/** Central app constants: DB naming, baseline/rolling-window tuning, status labels. */
export const APP_CONFIG = (() => {
    const DB_NAME = 'PTAQualityDB';
    const DB_VERSION = 1;
    const DEFAULT_SHEET = '2PZ-402';
    const BASELINE_WINDOW = 30; // rolling window size for statistical fallback
    const BASELINE_K = 2; // mean +/- k*SD
    // Real process control factors from PTA-Quality-Control.md §2 (source: PTA Quality
    // Characteristics Rev.14.xls). fineTune/fastTune are the SOP's documented step sizes
    // for normal vs. emergency adjustment — used to sanity-check calculated effect stats.
    const CONTROL_VARIABLES = [
        { name: 'CTA T-340', stage: 'Feed', tag: 'TM-304', unit: '%', fineTune: '0.01', fastTune: '2 - 3 %' },
        { name: 'CTA 4-CBA', stage: 'Feed', tag: 'TM-304', unit: 'ppm', fineTune: '100 ppm', fastTune: '200 - 300 ppm' },
        { name: 'Reprocess from TTK-401', stage: 'Feed', tag: 'XC1401', unit: 't/h', fineTune: '0.5-1 t/h', fastTune: '2 - 3 t/h' },
        { name: 'CTA feed rate', stage: 'Feed', tag: 'FC2101A', unit: 't/h', fineTune: '0.5-1 t/h', fastTune: '2.5-5 t/h' },
        { name: 'Slurry density', stage: 'Feed', tag: 'AI2100', unit: 'g/cm3', fineTune: '0.001 g/cm3', fastTune: '0.002-0.005 g/cm3' },
        { name: 'Hot oil flow rate', stage: 'Feed', tag: 'FC-2604', unit: 't/h', fineTune: '1 -2 t/h', fastTune: '4-5 t/h' },
        { name: 'H2 purity', stage: 'Feed', tag: 'COA', unit: '% vol.', fineTune: '-', fastTune: '-' },
        { name: 'Reactor pressure', stage: 'Reactor', tag: 'PC-2201', unit: 'kg/cm2', fineTune: '0.1 kg/cm2', fastTune: '0.2-0.5 kg/cm2' },
        { name: 'PCV-2201.MV', stage: 'Reactor', tag: 'PC-2201', unit: '%', fineTune: '-', fastTune: '-' },
        { name: 'Pressure of PD-301', stage: 'Crystallization', tag: 'PC-2301', unit: 'kg/cm2', fineTune: '0.5 Kg/>1Hr', fastTune: '0.5 Kg/<1Hr' },
        { name: 'Level of PD-301', stage: 'Crystallization', tag: 'LC-2301', unit: '%', fineTune: '1%/>30min', fastTune: '1%/<30min' },
        { name: 'Temperature of reslurry water', stage: 'Separation', tag: 'TC-2401', unit: 'oC', fineTune: '1 oC', fastTune: '2-5 oC' },
        { name: 'Reslurry water to PM-401', stage: 'Separation', tag: 'FC-2401A/B', unit: 't/h', fineTune: '0.5-1.0 t/h', fastTune: '1.0-2.0 t/h' },
        { name: 'LPW to suction PP-304', stage: 'Separation', tag: 'FC-2704', unit: 't/h', fineTune: '1 t/h', fastTune: '2-3 t/h' },
        { name: 'RPF Torque', stage: 'Separation', tag: 'XI-2400A/B', unit: 'N.m', fineTune: '-', fastTune: '-' },
        { name: 'CoAc flow rate', stage: 'Separation', tag: 'FI-2450', unit: 'cc/min', fineTune: '1 cc/min', fastTune: '2 cc/min' },
        { name: 'Rinse Ratio RPF', stage: 'Separation', tag: 'RC-2402A/B', unit: '%', fineTune: '0.02', fastTune: '0.04-0.06' },
        { name: 'Recycle water', stage: 'Separation', tag: 'LC-2501A', unit: '%', fineTune: '5 - 10 %', fastTune: '20 -50 %' },
        { name: 'Dryout Temperature', stage: 'Drying', tag: 'TC-2410', unit: 'oC', fineTune: '-', fastTune: '-' },
        { name: 'Dryer steam pressure', stage: 'Drying', tag: 'PC-2404A', unit: 'kg/cm2', fineTune: '0.02 kg/cm2', fastTune: '0.03-0.05 kg/cm2' },
        { name: 'Vibration screen', stage: 'Silo', tag: 'PM-802A(B,C)', unit: '-', fineTune: '-', fastTune: '-' }
    ];
    const STATUS = {
        IDLE: { text: 'Ready', class: 'status-glow-idle' },
        PROCESSING: { text: 'Processing...', class: 'status-glow-processing animate-pulse-fast' },
        ERROR: { text: 'Error', class: 'status-glow-error' }
    };
    return { DB_NAME, DB_VERSION, DEFAULT_SHEET, BASELINE_WINDOW, BASELINE_K, CONTROL_VARIABLES, STATUS };
})();
