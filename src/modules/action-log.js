import { STORAGE_ENGINE } from './storage-engine.js';
import { SpecEvaluator } from './spec-evaluator.js';
import { APP_CONFIG } from './app-config.js';

/** Deviation bucketing + recommendation lookup for logged corrective actions. */
export const ActionLog = (() => {
    function sheetParamKey(sheet, paramName) { return `${sheet}::${paramName}`; }

    // Classify how far off a value is, relative to the spec width, so past
    // actions can be matched against similarly-shaped deviations later.
    /** @param {number} value @param {?Array<{min:number,max:number}>} specBands @returns {string} */
    function deviationBucket(value, specBands) {
        if (!specBands || specBands.length === 0) return 'unknown';
        const finiteMins = specBands.map(b => b.min).filter(Number.isFinite);
        const finiteMaxs = specBands.map(b => b.max).filter(Number.isFinite);
        const specMin = finiteMins.length ? Math.min(...finiteMins) : null;
        const specMax = finiteMaxs.length ? Math.max(...finiteMaxs) : null;
        const width = (specMin !== null && specMax !== null) ? (specMax - specMin) : Math.abs(value) || 1;

        if (specMax !== null && value > specMax) {
            return (value - specMax) > width * 0.1 ? 'high-severe' : 'high-moderate';
        }
        if (specMin !== null && value < specMin) {
            return (specMin - value) > width * 0.1 ? 'low-severe' : 'low-moderate';
        }
        return 'near-spec';
    }

    async function logAction({ sheet, paramName, triggerValue, triggerTimestamp, bucket, controlVariable, fromValue, toValue, unit, note, actionTimestamp }) {
        const record = {
            sheetParam: sheetParamKey(sheet, paramName),
            sheet, paramName, triggerValue, bucket, controlVariable,
            fromValue, toValue, unit, note,
            createdAt: actionTimestamp,
            triggerTimestamp, // reference point for outcome look-forward, independent of when the form was filled in
            outcome: 'pending',
            outcomeAt: null,
            resultValue: null, // paramName's value at the follow-up sample that confirmed recovery (set by checkOutcomes)
            resultTimestamp: null,
            followUpChecked: []
        };
        return STORAGE_ENGINE.addAction(record);
    }

    async function findSimilarActions(sheet, paramName, bucket) {
        const all = await STORAGE_ENGINE.getActionsBySheetParam(sheetParamKey(sheet, paramName));
        return all
            .filter(a => a.bucket === bucket)
            .sort((a, b) => {
                const rank = (x) => x.outcome === 'success' ? 2 : (x.outcome === 'pending' ? 1 : 0);
                const r = rank(b) - rank(a);
                return r !== 0 ? r : b.createdAt - a.createdAt;
            });
    }

    // After new data lands, check pending actions against later samples of the
    // same parameter to see whether the value recovered back into spec.
    async function checkOutcomes(sheet, paramName, samples, params) {
        const param = params.find(p => p.name === paramName);
        if (!param) return;
        const actions = await STORAGE_ENGINE.getActionsBySheetParam(sheetParamKey(sheet, paramName));
        const pending = actions.filter(a => a.outcome === 'pending');
        if (pending.length === 0) return;

        const specBands = SpecEvaluator.parseBands(param.specText);
        for (const action of pending) {
            const since = action.triggerTimestamp || action.createdAt;
            const followUps = samples
                .filter(s => s.timestamp > since)
                .filter(s => s.values[paramName] && s.values[paramName].numeric !== null)
                .slice(0, 3);
            if (followUps.length === 0) continue;

            const newlyChecked = followUps.map(s => s.sampleId).filter(id => !action.followUpChecked.includes(id));
            if (newlyChecked.length === 0) continue;
            action.followUpChecked.push(...newlyChecked);

            const recovered = followUps.find(s => SpecEvaluator.isWithinBands(s.values[paramName].numeric, specBands));
            if (recovered) {
                action.outcome = 'success';
                action.outcomeAt = Date.now();
                action.resultValue = recovered.values[paramName].numeric;
                action.resultTimestamp = recovered.timestamp;
            } else if (action.followUpChecked.length >= 3) {
                action.outcome = 'fail';
                action.outcomeAt = Date.now();
            }
            await STORAGE_ENGINE.updateAction(action);
        }
    }

    // Pull every number out of a free-text SOP step string (e.g. "0.002-0.005 g/cm3"),
    // ignoring "-" / blank entries that mean "no documented step". The lookbehind/
    // lookahead exclude digits glued directly onto letters (the "3" in "g/cm3", the
    // "2" in "kg/cm2", the "1" in ">1Hr") so unit suffixes don't get parsed as data.
    function parseSopNumbers(text) {
        if (!text || text === '-') return [];
        const matches = String(text).match(/(?<![a-zA-Z])-?\d+(\.\d+)?(?![a-zA-Z])/g);
        return matches ? matches.map(Number) : [];
    }

    // Envelope of documented adjustment sizes (Fine tune ~ Fast/Emergency tune) for a
    // control variable, taken from APP_CONFIG.CONTROL_VARIABLES. Returns null when the
    // SOP has no numeric step for that factor (e.g. "-", or the factor isn't listed).
    function sopStepEnvelope(controlVariable) {
        const factor = APP_CONFIG.CONTROL_VARIABLES.find(cv => cv.name === controlVariable);
        if (!factor) return null;
        const nums = [...parseSopNumbers(factor.fineTune), ...parseSopNumbers(factor.fastTune)].map(Math.abs);
        if (nums.length === 0) return null;
        return { min: Math.min(...nums), max: Math.max(...nums) };
    }

    // Sanity-check a calculated average adjustment against the SOP's documented step
    // range, so getEffectStats doesn't silently present a number that's wildly outside
    // what operators actually do in practice. Thresholds (3x / 0.2x) are a loose flag,
    // not a hard SOP limit — the calculated stats are shown regardless.
    function checkAgainstSop(avgDeltaControl, controlVariable) {
        const envelope = sopStepEnvelope(controlVariable);
        if (!envelope) return null;
        const abs = Math.abs(avgDeltaControl);
        if (abs > envelope.max * 3) return 'above-sop-range';
        if (envelope.min > 0 && abs < envelope.min * 0.2) return 'below-sop-range';
        return 'within-sop-range';
    }

    // Data-driven effect size: from past *successful* actions matching this
    // sheet/param/bucket/controlVariable, how much did the control variable typically
    // move, and how much did the parameter typically move in response? Returns null
    // (never a guess) when fewer than 3 usable data points exist.
    async function getEffectStats(sheet, paramName, bucket, controlVariable) {
        const all = await STORAGE_ENGINE.getActionsBySheetParam(sheetParamKey(sheet, paramName));
        const usable = all.filter(a =>
            a.outcome === 'success' &&
            a.bucket === bucket &&
            a.controlVariable === controlVariable &&
            a.resultValue !== null && a.resultValue !== undefined &&
            Number.isFinite(parseFloat(a.fromValue)) &&
            Number.isFinite(parseFloat(a.toValue))
        );
        if (usable.length < 3) return null;

        const deltaParams = usable.map(a => a.resultValue - a.triggerValue);
        const deltaControls = usable.map(a => parseFloat(a.toValue) - parseFloat(a.fromValue));
        const avg = (arr) => arr.reduce((sum, v) => sum + v, 0) / arr.length;
        const avgDeltaParam = avg(deltaParams);
        const avgDeltaControl = avg(deltaControls);

        return {
            n: usable.length,
            avgDeltaParam,
            avgDeltaControl,
            unit: usable[usable.length - 1].unit || '',
            sopFlag: checkAgainstSop(avgDeltaControl, controlVariable)
        };
    }

    return { deviationBucket, logAction, findSimilarActions, checkOutcomes, getEffectStats };
})();
