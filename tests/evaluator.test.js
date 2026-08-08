import { describe, it, expect } from 'vitest';
import { SpecEvaluator } from '../src/modules/spec-evaluator.js';
import { Evaluator } from '../src/modules/evaluator.js';

describe('SpecEvaluator.parseBands — LIMS export formats', () => {
    it('parses three-part range "min <= X <= max"', () => {
        expect(SpecEvaluator.parseBands('1.8 <= X <= 3.0')).toEqual([{ min: 1.8, max: 3.0 }]);
    });

    it('parses "X <= n" as an upper bound', () => {
        expect(SpecEvaluator.parseBands('X <= 5')).toEqual([{ min: -Infinity, max: 5 }]);
    });

    it('parses "n <= X" as a lower bound', () => {
        expect(SpecEvaluator.parseBands('5 <= X')).toEqual([{ min: 5, max: Infinity }]);
    });

    it('parses a bare operator "<= n" without X', () => {
        expect(SpecEvaluator.parseBands('<= 5')).toEqual([{ min: -Infinity, max: 5 }]);
    });

    it('parses a plain "min - max" range', () => {
        expect(SpecEvaluator.parseBands('1.8 - 3.0')).toEqual([{ min: 1.8, max: 3.0 }]);
    });

    it('returns null for empty or "-" spec text (no spec defined)', () => {
        expect(SpecEvaluator.parseBands('')).toBeNull();
        expect(SpecEvaluator.parseBands('-')).toBeNull();
    });
});

describe('SpecEvaluator.isWithinBands', () => {
    it('treats "no bands" as always normal', () => {
        expect(SpecEvaluator.isWithinBands(999, null)).toBe(true);
    });

    it('checks value against min/max inclusively', () => {
        const bands = [{ min: 1, max: 5 }];
        expect(SpecEvaluator.isWithinBands(1, bands)).toBe(true);
        expect(SpecEvaluator.isWithinBands(5, bands)).toBe(true);
        expect(SpecEvaluator.isWithinBands(5.01, bands)).toBe(false);
    });
});

describe('Evaluator.evaluate', () => {
    const param = { specText: '1 <= X <= 10', warnText: '8 <= X <= 10' };

    it('classifies missing/pending values without checking bands', () => {
        expect(Evaluator.evaluate(param, null, null).status).toBe('na');
        expect(Evaluator.evaluate(param, { numeric: null, pending: true }, null).status).toBe('pending');
    });

    it('classifies a value outside spec as oos, even if it would also be in the warn range', () => {
        const result = Evaluator.evaluate(param, { numeric: 15, pending: false }, null);
        expect(result.status).toBe('oos');
    });

    it('classifies a value inside a file-defined warn band as warn', () => {
        const result = Evaluator.evaluate(param, { numeric: 9, pending: false }, null);
        expect(result.status).toBe('warn');
        expect(result.warnSource).toBe('file');
    });

    it('classifies an in-spec value outside the warn band as normal', () => {
        const result = Evaluator.evaluate(param, { numeric: 5, pending: false }, null);
        expect(result.status).toBe('normal');
    });

    it('falls back to the statistical baseline band when no warn text is provided', () => {
        const paramNoWarn = { specText: '1 <= X <= 10', warnText: '' };
        const baseline = { mean: 5, sd: 1, n: 5 }; // baselineBand -> [{min:3, max:7}]
        const result = Evaluator.evaluate(paramNoWarn, { numeric: 6, pending: false }, baseline);
        expect(result.status).toBe('warn');
        expect(result.warnSource).toBe('stat');
    });
});
