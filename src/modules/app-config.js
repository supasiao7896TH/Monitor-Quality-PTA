/** Central app constants: DB naming, baseline/rolling-window tuning, status labels. */
export const APP_CONFIG = (() => {
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
