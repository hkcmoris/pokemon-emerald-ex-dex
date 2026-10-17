import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import {
    emptyCollection,
    type CollectionDocument,
    type OwnedPokemon,
} from '@pokemon-emerald-ex-dex/shared';

import { getVisitedWorkspaceSelection } from './MyPokemonPage.js';

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
