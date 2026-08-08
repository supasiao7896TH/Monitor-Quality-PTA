import { ActionLog } from './action-log.js';
import { APP_CONFIG } from './app-config.js';
import { UIRenderer } from './ui-renderer.js';

/** Modal form for logging a corrective action against an alert card. */
export const ActionLogUI = (() => {
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
