const assert = require('node:assert/strict');
const test = require('node:test');
const { createStorageService } = require('../storage.js');

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createStorage(initial = {}) {
    const values = { ...initial };
    return {
        getItem: key => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
        setItem: (key, value) => { values[key] = String(value); },
        removeItem: key => { delete values[key]; }
    };
}

function createMemoryBackend(options = {}) {
    let state = null;
    let recoveries = [];
    let releaseWrite = null;
    let writeGate = options.holdWrites
        ? new Promise(resolve => { releaseWrite = resolve; })
        : Promise.resolve();

    return {
        async getState() { return clone(state); },
        async putState(record) {
            if (options.failPut) throw new Error('Write failed');
            await writeGate;
            state = clone(record);
            return clone(record);
        },
        async addRecovery(record) {
            recoveries.push(clone(record));
            return clone(record);
        },
        async listRecoveries() { return clone(recoveries); },
        async deleteRecovery(id) {
            recoveries = recoveries.filter(item => item.id !== id);
        },
        async estimate() { return { usage: 0, quota: 1 }; },
        async requestPersistence() { return false; },
        releaseWrites() {
            if (releaseWrite) releaseWrite();
            writeGate = Promise.resolve();
        }
    };
}

function incrementingClock() {
    let value = Date.parse('2026-06-21T00:00:00Z');
    return () => new Date(value += 1000).toISOString();
}

test('migrates validated legacy state and removes it only after read-back verification', async () => {
    const legacy = createStorage({
        egg_app_data: JSON.stringify({ sales: [{ id: 1 }], expenses: [] })
    });
    const backend = createMemoryBackend();
    const service = createStorageService({
        backend,
        legacyStorage: legacy,
        validate: value => Array.isArray(value.sales)
    });

    const result = await service.initialize();

    assert.equal(result.source, 'legacy-migrated');
    assert.equal((await backend.getState()).data.sales[0].id, 1);
    assert.equal(legacy.getItem('egg_app_data'), null);
});

test('failed migration keeps legacy state untouched', async () => {
    const legacyPayload = JSON.stringify({ sales: [{ id: 2 }], expenses: [] });
    const legacy = createStorage({ egg_app_data: legacyPayload });
    const backend = createMemoryBackend({ failPut: true });
    const service = createStorageService({
        backend,
        legacyStorage: legacy,
        validate: value => Array.isArray(value.sales)
    });

    const result = await service.initialize();

    assert.equal(result.source, 'legacy-fallback');
    assert.equal(legacy.getItem('egg_app_data'), legacyPayload);
});

test('coalesces queued saves and never lets an older revision win', async () => {
    const backend = createMemoryBackend({ holdWrites: true });
    const service = createStorageService({
        backend,
        legacyStorage: createStorage(),
        validate: () => true
    });

    const first = service.queueSave({ sales: [{ id: 1 }] });
    const second = service.queueSave({ sales: [{ id: 2 }] });
    backend.releaseWrites();
    const [firstResult, secondResult] = await Promise.all([first, second, service.flush()]);

    assert.deepEqual([firstResult.revision, secondResult.revision], [1, 2]);
    assert.equal((await backend.getState()).data.sales[0].id, 2);
});

test('keeps only the newest three recovery snapshots', async () => {
    const backend = createMemoryBackend();
    const service = createStorageService({
        backend,
        legacyStorage: createStorage(),
        validate: () => true,
        now: incrementingClock()
    });

    for (let id = 1; id <= 4; id += 1) {
        await service.createRecovery({ sales: [{ id }] }, 'cloud-restore');
    }

    const snapshots = await service.listRecoveries();
    assert.deepEqual(snapshots.map(snapshot => snapshot.data.sales[0].id), [4, 3, 2]);
});
