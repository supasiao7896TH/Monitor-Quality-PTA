/**
 * Factor -> Item severity correlation matrix from PTA-Quality-Control.md §3
 * (source: PTA Quality Characteristics Rev.14.xls, correlation grid sheet).
 * level: '◎' High effect, '○' Medium effect, '▷' Low effect.
 *
 * Rebuilt 2026-08-10 by reading the sheet's Shapes collection directly via
 * Excel COM automation (each shape's TopLeftCell gives its exact row/column,
 * and its AutoShapeType identifies triangle/circle/double-circle) — not by
 * visually reading a PDF render, which produced a materially wrong first
 * version of this matrix (caught when the user compared the app's advice
 * against the SOP directly). Validated against the user's two independently
 * confirmed columns (APS, P-TA) with an exact 16/16 match before being
 * trusted for the remaining columns. See PTA-Quality-Control.md §3 for the
 * full extraction writeup.
 */
export const CorrelationMatrix = (() => {
    const ENTRIES = [
        { factor: 'CTA T-340', item: 'T-340', level: '◎' },
        { factor: 'CTA T-340', item: 'T-400', level: '◎' },
        { factor: 'CTA 4-CBA', item: 'P-TA', level: '◎' },
        { factor: 'CTA 4-CBA', item: '4CBA', level: '○' },
        { factor: 'Reprocess from TTK-401', item: 'T-340', level: '◎' },
        { factor: 'Reprocess from TTK-401', item: 'T-400', level: '◎' },
        { factor: 'Reprocess from TTK-401', item: 'P-TA', level: '○' },
        { factor: 'Reprocess from TTK-401', item: '4CBA', level: '○' },
        { factor: 'CTA feed rate', item: 'T-400', level: '◎' },
        { factor: 'CTA feed rate', item: 'T-340', level: '◎' },
        { factor: 'CTA feed rate', item: 'b-value', level: '○' },
        { factor: 'CTA feed rate', item: 'P-TA', level: '○' },
        { factor: 'CTA feed rate', item: 'APS', level: '○' },
        { factor: 'CTA feed rate', item: '4CBA', level: '○' },
        { factor: 'CTA feed rate', item: 'BFM', level: '○' },
        { factor: 'Slurry density', item: 'APS', level: '▷' },
        { factor: 'Slurry density', item: 'P-TA', level: '▷' },
        { factor: 'Slurry density', item: 'T-400', level: '▷' },
        { factor: 'Slurry density', item: 'T-340', level: '▷' },
        { factor: 'Slurry density', item: 'BFM', level: '○' },
        { factor: 'Hot oil flow rate', item: 'BFM', level: '○' },
        { factor: 'H2 purity', item: 'T-400', level: '▷' },
        { factor: 'H2 purity', item: 'T-340', level: '▷' },
        { factor: 'H2 purity', item: '4CBA', level: '▷' },
        { factor: 'Reactor pressure', item: 'b-value', level: '◎' },
        { factor: 'Reactor pressure', item: '4CBA', level: '◎' },
        { factor: 'Reactor pressure', item: 'APS', level: '◎' },
        { factor: 'Reactor pressure', item: 'T-340', level: '▷' },
        { factor: 'Reactor pressure', item: 'T-400', level: '▷' },
        { factor: 'Reactor pressure', item: 'P-TA', level: '▷' },
        { factor: 'Reactor pressure', item: 'Fe', level: '○' },
        { factor: 'PCV-2201.MV', item: 'APS', level: '◎' },
        { factor: 'Pressure of PD-301', item: 'APS', level: '◎' },
        { factor: 'Pressure of PD-301', item: 'T-400', level: '▷' },
        { factor: 'Pressure of PD-301', item: 'T-340', level: '▷' },
        { factor: 'Level of PD-301', item: 'APS', level: '◎' },
        { factor: 'Level of PD-301', item: 'T-340', level: '▷' },
        { factor: 'Level of PD-301', item: 'T-400', level: '▷' },
        { factor: 'Level of PD-301', item: 'P-TA', level: '▷' },
        { factor: 'Temperature of reslurry water', item: 'T-400', level: '▷' },
        { factor: 'Temperature of reslurry water', item: 'T-340', level: '▷' },
        { factor: 'Reslurry water to PM-401', item: 'T-400', level: '▷' },
        { factor: 'Reslurry water to PM-401', item: 'T-340', level: '▷' },
        { factor: 'Reslurry water to PM-401', item: 'P-TA', level: '○' },
        { factor: 'LPW to suction PP-304', item: 'P-TA', level: '◎' },
        { factor: 'RPF Torque', item: 'Apperance', level: '◎' },
        { factor: 'RPF Torque', item: 'BFM', level: '◎' },
        { factor: 'CoAc flow rate', item: 'Co', level: '◎' },
        { factor: 'Rinse Ratio RPF', item: 'P-TA', level: '◎' },
        { factor: 'Recycle water', item: 'P-TA', level: '○' },
        { factor: 'Dryout Temperature', item: 'Moisture', level: '◎' },
        { factor: 'Dryout Temperature', item: 'Apperance', level: '○' },
        { factor: 'Dryer steam pressure', item: 'Moisture', level: '◎' },
        { factor: 'Dryer steam pressure', item: 'Apperance', level: '○' },
        { factor: 'Vibration screen', item: 'Apperance', level: '◎' }
    ];

    const LEVEL_RANK = { '◎': 3, '○': 2, '▷': 1 };

    // "4-CBA" / "4 CBA" / "4cba" all collapse to the same key; also folds the
    // source document's "Apperance" typo together with the correct spelling,
    // since real LIMS exports may use either.
    function normalize(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[\s\-_]/g, '')
            .replace(/^apperance$/, 'appearance');
    }

    /**
     * Factors known to affect the given quality item, ranked High -> Medium -> Low.
     * Matches by normalized substring (LIMS param names sometimes carry extra
     * text), so an item with no entries in the matrix returns an empty array —
     * callers should fall back to generic advice rather than treat that as "no effect".
     * @param {string} itemName @returns {Array<{factor:string, item:string, level:string}>}
     */
    function getRankedFactorsForItem(itemName) {
        const needle = normalize(itemName);
        if (!needle) return [];
        return ENTRIES
            .filter(e => normalize(e.item) === needle || needle.includes(normalize(e.item)) || normalize(e.item).includes(needle))
            .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);
    }

    return { ENTRIES, getRankedFactorsForItem };
})();
