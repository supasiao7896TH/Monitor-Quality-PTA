/* global lucide */
import { SpecEvaluator } from './spec-evaluator.js';
import { StatEngine } from './stat-engine.js';
import { Evaluator } from './evaluator.js';
import { ActionLog } from './action-log.js';
import { ActionLogUI } from './action-log-ui.js';
import { CorrelationMatrix } from './correlation-matrix.js';

/** Alert sidebar: builds warn/OOS cards with advice + past-action history, per current sheet. */
export const SmartAssistant = (() => {
    let alerts = [];
    let activeFilter = 'all'; // 'all' | 'warn' | 'oos'

    // Last-resort fallback for quality items the SOP correlation matrix doesn't
    // cover (e.g. LIMS params outside the 12 items in PTA-Quality-Control.md §3).
    function getGenericAdvice(paramName) {
        const name = paramName.toLowerCase();
        if (name.includes('4-cba')) return 'ตรวจสอบอุณหภูมิ Reactor หรือปริมาณ Catalyst';
        if (name.includes('p-ta') || name === 'pta') return 'ตรวจสอบอัตราส่วนการผสม หรือสภาวะปฏิกิริยา / พิจารณาปรับ Rinse Ratio';
        if (name.includes('b-value') || name.includes('a-value') || name.includes('l-value') || name.includes('%t') || name.includes('%ht')) return 'ตรวจสอบสิ่งเจือปน (Impurities) หรือระบบ Purification';
        if (name.includes('mps') || name.includes('um')) return 'ตรวจสอบระบบตกผลึก (Crystallizer) หรือเวลาพำนัก';
        if (name.includes('water') || name.includes('moisture')) return 'ตรวจสอบระบบอบแห้ง (Dryer) หรือ Centrifuge';
        if (name.includes('na') || name.includes('co') || name.includes('mn') || name.includes('br') || name.includes('q conc')) return 'ตรวจสอบระบบ Catalyst/Solvent Recovery';
        return 'ตรวจสอบ Process Control และประสานงานหน้างานด่วน';
    }

    const LEVEL_LABEL = { '◎': 'กระทบมาก (◎)', '○': 'กระทบปานกลาง (○)', '▷': 'กระทบน้อย (▷)' };

    // SOP-grounded advice from the Factor x Item correlation matrix: which control
    // variables are documented to move this item, ranked High -> Medium -> Low
    // effect. Falls back to the old generic keyword advice when the item isn't
    // covered by the matrix at all (never invents a ranking).
    function getAdvice(paramName) {
        const ranked = CorrelationMatrix.getRankedFactorsForItem(paramName);
        if (ranked.length === 0) return getGenericAdvice(paramName);

        const byLevel = { '◎': [], '○': [], '▷': [] };
        ranked.forEach(r => byLevel[r.level].push(r.factor));
        const parts = ['◎', '○', '▷']
            .filter(level => byLevel[level].length > 0)
            .map(level => `${LEVEL_LABEL[level]}: ${byLevel[level].join(', ')}`);
        return `ตาม SOP ควรตรวจสอบ — ${parts.join(' | ')}`;
    }

    const SOP_FLAG_TEXT = {
        'above-sop-range': ' ⚠️ ค่าที่ปรับเฉลี่ยจากประวัติสูงกว่าช่วง Fine/Fast tune ใน SOP มาก ควรตรวจสอบข้อมูลก่อนเชื่อ',
        'below-sop-range': ' ⚠️ ค่าที่ปรับเฉลี่ยจากประวัติต่ำกว่าช่วง Fine/Fast tune ใน SOP มาก ควรตรวจสอบข้อมูลก่อนเชื่อ'
    };

    function formatSmartAdvice(stats) {
        const sign = (v) => (v >= 0 ? '+' : '');
        const flagText = SOP_FLAG_TEXT[stats.sopFlag] || '';
        return `จากประวัติ ${stats.n} ครั้งที่สำเร็จ: ปรับ ${stats.controlVariable} เฉลี่ย ${sign(stats.avgDeltaControl)}${stats.avgDeltaControl.toFixed(3)}${stats.unit ? ' ' + stats.unit : ''} → พารามิเตอร์เปลี่ยนเฉลี่ย ${sign(stats.avgDeltaParam)}${stats.avgDeltaParam.toFixed(2)}${flagText}`;
    }

    // Among this alert's past similar actions, find the control variable with the
    // strongest data-backed effect size (N>=3, enforced inside getEffectStats). Picks
    // the candidate with the most data points; returns null if none qualify, so the
    // caller falls back to the generic getAdvice() text instead of guessing.
    async function getSmartAdvice(sheet, paramName, bucket, similarActions) {
        const controlVars = [...new Set(similarActions.map(a => a.controlVariable).filter(Boolean))];
        const candidates = [];
        for (const cv of controlVars) {
            const stats = await ActionLog.getEffectStats(sheet, paramName, bucket, cv);
            if (stats) candidates.push({ controlVariable: cv, ...stats });
        }
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => b.n - a.n);
        return candidates[0];
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
                    const smart = await getSmartAdvice(sheet, p.name, bucket, similar);
                    alerts.push({
                        sheet, time: row.dateTimeRaw, timestamp: row.timestamp, param: p.name, value: valObj.mainRaw,
                        limit: evalResult.status === 'oos' ? p.specText : (evalResult.warnSource === 'stat' ? formatBand(evalResult.warnBands) + ' (สถิติ)' : p.warnText),
                        type: evalResult.status, advice: smart ? formatSmartAdvice(smart) : getAdvice(p.name), bucket,
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
