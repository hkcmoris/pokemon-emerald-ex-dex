import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';
import { LanguageProvider } from './language.js';
import { MyPokemonMilestones } from './MyPokemonMilestones.js';

const species = loadCollectionSpeciesFixture([255, 256, 257]);
const torchic = species[255];
const pokemon: OwnedPokemon = {
    id: 'owned',
    playthroughId: 'run',
    nickname: 'Tamago',
    deleted: false,
    createdAt: '2026-10-13T00:00:00.000Z',
    state: { speciesId: 255, level: 11, moves: null, formEpoch: 'stage' },
};

function renderMilestones(
    details: SpeciesDetails = torchic,
    level: number = 11,
    language: 'en' | 'cs' = 'en',
    options: Partial<ComponentProps<typeof MyPokemonMilestones>> = {},
): string {
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client: new QueryClient() },
            createElement(
                LanguageProvider,
                { initialLanguage: language },
                createElement(MyPokemonMilestones, {
                    pokemon: { ...pokemon, state: { ...pokemon.state, level } },
                    details,
                    ...options,
                }),
            ),
        ),
    );
}

void test('shows the next move and evolution together before later moves', () => {
    const markup = renderMilestones();
    assert.equal((markup.match(/<li\b/g) ?? []).length, 2);
    assert.match(markup, /Lv\. 14<\/span>.*Peck/);
    assert.match(markup, /Lv\. 16<\/span>.*evolution-dna\.svg.*Combusken/);
    assert.ok(markup.indexOf('Peck') < markup.indexOf('Combusken'));
    assert.doesNotMatch(markup, /Fire Spin|Quick Attack|Blaziken/);
});

void test('retains a reached evolution level until the owned species changes', () => {
    const markup = renderMilestones(torchic, 16);
    assert.match(markup, /Combusken/);
    assert.match(markup, /Fire Spin/);
    assert.ok(markup.indexOf('Combusken') < markup.indexOf('Fire Spin'));
    assert.doesNotMatch(markup, /Peck/);
});

void test('deduplicates moves and places moves before evolution at the same level', () => {
    const peck = torchic.learnset.find((entry) => entry.name === 'Peck')!;
    const markup = renderMilestones({
        ...torchic,
        learnset: [
            { ...peck, level: 16 },
            { ...peck, level: 16, entryOrder: peck.entryOrder + 1 },
        ],
    });
    assert.equal((markup.match(/<li\b/g) ?? []).length, 2);
    assert.equal((markup.match(/>Peck</g) ?? []).length, 1);
    assert.ok(markup.indexOf('Peck') < markup.indexOf('Combusken'));
});

void test('excludes special move entries, internal evolutions and other species links', () => {
    const peck = torchic.learnset.find((entry) => entry.name === 'Peck')!;
    const evolution = torchic.evolutionLinks.find((entry) => entry.toSpeciesId === 256)!;
    const markup = renderMilestones({
        ...torchic,
        learnset: [{ ...peck, name: 'Special move', level: 0 }, peck],
        evolutionLinks: [
            { ...evolution, toName: 'Internal form', internalOnly: true, level: 1 },
            { ...evolution, toName: 'Other species', fromSpeciesId: 256, level: 1 },
            evolution,
        ],
    });
    assert.match(markup, /Peck/);
    assert.match(markup, /Combusken/);
    assert.doesNotMatch(markup, /Special move|Internal form|Other species/);
});

void test('places non-level evolution after known levels and preserves its condition', () => {
    const peck = torchic.learnset.find((entry) => entry.name === 'Peck')!;
    const evolution = torchic.evolutionLinks.find((entry) => entry.toSpeciesId === 256)!;
    const markup = renderMilestones({
        ...torchic,
        learnset: [peck],
        evolutionLinks: [
            {
                ...evolution,
                method: 'item',
                level: null,
                conditions: { item: 'Fire Stone' },
                summary: 'Use a Fire Stone.',
            },
        ],
    });
    assert.ok(markup.indexOf('Peck') < markup.indexOf('Combusken'));
    assert.match(markup, /aria-label="Evolution: Combusken — Use a Fire Stone\."/);
    assert.equal((markup.match(/my-level-badge/g) ?? []).length, 1);
    assert.doesNotMatch(markup, /ready|level.met/i);
});

void test('localizes milestone labels without repeating plain level conditions', () => {
    const markup = renderMilestones(torchic, 11, 'cs');
    assert.match(markup, /Co vás čeká/);
    assert.match(markup, /aria-label="Vývoj: Combusken \(Lv\. 16\)"/);
    assert.doesNotMatch(markup, /Reach level|Dosáhnout úrovně/);
    assert.match(
        renderMilestones({ ...torchic, learnset: [], evolutionLinks: [] }, 11, 'cs'),
        /Žádné další milníky/,
    );
});

void test('keeps additional evolution conditions when its required level is reached', () => {
    const evolution = torchic.evolutionLinks.find((entry) => entry.toSpeciesId === 256)!;
    const markup = renderMilestones(
        {
            ...torchic,
            learnset: [],
            evolutionLinks: [
                {
                    ...evolution,
                    conditions: { timeOfDay: 'night' },
                    summary: 'Reach level 16 at night.',
                },
            ],
        },
        16,
    );
    assert.match(markup, /aria-label="Evolution: Combusken — Reach level 16 at night\."/);
    assert.doesNotMatch(markup, /ready|level.met/i);
});

const family = Object.values(species);
function wishing(names: string[], level = 11): OwnedPokemon {
    return {
        ...pokemon,
        state: { ...pokemon.state, level },
        moveWishlist: {
            moves: names.map((name) => {
                const move = family
                    .flatMap((entry) => entry.learnset)
                    .find((move) => move.name === name)!;
                return { moveId: move.moveId, name: move.name };
            }),
            learnedMoveIds: [],
            targetSpeciesId: null,
        },
    };
}

void test('the real Torchic wishlist visibly delays evolution to 46 even before the next two moves', () => {
    const owned = wishing(['Flame Burst', 'Flamethrower']);
    const markup = renderMilestones(torchic, 11, 'en', { pokemon: owned, family });
    assert.match(
        markup,
        /Keep Torchic unevolved until Lv\. 46 to learn Flame Burst, Flamethrower, then evolve into Combusken/,
    );
    assert.match(markup, /Peck/);
    assert.match(markup, /Fire Spin/);
    assert.doesNotMatch(markup, /Evolution: Combusken \(Lv\. 16\)/);
    const late = {
        ...owned,
        state: { ...owned.state, level: 45 },
        moveWishlist: {
            ...owned.moveWishlist!,
            learnedMoveIds: [owned.moveWishlist!.moves[0].moveId],
        },
    };
    const lateMarkup = renderMilestones(torchic, 45, 'en', { pokemon: late, family });
    assert.match(lateMarkup, /Lv\. 46<\/span>.*Flamethrower/);
    assert.match(lateMarkup, /aria-label="Evolution: Combusken \(Lv\. 46\)"/);
    assert.ok(lateMarkup.indexOf('>Flamethrower<') < lateMarkup.indexOf('aria-label="Evolution:'));
    assert.match(lateMarkup, /aria-label="Flamethrower is wishlisted"/);
});

void test('current moves and remembered learning release the evolution hold', () => {
    const owned = wishing(['Flame Burst', 'Flamethrower']);
    for (const completed of [
        { ...owned, state: { ...owned.state, moves: owned.moveWishlist!.moves } },
        {
            ...owned,
            moveWishlist: {
                ...owned.moveWishlist!,
                learnedMoveIds: owned.moveWishlist!.moves.map((move) => move.moveId),
            },
        },
    ]) {
        const markup = renderMilestones(torchic, 11, 'en', { pokemon: completed, family });
        assert.match(markup, /aria-label="Evolution: Combusken \(Lv\. 16\)"/);
        assert.doesNotMatch(markup, /Keep Torchic unevolved|Lv\. 46/);
    }
});

void test('coming up excludes current-form moves that occur after planned evolution', () => {
    const owned = wishing(['Peck'], 16);
    owned.moveWishlist!.learnedMoveIds = [owned.moveWishlist!.moves[0].moveId];
    const markup = renderMilestones(torchic, 16, 'en', { pokemon: owned, family });
    assert.match(markup, /aria-label="Evolution: Combusken \(Lv\. 17\)"/);
    assert.doesNotMatch(markup, /Fire Spin|Flame Burst|Flamethrower/);
});

void test('a schedule using a TM explicitly conditions the coming evolution on access', () => {
    const owned = wishing(['Flamethrower', 'Flame Charge']);
    const markup = renderMilestones(torchic, 11, 'en', { pokemon: owned, family });
    assert.match(markup, /Flamethrower \(TM35\)/);
    assert.match(markup, /Confirm access to these machines before evolving/);
    assert.match(markup, /aria-label="Evolution: Combusken \(Lv\. 16\)"/);
    assert.doesNotMatch(markup, /Keep Torchic unevolved/);
});

void test('missing data, impossible wishes and schedule conflicts suppress evolution advice', () => {
    const naturalOnly = family.map((entry) => ({ ...entry, machines: [] }));
    const examples = [
        { pokemon: wishing(['Flamethrower']), family: [torchic] },
        { pokemon: wishing(['Flame Burst'], 29), family },
        {
            pokemon: wishing(['Flamethrower', 'Flame Charge']),
            family: naturalOnly,
            details: naturalOnly[0],
        },
    ];
    for (const options of examples) {
        const markup = renderMilestones(torchic, 11, 'en', options);
        assert.match(markup, /Evolution timing cannot yet be confirmed from the wishlist/);
        assert.doesNotMatch(markup, /evolution-dna\.svg|aria-label="Evolution:/);
    }
    assert.match(renderMilestones(torchic, 11, 'en', examples[0]), /family data is incomplete/);
    assert.match(renderMilestones(torchic, 11, 'en', examples[1]), /Flame Burst/);
});

void test('an unchosen branch and sync conflicts pause evolution guidance', () => {
    const eeveeFamily = loadCollectionSpeciesFixture([133, 134, 135, 136, 196, 197, 470, 471, 700]);
    const eevee = {
        ...wishing(['Peck']),
        state: { ...pokemon.state, speciesId: 133 },
    };
    const branchMarkup = renderMilestones(eeveeFamily[133], 11, 'en', {
        pokemon: eevee,
        family: Object.values(eeveeFamily),
    });
    assert.match(branchMarkup, /Choose a final evolution branch/);
    assert.doesNotMatch(branchMarkup, /evolution-dna\.svg/);
    const pausedMarkup = renderMilestones(torchic, 11, 'en', {
        pokemon: wishing(['Flamethrower']),
        family,
        wishlistPaused: true,
    });
    assert.match(pausedMarkup, /Resolve conflicting Pokémon or wishlist changes/);
    assert.doesNotMatch(pausedMarkup, /evolution-dna\.svg|Keep Torchic unevolved/);
});

void test('Czech coming up explains the hold and offers a checked tracked-move action', () => {
    const markup = renderMilestones(torchic, 27, 'cs', {
        pokemon: wishing(['Flame Burst', 'Flamethrower'], 27),
        family,
        onUpdate: async () => {},
    });
    assert.match(markup, /Ponechte Torchic bez vývoje do úrovně 46/);
    assert.match(markup, /Poté jej vyviňte na Combusken/);
    assert.match(
        markup,
        /aria-label="Odebrat Flame Burst z požadovaných útoků"[^>]*aria-pressed="true"/,
    );
    assert.doesNotMatch(markup, /Keep Torchic|Evolution:/);
});

void test('level-14 Torchic shows Double Kick after Combusken evolution, with or without a wishlist', () => {
    for (const options of [{ family }, { family, pokemon: wishing(['Double Kick'], 14) }]) {
        const markup = renderMilestones(torchic, 14, 'cs', {
            ...options,
            onUpdate: async () => {},
        });
        assert.equal((markup.match(/<li\b/g) ?? []).length, 2);
        assert.match(markup, /Lv\. 16<\/span>.*evolution-dna\.svg.*Combusken/);
        assert.match(markup, /title="Při vývoji na Combusken">Při vývoji<\/span>.*Double Kick/);
        assert.ok(markup.indexOf('my-evolution-milestone') < markup.indexOf('>Double Kick<'));
        assert.match(
            markup,
            /aria-label="(?:Sledovat Double Kick|Odebrat Double Kick z požadovaných útoků)"/,
        );
        assert.doesNotMatch(markup, /Lv\. 0|Fire Spin/);
    }
});

void test('evolution moves follow delayed evolution instead of the raw learning level', () => {
    const markup = renderMilestones(torchic, 20, 'en', {
        family,
        pokemon: wishing(['Double Kick'], 20),
    });
    assert.match(markup, /aria-label="Evolution: Combusken \(Lv\. 21\)"/);
    assert.match(markup, /On evolution<\/span>.*Double Kick/);
    assert.doesNotMatch(markup, /Lv\. 0|Lv\. 1<|Lv\. 16|Flamethrower/);
});

void test('evolution move previews deduplicate entries and require an available target and active evolution', () => {
    const combusken = species[256];
    const kick = combusken.learnset.find((move) => move.moveId === 24 && move.level === 0)!;
    const markup = renderMilestones(torchic, 14, 'en', {
        family: family.map((entry) =>
            entry.speciesId === 256
                ? { ...entry, learnset: [...entry.learnset, { ...kick, entryOrder: 999 }] }
                : entry,
        ),
    });
    assert.equal((markup.match(/>Double Kick</g) ?? []).length, 1);
    assert.doesNotMatch(renderMilestones(torchic, 14), /Double Kick/);
    assert.doesNotMatch(
        renderMilestones(torchic, 14, 'en', { family, wishlistPaused: true }),
        /Double Kick/,
    );
    assert.doesNotMatch(
        renderMilestones(torchic, 29, 'en', {
            family,
            pokemon: wishing(['Flame Burst'], 29),
        }),
        /Double Kick/,
    );
    assert.doesNotMatch(
        renderMilestones(combusken, 16, 'en', {
            family,
            pokemon: { ...pokemon, state: { ...pokemon.state, speciesId: 256, level: 16 } },
        }),
        /Double Kick/,
    );
});

void test('evolution milestones include other species without per-species exceptions', () => {
    const markup = renderMilestones(species[256], 36, 'en', {
        family,
        pokemon: { ...pokemon, state: { ...pokemon.state, speciesId: 256, level: 36 } },
    });
    assert.match(markup, /evolution-dna\.svg.*Blaziken/);
    assert.match(markup, /On evolution<\/span>.*Blaze Kick/);
    assert.doesNotMatch(markup, /Double Kick|Lv\. 0/);
});

void test('a level-one-only move is not presented as an evolution milestone', () => {
    const relatives = loadCollectionSpeciesFixture([21, 22]);
    const markup = renderMilestones(relatives[21], 19, 'en', {
        family: Object.values(relatives),
        pokemon: { ...pokemon, state: { ...pokemon.state, speciesId: 21, level: 19 } },
    });
    assert.match(markup, /Fearow/);
    assert.doesNotMatch(markup, /Drill Run|On evolution/);
});
