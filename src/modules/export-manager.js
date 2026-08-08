/* global html2pdf */
import { UIRenderer } from './ui-renderer.js';
import { APP_CONFIG } from './app-config.js';

/** PDF export of the current print area (unchanged behavior from prototype). */
export const ExportManager = (() => {
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
