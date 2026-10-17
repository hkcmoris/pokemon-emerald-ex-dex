import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import {
    emptyCollection,
    type CollectionDocument,
    type CollectionConflict,
    type OwnedPokemon,
} from '@pokemon-emerald-ex-dex/shared';

import {
    getVisitedWorkspaceSelection,
    hasPokemonObservationConflict,
    reorderParty,
} from './MyPokemonPage.js';
import { throws } from 'node:assert/strict';

const partyMember: OwnedPokemon = {
    id: 'party-member',
    playthroughId: 'second-run',
    nickname: 'Ember',
    state: { speciesId: 255, level: 12, moves: null, formEpoch: 'first' },
    deleted: false,
    createdAt: '2026-10-12T12:00:00.000Z',
};
const boxedMember: OwnedPokemon = { ...partyMember, id: 'boxed-member' };
const document: CollectionDocument = {
    ...emptyCollection(),
    playthroughs: {
        'first-run': { id: 'first-run', name: 'First', party: [], deleted: false },
        'second-run': { id: 'second-run', name: 'Second', party: [partyMember.id], deleted: false },
    },
    pokemon: { [partyMember.id]: partyMember, [boxedMember.id]: boxedMember },
};

function observationConflict(overrides: Partial<CollectionConflict> = {}): CollectionConflict {
    return {
        id: 'observation-conflict',
        kind: 'field',
        entity: 'observations',
        entityId: 'measurement',
        field: 'stats',
        base: null,
        local: { hp: 30 },
        remote: { hp: 31 },
        ...overrides,
    };
}

void test('observation conflict gating uses the saved owner for field conflicts', () => {
    const withObservation: CollectionDocument = {
        ...document,
        observations: {
            measurement: {
                id: 'measurement',
                pokemonId: partyMember.id,
                speciesId: 255,
                level: 12,
                formEpoch: 'first',
                recordedAt: '2026-10-17T12:00:00.000Z',
                stats: { hp: 30 },
                deleted: false,
            },
        },
    };
    strictEqual(
        hasPokemonObservationConflict(withObservation, [observationConflict()], partyMember.id),
        true,
    );
    strictEqual(
        hasPokemonObservationConflict(withObservation, [observationConflict()], boxedMember.id),
        false,
    );
});

void test('missing observation rows still gate predictions using any full-record conflict alternative', () => {
    for (const field of ['base', 'local', 'remote'] as const) {
        const conflict = observationConflict({
            field: '$entity',
            base: null,
            local: null,
            remote: null,
            [field]: { id: 'measurement', pokemonId: partyMember.id, stats: { hp: 30 } },
        });
        strictEqual(hasPokemonObservationConflict(document, [conflict], partyMember.id), true);
        strictEqual(hasPokemonObservationConflict(document, [conflict], boxedMember.id), false);
    }
});

void test('conflicting observation ownership gates both candidate members but ignores unrelated entities', () => {
    const conflict = observationConflict({
        field: 'pokemonId',
        base: partyMember.id,
        local: partyMember.id,
        remote: boxedMember.id,
    });
    strictEqual(hasPokemonObservationConflict(document, [conflict], partyMember.id), true);
    strictEqual(hasPokemonObservationConflict(document, [conflict], boxedMember.id), true);
    strictEqual(
        hasPokemonObservationConflict(
            document,
            [{ ...conflict, entity: 'pokemon' }],
            partyMember.id,
        ),
        false,
    );
    strictEqual(
        hasPokemonObservationConflict(
            document,
            [observationConflict({ base: [], local: null, remote: false })],
            partyMember.id,
        ),
        false,
    );
});

void test('a directly visited member restores its own run and root mode, including boxed members', () => {
    deepStrictEqual(getVisitedWorkspaceSelection(document, partyMember.id), {
        playthroughId: 'second-run',
        pokemonId: partyMember.id,
        view: 'party',
    });
    deepStrictEqual(getVisitedWorkspaceSelection(document, boxedMember.id), {
        playthroughId: 'second-run',
        pokemonId: boxedMember.id,
        view: 'collection',
    });
});

void test('missing or removed detail routes cannot replace the remembered workspace selection', () => {
    strictEqual(getVisitedWorkspaceSelection(document, undefined), null);
    strictEqual(getVisitedWorkspaceSelection(document, 'missing'), null);
    strictEqual(
        getVisitedWorkspaceSelection(
            {
                ...document,
                pokemon: {
                    ...document.pokemon,
                    [partyMember.id]: { ...partyMember, deleted: true },
                },
            },
            partyMember.id,
        ),
        null,
    );
    strictEqual(
        getVisitedWorkspaceSelection(
            {
                ...document,
                playthroughs: {
                    ...document.playthroughs,
                    'second-run': { ...document.playthroughs['second-run'], deleted: true },
                },
            },
            partyMember.id,
        ),
        null,
    );
});

void test('removing a selected member from the party preserves its collection selection', () => {
    const withoutParty = {
        ...document,
        playthroughs: {
            ...document.playthroughs,
            'second-run': { ...document.playthroughs['second-run'], party: [] },
        },
    };
    deepStrictEqual(getVisitedWorkspaceSelection(withoutParty, partyMember.id), {
        playthroughId: 'second-run',
        pokemonId: partyMember.id,
        view: 'collection',
    });
});

void test('reordering a party keeps member identity and unrelated run fields intact', () => {
    const source = {
        ...document,
        playthroughs: {
            ...document.playthroughs,
            'second-run': {
                ...document.playthroughs['second-run'],
                party: [partyMember.id, boxedMember.id],
            },
        },
    };
    const result = reorderParty(
        source,
        'second-run',
        [partyMember.id, boxedMember.id],
        [boxedMember.id, partyMember.id],
    );
    deepStrictEqual(result.playthroughs['second-run'].party, [boxedMember.id, partyMember.id]);
    strictEqual(result.pokemon, source.pokemon);
    strictEqual(result.playthroughs['second-run'].name, 'Second');
    throws(() =>
        reorderParty(
            result,
            'second-run',
            [partyMember.id, boxedMember.id],
            [boxedMember.id, partyMember.id],
        ),
    );
    throws(() =>
        reorderParty(
            source,
            'second-run',
            [partyMember.id, boxedMember.id],
            [partyMember.id, partyMember.id],
        ),
    );
});
