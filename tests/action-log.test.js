import { describe, it, expect, vi, beforeEach } from 'vitest';

// ActionLog pulls in STORAGE_ENGINE (IndexedDB), which doesn't exist in the
// Vitest/Node test environment — stub it so checkOutcomes can be tested
// without a real browser.
vi.mock('../src/modules/storage-engine.js', () => ({
    STORAGE_ENGINE: {
        getActionsBySheetParam: vi.fn(),
        updateAction: vi.fn()
    }
}));

const { STORAGE_ENGINE } = await import('../src/modules/storage-engine.js');
const { ActionLog } = await import('../src/modules/action-log.js');

describe('ActionLog.deviationBucket', () => {
    const specBands = [{ min: 1, max: 10 }]; // width = 9, severe threshold = 0.9

    it('returns "unknown" when there is no spec to compare against', () => {
        expect(ActionLog.deviationBucket(15, null)).toBe('unknown');
    });

    it('buckets values inside the spec as near-spec', () => {
        expect(ActionLog.deviationBucket(5, specBands)).toBe('near-spec');
    });

    it('buckets values just above max as high-moderate, far above as high-severe', () => {
        expect(ActionLog.deviationBucket(10.5, specBands)).toBe('high-moderate');
        expect(ActionLog.deviationBucket(15, specBands)).toBe('high-severe');
    });

    it('buckets values just below min as low-moderate, far below as low-severe', () => {
        expect(ActionLog.deviationBucket(0.5, specBands)).toBe('low-moderate');
        expect(ActionLog.deviationBucket(-5, specBands)).toBe('low-severe');
    });
});

describe('ActionLog.checkOutcomes', () => {
    beforeEach(() => {
        STORAGE_ENGINE.getActionsBySheetParam.mockReset();
        STORAGE_ENGINE.updateAction.mockReset();
    });

    const params = [{ name: 'X', specText: '1 <= X <= 10' }];

    it('marks a pending action as success once a later sample recovers into spec', async () => {
        const pendingAction = {
            sheetParam: 'Sheet1::X', sheet: 'Sheet1', paramName: 'X',
            triggerTimestamp: 1000, createdAt: 1000, outcome: 'pending', followUpChecked: []
        };
        STORAGE_ENGINE.getActionsBySheetParam.mockResolvedValue([pendingAction]);

        const samples = [
            { sampleId: 's1', timestamp: 2000, values: { X: { numeric: 5, pending: false } } }
        ];

        await ActionLog.checkOutcomes('Sheet1', 'X', samples, params);

        expect(pendingAction.outcome).toBe('success');
        expect(STORAGE_ENGINE.updateAction).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'success' }));
    });

    it('marks a pending action as fail after 3 follow-up samples still outside spec', async () => {
        const pendingAction = {
            sheetParam: 'Sheet1::X', sheet: 'Sheet1', paramName: 'X',
            triggerTimestamp: 1000, createdAt: 1000, outcome: 'pending', followUpChecked: []
        };
        STORAGE_ENGINE.getActionsBySheetParam.mockResolvedValue([pendingAction]);

        const samples = [
            { sampleId: 's1', timestamp: 2000, values: { X: { numeric: 15, pending: false } } },
            { sampleId: 's2', timestamp: 3000, values: { X: { numeric: 16, pending: false } } },
            { sampleId: 's3', timestamp: 4000, values: { X: { numeric: 17, pending: false } } }
        ];

        await ActionLog.checkOutcomes('Sheet1', 'X', samples, params);

        expect(pendingAction.outcome).toBe('fail');
    });

    it('leaves the action pending when there are not yet 3 follow-ups and none recovered', async () => {
        const pendingAction = {
            sheetParam: 'Sheet1::X', sheet: 'Sheet1', paramName: 'X',
            triggerTimestamp: 1000, createdAt: 1000, outcome: 'pending', followUpChecked: []
        };
        STORAGE_ENGINE.getActionsBySheetParam.mockResolvedValue([pendingAction]);

        const samples = [
            { sampleId: 's1', timestamp: 2000, values: { X: { numeric: 15, pending: false } } }
        ];

        await ActionLog.checkOutcomes('Sheet1', 'X', samples, params);

        expect(pendingAction.outcome).toBe('pending');
    });
});

describe('ActionLog.getEffectStats', () => {
    beforeEach(() => {
        STORAGE_ENGINE.getActionsBySheetParam.mockReset();
    });

    function successAction(overrides) {
        return {
            sheetParam: 'Sheet1::4-CBA', sheet: 'Sheet1', paramName: '4-CBA',
            bucket: 'high-moderate', controlVariable: 'Slurry density',
            triggerValue: 4600, resultValue: 4400,
            fromValue: '1.085', toValue: '1.082', unit: 'g/cm3',
            outcome: 'success',
            ...overrides
        };
    }

    it('returns null when fewer than 3 usable data points exist', async () => {
        STORAGE_ENGINE.getActionsBySheetParam.mockResolvedValue([successAction(), successAction()]);

        const stats = await ActionLog.getEffectStats('Sheet1', '4-CBA', 'high-moderate', 'Slurry density');

        expect(stats).toBeNull();
    });

    it('ignores actions with unparseable from/to values or a different control variable/bucket', async () => {
        STORAGE_ENGINE.getActionsBySheetParam.mockResolvedValue([
            successAction(),
            successAction(),
            successAction(),
            successAction({ fromValue: 'n/a' }), // unparseable -> excluded
            successAction({ controlVariable: 'Reactor pressure' }), // different control var -> excluded
            successAction({ bucket: 'low-moderate' }), // different bucket -> excluded
            successAction({ outcome: 'pending', resultValue: null }) // not a success -> excluded
        ]);

        const stats = await ActionLog.getEffectStats('Sheet1', '4-CBA', 'high-moderate', 'Slurry density');

        expect(stats.n).toBe(3);
    });

    it('computes the average parameter and control-variable deltas from matching actions', async () => {
        STORAGE_ENGINE.getActionsBySheetParam.mockResolvedValue([
            successAction({ triggerValue: 4600, resultValue: 4400, fromValue: '1.085', toValue: '1.082' }), // Δparam -200, Δcontrol -0.003
            successAction({ triggerValue: 4700, resultValue: 4500, fromValue: '1.086', toValue: '1.083' }), // Δparam -200, Δcontrol -0.003
            successAction({ triggerValue: 4650, resultValue: 4450, fromValue: '1.084', toValue: '1.081' })  // Δparam -200, Δcontrol -0.003
        ]);

        const stats = await ActionLog.getEffectStats('Sheet1', '4-CBA', 'high-moderate', 'Slurry density');

        expect(stats.n).toBe(3);
        expect(stats.avgDeltaParam).toBeCloseTo(-200, 5);
        expect(stats.avgDeltaControl).toBeCloseTo(-0.003, 5);
        expect(stats.unit).toBe('g/cm3');
    });

    it('flags a calculated average that is wildly outside the SOP\'s documented Fine/Fast tune step', async () => {
        // Slurry density SOP step is 0.001 (fine) ~ 0.002-0.005 (fast) g/cm3 (app-config.js) —
        // an average delta of 1.0 is >3x the fast-tune max, so it should be flagged, not trusted blindly.
        STORAGE_ENGINE.getActionsBySheetParam.mockResolvedValue([
            successAction({ fromValue: '1.085', toValue: '2.085' }),
            successAction({ fromValue: '1.086', toValue: '2.086' }),
            successAction({ fromValue: '1.084', toValue: '2.084' })
        ]);

        const stats = await ActionLog.getEffectStats('Sheet1', '4-CBA', 'high-moderate', 'Slurry density');

        expect(stats.sopFlag).toBe('above-sop-range');
    });

    it('leaves sopFlag null for a control variable not listed in APP_CONFIG.CONTROL_VARIABLES', async () => {
        STORAGE_ENGINE.getActionsBySheetParam.mockResolvedValue([
            successAction({ controlVariable: 'Unknown Valve' }),
            successAction({ controlVariable: 'Unknown Valve' }),
            successAction({ controlVariable: 'Unknown Valve' })
        ]);

        const stats = await ActionLog.getEffectStats('Sheet1', '4-CBA', 'high-moderate', 'Unknown Valve');

        expect(stats.sopFlag).toBeNull();
    });
});
