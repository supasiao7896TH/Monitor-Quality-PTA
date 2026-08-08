import { STORAGE_ENGINE } from './storage-engine.js';
import { SpecEvaluator } from './spec-evaluator.js';

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

            const recovered = followUps.some(s => SpecEvaluator.isWithinBands(s.values[paramName].numeric, specBands));
            if (recovered) {
                action.outcome = 'success';
                action.outcomeAt = Date.now();
            } else if (action.followUpChecked.length >= 3) {
                action.outcome = 'fail';
                action.outcomeAt = Date.now();
            }
            await STORAGE_ENGINE.updateAction(action);
        }
    }

    return { deviationBucket, logAction, findSimilarActions, checkOutcomes };
})();
