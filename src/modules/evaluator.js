import { SpecEvaluator } from './spec-evaluator.js';
import { StatEngine } from './stat-engine.js';

/** Per-parameter, per-value classification against spec/warn bands. */
export const Evaluator = (() => {
    /**
     * @param {{specText:string, warnText:string}} param
     * @param {?{numeric:?number, pending:boolean}} valueObj
     * @param {*} baseline precomputed StatEngine baseline for this param, as of just before this sample — see StatEngine.computeRollingBaselines
     * @returns {{status:('normal'|'warn'|'oos'|'pending'|'na'), specBands:?Array, warnBands:?Array, warnSource:?('file'|'stat')}}
     */
    function evaluate(param, valueObj, baseline) {
        if (!valueObj || valueObj.numeric === null) {
            return { status: valueObj && valueObj.pending ? 'pending' : 'na', specBands: null, warnBands: null, warnSource: null };
        }
        const value = valueObj.numeric;
        const specBands = SpecEvaluator.parseBands(param.specText);
        let warnBands = SpecEvaluator.parseBands(param.warnText);
        let warnSource = warnBands ? 'file' : null;

        if (!warnBands) {
            warnBands = StatEngine.baselineBand(baseline);
            if (warnBands) warnSource = 'stat';
        }

        const inSpec = SpecEvaluator.isWithinBands(value, specBands);
        if (!inSpec) return { status: 'oos', specBands, warnBands, warnSource };

        const inWarn = warnBands ? SpecEvaluator.isWithinBands(value, warnBands) : false;
        if (inWarn) return { status: 'warn', specBands, warnBands, warnSource };

        return { status: 'normal', specBands, warnBands, warnSource };
    }

    return { evaluate };
})();
