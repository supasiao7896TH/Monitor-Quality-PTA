/* global lucide */
import { STORAGE_ENGINE } from './storage-engine.js';
import { APP_CONFIG } from './app-config.js';
import { ActionLog } from './action-log.js';
import { SmartAssistant } from './smart-assistant.js';
import { SpecEvaluator } from './spec-evaluator.js';
import { StatEngine } from './stat-engine.js';
import { Evaluator } from './evaluator.js';
import { ChartManager } from './chart-manager.js';

/** Sheet tabs, main data table, and header/status glow rendering. */
export const UIRenderer = (() => {
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
