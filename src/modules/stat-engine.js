import { APP_CONFIG } from './app-config.js';
import { SpecEvaluator } from './spec-evaluator.js';

/** Rolling statistical baseline (mean/SD), used as a warn-band fallback when the file has no explicit warning spec. */
export const StatEngine = (() => {
    /** @param {number[]} values @returns {?{mean:number, sd:number, n:number}} */
    function computeBaselineFromValues(values) {
        if (values.length < 5) return null; // not enough history to be meaningful
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
        const sd = Math.sqrt(variance);
        return { mean, sd, n: values.length };
    }

    // Excludes values already outside the spec, so a drifting/OOS run of samples
    // can't widen its own warn band and get statistically relabeled as "normal".
    function computeBaseline(samples, paramName, specBands) {
        const values = samples
            .map(s => s.values[paramName])
            .filter(v => v && v.numeric !== null && v.pending === false && SpecEvaluator.isWithinBands(v.numeric, specBands))
            .slice(-APP_CONFIG.BASELINE_WINDOW)
            .map(v => v.numeric);
        return computeBaselineFromValues(values);
    }

    function baselineBand(baseline) {
        if (!baseline || baseline.sd === 0) return null;
        const k = APP_CONFIG.BASELINE_K;
        return [{ min: baseline.mean - k * baseline.sd, max: baseline.mean + k * baseline.sd }];
    }

    // One pass per parameter: keeps a bounded window of in-spec values and returns
    // the "as of just before this sample" baseline for every index, so callers don't
    // need to re-filter/re-reduce the whole history per row (that was O(n^2)).
    function computeRollingBaselines(samples, paramName, specBands) {
        const window = [];
        const baselines = new Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            baselines[i] = computeBaselineFromValues(window);
            const v = samples[i].values[paramName];
            if (v && v.numeric !== null && v.pending === false && SpecEvaluator.isWithinBands(v.numeric, specBands)) {
                window.push(v.numeric);
                if (window.length > APP_CONFIG.BASELINE_WINDOW) window.shift();
            }
        }
        return baselines;
    }

    return { computeBaseline, computeBaselineFromValues, computeRollingBaselines, baselineBand };
})();
