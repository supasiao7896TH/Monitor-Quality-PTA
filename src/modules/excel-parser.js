/* global XLSX */
/** Multi-sheet Excel parsing with dynamic header-block detection (LIMS export layout). */
export const ExcelParser = (() => {
    const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

    function parseLimsDateTime(str) {
        const m = String(str || '').match(/(\d{1,2})-(\w{3})-(\d{4})\s+(\d{1,2}):(\d{2})/);
        if (!m) return null;
        const monthIdx = MONTHS[m[2]];
        if (monthIdx === undefined) return null;
        return new Date(Number(m[3]), monthIdx, Number(m[1]), Number(m[4]), Number(m[5])).getTime();
    }

    function parseValue(rawStr) {
        const str = String(rawStr || '').trim();
        if (str === '') return { numeric: null, text: '', pending: false };
        if (str === 'Initial' || str === 'Received') return { numeric: null, text: str, pending: true };
        const cleaned = str.replace(/\*/g, '').trim();
        const num = parseFloat(cleaned);
        if (isNaN(num)) return { numeric: null, text: str, pending: false }; // e.g. "White Powder"
        return { numeric: num, text: str, pending: false };
    }

    function findHeaderBlock(rows) {
        const headerRowIdx = rows.findIndex(r => String((r || [])[3] || '').trim() === 'Parameter');
        if (headerRowIdx === -1) return null;

        let idx = headerRowIdx + 1;
        let unitRow = null, methodRow = null, specRow = null, warnRow = null;
        while (idx < rows.length) {
            const label = String((rows[idx] || [])[3] || '').trim();
            if (label === 'Unit') { unitRow = rows[idx]; idx++; continue; }
            if (label === 'Test Method') { methodRow = rows[idx]; idx++; continue; }
            if (/^Specifications/i.test(label)) {
                if (/warning/i.test(label)) warnRow = rows[idx]; else specRow = rows[idx];
                idx++; continue;
            }
            break;
        }
        return { headerRow: rows[headerRowIdx], unitRow, methodRow, specRow, warnRow, dataStartIdx: idx };
    }

    function buildParams(headerRow, unitRow, methodRow, specRow, warnRow) {
        const params = [];
        for (let c = 4; c < headerRow.length; c++) {
            const name = String(headerRow[c] || '').trim();
            if (name === '') continue;
            params.push({
                colIndex: c,
                name,
                unit: String((unitRow || [])[c] || '').trim(),
                method: String((methodRow || [])[c] || '').trim(),
                specText: String((specRow || [])[c] || '').trim(),
                warnText: String((warnRow || [])[c] || '').trim()
            });
        }
        return params;
    }

    function isRowBlank(row) {
        return !row || row.every(v => String(v || '').trim() === '');
    }

    function parseDataRows(rows, dataStartIdx, params) {
        const samples = [];
        let i = dataStartIdx;
        while (i < rows.length) {
            const row = rows[i] || [];
            const col0 = String(row[0] || '').trim();
            const col1 = String(row[1] || '').trim();

            if (isRowBlank(row)) { i++; continue; }
            if (col0 === '' && /^off spec/i.test(col1)) { i++; continue; } // file's own flag, not used for logic

            if (col0 !== '') {
                let detail = null;
                const next = rows[i + 1];
                if (next && String(next[0] || '').trim() === '') {
                    const nCol1 = String(next[1] || '').trim();
                    const nCol2 = String(next[2] || '').trim();
                    if (nCol1.startsWith('(') || nCol2.startsWith('(')) { detail = next; }
                }
                const sampleId = String(row[2] || '').trim();
                const dateTimeRaw = String(row[3] || '').trim();
                const timestamp = parseLimsDateTime(dateTimeRaw);
                const status = detail ? String(detail[2] || '').replace(/[()]/g, '').trim() : 'Unknown';

                const values = {};
                params.forEach(p => {
                    const strA = String(row[p.colIndex] === undefined ? '' : row[p.colIndex]).trim();
                    const strB = detail ? String(detail[p.colIndex] === undefined ? '' : detail[p.colIndex]).trim() : '';
                    const mainStr = strB !== '' ? strB : strA;
                    const subStr = (strA !== '' && strA !== mainStr) ? strA : '';
                    values[p.name] = { mainRaw: mainStr, subRaw: subStr, ...parseValue(mainStr) };
                });

                if (sampleId !== '' && timestamp !== null) {
                    samples.push({ sampleId, dateTimeRaw, timestamp, status, values });
                }
                i += detail ? 2 : 1;
                continue;
            }
            i++;
        }
        return samples;
    }

    function parseWorkbook(workbook) {
        const result = {};
        workbook.SheetNames.forEach(sheetName => {
            const ws = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
            const block = findHeaderBlock(rows);
            if (!block) return;
            const params = buildParams(block.headerRow, block.unitRow, block.methodRow, block.specRow, block.warnRow);
            if (params.length === 0) return;
            const samples = parseDataRows(rows, block.dataStartIdx, params);
            if (samples.length === 0) return;
            result[sheetName] = { params, samples };
        });
        return result;
    }

    return { parseWorkbook };
})();
