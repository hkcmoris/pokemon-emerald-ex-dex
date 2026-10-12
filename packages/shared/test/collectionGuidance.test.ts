import { deepStrictEqual, equal, match, ok } from 'node:assert/strict';
import { test } from 'node:test';
import {
    getCatchUpRecap,
    getEvolutionConditions,
    getEvolutionGuidance,
} from '../src/collectionGuidance.js';
import type { OwnedPokemon } from '../src/collection.js';
import { loadCollectionSpeciesFixture } from './fixtures/collectionSpecies.js';
import type {
    LearnsetEntry,
    SpeciesDetails,
    SpeciesEvolution,
    SpeciesMachine,
} from '../src/dex.js';

const owned: OwnedPokemon = {
    id: 'mon',
    playthroughId: 'run',
    nickname: '',
    deleted: false,
    createdAt: '2026-10-12T12:00:00Z',
    state: { speciesId: 1, level: 20, moves: null, formEpoch: 'form1' },
};

function move(moveId: number, level: number): LearnsetEntry {
    return {
        moveId,
        name: `Move ${moveId}`,
        level,
        entryOrder: 0,
        description: '',
        descriptionCs: null,
        typeId: 1,
        type: 'Normal',
        typeIconFile: null,
        categoryId: 1,
        category: 'Physical',
        categoryIconFile: null,
        power: 40,
        accuracy: 100,
        pp: 20,
        priority: 0,
        effectId: 0,
        targetId: 0,
    };
}

function edge(
    fromSpeciesId: number,
    toSpeciesId: number,
    level: number | null,
    method = 'level',
): SpeciesEvolution {
    return {
        fromSpeciesId,
        toSpeciesId,
        level,
        method,
        methodId: 4,
        edgeOrder: 0,
        fromName: `Species ${fromSpeciesId}`,
        toName: `Species ${toSpeciesId}`,
        trigger: level === null ? 'use_item' : 'level_up',
        conditions: {},
        summary: 'Test requirement.',
        rawParam: level ?? 0,
        items: [],
        internalOnly: false,
        fromSprite: null,
        toSprite: null,
    };
}

function species(
    speciesId: number,
    learnset: LearnsetEntry[],
    evolutionFamily: SpeciesEvolution[],
    machines: SpeciesMachine[] = [],
): SpeciesDetails {
    return {
        speciesId,
        name: `Species ${speciesId}`,
        types: [],
        typeIds: [],
        typeIconFiles: [],
        stats: { hp: 1, attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
        baseStatTotal: 6,
        sprites: null,
        abilities: [],
        learnset,
        machines,
        evolutionFamily,
        evolutionLinks: evolutionFamily.filter(
            (evolution) => evolution.fromSpeciesId === speciesId,
        ),
        evolutionBaseSpeciesId: 1,
        formInfo: null,
        forms: null,
        formChanges: [],
    };
}

void test('full-path comparisons find terminal-stage opportunities that an intermediate stage lacks', () => {
    const edges = [edge(1, 2, 25), edge(2, 3, 35)];
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [move(10, 33)], edges),
        2: species(2, [], edges),
        3: species(3, [move(10, 39)], edges),
    });
    equal(advice.length, 1);
    equal(advice[0].kind, 'timing');
    deepStrictEqual(advice[0].branch, [1, 2, 3]);
    deepStrictEqual(advice[0].opportunities, [
        { speciesId: 3, level: 39, machine: null, conditional: false },
    ]);
});

void test('already-passed target learnset levels do not count as future opportunities', () => {
    const edges = [edge(1, 2, 25)];
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [move(10, 28)], edges),
        2: species(2, [move(10, 24)], edges),
    });
    equal(advice[0].kind, 'timing');
    equal(advice[0].actionable, false);
    deepStrictEqual(advice[0].opportunities, []);
    match(advice[0].message, /shared move, not a level-up exclusive/);
    match(advice[0].message, /not upcoming learning opportunities/);
});

void test('branches distinguish no future opportunity from a machine-only alternative', () => {
    const edges = [edge(1, 2, 25), edge(1, 4, null, 'use_item')];
    const machine: SpeciesMachine = { ...move(10, 1), machine: 'TM01', kind: 'TM', number: 1 };
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [move(10, 28)], edges),
        2: species(2, [], edges),
        4: species(4, [], edges, [machine]),
    });
    equal(advice.find((item) => item.branch.at(-1) === 2)!.kind, 'check-before-evolving');
    const alternative = advice.find((item) => item.branch.at(-1) === 4)!;
    equal(alternative.kind, 'check-before-evolving');
    equal(alternative.actionable, true);
    equal(alternative.opportunities[0].conditional, true);
    match(alternative.message, /have the machine/);
});

void test('missing branch details never produce a confident unavailability claim', () => {
    const edges = [edge(1, 2, 25), edge(2, 3, 35)];
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [move(10, 28)], edges),
        2: species(2, [], edges),
    });
    equal(advice[0].kind, 'timing');
    match(advice[0].message, /unconfirmed/);
});

void test('TM/HM compatibility loss stays a comparison instead of a level-up highlight', () => {
    const edges = [edge(1, 2, 25)];
    const machine: SpeciesMachine = { ...move(10, 1), machine: 'HM01', kind: 'HM', number: 1 };
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [], edges, [machine]),
        2: species(2, [], edges),
    });
    equal(advice[0].kind, 'machine-alternative');
    equal(advice[0].actionable, false);
    equal(advice[0].currentLevel, null);
    equal(advice[0].sourceMachine, 'HM01');
    match(advice[0].message, /have the machine/);
});

void test('past learning levels stay in comparisons but do not crowd actionable evolution highlights', () => {
    const edges = [edge(1, 2, 25)];
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [move(1, 1), move(2, 3), move(3, 20), move(4, 37)], edges),
        2: species(2, [], edges),
    });
    deepStrictEqual(
        advice.filter((entry) => entry.actionable).map((entry) => entry.moveId),
        [4],
    );
    match(
        advice.find((entry) => entry.moveId === 1)!.message,
        /does not imply the move can still be learned now/,
    );
});

void test('a machine available now remains in comparisons when its earlier level-up opportunity is past', () => {
    const edges = [edge(1, 2, 25)];
    const machine: SpeciesMachine = { ...move(10, 1), machine: 'TM01', kind: 'TM', number: 1 };
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [move(10, 1)], edges, [machine]),
        2: species(2, [], edges),
    });
    equal(advice[0].kind, 'machine-alternative');
    equal(advice[0].actionable, false);
    equal(advice[0].sourceMachine, 'TM01');
});

void test('raw level-zero entries remain conditional special alternatives, never ordinary passed levels', () => {
    const edges = [edge(1, 2, 25), edge(2, 3, 35)];
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [move(10, 28), move(11, 0)], edges),
        2: species(2, [move(10, 0)], edges),
        3: species(3, [], edges),
    });
    const comparison = advice.find((entry) => entry.sourceSpeciesId === 1 && entry.moveId === 10)!;
    equal(comparison.kind, 'timing');
    deepStrictEqual(comparison.opportunities, [
        { speciesId: 2, level: 0, machine: null, conditional: true },
    ]);
    match(comparison.message, /special entry \(raw level 0; verify/);
    const rawSource = advice.find((entry) => entry.sourceSpeciesId === 1 && entry.moveId === 11)!;
    equal(rawSource.kind, 'timing');
    match(rawSource.message, /not an ordinary level-up/);
    equal(rawSource.message.includes('learning level is already past'), false);
    ok(advice.some((entry) => entry.sourceSpeciesId === 2 && entry.moveId === 10));
});

void test('intermediate stages are compared too and cycles never recurse forever', () => {
    const edges = [edge(1, 2, 25), edge(2, 3, 35), edge(3, 1, 50)];
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [], edges),
        2: species(2, [move(12, 30)], edges),
        3: species(3, [], edges),
    });
    equal(advice.length, 2);
    equal(advice[0].sourceSpeciesId, 2);
    equal(advice[0].kind, 'check-before-evolving');
    equal(advice[0].actionable, true);
    equal(advice[1].kind, 'evolution-gain');
    equal(advice[1].sourceSpeciesId, 2);
});

void test('branch-specific repertoire and missing path data constrain evolution tradeoffs', () => {
    const edges = [edge(1, 2, 25), edge(1, 3, 25), edge(3, 4, 35)];
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [move(10, 28)], edges),
        2: species(2, [move(10, 1), move(11, 30)], edges),
        3: species(3, [move(12, 30)], edges),
    });
    const shared = advice.find((entry) => entry.moveId === 10 && entry.branch.at(-1) === 2)!;
    equal(shared.kind, 'timing');
    equal(shared.actionable, false);
    ok(advice.some((entry) => entry.moveId === 11 && entry.actionable));
    const incomplete = advice.filter((entry) => entry.branch.at(-1) === 4);
    ok(incomplete.length > 0);
    ok(incomplete.every((entry) => !entry.actionable));
    ok(incomplete.every((entry) => entry.message.includes('unconfirmed')));
});

void test('duplicate level-zero and level-one entries do not hide reachable evolved-form gains', () => {
    const edges = [edge(1, 2, 25)];
    const advice = getEvolutionGuidance(owned, {
        1: species(1, [], edges),
        2: species(2, [move(10, 0), move(10, 1), move(10, 63)], edges),
    });
    equal(advice.length, 1);
    equal(advice[0].kind, 'evolution-gain');
    equal(advice[0].currentLevel, 63);
    equal(advice[0].actionable, true);
    deepStrictEqual(advice[0].opportunities, [
        { speciesId: 2, level: 0, machine: null, conditional: true },
        { speciesId: 2, level: 63, machine: null, conditional: false },
    ]);
});

const torchicFamily = loadCollectionSpeciesFixture([255, 256, 257]);
function torchic(level: number): OwnedPokemon {
    return { ...owned, state: { ...owned.state, speciesId: 255, level } };
}

void test('real Torchic learnsets compare Flamethrower waiting against evolution gains without false Peck exclusivity', () => {
    const advice = getEvolutionGuidance(torchic(11), torchicFamily);
    const peck = advice.filter((entry) => entry.name === 'Peck');
    ok(peck.every((entry) => entry.kind === 'timing' && !entry.actionable));
    const flamethrower = advice.find((entry) => entry.name === 'Flamethrower')!;
    equal(flamethrower.kind, 'check-before-evolving');
    equal(flamethrower.sourceSpeciesId, 255);
    equal(flamethrower.currentLevel, 46);
    equal(flamethrower.actionable, true);
    deepStrictEqual(
        flamethrower.opportunities.map((entry) => [entry.speciesId, entry.machine]),
        [
            [256, 'TM35'],
            [257, 'TM35'],
        ],
    );
    match(flamethrower.message, /level-up exclusive/);
    match(flamethrower.message, /TM35/);
    const flameCharge = advice.find(
        (entry) => entry.name === 'Flame Charge' && entry.kind === 'evolution-gain',
    )!;
    equal(flameCharge.actionable, true);
    equal(flameCharge.sourceSpeciesId, 256);
    equal(flameCharge.currentLevel, 20);
    match(flameCharge.message, /delaying earlier evolutions past it can miss/);
    const bulkUp = advice.find(
        (entry) => entry.name === 'Bulk Up' && entry.kind === 'evolution-gain',
    )!;
    equal(bulkUp.actionable, true);
    equal(bulkUp.currentLevel, 31);
    const doubleKick = advice.find(
        (entry) => entry.name === 'Double Kick' && entry.kind === 'evolution-gain',
    )!;
    equal(doubleKick.actionable, false);
    equal(doubleKick.currentLevel, 0);
    match(doubleKick.message, /special learnset entry/);
});

void test('waiting until Torchic level 46 misses early evolved-form gains while later moves remain possible', () => {
    const advice = getEvolutionGuidance(torchic(46), torchicFamily);
    for (const name of ['Flame Charge', 'Bulk Up']) {
        const gain = advice.find(
            (entry) => entry.name === name && entry.kind === 'evolution-gain',
        )!;
        equal(gain.actionable, false, name);
        ok(gain.opportunities.every((entry) => entry.level === null || entry.level === 0));
        match(gain.message, /not an upcoming learning opportunity/);
    }
    const braveBird = advice.find(
        (entry) => entry.name === 'Brave Bird' && entry.kind === 'evolution-gain',
    )!;
    equal(braveBird.actionable, true);
    equal(braveBird.currentLevel, 50);
    equal(braveBird.sourceSpeciesId, 257);
    const flareBlitz = advice.find(
        (entry) => entry.name === 'Flare Blitz' && entry.kind === 'evolution-gain',
    )!;
    equal(flareBlitz.actionable, true);
    equal(flareBlitz.currentLevel, 58);
});

void test('Torchic Flamethrower wait expires at its learning level while the comparison keeps its TM alternative', () => {
    const before = getEvolutionGuidance(torchic(45), torchicFamily).find(
        (entry) => entry.name === 'Flamethrower',
    )!;
    equal(before.kind, 'check-before-evolving');
    equal(before.actionable, true);
    const atLevel = getEvolutionGuidance(torchic(46), torchicFamily).find(
        (entry) => entry.name === 'Flamethrower',
    )!;
    equal(atLevel.kind, 'timing');
    equal(atLevel.actionable, false);
    equal(atLevel.currentLevel, 46);
    match(atLevel.message, /Confirm whether the move was learned at this level/);
    match(atLevel.message, /TM35/);
    equal(atLevel.message.includes('Keep Torchic until'), false);
    ok(atLevel.opportunities.some((entry) => entry.machine === 'TM35'));
});

void test('recorded moves suppress both waiting and evolution-gain highlights without discarding comparisons', () => {
    const pokemon = torchic(11);
    const names = ['Flamethrower', 'Flame Charge'];
    const recorded = names.map((name) => {
        const move = [...torchicFamily[255].learnset, ...torchicFamily[256].learnset].find(
            (entry) => entry.name === name,
        )!;
        return { moveId: move.moveId, name };
    });
    pokemon.state.moves = recorded;
    const advice = getEvolutionGuidance(pokemon, torchicFamily);
    for (const name of names) {
        const entries = advice.filter((entry) => entry.name === name);
        ok(entries.length > 0);
        ok(entries.every((entry) => !entry.actionable));
        ok(entries.every((entry) => entry.message.includes('Already recorded')));
    }
});

void test('recaps are skippable data and never claim unknown evolution requirements are satisfied', () => {
    const original = structuredClone(owned);
    const detail = species(
        1,
        [move(1, 20), move(2, 22), move(3, 27), move(4, 30)],
        [
            edge(1, 2, 25),
            edge(1, 3, 25, 'level_attack_gt_defense'),
            edge(1, 4, null, 'use_item'),
            edge(1, 5, 30),
        ],
    );
    const recap = getCatchUpRecap(detail, 20, 27);
    deepStrictEqual(
        recap.moves.map((entry) => entry.moveId),
        [2, 3],
    );
    equal(recap.evolutions.length, 3);
    equal(recap.evolutions[0].condition, 'level-met');
    ok(recap.evolutions.slice(1).every((entry) => entry.condition === 'unknown'));
    deepStrictEqual(owned, original);
    deepStrictEqual(getCatchUpRecap(detail, 27, 20), { moves: [], evolutions: [] });
});

void test('evolution evidence distinguishes unrecorded moves, observed membership, and unknown conditions', () => {
    const evolution = {
        ...edge(1, 2, null, 'level_knowing_move'),
        conditions: { knownMove: { moveId: 10, name: 'Move 10' }, friendship: 'high' },
    };
    deepStrictEqual(
        getEvolutionConditions(owned, evolution).map((entry) => entry.status),
        ['unknown', 'unknown'],
    );
    const recorded = {
        ...owned,
        state: { ...owned.state, moves: [{ moveId: 10, name: 'Move 10' }] },
    };
    deepStrictEqual(
        getEvolutionConditions(recorded, evolution).map((entry) => entry.status),
        ['met', 'unknown'],
    );
    const partyEvolution = {
        ...edge(1, 2, null, 'level_with_species_in_party'),
        conditions: { speciesInParty: { speciesId: 3, name: 'Species 3' } },
    };
    equal(getEvolutionConditions(owned, partyEvolution)[0].status, 'unknown');
    equal(getEvolutionConditions(owned, partyEvolution, { party: [owned] })[0].status, 'unmet');
    equal(
        getEvolutionConditions(owned, partyEvolution, {
            party: [{ ...owned, state: { ...owned.state, speciesId: 3 } }],
        })[0].status,
        'met',
    );
});

void test('stat conditions use measured current-stage current-level evidence only and remain unknown when contradictory', () => {
    const evolution = {
        ...edge(1, 2, 20, 'level_attack_gt_defense'),
        conditions: { statRelation: 'Attack > Defense' },
    };
    const observation = {
        id: 'a',
        pokemonId: owned.id,
        speciesId: 1,
        formEpoch: 'form1',
        level: 20,
        recordedAt: '2026-10-12T12:00:00Z',
        deleted: false,
        stats: { attack: 40, defense: 30 },
    };
    const evidence = (observations: (typeof observation)[]) =>
        getEvolutionConditions(owned, evolution, { observations }).at(-1)!.status;
    equal(evidence([]), 'unknown');
    equal(evidence([observation]), 'met');
    equal(evidence([{ ...observation, level: 19 }]), 'unknown');
    equal(evidence([{ ...observation, formEpoch: 'old-form' }]), 'unknown');
    equal(
        evidence([observation, { ...observation, id: 'b', stats: { attack: 29, defense: 30 } }]),
        'unknown',
    );
});
