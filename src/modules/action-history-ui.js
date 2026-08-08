/* global lucide */
import { STORAGE_ENGINE } from './storage-engine.js';
import { APP_CONFIG } from './app-config.js';
import { SpecEvaluator } from './spec-evaluator.js';

/** Before/after audit view across all logged actions, filterable by sheet and outcome. */
export const ActionHistoryUI = (() => {
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
