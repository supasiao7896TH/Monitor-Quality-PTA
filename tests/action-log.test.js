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
