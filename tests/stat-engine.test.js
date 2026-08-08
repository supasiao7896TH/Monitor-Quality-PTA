import { describe, it, expect } from 'vitest';
import { StatEngine } from '../src/modules/stat-engine.js';

describe('StatEngine.computeBaselineFromValues', () => {
    it('returns null with fewer than 5 values (not enough history)', () => {
        expect(StatEngine.computeBaselineFromValues([1, 2, 3, 4])).toBeNull();
    });

    it('computes mean/sd/n once there are 5+ values', () => {
        const result = StatEngine.computeBaselineFromValues([10, 12, 11, 13, 9]);
        expect(result.n).toBe(5);
        expect(result.mean).toBeCloseTo(11, 10);
        expect(result.sd).toBeCloseTo(Math.sqrt(2), 10);
    });
});

describe('StatEngine.computeBaseline', () => {
    it('excludes out-of-spec values so a drifting run cannot widen its own baseline', () => {
        // This is the exact bug documented in PROGRESS.md: unfiltered baseline
        // self-references drifting/OOS data instead of staying anchored to good history.
        const samples = [
            { values: { X: { numeric: 10, pending: false } } },
            { values: { X: { numeric: 11, pending: false } } },
            { values: { X: { numeric: 10, pending: false } } },
            { values: { X: { numeric: 11, pending: false } } },
            { values: { X: { numeric: 10, pending: false } } },
            { values: { X: { numeric: 999, pending: false } } } // clearly OOS spike
        ];
        const specBands = [{ min: 0, max: 20 }];
        const baseline = StatEngine.computeBaseline(samples, 'X', specBands);
        expect(baseline.mean).toBeCloseTo(10.4, 10); // only the 5 in-spec values count
    });
});

describe('StatEngine.computeRollingBaselines', () => {
    it('has no baseline until 5 in-spec values have accumulated, then reflects the trailing window', () => {
        const samples = [1, 2, 3, 4, 5, 6].map(numeric => ({ values: { X: { numeric, pending: false } } }));
        const baselines = StatEngine.computeRollingBaselines(samples, 'X', null);
        expect(baselines.slice(0, 5)).toEqual([null, null, null, null, null]);
        expect(baselines[5].mean).toBeCloseTo(3, 10); // window = [1,2,3,4,5], as of just before sample index 5
    });
});

describe('StatEngine.baselineBand', () => {
    it('returns null when there is no baseline or sd is 0', () => {
        expect(StatEngine.baselineBand(null)).toBeNull();
        expect(StatEngine.baselineBand({ mean: 5, sd: 0, n: 5 })).toBeNull();
    });

    it('bands mean +/- k*sd (k = APP_CONFIG.BASELINE_K = 2)', () => {
        const band = StatEngine.baselineBand({ mean: 5, sd: 1, n: 5 });
        expect(band).toEqual([{ min: 3, max: 7 }]);
    });
});
