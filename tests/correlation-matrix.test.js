import { describe, it, expect } from 'vitest';
import { CorrelationMatrix } from '../src/modules/correlation-matrix.js';

describe('CorrelationMatrix.getRankedFactorsForItem', () => {
    it('returns factors ranked High -> Medium -> Low effect', () => {
        const ranked = CorrelationMatrix.getRankedFactorsForItem('4CBA');
        const levels = ranked.map(r => r.level);
        const rank = { '◎': 3, '○': 2, '▷': 1 };
        for (let i = 1; i < levels.length; i++) {
            expect(rank[levels[i - 1]]).toBeGreaterThanOrEqual(rank[levels[i]]);
        }
    });

    // APS and P-TA are the two columns the plant confirmed end-to-end against the
    // SOP directly (2026-08-10) after the first version of this matrix — built from
    // a visual PDF read — turned out to have a column-misattribution bug. These two
    // pairs anchor that confirmed data, not a guess.
    it('includes the plant-confirmed Reactor pressure x APS = High effect pair', () => {
        const ranked = CorrelationMatrix.getRankedFactorsForItem('APS');
        const match = ranked.find(r => r.factor === 'Reactor pressure');
        expect(match).toBeDefined();
        expect(match.level).toBe('◎');
    });

    it('includes the plant-confirmed Slurry density x P-TA = Low effect pair', () => {
        const ranked = CorrelationMatrix.getRankedFactorsForItem('P-TA');
        const match = ranked.find(r => r.factor === 'Slurry density');
        expect(match).toBeDefined();
        expect(match.level).toBe('▷');
    });

    it('matches item names regardless of hyphen/space/case differences', () => {
        const withHyphen = CorrelationMatrix.getRankedFactorsForItem('4-CBA');
        const noHyphen = CorrelationMatrix.getRankedFactorsForItem('4CBA');
        const lower = CorrelationMatrix.getRankedFactorsForItem('4cba');
        expect(withHyphen.length).toBeGreaterThan(0);
        expect(noHyphen.map(r => r.factor).sort()).toEqual(withHyphen.map(r => r.factor).sort());
        expect(lower.map(r => r.factor).sort()).toEqual(withHyphen.map(r => r.factor).sort());
    });

    it('folds the source document\'s "Apperance" typo together with "Appearance"', () => {
        const typo = CorrelationMatrix.getRankedFactorsForItem('Apperance');
        const correct = CorrelationMatrix.getRankedFactorsForItem('Appearance');
        expect(typo.length).toBeGreaterThan(0);
        expect(correct.map(r => r.factor).sort()).toEqual(typo.map(r => r.factor).sort());
    });

    it('matches the LIMS export\'s "MPS (Laser)" name to the SOP matrix\'s "APS" item', () => {
        const mps = CorrelationMatrix.getRankedFactorsForItem('MPS (Laser)');
        const aps = CorrelationMatrix.getRankedFactorsForItem('APS');
        expect(mps.length).toBeGreaterThan(0);
        expect(mps.map(r => r.factor).sort()).toEqual(aps.map(r => r.factor).sort());
    });

    it('returns an empty array for an item with no entries in the matrix, never a guess', () => {
        expect(CorrelationMatrix.getRankedFactorsForItem('Some Unlisted Param')).toEqual([]);
        expect(CorrelationMatrix.getRankedFactorsForItem('')).toEqual([]);
        expect(CorrelationMatrix.getRankedFactorsForItem(null)).toEqual([]);
    });
});
