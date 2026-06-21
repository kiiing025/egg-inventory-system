(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.YolkStorage = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DB_NAME = 'yolk-inventory';
    const DB_VERSION = 1;
    const STATE_STORE = 'app_state';
    const RECOVERY_STORE = 'recovery_snapshots';
    const STATE_ID = 'primary';
    const LEGACY_KEY = 'egg_app_data';
    const RECOVERY_LIMIT = 3;

    function defaultClone(value) {
        if (value == null) return value;
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function requestResult(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
        });
    }

    function transactionComplete(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
            transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
        });
    }

    function createIndexedDbBackend(indexedDb) {
        const databaseApi = indexedDb || (typeof globalThis !== 'undefined' ? globalThis.indexedDB : null);
        if (!databaseApi) throw new Error('IndexedDB is not available on this device.');

        let databasePromise = null;
        function openDatabase() {
            if (databasePromise) return databasePromise;
            databasePromise = new Promise((resolve, reject) => {
                const request = databaseApi.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains(STATE_STORE)) {
                        database.createObjectStore(STATE_STORE, { keyPath: 'id' });
                    }
                    if (!database.objectStoreNames.contains(RECOVERY_STORE)) {
                        database.createObjectStore(RECOVERY_STORE, { keyPath: 'id' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    databasePromise = null;
                    reject(request.error || new Error('Could not open phone storage.'));
                };
                request.onblocked = () => {
                    databasePromise = null;
                    reject(new Error('Phone storage upgrade is blocked by another open app tab.'));
                };
            });
            return databasePromise;
        }

        async function runTransaction(storeName, mode, operation) {
            const database = await openDatabase();
            const transaction = database.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            const result = operation(store);
            const requestPromise = result && typeof result.onsuccess !== 'undefined'
                ? requestResult(result)
                : Promise.resolve(result);
            const [requestValue] = await Promise.all([requestPromise, transactionComplete(transaction)]);
            return requestValue;
        }

        return {
            async getState() {
                const record = await runTransaction(STATE_STORE, 'readonly', store => store.get(STATE_ID));
                return record || null;
            },
            async putState(record) {
                const stored = { ...record, id: STATE_ID };
                await runTransaction(STATE_STORE, 'readwrite', store => store.put(stored));
                return stored;
            },
            async deleteState() {
                await runTransaction(STATE_STORE, 'readwrite', store => store.delete(STATE_ID));
            },
            async addRecovery(record) {
                await runTransaction(RECOVERY_STORE, 'readwrite', store => store.put(record));
                return record;
            },
            async listRecoveries() {
                const records = await runTransaction(RECOVERY_STORE, 'readonly', store => store.getAll());
                return records || [];
            },
            async deleteRecovery(id) {
                await runTransaction(RECOVERY_STORE, 'readwrite', store => store.delete(id));
            },
            async estimate() {
                const manager = typeof navigator !== 'undefined' ? navigator.storage : null;
                return manager?.estimate ? manager.estimate() : { usage: 0, quota: 0 };
            },
            async requestPersistence() {
                const manager = typeof navigator !== 'undefined' ? navigator.storage : null;
                return manager?.persist ? manager.persist() : false;
            }
        };
    }

    function createStorageService(options = {}) {
        const backend = options.backend || createIndexedDbBackend(options.indexedDB);
        const legacyStorage = options.legacyStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
        const validate = options.validate || (() => true);
        const now = options.now || (() => new Date().toISOString());
        const clone = options.clone || defaultClone;
        const listeners = new Set();
        let revision = 0;
        let issuedRevision = 0;
        let recoverySequence = 0;
        let queuedRecord = null;
        let drainPromise = null;
        let waiters = [];
        let status = {
            state: 'idle',
            message: 'Phone storage is ready.',
            error: null,
            revision: 0
        };

        function updateStatus(changes) {
            status = { ...status, ...changes };
            const snapshot = clone(status);
            listeners.forEach(listener => listener(snapshot));
        }

        function validData(data) {
            try {
                return Boolean(validate(data));
            } catch (_) {
                return false;
            }
        }

        function settleWaiters(savedRevision, error) {
            const remaining = [];
            waiters.forEach(waiter => {
                if (waiter.revision <= savedRevision) {
                    if (error) waiter.reject(error);
                    else waiter.resolve({ revision: savedRevision });
                } else {
                    remaining.push(waiter);
                }
            });
            waiters = remaining;
        }

        async function drainQueue() {
            while (queuedRecord) {
                const record = queuedRecord;
                queuedRecord = null;
                try {
                    await backend.putState(clone(record));
                    revision = Math.max(revision, record.revision);
                    settleWaiters(record.revision, null);
                    updateStatus({
                        state: queuedRecord ? 'saving' : 'saved',
                        message: queuedRecord ? 'Saving newest phone changes...' : 'Saved on phone',
                        error: null,
                        revision
                    });
                } catch (error) {
                    if (!queuedRecord || queuedRecord.revision < record.revision) queuedRecord = record;
                    settleWaiters(record.revision, error);
                    updateStatus({
                        state: 'error',
                        message: 'Phone save failed. Your unsaved changes are still open for retry.',
                        error: error?.message || String(error),
                        revision
                    });
                    throw error;
                }
            }
            return { revision };
        }

        function startDrain() {
            if (!drainPromise) {
                drainPromise = drainQueue().finally(() => {
                    drainPromise = null;
                });
            }
            return drainPromise;
        }

        async function initialize() {
            updateStatus({ state: 'loading', message: 'Opening phone storage...', error: null });
            const existing = await backend.getState();
            if (existing) {
                if (!validData(existing.data)) {
                    const error = new Error('Saved phone data did not pass validation.');
                    updateStatus({ state: 'error', message: error.message, error: error.message });
                    throw error;
                }
                revision = Number(existing.revision) || 0;
                issuedRevision = revision;
                updateStatus({ state: 'saved', message: 'Loaded from phone', error: null, revision });
                return { source: 'indexeddb', data: clone(existing.data), revision };
            }

            const legacyText = legacyStorage?.getItem?.(LEGACY_KEY);
            if (legacyText != null) {
                let legacyData;
                try {
                    legacyData = JSON.parse(legacyText);
                } catch (_) {
                    const error = new Error('Existing phone data could not be read.');
                    updateStatus({ state: 'error', message: error.message, error: error.message });
                    throw error;
                }
                if (!validData(legacyData)) {
                    const error = new Error('Existing phone data did not pass validation.');
                    updateStatus({ state: 'error', message: error.message, error: error.message });
                    throw error;
                }

                const migrationRecord = {
                    id: STATE_ID,
                    revision: 1,
                    savedAt: now(),
                    data: clone(legacyData)
                };
                try {
                    await backend.putState(migrationRecord);
                    const verified = await backend.getState();
                    const exactCopy = verified &&
                        JSON.stringify(verified.data) === JSON.stringify(migrationRecord.data);
                    if (!verified || verified.revision !== migrationRecord.revision ||
                        !validData(verified.data) || !exactCopy) {
                        throw new Error('Migrated phone data could not be verified.');
                    }
                    revision = migrationRecord.revision;
                    issuedRevision = revision;
                    legacyStorage.removeItem(LEGACY_KEY);
                    updateStatus({ state: 'saved', message: 'Phone data upgraded safely', error: null, revision });
                    return { source: 'legacy-migrated', data: clone(verified.data), revision };
                } catch (error) {
                    if (typeof backend.deleteState === 'function') {
                        try {
                            await backend.deleteState();
                        } catch (_) {
                            // The original localStorage copy remains authoritative.
                        }
                    }
                    updateStatus({
                        state: 'error',
                        message: 'Could not upgrade phone storage; using the preserved local copy.',
                        error: error?.message || String(error)
                    });
                    return { source: 'legacy-fallback', data: clone(legacyData), revision: 0, error };
                }
            }

            updateStatus({ state: 'saved', message: 'Phone storage is ready', error: null, revision: 0 });
            return { source: 'empty', data: null, revision: 0 };
        }

        function queueSave(data) {
            if (!validData(data)) return Promise.reject(new Error('Phone data did not pass validation.'));
            const nextRevision = ++issuedRevision;
            queuedRecord = {
                id: STATE_ID,
                revision: nextRevision,
                savedAt: now(),
                data: clone(data)
            };
            updateStatus({ state: 'saving', message: 'Saving on phone...', error: null });
            const completion = new Promise((resolve, reject) => {
                waiters.push({ revision: nextRevision, resolve, reject });
            });
            startDrain().catch(() => {});
            return completion;
        }

        async function flush() {
            if (queuedRecord && !drainPromise) startDrain().catch(() => {});
            if (drainPromise) await drainPromise;
            return { revision };
        }

        async function listRecoveries() {
            const records = await backend.listRecoveries();
            return records
                .filter(record => record && validData(record.data))
                .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
                .map(clone);
        }

        async function createRecovery(data, reason = 'manual') {
            if (!validData(data)) throw new Error('Recovery data did not pass validation.');
            const createdAt = now();
            const record = {
                id: `recovery-${createdAt}-${++recoverySequence}`,
                createdAt,
                reason,
                data: clone(data)
            };
            await backend.addRecovery(record);
            const records = await listRecoveries();
            await Promise.all(records.slice(RECOVERY_LIMIT).map(item => backend.deleteRecovery(item.id)));
            return clone(record);
        }

        async function restoreRecovery(id) {
            const record = (await listRecoveries()).find(item => item.id === id);
            if (!record) throw new Error('Recovery snapshot was not found.');
            await queueSave(record.data);
            await flush();
            return clone(record.data);
        }

        return {
            initialize,
            queueSave,
            flush,
            createRecovery,
            listRecoveries,
            restoreRecovery,
            estimate: () => backend.estimate(),
            requestPersistence: () => backend.requestPersistence(),
            getStatus: () => clone(status),
            subscribe(listener) {
                listeners.add(listener);
                listener(clone(status));
                return () => listeners.delete(listener);
            }
        };
    }

    return {
        DB_NAME,
        DB_VERSION,
        createIndexedDbBackend,
        createStorageService
    };
}));
