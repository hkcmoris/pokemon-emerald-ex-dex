import { deepStrictEqual, strictEqual, ok } from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';

import {
    chooseReviewEvolution,
    clearLevelReview,
    decodePendingLevelReview,
    mergePendingLevelReviews,
    readLevelReview,
    rememberLevelReview,
    type PendingLevelReview,
} from './levelingSession.js';

const base: PendingLevelReview = {
    speciesId: 256,
    formEpoch: 'combusken',
    oldLevel: 18,
    newLevel: 22,
};
const pokemon = (id: string): OwnedPokemon => ({
    id,
    playthroughId: 'run',
    nickname: '',
    state: { speciesId: 256, formEpoch: 'combusken', level: 30, moves: null },
    createdAt: '2026-10-17T00:00:00Z',
    deleted: false,
});
const prefix = 'emerald-ex:pending-level-review:v2:';

void test('pending-review decoding rejects malformed levels, forms and evolution choices', () => {
    deepStrictEqual(decodePendingLevelReview(JSON.stringify(base)), base);
    for (const value of [
        null,
        [],
        'invalid',
        { ...base, oldLevel: 22 },
        { ...base, newLevel: 101 },
        { ...base, oldLevel: 0 },
        { ...base, formEpoch: null },
        { ...base, evolutionSpeciesId: -1 },
    ]) {
        strictEqual(decodePendingLevelReview(JSON.stringify(value)), null);
    }
    strictEqual(decodePendingLevelReview('{broken'), null);
});

void test('same-stage intervals merge without crossing a form change, and remote cancellation clears an evolution choice', () => {
    const selected = { ...base, evolutionSpeciesId: 257 };
    deepStrictEqual(mergePendingLevelReviews(selected, { ...base, oldLevel: 20, newLevel: 25 }), {
        ...selected,
        newLevel: 25,
    });
    deepStrictEqual(mergePendingLevelReviews(selected, base, false), base);
    const evolved = { ...base, speciesId: 257, formEpoch: 'blaziken', oldLevel: 25, newLevel: 26 };
    deepStrictEqual(mergePendingLevelReviews(base, evolved), evolved);
});

void test('per-member storage migrates safely, reconciles other tabs, and retains failed writes locally', () => {
    const values = new Map<string, string>();
    const writes: string[] = [];
    let failWrites = false;
    const storage: Storage = {
        get length() {
            return values.size;
        },
        key: (index) => [...values.keys()][index] ?? null,
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            if (failWrites) throw new Error('quota');
            values.set(key, value);
            writes.push(key);
        },
        removeItem: (key) => {
            values.delete(key);
        },
        clear: () => values.clear(),
    };
    let listener: ((event: StorageEvent) => void) | undefined;
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            localStorage: storage,
            addEventListener: (type: string, handler: (event: StorageEvent) => void) => {
                if (type === 'storage') listener = handler;
            },
        },
    });
    const remote = (id: string, value: PendingLevelReview | null, eventValue = value) => {
        const key = `${prefix}${encodeURIComponent(id)}`;
        values.set(key, JSON.stringify(value));
        listener?.({
            key,
            newValue: JSON.stringify(eventValue),
            storageArea: storage,
        } as StorageEvent);
    };
    try {
        values.set(
            'emerald-ex:pending-level-reviews:v1',
            JSON.stringify([
                ['legacy', base],
                ['reviewed', base],
            ]),
        );
        values.set(`${prefix}reviewed`, 'null');
        deepStrictEqual(readLevelReview(pokemon('legacy')), base);
        strictEqual(readLevelReview(pokemon('reviewed')), null);
        strictEqual(values.has('emerald-ex:pending-level-reviews:v1'), false);
        ok(listener);

        remote('other/member', { ...base, oldLevel: 19, newLevel: 24 });
        const otherRaw = values.get(`${prefix}other%2Fmember`);
        writes.length = 0;
        rememberLevelReview('legacy', { ...base, oldLevel: 22, newLevel: 23 });
        deepStrictEqual(writes, [`${prefix}legacy`]);
        strictEqual(values.get(`${prefix}other%2Fmember`), otherRaw);
        deepStrictEqual(readLevelReview(pokemon('other/member')), {
            ...base,
            oldLevel: 19,
            newLevel: 24,
        });

        remote('legacy', { ...base, oldLevel: 20, newLevel: 25 });
        deepStrictEqual(readLevelReview(pokemon('legacy')), { ...base, newLevel: 25 });
        deepStrictEqual(JSON.parse(values.get(`${prefix}legacy`)!), { ...base, newLevel: 25 });
        chooseReviewEvolution('legacy', 257);
        strictEqual(readLevelReview(pokemon('legacy'))?.evolutionSpeciesId, 257);
        remote('legacy', { ...base, newLevel: 25 });
        strictEqual(readLevelReview(pokemon('legacy'))?.evolutionSpeciesId, undefined);
        remote('legacy', null, base);
        strictEqual(readLevelReview(pokemon('legacy')), null);
        rememberLevelReview('legacy', base);
        remote('legacy', { ...base, oldLevel: 24, newLevel: 25 }, null);
        deepStrictEqual(readLevelReview(pokemon('legacy')), {
            ...base,
            oldLevel: 24,
            newLevel: 25,
        });

        failWrites = true;
        rememberLevelReview('quota', base);
        deepStrictEqual(readLevelReview(pokemon('quota')), base);
        failWrites = false;
        rememberLevelReview('quota', { ...base, oldLevel: 22, newLevel: 24 });
        deepStrictEqual(JSON.parse(values.get(`${prefix}quota`)!), { ...base, newLevel: 24 });
        failWrites = true;
        clearLevelReview('quota');
        chooseReviewEvolution('quota', 257);
        strictEqual(readLevelReview(pokemon('quota')), null);
        failWrites = false;
        clearLevelReview('quota');
        strictEqual(values.get(`${prefix}quota`), 'null');
        strictEqual(readLevelReview(pokemon('quota')), null);
    } finally {
        if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});
