import { describe, it, expect, vi, beforeEach } from 'vitest';

// SmartAssistant pulls in ActionLog, which pulls in STORAGE_ENGINE (IndexedDB) —
// stub it so buildEpisodeAlerts can run without a real browser. Resolving []
// makes findSimilarActions/getEffectStats no-ops, so every alert falls back to
// the (untested-here) generic/SOP advice text rather than the data-driven path.
vi.mock('../src/modules/storage-engine.js', () => ({
    STORAGE_ENGINE: {
        getActionsBySheetParam: vi.fn()
    }
}));

const { STORAGE_ENGINE } = await import('../src/modules/storage-engine.js');
const { SmartAssistant } = await import('../src/modules/smart-assistant.js');
const { APP_CONFIG } = await import('../src/modules/app-config.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgoTs = (days) => Date.now() - days * DAY_MS;

const paramX = { name: 'X', specText: '1 <= X <= 10', warnText: '8 <= X <= 10' };

// value: 5 -> normal, 9 -> warn, 15 -> oos (per paramX's spec/warn bands above).
function sampleRow(daysAgo, value, paramName = 'X') {
    const timestamp = daysAgoTs(daysAgo);
    return {
        timestamp,
        dateTimeRaw: new Date(timestamp).toISOString(),
        values: { [paramName]: { numeric: value, pending: false, mainRaw: String(value) } }
    };
}

describe('SmartAssistant.buildEpisodeAlerts', () => {
    beforeEach(() => {
        STORAGE_ENGINE.getActionsBySheetParam.mockReset();
        STORAGE_ENGINE.getActionsBySheetParam.mockResolvedValue([]);
    });

    it('excludes a sample older than APP_CONFIG.ALERT_SIDEBAR_WINDOW_DAYS', async () => {
        const oldRow = sampleRow(APP_CONFIG.ALERT_SIDEBAR_WINDOW_DAYS + 5, 15); // OOS but outside the window
        const alerts = await SmartAssistant.buildEpisodeAlerts('Sheet1', [oldRow], [paramX]);
        expect(alerts).toEqual([]);
    });

    it('collapses consecutive same-type OOS samples of one parameter into a single episode', async () => {
        const samples = [sampleRow(3, 15), sampleRow(2, 16), sampleRow(1, 17)]; // ascending time, all OOS
        const alerts = await SmartAssistant.buildEpisodeAlerts('Sheet1', samples, [paramX]);

        expect(alerts.length).toBe(1);
        expect(alerts[0].type).toBe('oos');
        expect(alerts[0].count).toBe(3);
        expect(alerts[0].value).toBe('17'); // latest sample in the episode
    });

    it('splits into two separate episodes when a normal reading recovers in between', async () => {
        const samples = [sampleRow(3, 15), sampleRow(2, 5), sampleRow(1, 17)]; // OOS, normal, OOS
        const alerts = await SmartAssistant.buildEpisodeAlerts('Sheet1', samples, [paramX]);

        expect(alerts.length).toBe(2);
        expect(alerts.every(a => a.count === 1)).toBe(true);
    });

    it('starts a new episode when the status type changes from warn to oos, even back-to-back', async () => {
        const samples = [sampleRow(3, 9), sampleRow(2, 9), sampleRow(1, 15)]; // warn, warn, oos
        const alerts = await SmartAssistant.buildEpisodeAlerts('Sheet1', samples, [paramX]);

        expect(alerts.length).toBe(2);
        expect(alerts.find(a => a.type === 'warn').count).toBe(2);
        expect(alerts.find(a => a.type === 'oos').count).toBe(1);
    });

    it('returns episodes newest-first across parameters, even though they are built per-parameter', async () => {
        const paramY = { name: 'Y', specText: '1 <= X <= 10', warnText: '8 <= X <= 10' };
        const samples = [
            sampleRow(5, 15, 'Y'), // older episode
            sampleRow(1, 15, 'X')  // newer episode
        ];

        // paramY is discovered first (params order), but the newer X episode should sort first.
        const alerts = await SmartAssistant.buildEpisodeAlerts('Sheet1', samples, [paramY, paramX]);

        expect(alerts.map(a => a.param)).toEqual(['X', 'Y']);
    });
});
