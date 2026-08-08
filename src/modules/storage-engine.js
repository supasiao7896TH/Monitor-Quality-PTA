import { APP_CONFIG } from './app-config.js';

/** IndexedDB persistence: samples, per-sheet parameter metadata, and logged actions. */
export const STORAGE_ENGINE = (() => {
    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(APP_CONFIG.DB_NAME, APP_CONFIG.DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('samples')) {
                    const store = db.createObjectStore('samples', { keyPath: 'id' });
                    store.createIndex('sheet', 'sheet', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('sheetMeta')) {
                    db.createObjectStore('sheetMeta', { keyPath: 'sheet' });
                }
                if (!db.objectStoreNames.contains('actions')) {
                    const store = db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('sheetParam', 'sheetParam', { unique: false });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
        return dbPromise;
    }

    async function tx(storeNames, mode) {
        const db = await open();
        return db.transaction(storeNames, mode);
    }

    async function putSample(record) {
        const t = await tx(['samples'], 'readwrite');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('samples').put(record);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function putSheetMeta(record) {
        const t = await tx(['sheetMeta'], 'readwrite');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('sheetMeta').put(record);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getAllSamplesForSheet(sheet) {
        const t = await tx(['samples'], 'readonly');
        return new Promise((resolve, reject) => {
            const idx = t.objectStore('samples').index('sheet');
            const req = idx.getAll(IDBKeyRange.only(sheet));
            req.onsuccess = () => resolve(req.result.sort((a, b) => a.timestamp - b.timestamp));
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getAllSheetNames() {
        const t = await tx(['sheetMeta'], 'readonly');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('sheetMeta').getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getSheetMeta(sheet) {
        const t = await tx(['sheetMeta'], 'readonly');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('sheetMeta').get(sheet);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function addAction(record) {
        const t = await tx(['actions'], 'readwrite');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('actions').add(record);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function updateAction(record) {
        const t = await tx(['actions'], 'readwrite');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('actions').put(record);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getActionsBySheetParam(sheetParam) {
        const t = await tx(['actions'], 'readonly');
        return new Promise((resolve, reject) => {
            const idx = t.objectStore('actions').index('sheetParam');
            const req = idx.getAll(IDBKeyRange.only(sheetParam));
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getAllActions() {
        const t = await tx(['actions'], 'readonly');
        return new Promise((resolve, reject) => {
            const req = t.objectStore('actions').getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function clearAll() {
        const t = await tx(['samples', 'sheetMeta', 'actions'], 'readwrite');
        return Promise.all([
            new Promise((res) => { t.objectStore('samples').clear().onsuccess = res; }),
            new Promise((res) => { t.objectStore('sheetMeta').clear().onsuccess = res; }),
            new Promise((res) => { t.objectStore('actions').clear().onsuccess = res; })
        ]);
    }

    return {
        putSample, putSheetMeta, getAllSamplesForSheet, getAllSheetNames, getSheetMeta,
        addAction, updateAction, getActionsBySheetParam, getAllActions, clearAll
    };
})();
