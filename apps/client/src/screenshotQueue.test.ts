import { deepStrictEqual, notStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';
import {
    createStatScreenshot,
    reviseScreenshotQueue,
    screenshotDraftKey,
    validateScreenshotSubmission,
} from './screenshotQueue.js';

const pokemon: OwnedPokemon = {
    id: 'owned',
    playthroughId: 'run',
    nickname: '',
    state: { speciesId: 1, level: 22, moves: null, formEpoch: 'current' },
    deleted: false,
    createdAt: '2026-10-17T12:00:00.000Z',
};

void test('queued screenshots have stable independent observation IDs for safe save retries', () => {
    const first = createStatScreenshot(new Blob(['image'], { type: 'image/png' }), pokemon);
    const second = createStatScreenshot(new Blob(['image2'], { type: 'image/jpeg' }), pokemon);
    notStrictEqual(first.observationId, second.observationId);
    notStrictEqual(screenshotDraftKey(first.id), screenshotDraftKey(second.id));
    const queue = reviseScreenshotQueue([first, second], first.id, { completed: true });
    strictEqual(queue[0].observationId, first.observationId);
    strictEqual(queue[0].image, first.image);
    strictEqual(queue[0].completed, true);
    strictEqual(queue[1], second);
});

void test('stale screenshot submissions are rejected before they can overwrite another member or saved observation', () => {
    const entry = createStatScreenshot(new Blob(['image'], { type: 'image/png' }), pokemon);
    strictEqual(validateScreenshotSubmission([entry], entry.id, pokemon.id), entry);
    throws(() => validateScreenshotSubmission([], entry.id, pokemon.id));
    throws(() =>
        validateScreenshotSubmission([{ ...entry, completed: true }], entry.id, pokemon.id),
    );
    throws(() =>
        validateScreenshotSubmission([{ ...entry, pokemonId: 'other' }], entry.id, pokemon.id),
    );
});

void test('reassignment and discard affect only the chosen screenshot', () => {
    const first = createStatScreenshot(new Blob(['image'], { type: 'image/png' }), pokemon);
    const second = createStatScreenshot(new Blob(['image2'], { type: 'image/png' }), pokemon);
    const queue = reviseScreenshotQueue([first, second], first.id, { pokemonId: 'other' });
    strictEqual(queue[0].pokemonId, 'other');
    strictEqual(queue[0].observationId, first.observationId);
    deepStrictEqual(reviseScreenshotQueue(queue, first.id, 'remove'), [second]);
});

void test('screenshot import rejects non-images and executable SVG documents', () => {
    throws(() => createStatScreenshot(new Blob(['text'], { type: 'text/plain' }), pokemon));
    throws(() => createStatScreenshot(new Blob(['svg'], { type: 'image/svg+xml' }), pokemon));
});
