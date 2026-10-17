import { deepStrictEqual, rejects, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';

import {
    clearObservationDraft,
    decodeObservationDraftRecord,
    getObservationDraft,
    isObservationDraftSaving,
    reassignObservationDraft,
    runObservationDraftSave,
    setObservationDraft,
    type ObservationDraft,
} from './observationDrafts.js';

const draft: ObservationDraft = {
    speciesId: 1,
    formEpoch: 'stage',
    level: '13',
    recordedAt: '2026-10-17T12:30',
    stats: { hp: '40' },
};
const targetPokemon: OwnedPokemon = {
    id: 'new-owner',
    playthroughId: 'run',
    nickname: '',
    deleted: false,
    createdAt: '2026-10-17T12:00:00.000Z',
    state: { speciesId: 2, formEpoch: 'new-owner-stage', level: 5, moves: null },
};

void test('screenshot reassignment installs the owner draft before publishing the queue change', async () => {
    setObservationDraft('assignment-source', 'old-owner', draft);
    try {
        const result = await reassignObservationDraft(
            'assignment-source',
            'assignment-target',
            targetPokemon,
            () => {
                // A subscriber mounted by this commit must already see the screenshot's preserved values.
                deepStrictEqual(getObservationDraft('assignment-target'), {
                    ...draft,
                    speciesId: 2,
                    formEpoch: 'new-owner-stage',
                });
                strictEqual(getObservationDraft('assignment-source'), draft);
                return Promise.resolve('committed');
            },
        );
        strictEqual(result, 'committed');
        strictEqual(getObservationDraft('assignment-source'), undefined);
        strictEqual(getObservationDraft('assignment-target')?.level, '13');
    } finally {
        clearObservationDraft('assignment-source');
        clearObservationDraft('assignment-target');
    }
});

void test('failed screenshot reassignment restores the prior target draft and retains the source', async () => {
    const previous = { ...draft, level: '9', speciesId: 2, formEpoch: 'new-owner-stage' };
    setObservationDraft('failed-assignment-source', 'old-owner', draft);
    setObservationDraft('failed-assignment-target', targetPokemon.id, previous);
    try {
        await rejects(
            reassignObservationDraft(
                'failed-assignment-source',
                'failed-assignment-target',
                targetPokemon,
                () => Promise.reject(new Error('Could not persist assignment')),
            ),
        );
        strictEqual(getObservationDraft('failed-assignment-source'), draft);
        strictEqual(getObservationDraft('failed-assignment-target'), previous);
    } finally {
        clearObservationDraft('failed-assignment-source');
        clearObservationDraft('failed-assignment-target');
    }
});

void test('a pending draft save is shared across editors and cannot be submitted twice', async () => {
    const key = 'pending-draft';
    setObservationDraft(key, 'owned', draft);
    let finish!: () => void;
    let writes = 0;
    const saving = runObservationDraftSave(key, () => {
        writes++;
        return new Promise<void>((resolve) => {
            finish = resolve;
        });
    });
    strictEqual(isObservationDraftSaving(key), true);
    strictEqual(
        await runObservationDraftSave(key, () => {
            writes++;
            return Promise.resolve();
        }),
        false,
    );
    strictEqual(writes, 1);
    finish();
    strictEqual(await saving, true);
    strictEqual(isObservationDraftSaving(key), false);
    strictEqual(getObservationDraft(key), undefined);
});

void test('durable draft records retain historical identity, timestamp and intentionally blank fields', () => {
    const record = { pokemonId: 'owned', value: { ...draft, stats: { hp: '40', speed: '' } } };
    deepStrictEqual(decodeObservationDraftRecord(JSON.stringify(record)), record);
    strictEqual(decodeObservationDraftRecord('invalid json'), undefined);
    strictEqual(
        decodeObservationDraftRecord(
            JSON.stringify({ ...record, value: { ...draft, formEpoch: null } }),
        ),
        undefined,
    );
    strictEqual(
        decodeObservationDraftRecord(
            JSON.stringify({ ...record, value: { ...draft, stats: { hp: 40 } } }),
        ),
        undefined,
    );
});

void test('editing and clearing drafts write separate local records without erasing another entry', () => {
    const values = new Map<string, string>();
    const storage: Storage = {
        get length() {
            return values.size;
        },
        key: (index) => [...values.keys()][index] ?? null,
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            values.set(key, value);
        },
        removeItem: (key) => {
            values.delete(key);
        },
        clear: () => values.clear(),
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { localStorage: storage },
    });
    try {
        setObservationDraft('durable-a', 'owned', draft);
        setObservationDraft('durable-b', 'another', { ...draft, level: '22' });
        strictEqual(values.size, 2);
        const persisted = [...values.values()].map(decodeObservationDraftRecord);
        deepStrictEqual(persisted, [
            { pokemonId: 'owned', value: draft },
            { pokemonId: 'another', value: { ...draft, level: '22' } },
        ]);
        clearObservationDraft('durable-a');
        strictEqual(values.size, 1);
        strictEqual([...values.keys()][0].endsWith('durable-b'), true);
    } finally {
        clearObservationDraft('durable-a');
        clearObservationDraft('durable-b');
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});

void test('save completion clears only its submitted draft revision', async () => {
    const key = 'revised-draft';
    setObservationDraft(key, 'owned', draft);
    let finish!: () => void;
    const saving = runObservationDraftSave(
        key,
        () =>
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
    );
    const newer = { ...draft, level: '14', stats: { hp: '43' } };
    setObservationDraft(key, 'owned', newer);
    finish();
    await saving;
    strictEqual(getObservationDraft(key), newer);
    strictEqual(isObservationDraftSaving(key), false);
    clearObservationDraft(key);
});

void test('failed saves retain the draft and allow a later retry', async () => {
    const key = 'failed-draft';
    setObservationDraft(key, 'owned', draft);
    await rejects(
        runObservationDraftSave(key, () => Promise.reject(new Error('Local storage unavailable'))),
    );
    strictEqual(isObservationDraftSaving(key), false);
    strictEqual(getObservationDraft(key), draft);
    strictEqual(await runObservationDraftSave(key, async () => {}), true);
    strictEqual(getObservationDraft(key), undefined);
});
