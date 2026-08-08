/* global XLSX, lucide */
import { APP_CONFIG } from './modules/app-config.js';
import { STORAGE_ENGINE } from './modules/storage-engine.js';
import { ExcelParser } from './modules/excel-parser.js';
import { UIRenderer } from './modules/ui-renderer.js';
import { ActionLogUI } from './modules/action-log-ui.js';
import { ActionHistoryUI } from './modules/action-history-ui.js';
import { SmartAssistant } from './modules/smart-assistant.js';
import { ChartManager } from './modules/chart-manager.js';
import { ExportManager } from './modules/export-manager.js';

/** App bootstrap: file intake, IndexedDB merge, theme toggle, reset, init wiring. */
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

// index.html still uses inline onclick="..."/onchange="..." attributes that
// reference these names directly — ES modules are not global by default, so
// they must be attached to `window` explicitly for those handlers to resolve.
window.toggleTheme = toggleTheme;
window.resetApp = resetApp;
window.SmartAssistant = SmartAssistant;
window.ActionHistoryUI = ActionHistoryUI;
window.ActionLogUI = ActionLogUI;
window.ChartManager = ChartManager;
window.ExportManager = ExportManager;

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    APP_CORE.init();
});
