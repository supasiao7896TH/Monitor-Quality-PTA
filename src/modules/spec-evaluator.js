/**
 * Robust multi-band spec/warn text parser.
 * Real LIMS exports encode limits in several inconsistent shapes
 * (e.g. "1.8 < X < 3.0", "X <= 5", "<= 5", "1.8 - 3.0", or two disjoint
 * bands like "<1.8 < X > 3.0"); this module normalizes all of them into
 * `{ min, max }` band objects.
 */
export const SpecEvaluator = (() => {
    function normalize(s) {
        return String(s || '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // "min <=X<= max" / "min < X < max" three-part range
    function parseThreePart(s) {
        const m = s.match(/^(-?\d+\.?\d*)\s*(<=|<)\s*X\s*(<=|<)\s*(-?\d+\.?\d*)$/i);
        if (!m) return null;
        return { min: parseFloat(m[1]), max: parseFloat(m[4]) };
    }

    // "X <= n" / "X >= n" / "X < n" / "X > n"
    function parseXFirst(s) {
        const m = s.match(/^X\s*(<=|>=|<|>)\s*(-?\d+\.?\d*)$/i);
        if (!m) return null;
        const [, op, nStr] = m;
        const n = parseFloat(nStr);
        if (op === '<=' || op === '<') return { min: -Infinity, max: n };
        return { min: n, max: Infinity };
    }

    // "n <= X" / "n >= X" / "n < X" / "n > X"
    function parseXLast(s) {
        const m = s.match(/^(-?\d+\.?\d*)\s*(<=|>=|<|>)\s*X$/i);
        if (!m) return null;
        const [, nStr, op] = m;
        const n = parseFloat(nStr);
        if (op === '<=' || op === '<') return { min: n, max: Infinity }; // n<=X => X>=n
        return { min: -Infinity, max: n }; // n>=X => X<=n
    }

    // plain "<=n" / ">=n" without X
    function parseBareOp(s) {
        const m = s.match(/^(<=|>=|<|>)\s*(-?\d+\.?\d*)$/);
        if (!m) return null;
        const [, op, nStr] = m;
        const n = parseFloat(nStr);
        if (op === '<=' || op === '<') return { min: -Infinity, max: n };
        return { min: n, max: Infinity };
    }

    // plain "min - max" range
    function parseRange(s) {
        const m = s.match(/^(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)$/);
        if (!m) return null;
        return { min: parseFloat(m[1]), max: parseFloat(m[2]) };
    }

    // a single side of a two-band expression: either a full range, or a bare
    // number whose direction is inferred from the operator adjacent to X
    function parseSide(part, side, op) {
        const trimmed = part.trim();
        const range = parseRange(trimmed);
        if (range) return range;
        const n = parseFloat(trimmed);
        if (isNaN(n)) return null;
        const isLessOp = op === '<' || op === '<=';
        if (side === 'left') {
            // format was "N <op> X" e.g. "1.8 < X" means X > 1.8
            return isLessOp ? { min: n, max: Infinity } : { min: -Infinity, max: n };
        }
        // side === 'right': format was "X <op> N" e.g. "X > 3.0" means X > 3.0
        return isLessOp ? { min: -Infinity, max: n } : { min: n, max: Infinity };
    }

    function parseSingleBand(s) {
        s = s.trim();
        if (s === '' || s === '-') return null;
        return parseThreePart(s) || parseXFirst(s) || parseXLast(s) || parseBareOp(s) || parseRange(s) || null;
    }

    // Real LIMS exports sometimes encode two disjoint warning bands as
    // "<left> < X > <right>" — the < / > here are separators, not always
    // strict inequalities, so each side is parsed independently.
    /**
     * @param {string} rawSpecStr
     * @returns {?Array<{min:number,max:number}>}
     */
    function parseBands(rawSpecStr) {
        const s = normalize(rawSpecStr);
        if (s === '' || s === '-') return null;

        const twoBand = s.match(/^(.+?)(<=|<)\s*X\s*(>=|>)(.+)$/i);
        if (twoBand) {
            const [, leftPart, leftOp, rightOp, rightPart] = twoBand;
            const left = parseSide(leftPart, 'left', leftOp);
            const right = parseSide(rightPart, 'right', rightOp);
            const bands = [left, right].filter(Boolean);
            return bands.length ? bands : null;
        }

        const single = parseSingleBand(s);
        return single ? [single] : null;
    }

    /**
     * @param {number} value
     * @param {?Array<{min:number,max:number}>} bands
     * @returns {boolean}
     */
    function isWithinBands(value, bands) {
        if (!bands) return true; // no spec defined -> always considered normal
        return bands.some(b => value >= b.min && value <= b.max);
    }

    return { parseBands, isWithinBands };
})();
