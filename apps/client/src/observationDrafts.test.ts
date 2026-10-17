import { rejects, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import {
    clearObservationDraft,
    getObservationDraft,
    isObservationDraftSaving,
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
