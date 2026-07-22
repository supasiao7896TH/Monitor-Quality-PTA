'use strict';

// ==========================================
// MODULE: APP_CONFIG
// ==========================================
const APP_CONFIG = (() => {
    const DB_NAME = 'PTAQualityDB';
    const DB_VERSION = 1;
    const DEFAULT_SHEET = '2PZ-402';
    const BASELINE_WINDOW = 30; // rolling window size for statistical fallback
    const BASELINE_K = 2; // mean +/- k*SD
    const CONTROL_VARIABLES = [
        'Rinse Ratio', 'Reactor Temperature', 'Catalyst Feed Rate',
        'Residence Time', 'Oxidation Air Rate', 'Solvent Ratio', 'Crystallizer Temperature'
    ];
    const STATUS = {
        IDLE: { text: 'Ready', class: 'status-glow-idle' },
        PROCESSING: { text: 'Processing...', class: 'status-glow-processing animate-pulse-fast' },
        ERROR: { text: 'Error', class: 'status-glow-error' }
    };
    return { DB_NAME, DB_VERSION, DEFAULT_SHEET, BASELINE_WINDOW, BASELINE_K, CONTROL_VARIABLES, STATUS };
})();

// ==========================================
// MODULE: STORAGE_ENGINE (IndexedDB)
// ==========================================
const STORAGE_ENGINE = (() => {
    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(APP_CONFIG.DB_NAME, APP_CONFIG.DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('samples')) {
                    const store = db.createObjectStore('samples', { keyPath: 'id' });
                    store.createIndex('sheet', 'sheet', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('sheetMeta')) {
                    db.createObjectStore('sheetMeta', { keyPath: 'sheet' });
                }
                if (!db.objectStoreNames.contains('actions')) {
                    const store = db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('sheetParam', 'sheetParam', { unique: false });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
        return dbPromise;
    }

    async function tx(storeNames, mode) {
        const db = await open();
        return db.transaction(storeNames, mode);
    }

    async function putSample(record) {
        const t = await tx(['samples'], 'readwrite');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('samples').put(record);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function putSheetMeta(record) {
        const t = await tx(['sheetMeta'], 'readwrite');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('sheetMeta').put(record);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getAllSamplesForSheet(sheet) {
        const t = await tx(['samples'], 'readonly');
        return new Promise((resolve, reject) => {
            const idx = t.objectStore('samples').index('sheet');
            const req = idx.getAll(IDBKeyRange.only(sheet));
            req.onsuccess = () => resolve(req.result.sort((a, b) => a.timestamp - b.timestamp));
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getAllSheetNames() {
        const t = await tx(['sheetMeta'], 'readonly');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('sheetMeta').getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getSheetMeta(sheet) {
        const t = await tx(['sheetMeta'], 'readonly');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('sheetMeta').get(sheet);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function addAction(record) {
        const t = await tx(['actions'], 'readwrite');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('actions').add(record);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function updateAction(record) {
        const t = await tx(['actions'], 'readwrite');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('actions').put(record);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getActionsBySheetParam(sheetParam) {
        const t = await tx(['actions'], 'readonly');
        return new Promise((resolve, reject) => {
            const idx = t.objectStore('actions').index('sheetParam');
            const req = idx.getAll(IDBKeyRange.only(sheetParam));
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getAllActions() {
        const t = await tx(['actions'], 'readonly');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('actions').getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function clearAll() {
        const t = await tx(['samples', 'sheetMeta', 'actions'], 'readwrite');
        return Promise.all([
            new Promise((res) => { t.objectStore('samples').clear().onsuccess = res; }),
            new Promise((res) => { t.objectStore('sheetMeta').clear().onsuccess = res; }),
            new Promise((res) => { t.objectStore('actions').clear().onsuccess = res; })
        ]);
    }

    return {
        putSample, putSheetMeta, getAllSamplesForSheet, getAllSheetNames, getSheetMeta,
        addAction, updateAction, getActionsBySheetParam, getAllActions, clearAll
    };
})();

// ==========================================
// MODULE: SpecEvaluator — robust multi-band spec/warn parser
// ==========================================
const SpecEvaluator = (() => {
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

    function isWithinBands(value, bands) {
        if (!bands) return true; // no spec defined -> always considered normal
        return bands.some(b => value >= b.min && value <= b.max);
    }

    return { parseBands, isWithinBands };
})();

// ==========================================
// MODULE: ExcelParser — multi-sheet, dynamic header detection
// ==========================================
const ExcelParser = (() => {
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

// ==========================================
// MODULE: StatEngine — rolling baseline fallback for warn band
// ==========================================
const StatEngine = (() => {
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

// ==========================================
// MODULE: Evaluation helpers (spec/warn classification per param+value)
// ==========================================
const Evaluator = (() => {
    // Returns { status: 'normal'|'warn'|'oos', specBands, warnBands, warnSource: 'file'|'stat'|null }
    // `baseline` is a precomputed StatEngine baseline (mean/sd) for this param as of
    // just before this sample — see StatEngine.computeRollingBaselines.
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

// ==========================================
// MODULE: ActionLog — deviation bucketing + recommendation lookup
// ==========================================
const ActionLog = (() => {
    function sheetParamKey(sheet, paramName) { return `${sheet}::${paramName}`; }

    // Classify how far off a value is, relative to the spec width, so past
    // actions can be matched against similarly-shaped deviations later.
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

// ==========================================
// MODULE: SmartAssistant — alert cards + advice + action recommendations
// ==========================================
const SmartAssistant = (() => {
    let alerts = [];
    let activeFilter = 'all'; // 'all' | 'warn' | 'oos'

    function getAdvice(paramName) {
        const name = paramName.toLowerCase();
        if (name.includes('4-cba')) return 'ตรวจสอบอุณหภูมิ Reactor หรือปริมาณ Catalyst';
        if (name.includes('p-ta') || name === 'pta') return 'ตรวจสอบอัตราส่วนการผสม หรือสภาวะปฏิกิริยา / พิจารณาปรับ Rinse Ratio';
        if (name.includes('b-value') || name.includes('a-value') || name.includes('l-value') || name.includes('%t') || name.includes('%ht')) return 'ตรวจสอบสิ่งเจือปน (Impurities) หรือระบบ Purification';
        if (name.includes('mps') || name.includes('um')) return 'ตรวจสอบระบบตกผลึก (Crystallizer) หรือเวลาพำนัก';
        if (name.includes('water') || name.includes('moisture')) return 'ตรวจสอบระบบอบแห้ง (Dryer) หรือ Centrifuge';
        if (name.includes('na') || name.includes('co') || name.includes('mn') || name.includes('br') || name.includes('q conc')) return 'ตรวจสอบระบบ Catalyst/Solvent Recovery';
        return 'ตรวจสอบ Process Control และประสานงานหน้างานด่วน';
    }

    async function analyzeAndRender(sheet, samples, params) {
        activeFilter = 'all';
        alerts = [];
        const paramBaselines = new Map();
        params.forEach(p => {
            const specBands = SpecEvaluator.parseBands(p.specText);
            paramBaselines.set(p.name, StatEngine.computeRollingBaselines(samples, p.name, specBands));
        });
        for (let i = samples.length - 1; i >= 0; i--) {
            const row = samples[i];
            for (const p of params) {
                const valObj = row.values[p.name];
                const evalResult = Evaluator.evaluate(p, valObj, paramBaselines.get(p.name)[i]);
                if (evalResult.status === 'oos' || evalResult.status === 'warn') {
                    const bucket = ActionLog.deviationBucket(valObj.numeric, evalResult.specBands);
                    const similar = await ActionLog.findSimilarActions(sheet, p.name, bucket);
                    alerts.push({
                        sheet, time: row.dateTimeRaw, timestamp: row.timestamp, param: p.name, value: valObj.mainRaw,
                        limit: evalResult.status === 'oos' ? p.specText : (evalResult.warnSource === 'stat' ? formatBand(evalResult.warnBands) + ' (สถิติ)' : p.warnText),
                        type: evalResult.status, advice: getAdvice(p.name), bucket,
                        triggerValue: valObj.numeric, similarActions: similar
                    });
                }
            }
        }
        updateUI();
    }

    function formatBand(bands) {
        if (!bands) return '-';
        return bands.map(b => `${Number.isFinite(b.min) ? b.min.toFixed(2) : '-∞'} ~ ${Number.isFinite(b.max) ? b.max.toFixed(2) : '∞'}`).join(' หรือ ');
    }

    function emptyStateMessage() {
        if (activeFilter === 'warn') return 'ไม่พบค่าเตือน (No Warning)';
        if (activeFilter === 'oos') return 'ไม่พบค่าหลุดสเปค (No OOS)';
        return 'ไม่พบค่าผิดปกติ (All Normal)';
    }

    function updateUI() {
        const badge = document.getElementById('alert-badge');
        const count = alerts.length;
        if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }

        const visibleAlerts = activeFilter === 'all' ? alerts : alerts.filter(a => a.type === activeFilter);

        const container = document.getElementById('assistant-alerts');
        if (visibleAlerts.length === 0) {
            container.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500';
            wrap.innerHTML = `<i data-lucide="check-circle-2" class="w-12 h-12 mb-3 text-emerald-400 opacity-50"></i>
                <p class="font-medium text-sm">${emptyStateMessage()}</p>`;
            container.appendChild(wrap);
            lucide.createIcons();
            return;
        }

        container.innerHTML = '';
        visibleAlerts.forEach((alert, idx) => {
            const isOOS = alert.type === 'oos';
            const card = document.createElement('div');
            card.className = `rounded-xl border ${isOOS ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10' : 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10'} p-3.5 shadow-sm transition-all hover:shadow-md`;

            const header = document.createElement('div');
            header.className = 'flex justify-between items-start mb-2';
            const timeEl = document.createElement('div');
            timeEl.className = `flex items-center gap-1.5 font-bold ${isOOS ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`;
            timeEl.innerHTML = `<i data-lucide="${isOOS ? 'shield-alert' : 'alert-triangle'}" class="w-4 h-4"></i>`;
            const timeText = document.createElement('span');
            timeText.textContent = alert.time;
            timeEl.appendChild(timeText);
            const badgeEl = document.createElement('span');
            badgeEl.className = `text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/50 dark:bg-slate-900/50 ${isOOS ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`;
            badgeEl.textContent = isOOS ? 'Out of Spec' : 'Warning';
            header.appendChild(timeEl); header.appendChild(badgeEl);

            const body = document.createElement('div');
            body.className = 'mb-2';
            const paramName = document.createElement('p');
            paramName.className = 'text-sm font-semibold text-slate-800 dark:text-slate-200';
            paramName.textContent = alert.param;
            const valRow = document.createElement('div');
            valRow.className = 'flex items-end gap-2 mt-0.5';
            const valEl = document.createElement('span');
            valEl.className = 'text-lg font-bold text-slate-900 dark:text-white leading-none';
            valEl.textContent = alert.value;
            const limitEl = document.createElement('span');
            limitEl.className = 'text-xs text-slate-500 dark:text-slate-400 mb-0.5';
            limitEl.textContent = `(${isOOS ? 'Spec Limit:' : 'Warn:'} ${alert.limit})`;
            valRow.appendChild(valEl); valRow.appendChild(limitEl);
            body.appendChild(paramName); body.appendChild(valRow);

            const adviceBlock = document.createElement('div');
            adviceBlock.className = 'pt-2 border-t border-slate-200/50 dark:border-slate-700/50 mt-2';
            const adviceP = document.createElement('p');
            adviceP.className = 'text-xs text-indigo-700 dark:text-indigo-300 font-medium flex items-start gap-1.5';
            adviceP.innerHTML = `<i data-lucide="wrench" class="w-3.5 h-3.5 mt-0.5 flex-shrink-0"></i>`;
            const adviceSpan = document.createElement('span');
            adviceSpan.textContent = alert.advice;
            adviceP.appendChild(adviceSpan);
            adviceBlock.appendChild(adviceP);

            if (alert.similarActions && alert.similarActions.length > 0) {
                const histBlock = document.createElement('div');
                histBlock.className = 'mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-col gap-1';
                const label = document.createElement('p');
                label.className = 'text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500';
                label.textContent = 'เคยทำมาก่อน';
                histBlock.appendChild(label);
                alert.similarActions.slice(0, 2).forEach(a => {
                    const p = document.createElement('p');
                    p.className = 'text-xs text-slate-600 dark:text-slate-300';
                    const outcomeIcon = a.outcome === 'success' ? '✅' : (a.outcome === 'fail' ? '⚠️' : '⏳');
                    p.textContent = `${outcomeIcon} ปรับ ${a.controlVariable} ${a.fromValue}→${a.toValue}${a.unit ? ' ' + a.unit : ''}`;
                    histBlock.appendChild(p);
                });
                adviceBlock.appendChild(histBlock);
            }

            const actionBtn = document.createElement('button');
            actionBtn.className = 'mt-3 w-full text-xs font-medium text-white bg-brand-primary hover:bg-blue-600 rounded-lg py-1.5 flex items-center justify-center gap-1.5';
            actionBtn.innerHTML = `<i data-lucide="plus" class="w-3.5 h-3.5"></i> บันทึก Action`;
            actionBtn.addEventListener('click', () => ActionLogUI.open(alert));

            card.appendChild(header); card.appendChild(body); card.appendChild(adviceBlock); card.appendChild(actionBtn);
            container.appendChild(card);
        });
        lucide.createIcons();
    }

    function toggle(forceOpen = false, filter = 'all') {
        const sidebar = document.getElementById('assistant-sidebar');
        activeFilter = filter;
        updateUI();
        if (forceOpen) sidebar.classList.add('sidebar-open');
        else sidebar.classList.toggle('sidebar-open');
    }

    return { analyzeAndRender, toggle, getAlerts: () => alerts };
})();

// ==========================================
// MODULE: ActionLogUI — modal form bound to alert cards
// ==========================================
const ActionLogUI = (() => {
    let currentAlert = null;

    function open(alert) {
        currentAlert = alert;
        document.getElementById('action-param-display').value = `${alert.param} = ${alert.value} (${alert.time})`;
        document.getElementById('action-control-var').value = '';
        document.getElementById('action-from-value').value = '';
        document.getElementById('action-to-value').value = '';
        document.getElementById('action-unit').value = '';
        document.getElementById('action-note').value = '';
        document.getElementById('action-modal').classList.remove('hidden');
    }

    function close() {
        document.getElementById('action-modal').classList.add('hidden');
        currentAlert = null;
    }

    async function submit(e) {
        e.preventDefault();
        if (!currentAlert) return;
        await ActionLog.logAction({
            sheet: currentAlert.sheet,
            paramName: currentAlert.param,
            triggerValue: currentAlert.triggerValue,
            triggerTimestamp: currentAlert.timestamp,
            bucket: currentAlert.bucket,
            controlVariable: document.getElementById('action-control-var').value.trim(),
            fromValue: document.getElementById('action-from-value').value.trim(),
            toValue: document.getElementById('action-to-value').value.trim(),
            unit: document.getElementById('action-unit').value.trim(),
            note: document.getElementById('action-note').value.trim(),
            actionTimestamp: Date.now()
        });
        close();
        await UIRenderer.refreshCurrentSheet();
    }

    function populateControlVarList() {
        const dl = document.getElementById('control-var-list');
        dl.innerHTML = '';
        APP_CONFIG.CONTROL_VARIABLES.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            dl.appendChild(opt);
        });
    }

    return { open, close, submit, populateControlVarList };
})();

// ==========================================
// MODULE: ActionHistoryUI — before/after audit view across all logged actions
// ==========================================
const ActionHistoryUI = (() => {
    let allActions = [];
    let sheetFilter = 'all';
    let outcomeFilter = 'all';
    let sampleCache = new Map(); // sheet -> samples[]
    let metaCache = new Map();   // sheet -> sheetMeta

    async function open() {
        allActions = await STORAGE_ENGINE.getAllActions();
        sheetFilter = 'all';
        outcomeFilter = 'all';
        sampleCache = new Map();
        metaCache = new Map();

        populateSheetFilter();
        document.getElementById('action-history-outcome-filter').value = 'all';
        await render();
        document.getElementById('action-history-modal').classList.remove('hidden');
    }

    function close() {
        document.getElementById('action-history-modal').classList.add('hidden');
    }

    function onSheetFilterChange(value) {
        sheetFilter = value;
        render();
    }

    function onOutcomeFilterChange(value) {
        outcomeFilter = value;
        render();
    }

    function populateSheetFilter() {
        const select = document.getElementById('action-history-sheet-filter');
        const sheets = [...new Set(allActions.map(a => a.sheet))].sort((a, b) => {
            if (a === APP_CONFIG.DEFAULT_SHEET) return -1;
            if (b === APP_CONFIG.DEFAULT_SHEET) return 1;
            return a.localeCompare(b);
        });
        select.innerHTML = '';
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = 'ทุก Sheet';
        select.appendChild(allOpt);
        sheets.forEach(sheet => {
            const opt = document.createElement('option');
            opt.value = sheet;
            opt.textContent = sheet;
            select.appendChild(opt);
        });
        select.value = 'all';
    }

    function filteredSorted() {
        return allActions
            .filter(a => sheetFilter === 'all' || a.sheet === sheetFilter)
            .filter(a => outcomeFilter === 'all' || a.outcome === outcomeFilter)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    async function ensureSheetDataCached(sheets) {
        const missing = sheets.filter(s => !sampleCache.has(s));
        await Promise.all(missing.map(async sheet => {
            const [meta, samples] = await Promise.all([
                STORAGE_ENGINE.getSheetMeta(sheet),
                STORAGE_ENGINE.getAllSamplesForSheet(sheet)
            ]);
            metaCache.set(sheet, meta);
            sampleCache.set(sheet, samples);
        }));
    }

    async function render() {
        const list = filteredSorted();
        document.getElementById('action-history-count').textContent = `${list.length} รายการ`;

        const container = document.getElementById('action-history-list');
        container.innerHTML = '';

        if (list.length === 0) {
            const wrap = document.createElement('div');
            wrap.className = 'flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500';
            wrap.innerHTML = `<i data-lucide="inbox" class="w-12 h-12 mb-3 opacity-50"></i>
                <p class="font-medium text-sm">ไม่พบประวัติ Action</p>`;
            container.appendChild(wrap);
            lucide.createIcons();
            return;
        }

        await ensureSheetDataCached([...new Set(list.map(a => a.sheet))]);

        list.forEach(action => container.appendChild(buildActionCard(action)));
        lucide.createIcons();
    }

    function outcomeBadge(outcome, checkedCount) {
        const badge = document.createElement('span');
        badge.className = 'text-[11px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap';
        if (outcome === 'success') {
            badge.className += ' bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
            badge.textContent = '✅ สำเร็จ';
        } else if (outcome === 'fail') {
            badge.className += ' bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400';
            badge.textContent = '⚠️ ไม่สำเร็จ';
        } else {
            badge.className += ' bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
            badge.textContent = `⏳ รอผล (${checkedCount}/3)`;
        }
        return badge;
    }

    function timelinePoint(label, timeText, valueText, variant) {
        const colors = {
            trigger: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
            in: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400',
            out: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400',
            pending: 'border-dashed border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500'
        };
        const box = document.createElement('div');
        box.className = `rounded-lg border px-3 py-1.5 min-w-[110px] text-center ${colors[variant]}`;
        const labelEl = document.createElement('div');
        labelEl.className = 'text-[10px] uppercase font-bold opacity-70';
        labelEl.textContent = label;
        const valueEl = document.createElement('div');
        valueEl.className = 'text-sm font-bold';
        valueEl.textContent = valueText;
        const timeEl = document.createElement('div');
        timeEl.className = 'text-[10px] opacity-70';
        timeEl.textContent = timeText;
        box.appendChild(labelEl);
        box.appendChild(valueEl);
        box.appendChild(timeEl);
        return box;
    }

    function arrowIcon() {
        const span = document.createElement('span');
        span.className = 'text-slate-300 dark:text-slate-600';
        span.innerHTML = '<i data-lucide="arrow-right" class="w-4 h-4"></i>';
        return span;
    }

    function buildActionCard(action) {
        const samples = sampleCache.get(action.sheet) || [];
        const meta = metaCache.get(action.sheet);
        const param = meta ? meta.params.find(p => p.name === action.paramName) : null;
        const specBands = param ? SpecEvaluator.parseBands(param.specText) : null;

        const triggerSample = samples.find(s => s.timestamp === action.triggerTimestamp);
        const triggerTime = triggerSample ? triggerSample.dateTimeRaw : new Date(action.triggerTimestamp || action.createdAt).toLocaleString('th-TH');
        const triggerValueText = (triggerSample && triggerSample.values[action.paramName])
            ? triggerSample.values[action.paramName].mainRaw
            : String(action.triggerValue);

        const followUps = action.followUpChecked
            .map(id => samples.find(s => s.sampleId === id))
            .filter(Boolean)
            .map(s => {
                const v = s.values[action.paramName];
                const numeric = v ? v.numeric : null;
                return {
                    time: s.dateTimeRaw,
                    display: v ? v.mainRaw : '-',
                    inSpec: (specBands && numeric !== null) ? SpecEvaluator.isWithinBands(numeric, specBands) : null
                };
            });

        const card = document.createElement('div');
        card.className = 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4 shadow-sm';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-start mb-3';
        const titleBlock = document.createElement('div');
        const paramLine = document.createElement('p');
        paramLine.className = 'text-sm font-bold text-slate-800 dark:text-slate-100';
        paramLine.textContent = `${action.sheet} — ${action.paramName}`;
        const dateLine = document.createElement('p');
        dateLine.className = 'text-xs text-slate-400 dark:text-slate-500';
        dateLine.textContent = new Date(action.createdAt).toLocaleString('th-TH');
        titleBlock.appendChild(paramLine);
        titleBlock.appendChild(dateLine);
        header.appendChild(titleBlock);
        header.appendChild(outcomeBadge(action.outcome, action.followUpChecked.length));
        card.appendChild(header);

        const timeline = document.createElement('div');
        timeline.className = 'flex items-center gap-2 flex-wrap my-2';
        timeline.appendChild(timelinePoint('Trigger', triggerTime, triggerValueText, 'trigger'));
        followUps.forEach(f => {
            timeline.appendChild(arrowIcon());
            timeline.appendChild(timelinePoint('ผลถัดมา', f.time, f.display, f.inSpec === false ? 'out' : 'in'));
        });
        if (action.outcome === 'pending') {
            for (let i = followUps.length; i < 3; i++) {
                timeline.appendChild(arrowIcon());
                timeline.appendChild(timelinePoint('รอผล', 'รอผลตรวจถัดไป', '...', 'pending'));
            }
        }
        card.appendChild(timeline);

        const footer = document.createElement('div');
        footer.className = 'pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-4 gap-y-1';
        const controlLine = document.createElement('span');
        controlLine.textContent = `ปรับ: ${action.controlVariable} ${action.fromValue} → ${action.toValue}${action.unit ? ' ' + action.unit : ''}`;
        footer.appendChild(controlLine);
        if (action.note) {
            const noteLine = document.createElement('span');
            noteLine.textContent = `หมายเหตุ: ${action.note}`;
            footer.appendChild(noteLine);
        }
        card.appendChild(footer);

        return card;
    }

    return { open, close, onSheetFilterChange, onOutcomeFilterChange };
})();

// ==========================================
// MODULE: UIRenderer — tabs, table, summary
// ==========================================
const UIRenderer = (() => {
    let currentSheet = null;
    let currentSamples = [];
    let currentParams = [];

    async function renderTabs() {
        const sheets = await STORAGE_ENGINE.getAllSheetNames();
        const tabsBar = document.getElementById('tabs-bar');
        if (sheets.length === 0) { tabsBar.classList.add('hidden'); return; }
        tabsBar.classList.remove('hidden');
        tabsBar.innerHTML = '';

        const ordered = sheets.slice().sort((a, b) => {
            if (a === APP_CONFIG.DEFAULT_SHEET) return -1;
            if (b === APP_CONFIG.DEFAULT_SHEET) return 1;
            return a.localeCompare(b);
        });
        if (!currentSheet || !ordered.includes(currentSheet)) {
            currentSheet = ordered.includes(APP_CONFIG.DEFAULT_SHEET) ? APP_CONFIG.DEFAULT_SHEET : ordered[0];
        }

        ordered.forEach(sheet => {
            const btn = document.createElement('button');
            btn.className = `tab-btn px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 ${sheet === currentSheet ? 'active' : ''}`;
            btn.textContent = sheet;
            btn.addEventListener('click', () => selectSheet(sheet));
            tabsBar.appendChild(btn);
        });
    }

    async function selectSheet(sheet) {
        currentSheet = sheet;
        await renderTabs();
        await refreshCurrentSheet();
    }

    async function refreshCurrentSheet() {
        if (!currentSheet) return;
        setStatus(APP_CONFIG.STATUS.PROCESSING);
        const meta = await STORAGE_ENGINE.getSheetMeta(currentSheet);
        currentParams = meta ? meta.params : [];
        currentSamples = await STORAGE_ENGINE.getAllSamplesForSheet(currentSheet);

        for (const p of currentParams) {
            await ActionLog.checkOutcomes(currentSheet, p.name, currentSamples, currentParams);
        }

        renderTable();
        await SmartAssistant.analyzeAndRender(currentSheet, currentSamples, currentParams);
        setStatus(APP_CONFIG.STATUS.IDLE);
    }

    function renderTable() {
        const stats = { total: currentSamples.length, warn: 0, oos: 0 };
        const thead = document.getElementById('table-head');
        const tbody = document.getElementById('table-body');

        // Precompute once per parameter (was recomputed from scratch per cell, O(n^2)).
        const paramBaselines = new Map();
        currentParams.forEach(p => {
            const specBands = SpecEvaluator.parseBands(p.specText);
            paramBaselines.set(p.name, StatEngine.computeRollingBaselines(currentSamples, p.name, specBands));
        });

        let thName = `<tr class="text-slate-600 dark:text-slate-200">
            <th class="sticky-corner-1 px-4 py-3 min-w-[100px]">เวลา (Time)</th>
            <th class="sticky-corner-2 px-4 py-3 min-w-[120px]">สถานะ (Status)</th>`;
        let thSpec = `<tr class="text-emerald-600 dark:text-emerald-400 bg-slate-200/50 dark:bg-slate-800/90 text-[11px] border-t border-slate-200 dark:border-slate-700"><th class="sticky-col-1 px-4 py-1.5 font-normal">Spec Limits</th><th class="sticky-col-2 px-4 py-1.5 font-normal"></th>`;
        let thWarn = `<tr class="text-amber-600 dark:text-amber-400 bg-slate-200/50 dark:bg-slate-800/90 text-[11px]"><th class="sticky-col-1 px-4 py-1.5 font-normal">Warn Limits</th><th class="sticky-col-2 px-4 py-1.5 font-normal"></th>`;

        currentParams.forEach(p => {
            thName += `<th class="px-6 py-3 whitespace-nowrap text-center clickable-header group" data-param="${escapeAttr(p.name)}" title="คลิกเพื่อดูกราฟ Trend">
                <div class="flex items-center justify-center gap-1 font-semibold">
                    ${escapeHtml(p.name)} <i data-lucide="external-link" class="w-3 h-3 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                </div>
            </th>`;
            const warnMeta = evaluateForBaseline(p);
            thSpec += `<th class="px-6 py-1.5 whitespace-nowrap text-center border-l border-slate-200 dark:border-slate-700/50">${escapeHtml(p.specText || '-')}</th>`;
            thWarn += `<th class="px-6 py-1.5 whitespace-nowrap text-center border-l border-slate-200 dark:border-slate-700/50">${escapeHtml(p.warnText || (warnMeta ? formatBandShort(warnMeta) + ' (สถิติ)' : '-'))}</th>`;
        });

        thead.innerHTML = thName + '</tr>' + thSpec + '</tr>' + thWarn + '</tr>';
        thead.querySelectorAll('.clickable-header').forEach(th => {
            th.addEventListener('click', () => ChartManager.openModal(currentSheet, th.getAttribute('data-param'), currentSamples, currentParams));
        });

        tbody.innerHTML = '';
        currentSamples.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group';

            const statusColor = row.status.toLowerCase().includes('complete') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-300';
            const tdTime = document.createElement('td');
            tdTime.className = 'sticky-col-1 px-4 py-4 whitespace-nowrap font-medium text-brand-primary dark:text-brand-glow bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800';
            tdTime.textContent = row.dateTimeRaw;
            const tdStatus = document.createElement('td');
            tdStatus.className = `sticky-col-2 px-4 py-4 whitespace-nowrap text-xs bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 ${statusColor}`;
            tdStatus.textContent = row.status;
            tr.appendChild(tdTime); tr.appendChild(tdStatus);

            currentParams.forEach(p => {
                const v = row.values[p.name] || { mainRaw: '-', numeric: null, pending: false };
                const evalResult = Evaluator.evaluate(p, v, paramBaselines.get(p.name)[idx]);
                if (evalResult.status === 'oos') stats.oos++;
                if (evalResult.status === 'warn') stats.warn++;

                const td = document.createElement('td');
                let cellClass = 'px-6 py-3 whitespace-nowrap text-center border-l border-slate-100 dark:border-slate-800';
                let valColor = 'text-slate-800 dark:text-white';
                if (evalResult.status === 'oos') { cellClass += ' cell-oos'; valColor = 'text-red-600 dark:text-red-300 font-bold'; }
                else if (evalResult.status === 'warn') { cellClass += ' cell-warn'; valColor = 'text-amber-600 dark:text-amber-300 font-bold'; }
                td.className = cellClass;

                const inner = document.createElement('div');
                inner.className = 'flex flex-col items-center justify-center';
                const span = document.createElement('span');
                span.className = `text-sm ${valColor}`;
                span.textContent = v.mainRaw || '-';
                inner.appendChild(span);
                if (v.subRaw) {
                    const sub = document.createElement('span');
                    sub.className = 'text-[10px] text-slate-400 dark:text-slate-500 mt-0.5';
                    sub.textContent = `(${v.subRaw})`;
                    inner.appendChild(sub);
                }
                td.appendChild(inner);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        document.getElementById('sum-total').textContent = stats.total;
        document.getElementById('sum-warn').textContent = stats.warn;
        document.getElementById('sum-oos').textContent = stats.oos;
        document.getElementById('data-section').classList.remove('hidden');
        document.getElementById('executive-summary').classList.remove('hidden');
        document.getElementById('action-buttons').classList.remove('hidden');
        lucide.createIcons();
    }

    function evaluateForBaseline(param) {
        if (param.warnText) return null;
        const specBands = SpecEvaluator.parseBands(param.specText);
        const baseline = StatEngine.computeBaseline(currentSamples, param.name, specBands);
        const band = StatEngine.baselineBand(baseline);
        return band ? band[0] : null;
    }

    function formatBandShort(band) {
        return `${band.min.toFixed(2)} ~ ${band.max.toFixed(2)}`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    function escapeAttr(str) {
        return String(str).replace(/"/g, '&quot;');
    }

    function setStatus(statusObj, errorMsg = null) {
        const statusText = document.getElementById('header-status-text');
        const dotHeader = document.getElementById('header-status-dot');
        const dotSig = document.getElementById('signature-status');
        statusText.textContent = statusObj.text;
        dotHeader.className = `w-2.5 h-2.5 rounded-full ${statusObj.class}`;
        dotSig.className = `w-2 h-2 rounded-full ${statusObj.class} transition-colors duration-300`;
        if (errorMsg) {
            const dzText = document.getElementById('dropzone-text');
            const dzSub = document.getElementById('dropzone-subtext');
            dzText.textContent = 'เกิดข้อผิดพลาดในการอ่านไฟล์';
            dzText.className = 'text-lg font-semibold text-red-500 dark:text-red-400';
            dzSub.textContent = errorMsg;
            dzSub.className = 'text-sm text-red-400 dark:text-red-300 mt-1';
            lucide.createIcons();
        }
    }

    function getCurrentSheet() { return currentSheet; }

    return { renderTabs, selectSheet, refreshCurrentSheet, setStatus, getCurrentSheet };
})();

// ==========================================
// MODULE: ChartManager — trend view over accumulated history
// ==========================================
const ChartManager = (() => {
    let instance = null;

    function openModal(sheet, paramName, samples, params) {
        const param = params.find(p => p.name === paramName);
        if (!param) return;

        document.getElementById('chart-title').textContent = paramName;
        document.getElementById('chart-spec-info').textContent = `Spec: ${param.specText || '-'} | Warn: ${param.warnText || 'สถิติ (auto)'}`;
        document.getElementById('chart-modal').classList.remove('hidden');

        const labels = samples.map(d => d.dateTimeRaw);
        const dataPoints = samples.map(d => {
            const v = d.values[paramName];
            return (v && v.numeric !== null) ? v.numeric : null;
        });

        const specBandsRaw = SpecEvaluator.parseBands(param.specText);
        const specBands = specBandsRaw || [];
        let warnBands = SpecEvaluator.parseBands(param.warnText);
        if (!warnBands) {
            const baseline = StatEngine.computeBaseline(samples, paramName, specBandsRaw);
            warnBands = StatEngine.baselineBand(baseline) || [];
        }

        const datasets = [{
            label: paramName, data: dataPoints, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2, pointBackgroundColor: '#3b82f6', pointRadius: 3, pointHoverRadius: 6, fill: true, tension: 0.25, spanGaps: true
        }];

        specBands.forEach((b, i) => addRefLines(datasets, b, labels.length, '#ef4444', `Spec ${i + 1}`));
        (warnBands || []).forEach((b, i) => addRefLines(datasets, b, labels.length, '#f59e0b', `Warn ${i + 1}`));

        const ctx = document.getElementById('trendChart').getContext('2d');
        if (instance) instance.destroy();

        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        const tickColor = isDark ? '#94a3b8' : '#475569';

        instance = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true, labels: { color: tickColor, boxWidth: 12, font: { size: 10 } } } },
                scales: {
                    y: { grid: { color: gridColor }, ticks: { color: tickColor } },
                    x: { grid: { display: false }, ticks: { color: tickColor, maxRotation: 60, minRotation: 30 } }
                }
            }
        });
    }

    function addRefLines(datasets, band, n, color, label) {
        if (Number.isFinite(band.min)) {
            datasets.push({ label: `${label} Min`, data: Array(n).fill(band.min), borderColor: color, borderDash: [6, 4], borderWidth: 1, pointRadius: 0, fill: false });
        }
        if (Number.isFinite(band.max)) {
            datasets.push({ label: `${label} Max`, data: Array(n).fill(band.max), borderColor: color, borderDash: [6, 4], borderWidth: 1, pointRadius: 0, fill: false });
        }
    }

    function closeModal() { document.getElementById('chart-modal').classList.add('hidden'); }

    return { openModal, closeModal };
})();

// ==========================================
// MODULE: ExportManager — PDF export (unchanged behavior from prototype)
// ==========================================
const ExportManager = (() => {
    function downloadPDF() {
        UIRenderer.setStatus(APP_CONFIG.STATUS.PROCESSING);
        const element = document.getElementById('print-area');
        const opt = {
            margin: 0.2, filename: 'PTA_Quality_Report.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'a3', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save().then(() => UIRenderer.setStatus(APP_CONFIG.STATUS.IDLE));
    }
    return { downloadPDF };
})();

// ==========================================
// MODULE: APP_CORE — init, file handling, theme, reset
// ==========================================
const APP_CORE = (() => {
    async function handleFiles(fileList) {
        const files = Array.from(fileList).filter(f => f.name.match(/\.(xlsx|xls|csv)$/i));
        if (files.length === 0) { alert('รองรับเฉพาะไฟล์ Excel/CSV ครับ'); return; }

        UIRenderer.setStatus(APP_CONFIG.STATUS.PROCESSING);
        const dzText = document.getElementById('dropzone-text');
        const dzSub = document.getElementById('dropzone-subtext');
        dzText.textContent = `กำลังประมวลผล ${files.length} ไฟล์...`;
        dzText.className = 'text-lg font-semibold text-brand-primary';
        dzSub.classList.add('hidden');

        try {
            for (const file of files) {
                await processFile(file);
            }
            dzText.textContent = 'โหลดข้อมูลใหม่ (อัปโหลดทับได้เลย)';
            dzText.className = 'text-lg font-semibold text-slate-700 dark:text-slate-200';
            dzSub.textContent = 'อัปเดตข้อมูลสำเร็จแล้ว';
            dzSub.className = 'text-sm text-emerald-600 dark:text-emerald-400 mt-1';
            dzSub.classList.remove('hidden');
            document.getElementById('dropzone').classList.replace('p-10', 'p-4');
            document.getElementById('dropzone').classList.add('opacity-60');

            await UIRenderer.renderTabs();
            await UIRenderer.refreshCurrentSheet();
            UIRenderer.setStatus(APP_CONFIG.STATUS.IDLE);
        } catch (err) {
            console.error(err);
            UIRenderer.setStatus(APP_CONFIG.STATUS.ERROR, err.message);
        }
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('เบราว์เซอร์ไม่สามารถอ่านไฟล์นี้ได้'));
            reader.readAsArrayBuffer(file);
        });
    }

    // A later upload for the same sheet may have fewer/different columns than
    // an earlier one (e.g. a check that only tests a subset of parameters).
    // Keep the union of everything ever seen, refreshing definitions for
    // params present in the new file rather than discarding the rest.
    async function mergeParamsWithExisting(sheetName, newParams) {
        const existingMeta = await STORAGE_ENGINE.getSheetMeta(sheetName);
        if (!existingMeta) return newParams;
        const byName = new Map(existingMeta.params.map(p => [p.name, p]));
        newParams.forEach(p => byName.set(p.name, p));
        return Array.from(byName.values());
    }

    async function processFile(file) {
        const buffer = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const parsed = ExcelParser.parseWorkbook(workbook);
        if (Object.keys(parsed).length === 0) throw new Error('ไม่พบตารางข้อมูลที่รู้จักในไฟล์นี้');

        for (const [sheetName, { params, samples }] of Object.entries(parsed)) {
            const mergedParams = await mergeParamsWithExisting(sheetName, params);
            await STORAGE_ENGINE.putSheetMeta({ sheet: sheetName, params: mergedParams, lastUpdated: Date.now() });
            for (const sample of samples) {
                await STORAGE_ENGINE.putSample({
                    id: `${sheetName}::${sample.sampleId}`,
                    sheet: sheetName,
                    sampleId: sample.sampleId,
                    timestamp: sample.timestamp,
                    dateTimeRaw: sample.dateTimeRaw,
                    status: sample.status,
                    values: sample.values
                });
            }
        }
    }

    async function resetAll() {
        if (!confirm('ยืนยันล้างประวัติข้อมูลทั้งหมดในเครื่องนี้? การกระทำนี้ย้อนกลับไม่ได้')) return;
        await STORAGE_ENGINE.clearAll();
        document.getElementById('data-section').classList.add('hidden');
        document.getElementById('executive-summary').classList.add('hidden');
        document.getElementById('action-buttons').classList.add('hidden');
        document.getElementById('tabs-bar').classList.add('hidden');
        document.getElementById('assistant-sidebar').classList.remove('sidebar-open');
        document.getElementById('action-history-modal').classList.add('hidden');

        const dzText = document.getElementById('dropzone-text');
        const dzSub = document.getElementById('dropzone-subtext');
        dzText.textContent = 'ลากไฟล์ผล Lab (Excel) มาวางที่นี่ — เลือกได้หลายไฟล์';
        dzText.className = 'text-lg font-semibold text-slate-800 dark:text-slate-200';
        dzSub.textContent = 'ระบบจะสแกนทุก Sheet และสะสมประวัติไว้ในเครื่องนี้ (IndexedDB)';
        dzSub.classList.remove('hidden');
        dzSub.className = 'text-sm text-slate-500 dark:text-slate-400 mt-1';

        const dropzone = document.getElementById('dropzone');
        dropzone.classList.replace('p-4', 'p-10');
        dropzone.classList.remove('opacity-60');
        document.getElementById('file-input').value = '';
        UIRenderer.setStatus(APP_CONFIG.STATUS.IDLE);
    }

    function toggleThemeInternal() {
        const html = document.documentElement;
        html.classList.toggle('dark');
        const isDark = html.classList.contains('dark');
        const iconEl = document.getElementById('theme-icon');
        iconEl.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
    }

    async function init() {
        ActionLogUI.populateControlVarList();
        document.getElementById('action-form').addEventListener('submit', ActionLogUI.submit);

        const dropzone = document.getElementById('dropzone');
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eName => {
            dropzone.addEventListener(eName, (e) => { e.preventDefault(); e.stopPropagation(); });
        });
        ['dragenter', 'dragover'].forEach(eName => dropzone.addEventListener(eName, () => dropzone.classList.add('dropzone-active')));
        ['dragleave', 'drop'].forEach(eName => dropzone.addEventListener(eName, () => dropzone.classList.remove('dropzone-active')));
        dropzone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
        document.getElementById('file-input').addEventListener('change', (e) => { if (e.target.files.length) handleFiles(e.target.files); });

        await UIRenderer.renderTabs();
        const sheets = await STORAGE_ENGINE.getAllSheetNames();
        if (sheets.length > 0) {
            document.getElementById('dropzone').classList.replace('p-10', 'p-4');
            document.getElementById('dropzone').classList.add('opacity-60');
            document.getElementById('dropzone-text').textContent = 'โหลดข้อมูลใหม่ (อัปโหลดทับได้เลย)';
            await UIRenderer.refreshCurrentSheet();
        }
    }

    return { init, resetAll, toggleTheme: toggleThemeInternal };
})();

function toggleTheme() { APP_CORE.toggleTheme(); }
function resetApp() { APP_CORE.resetAll(); }

