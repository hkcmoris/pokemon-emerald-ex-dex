import { deepStrictEqual, equal, match, ok } from 'node:assert/strict';
import { test } from 'node:test';
import type { KnownMove, OwnedPokemon } from '../src/collection.js';
import type {
    LearnsetEntry,
    SpeciesDetails,
    SpeciesEvolution,
    SpeciesMachine,
} from '../src/dex.js';
import {
    assessMoveWishlistAddition,
    MOVE_REMINDER_ALTERNATIVES_ENABLED,
    planMoveWishlist,
} from '../src/movePlanner.js';
import { loadCollectionSpeciesFixture } from './fixtures/collectionSpecies.js';
import { getEvolutionMoves } from '../src/evolutionMoves.js';

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
        summary: 'Use the required evolution item.',
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
    evolutionFamily: SpeciesEvolution[] = [],
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
function owned(
    speciesId: number,
    level: number,
    moves: KnownMove[],
    targetSpeciesId: number | null = null,
): OwnedPokemon {
    return {
        id: 'mon',
        playthroughId: 'run',
        nickname: '',
        deleted: false,
        createdAt: '2026-10-14T12:00:00Z',
        state: { speciesId, level, moves: null, formEpoch: 'form1' },
        moveWishlist: { moves, learnedMoveIds: [], targetSpeciesId },
    };
}
const torchicFamily = loadCollectionSpeciesFixture([255, 256, 257]);
function torchicMove(name: string): KnownMove {
    const result = Object.values(torchicFamily)
        .flatMap((entry) => entry.learnset)
        .find((entry) => entry.name === name);
    if (!result) throw new Error(`Missing fixture move ${name}`);
    return { moveId: result.moveId, name: result.name };
}

void test('raw level-zero entries are exposed without duplicate level-one moves', () => {
    const combusken = torchicFamily[256];
    const doubleKick = combusken.learnset.find((move) => move.moveId === 24 && move.level === 0)!;
    deepStrictEqual(
        getEvolutionMoves({ ...combusken, learnset: [...combusken.learnset, doubleKick] }).map(
            (move) => [move.moveId, move.level],
        ),
        [[24, 0]],
    );
    deepStrictEqual(getEvolutionMoves(torchicFamily[255]), []);
    deepStrictEqual(
        getEvolutionMoves(torchicFamily[257]).map((move) => move.moveId),
        [299],
    );
    deepStrictEqual(
        getEvolutionMoves({
            ...combusken,
            learnset: combusken.learnset.filter((move) => move.level !== 0),
        }),
        [],
    );
});

void test('Torchic can wishlist Double Kick and learns it immediately after evolving at level 16', () => {
    const result = assessMoveWishlistAddition(
        owned(255, 14, []),
        torchicFamily,
        torchicMove('Double Kick'),
    );
    equal(result.allowed, true);
    equal(result.plan.status, 'ready');
    equal(result.status, 'natural');
    deepStrictEqual(result.plan.moves[0].source, {
        kind: 'evolution',
        speciesId: 256,
        level: 16,
        machine: null,
        requirement: null,
    });
    deepStrictEqual(
        result.plan.steps.map((step) => [
            step.kind,
            step.level,
            step.kind === 'learn' ? step.name : step.toSpeciesId,
        ]),
        [
            ['evolve', 16, 256],
            ['learn', 16, 'Double Kick'],
            ['evolve', 36, 257],
        ],
    );
});

void test('Double Kick remains available after waiting for Torchic Flamethrower', () => {
    const plan = planMoveWishlist(
        owned(255, 14, ['Flamethrower', 'Double Kick'].map(torchicMove)),
        torchicFamily,
    );
    equal(plan.status, 'ready');
    ok(plan.moves.every((move) => move.status === 'natural'));
    deepStrictEqual(
        plan.steps.map((step) => [
            step.kind,
            step.level,
            step.kind === 'learn' ? step.name : step.toSpeciesId,
        ]),
        [
            ['learn', 46, 'Flamethrower'],
            ['evolve', 46, 256],
            ['learn', 46, 'Double Kick'],
            ['evolve', 47, 257],
        ],
    );
});

void test('recorded Combusken cannot recover Double Kick from its past evolution', () => {
    const result = assessMoveWishlistAddition(
        owned(256, 16, []),
        torchicFamily,
        torchicMove('Double Kick'),
    );
    equal(result.allowed, false);
    equal(result.status, 'unreachable');
    ok(result.plan.steps.every((step) => step.kind !== 'learn' || step.moveId !== 24));
});

void test('Blaziken Blaze Kick is learned from its own evolution entry', () => {
    const result = assessMoveWishlistAddition(
        owned(255, 14, []),
        torchicFamily,
        torchicMove('Blaze Kick'),
    );
    equal(result.allowed, true);
    equal(result.status, 'natural');
    deepStrictEqual(result.plan.moves[0].source, {
        kind: 'evolution',
        speciesId: 257,
        level: 36,
        machine: null,
        requirement: null,
    });
    equal(MOVE_REMINDER_ALTERNATIVES_ENABLED, false);
});

void test('evolution moves use raw data for arbitrary species and move IDs', () => {
    const edges = [edge(9001, 9002, 30)];
    const evolutionMove = move(9003, 0);
    const family = {
        9001: species(9001, [], edges),
        9002: species(
            9002,
            [evolutionMove, { ...evolutionMove, entryOrder: 1 }, move(9004, 1)],
            edges,
        ),
    };
    deepStrictEqual(
        getEvolutionMoves(family[9002]).map((entry) => entry.moveId),
        [9003],
    );
    const plan = planMoveWishlist(owned(9001, 20, [evolutionMove]), family);
    equal(plan.status, 'ready');
    equal(plan.moves[0].source?.kind, 'evolution');
    deepStrictEqual(
        plan.steps.map((step) => [step.kind, step.level]),
        [
            ['evolve', 30],
            ['learn', 30],
        ],
    );
});

void test('Sceptile Leaf Blade is offered on evolution without a duplicate level-one entry', () => {
    const family = loadCollectionSpeciesFixture([253, 254]);
    const leafBlade = family[254].learnset.find(
        (move) => move.name === 'Leaf Blade' && move.level === 0,
    )!;
    equal(
        family[254].learnset.some((move) => move.moveId === leafBlade.moveId && move.level === 1),
        false,
    );
    deepStrictEqual(
        getEvolutionMoves(family[254]).map((move) => move.moveId),
        [leafBlade.moveId],
    );
    const result = assessMoveWishlistAddition(owned(253, 35, []), family, leafBlade);
    equal(result.allowed, true);
    deepStrictEqual(result.plan.moves[0].source, {
        kind: 'evolution',
        speciesId: 254,
        level: 36,
        machine: null,
        requirement: null,
    });
});

void test('Fearow Drill Run is a level-45 opportunity, not an evolution move inferred from level one', () => {
    const family = loadCollectionSpeciesFixture([21, 22]);
    const drillRun = family[22].learnset.find((move) => move.name === 'Drill Run')!;
    deepStrictEqual(
        family[22].learnset
            .filter((move) => move.moveId === drillRun.moveId)
            .map((move) => move.level),
        [1, 45],
    );
    deepStrictEqual(getEvolutionMoves(family[22]), []);
    const result = assessMoveWishlistAddition(owned(21, 19, []), family, drillRun);
    equal(result.allowed, true);
    equal(result.plan.moves[0].source?.kind, 'level-up');
    equal(result.plan.moves[0].source?.level, 45);
});

void test('Torchic keeps Flamethrower until 46, evolves once per level, then learns Brave Bird at 50', () => {
    const wishes = ['Flamethrower', 'Brave Bird'].map(torchicMove);
    const plan = planMoveWishlist(owned(255, 11, wishes), torchicFamily);
    equal(plan.status, 'ready');
    equal(plan.targetSpeciesId, 257);
    ok(plan.moves.every((entry) => entry.status === 'natural'));
    deepStrictEqual(
        plan.steps.map((step) => [
            step.kind,
            step.level,
            step.kind === 'learn' ? step.name : step.toSpeciesId,
        ]),
        [
            ['learn', 46, 'Flamethrower'],
            ['evolve', 46, 256],
            ['evolve', 47, 257],
            ['learn', 50, 'Brave Bird'],
        ],
    );
});

void test('Flame Charge fits the Torchic wishlist only by explicitly requiring TM35 for Flamethrower', () => {
    const pokemon = owned(255, 11, ['Flamethrower', 'Brave Bird'].map(torchicMove));
    const result = assessMoveWishlistAddition(pokemon, torchicFamily, torchicMove('Flame Charge'));
    equal(result.allowed, true);
    const flamethrower = result.plan.moves.find((entry) => entry.name === 'Flamethrower')!;
    equal(flamethrower.status, 'conditional');
    equal(flamethrower.source?.machine, 'TM35');
    match(flamethrower.reason!, /Requires access to TM35/);
    equal(result.plan.moves.find((entry) => entry.name === 'Flame Charge')?.status, 'natural');
    equal(result.plan.moves.find((entry) => entry.name === 'Brave Bird')?.status, 'natural');
});

void test('without a machine route the conflicting Flame Charge selection is blocked with the precise wish', () => {
    const naturalOnly = Object.fromEntries(
        Object.entries(torchicFamily).map(([id, data]) => [id, { ...data, machines: [] }]),
    );
    const pokemon = owned(255, 11, ['Flamethrower', 'Brave Bird'].map(torchicMove));
    const result = assessMoveWishlistAddition(pokemon, naturalOnly, torchicMove('Flame Charge'));
    equal(result.allowed, false);
    equal(result.status, 'conflict');
    deepStrictEqual(result.conflictingMoveIds, [torchicMove('Flamethrower').moveId]);
    match(result.reason!, /Flamethrower/);
    equal(pokemon.moveWishlist!.moves.length, 2);
});

void test('an acquired wish is complete from current moves or permanent acquisition history', () => {
    const wishes = ['Flamethrower', 'Brave Bird'].map(torchicMove);
    const pokemon = owned(255, 11, wishes);
    pokemon.state.moves = [wishes[0]];
    const current = planMoveWishlist(pokemon, torchicFamily);
    equal(current.moves[0].status, 'learned');
    deepStrictEqual(
        current.steps.filter((step) => step.kind === 'evolve').map((step) => step.level),
        [16, 36],
    );
    pokemon.state.moves = [];
    pokemon.moveWishlist!.learnedMoveIds = [wishes[0].moveId];
    equal(planMoveWishlist(pokemon, torchicFamily).moves[0].status, 'learned');
});

void test('past wishes stay visible after evolving without blocking unrelated feasible additions', () => {
    const pokemon = owned(257, 47, [torchicMove('Flame Charge')]);
    const base = planMoveWishlist(pokemon, torchicFamily);
    equal(base.moves[0].status, 'unreachable');
    const result = assessMoveWishlistAddition(pokemon, torchicFamily, torchicMove('Brave Bird'));
    equal(result.allowed, true);
    equal(result.plan.moves[0].status, 'unreachable');
    equal(result.plan.moves[1].status, 'natural');
    ok(result.plan.warnings.some((warning) => warning.includes('Flame Charge')));
});

void test('the wishlist can plan more than four acquisitions and does not reserve move slots', () => {
    const moves = Array.from({ length: 8 }, (_, index) => move(index + 1, index + 12));
    const plan = planMoveWishlist(owned(1, 10, moves), { 1: species(1, moves) });
    equal(plan.status, 'ready');
    equal(plan.moves.length, 8);
    equal(plan.steps.length, 8);
    ok(plan.moves.every((entry) => entry.status === 'natural'));
});

void test('branches require a terminal choice, and moves on a different branch are unavailable', () => {
    const edges = [edge(1, 2, 16), edge(1, 3, 16)];
    const family = {
        1: species(1, [], edges),
        2: species(2, [move(10, 20)], edges),
        3: species(3, [move(11, 20)], edges),
    };
    const pokemon = owned(1, 10, []);
    equal(planMoveWishlist(pokemon, family).status, 'choose-branch');
    equal(assessMoveWishlistAddition(pokemon, family, move(10, 20)).allowed, false);
    pokemon.moveWishlist!.targetSpeciesId = 2;
    equal(assessMoveWishlistAddition(pokemon, family, move(10, 20)).allowed, true);
    const otherBranch = assessMoveWishlistAddition(pokemon, family, move(11, 20));
    equal(otherBranch.allowed, false);
    equal(otherBranch.status, 'unreachable');
});

void test('a retained target from another branch produces a warning instead of silently changing the target', () => {
    const family = { 2: species(2, []) };
    const plan = planMoveWishlist(owned(2, 20, [move(10, 30)], 3), family);
    equal(plan.status, 'unreachable');
    equal(plan.targetSpeciesId, 3);
    match(plan.warnings[0], /not reachable/);
});

void test('missing intermediate family data stays unknown and cannot block a move as impossible', () => {
    const edges = [edge(1, 2, 16), edge(2, 3, 36)];
    const family = { 1: species(1, [], edges), 3: species(3, [move(10, 50)], edges) };
    const result = assessMoveWishlistAddition(owned(1, 10, []), family, move(10, 50));
    equal(result.allowed, false);
    equal(result.status, 'unknown');
    equal(result.plan.status, 'unknown');
    deepStrictEqual(result.plan.missingSpeciesIds, [2]);
});

void test('raw evolution moves are supported without enabling ordinary same-level target learning', () => {
    const edges = [edge(1, 2, 16)];
    const family = {
        1: species(1, [], edges),
        2: species(2, [move(10, 16), move(11, 0), move(12, 17)], edges),
    };
    const pokemon = owned(1, 15, []);
    for (const id of [10]) {
        const result = assessMoveWishlistAddition(pokemon, family, move(id, 0));
        equal(result.allowed, false);
        equal(result.status, 'unreachable');
        match(result.reason!, /No verified learning route/);
    }
    const onEvolution = assessMoveWishlistAddition(pokemon, family, move(11, 0));
    equal(onEvolution.allowed, true);
    equal(onEvolution.plan.moves[0].source?.kind, 'evolution');
    equal(onEvolution.plan.moves[0].source?.level, 16);
    equal(assessMoveWishlistAddition(pokemon, family, move(12, 17)).allowed, true);
    equal(MOVE_REMINDER_ALTERNATIVES_ENABLED, false);
});

void test('moves at or below the current level need a conditional machine or recorded acquisition', () => {
    const machines: SpeciesMachine[] = [
        { ...move(10, 20), machine: 'TM01', kind: 'TM', number: 1 },
    ];
    const family = { 1: species(1, [move(10, 20), move(11, 19)], [], machines) };
    const plan = planMoveWishlist(owned(1, 20, [move(10, 20), move(11, 19)]), family);
    equal(plan.moves[0].status, 'conditional');
    equal(plan.moves[1].status, 'unreachable');
});

void test('at level 100 level-up evolution cannot happen, while a final form can still use a machine', () => {
    const edges = [edge(1, 2, 16)];
    const machines: SpeciesMachine[] = [
        { ...move(10, 20), machine: 'TM01', kind: 'TM', number: 1 },
    ];
    const family = { 1: species(1, [], edges), 2: species(2, [], edges, machines) };
    equal(planMoveWishlist(owned(1, 100, []), family).status, 'unreachable');
    const terminal = planMoveWishlist(owned(2, 100, [move(10, 20)]), family);
    equal(terminal.status, 'ready');
    equal(terminal.moves[0].status, 'conditional');
});

void test('one late learning event cannot be followed by two level-up evolutions on the same level', () => {
    const edges = [edge(1, 2, 16), edge(2, 3, 36)];
    const family = {
        1: species(1, [move(10, 99)], edges),
        2: species(2, [], edges),
        3: species(3, [move(11, 100)], edges),
    };
    const result = assessMoveWishlistAddition(owned(1, 90, [move(10, 99)]), family, move(11, 100));
    equal(result.allowed, false);
    equal(result.status, 'conflict');
});

void test('item evolution can happen now, with its game requirements visible on the step', () => {
    const edges = [edge(1, 2, null, 'item')];
    const family = { 1: species(1, [], edges), 2: species(2, [move(10, 21)], edges) };
    const plan = planMoveWishlist(owned(1, 20, [move(10, 21)]), family);
    equal(plan.status, 'ready');
    const evolution = plan.steps[0];
    ok(evolution.kind === 'evolve');
    equal(evolution.level, 20);
    equal(evolution.conditional, true);
    equal(evolution.evolution.summary, 'Use the required evolution item.');
    equal(plan.steps[1].level, 21);
});

void test('internal-only edges are ignored and cyclic families cannot fabricate a terminal form', () => {
    const internal = { ...edge(1, 2, 16), internalOnly: true };
    equal(planMoveWishlist(owned(1, 10, []), { 1: species(1, [], [internal]) }).status, 'ready');
    const edges = [edge(1, 2, 16), edge(2, 1, 20)];
    const cyclic = planMoveWishlist(owned(1, 10, []), {
        1: species(1, [], edges),
        2: species(2, [], edges),
    });
    equal(cyclic.status, 'unknown');
});

void test('planner translates user-facing warnings and machine conditions', () => {
    const family = {
        1: species(1, [], [], [{ ...move(10, 1), machine: 'TM01', kind: 'TM', number: 1 }]),
    };
    const plan = planMoveWishlist(owned(1, 20, [move(10, 1), move(11, 1)]), family, {
        t: (_en, cs) => cs,
    });
    match(plan.moves[0].reason!, /Vyžaduje přístup/);
    match(plan.moves[1].reason!, /není na zvolené větvi/);
});

void test('Piloswine cannot assume an AncientPower reminder for its evolution prerequisite', () => {
    const family = loadCollectionSpeciesFixture([221, 473]);
    const pokemon = owned(221, 20, [{ moveId: 458, name: 'Double Hit' }]);
    pokemon.state.moves = [];
    let plan = planMoveWishlist(pokemon, family);
    equal(plan.status, 'unknown');
    equal(plan.steps.length, 0);
    match(plan.warnings[0], /AncientPower/);
    equal(
        assessMoveWishlistAddition(pokemon, family, { moveId: 458, name: 'Double Hit' }).allowed,
        false,
    );
    pokemon.moveWishlist!.learnedMoveIds = [246];
    plan = planMoveWishlist(pokemon, family);
    equal(plan.status, 'unknown', 'historical acquisition is not an equipped move');
    pokemon.state.moves = [{ moveId: 246, name: 'AncientPower' }];
    plan = planMoveWishlist(pokemon, family);
    equal(plan.status, 'ready');
    deepStrictEqual(
        plan.steps.map((step) => [step.kind, step.level]),
        [
            ['evolve', 21],
            ['learn', 33],
        ],
    );
});

void test('Aipom must learn and retain Double Hit at 32 before evolving', () => {
    const family = loadCollectionSpeciesFixture([190, 424]);
    const pokemon = owned(190, 20, [{ moveId: 374, name: 'Fling' }]);
    pokemon.state.moves = [];
    const plan = planMoveWishlist(pokemon, family);
    equal(plan.status, 'ready');
    deepStrictEqual(
        plan.steps.map((step) => [
            step.kind,
            step.level,
            step.kind === 'learn' ? step.name : step.toSpeciesId,
        ]),
        [
            ['learn', 32, 'Double Hit'],
            ['evolve', 32, 424],
            ['learn', 36, 'Fling'],
        ],
    );
    const prerequisite = plan.steps[0];
    ok(prerequisite.kind === 'learn');
    match(prerequisite.source.requirement!, /Keep Double Hit equipped/);
});

void test('Eevee must acquire a Fairy move before the conditional Sylveon evolution', () => {
    const family = loadCollectionSpeciesFixture([133, 700]);
    // The fixture includes all Eevee edges, so provide the other branch species too.
    const fullFamily = loadCollectionSpeciesFixture([133, 134, 135, 136, 196, 197, 470, 471, 700]);
    const pokemon = owned(133, 20, [{ moveId: 113, name: 'Light Screen' }], 700);
    pokemon.state.moves = [];
    const plan = planMoveWishlist(pokemon, fullFamily);
    equal(plan.status, 'ready');
    const evolution = plan.steps.find((step) => step.kind === 'evolve')!;
    equal(evolution.level, 29);
    ok(evolution.kind === 'evolve' && evolution.conditional);
    const prerequisite = plan.steps.find((step) => step.kind === 'learn' && step.moveId === 204);
    ok(prerequisite?.kind === 'learn');
    equal(prerequisite.level, 29);
    equal(plan.moves[0].source?.level, 33);
    equal(plan.moves[0].status, 'natural');
    equal(family[133].learnset.find((entry) => entry.moveId === 204)?.level, 29);
});

void test('a required move can use a conditional TM, and a later natural source cannot erase that prerequisite', () => {
    const requirement = {
        ...edge(1, 2, 16),
        conditions: { knownMove: { moveId: 10, name: 'Move 10' } },
    };
    const machine: SpeciesMachine = { ...move(10, 1), machine: 'TM01', kind: 'TM', number: 1 };
    const family = {
        1: species(1, [], [requirement], [machine]),
        2: species(2, [move(10, 30), move(11, 20)], [requirement]),
    };
    const pokemon = owned(1, 10, [move(10, 30), move(11, 20)]);
    pokemon.state.moves = [];
    const plan = planMoveWishlist(pokemon, family);
    equal(plan.status, 'ready');
    equal(plan.moves[0].status, 'conditional');
    deepStrictEqual(
        plan.steps.map((step) => [step.kind, step.level]),
        [
            ['learn', 10],
            ['evolve', 16],
            ['learn', 20],
        ],
    );
    const prerequisite = plan.steps[0];
    ok(prerequisite.kind === 'learn');
    equal(prerequisite.source.machine, 'TM01');
    match(prerequisite.source.requirement!, /Requires access to TM01.*Keep Move 10 equipped/);
});

void test('a known move-type condition without equipped or future matching moves is unverified', () => {
    const requirement = { ...edge(1, 2, 16), conditions: { knownMoveType: 'Fairy' } };
    const family = {
        1: species(1, [], [requirement]),
        2: species(2, [move(10, 20)], [requirement]),
    };
    const pokemon = owned(1, 10, [move(10, 20)]);
    pokemon.state.moves = [];
    const plan = planMoveWishlist(pokemon, family);
    equal(plan.status, 'unknown');
    match(plan.warnings[0], /Fairy-type move/);
});
