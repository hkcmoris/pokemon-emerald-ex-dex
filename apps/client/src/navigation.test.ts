import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { damageSimulatorHref, ownedPokemonHref, parseRoute, speciesHref } from './navigation.js';

void test('species pages have stable static-host-friendly links, including padded IDs', () => {
    strictEqual(speciesHref(25), '#/species/25');
    deepStrictEqual(parseRoute(speciesHref(25)), { kind: 'species', id: 25 });
    deepStrictEqual(parseRoute('#/species/0001'), { kind: 'species', id: 1 });
    for (const hash of ['', '#', '#/']) deepStrictEqual(parseRoute(hash), { kind: 'dex' });
});

void test('invalid routes and IDs cannot trigger a species request', () => {
    for (const hash of [
        '#/species/0',
        '#/species/-1',
        '#/species/65536',
        '#/species/1.2',
        '#/species/1x',
        '#/species/1/unknown',
        '#/moves/25',
    ]) {
        deepStrictEqual(parseRoute(hash), { kind: 'not-found' }, hash);
    }
});

void test('owned Pokemon pages preserve collection IDs and collection links', () => {
    const id = 'c3496d60-83c1-4d21-a27a-3d9056caf0df';
    strictEqual(ownedPokemonHref(id), `#/my-pokemon/${id}`);
    deepStrictEqual(parseRoute(ownedPokemonHref(id)), { kind: 'owned-pokemon', id });
    deepStrictEqual(parseRoute('#/my-pokemon/Torchic_1'), {
        kind: 'owned-pokemon',
        id: 'Torchic_1',
    });
    deepStrictEqual(parseRoute('#/my-pokemon/%54orchic%5F1'), {
        kind: 'owned-pokemon',
        id: 'Torchic_1',
    });
    deepStrictEqual(parseRoute(ownedPokemonHref('a'.repeat(80))), {
        kind: 'owned-pokemon',
        id: 'a'.repeat(80),
    });
    deepStrictEqual(parseRoute('#/my-pokemon'), { kind: 'my-pokemon' });
    deepStrictEqual(parseRoute('#/my-pokemon?add=255'), {
        kind: 'my-pokemon',
        addSpeciesId: 255,
    });
});

void test('owned Pokemon routes reject malformed and unsupported collection IDs', () => {
    for (const hash of [
        '#/my-pokemon/',
        '#/my-pokemon/a/b',
        '#/my-pokemon/a%2Fb',
        '#/my-pokemon/a?add=255',
        '#/my-pokemon/a%3Fadd%3D255',
        '#/my-pokemon/a#b',
        '#/my-pokemon/a%23b',
        '#/my-pokemon/a%20b',
        '#/my-pokemon/%',
        '#/my-pokemon/%C3',
        '#/my-pokemon/__proto__',
        '#/my-pokemon/%63onstructor',
        '#/my-pokemon/prototype',
        `#/my-pokemon/${'a'.repeat(81)}`,
    ]) {
        deepStrictEqual(parseRoute(hash), { kind: 'not-found' }, hash);
    }
});

void test('simulator links address owned identities and reject malformed or nested paths', () => {
    strictEqual(damageSimulatorHref('Pinchy_1'), '#/simulator/Pinchy_1');
    strictEqual(damageSimulatorHref(), '#/simulator');
    deepStrictEqual(parseRoute(damageSimulatorHref()), { kind: 'damage-simulator' });
    deepStrictEqual(parseRoute(damageSimulatorHref('Pinchy_1')), {
        kind: 'damage-simulator',
        id: 'Pinchy_1',
    });
    deepStrictEqual(parseRoute('#/my-pokemon/%50inchy_1/simulator'), {
        kind: 'damage-simulator',
        id: 'Pinchy_1',
    });
    for (const hash of [
        '#/simulator/',
        '#/simulator/__proto__',
        '#/simulator/prototype',
        '#/simulator/%63onstructor',
        '#/simulator/a%2Fb',
        '#/simulator/%',
        '#/simulator/a/extra',
        '#/simulator/a?level=1',
        `#/simulator/${'a'.repeat(81)}`,
        '#/my-pokemon//simulator',
        '#/my-pokemon/__proto__/simulator',
        '#/my-pokemon/a%2Fb/simulator',
        '#/my-pokemon/%/simulator',
        '#/my-pokemon/a/simulator/extra',
        '#/my-pokemon/a/simulator?level=1',
    ])
        deepStrictEqual(parseRoute(hash), { kind: 'not-found' }, hash);
});
