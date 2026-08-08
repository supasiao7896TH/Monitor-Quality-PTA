/* global Chart */
import { SpecEvaluator } from './spec-evaluator.js';
import { StatEngine } from './stat-engine.js';

/** Trend chart modal (Chart.js) over the accumulated sample history for one parameter. */
export const ChartManager = (() => {
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
