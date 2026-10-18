import type {
    BattleEncounter,
    CollectionConflict,
    CollectionDocument,
    EncounterOpponent,
    KnownMove,
} from '@pokemon-emerald-ex-dex/shared';

function assertId(id: string): void {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || ['__proto__', 'prototype', 'constructor'].includes(id))
        throw new Error('Invalid encounter identity.');
}

function encounterName(name: string): string {
    const value = name.trim();
    if (!value || value.length > 80)
        throw new Error('Enter an encounter name of up to 80 characters.');
    return value;
}

function assertLevel(level: number): void {
    if (!Number.isInteger(level) || level < 1 || level > 100)
        throw new Error('The level must be a whole number from 1 to 100.');
}

function sameMoves(a: readonly KnownMove[], b: readonly KnownMove[]): boolean {
    return (
        a.length === b.length &&
        a.every((move, index) => move.moveId === b[index].moveId && move.name === b[index].name)
    );
}

function sameOpponent(a: EncounterOpponent, b: EncounterOpponent): boolean {
    return (
        a.id === b.id &&
        a.encounterId === b.encounterId &&
        a.speciesId === b.speciesId &&
        a.level === b.level &&
        a.deleted === b.deleted &&
        sameMoves(a.moves, b.moves)
    );
}

export function rematchEncounterName(name: string, suffix: string): string {
    return `${name.slice(0, Math.max(0, 80 - suffix.length))}${suffix.slice(0, 80)}`;
}

function activeEncounter(document: CollectionDocument, id: string): BattleEncounter {
    const encounter = document.encounters?.[id];
    const run = encounter && document.playthroughs[encounter.playthroughId];
    if (!encounter || encounter.deleted || !run || run.deleted)
        throw new Error('This encounter or its playthrough is no longer available.');
    return encounter;
}

function currentOpponent(
    document: CollectionDocument,
    expected: EncounterOpponent,
    deleted = false,
): EncounterOpponent {
    const current = document.opponents?.[expected.id];
    const encounter = activeEncounter(document, expected.encounterId);
    if (
        expected.deleted ||
        !current ||
        current.deleted !== deleted ||
        current.encounterId !== expected.encounterId ||
        current.speciesId !== expected.speciesId ||
        (!deleted && !encounter.party.includes(current.id))
    )
        throw new Error('This opponent changed. Check the saved encounter and try again.');
    return current;
}

export function getEncounterOpponents(
    document: CollectionDocument,
    encounter: BattleEncounter,
): EncounterOpponent[] {
    if (encounter.deleted) return [];
    return [...new Set(encounter.party)].flatMap((id) => {
        const opponent = document.opponents?.[id];
        return opponent && !opponent.deleted && opponent.encounterId === encounter.id
            ? [opponent]
            : [];
    });
}

export function encounterHasConflict(
    document: CollectionDocument,
    conflicts: readonly CollectionConflict[],
    encounterId: string,
): boolean {
    const encounter = document.encounters?.[encounterId];
    return conflicts.some(
        (conflict) =>
            (conflict.entity === 'encounters' && conflict.entityId === encounterId) ||
            (conflict.entity === 'playthroughs' &&
                conflict.entityId === encounter?.playthroughId &&
                ['$entity', 'deleted'].includes(conflict.field)),
    );
}

export function opponentHasConflict(
    document: CollectionDocument,
    conflicts: readonly CollectionConflict[],
    opponent: EncounterOpponent,
): boolean {
    return (
        encounterHasConflict(document, conflicts, opponent.encounterId) ||
        conflicts.some(
            (conflict) => conflict.entity === 'opponents' && conflict.entityId === opponent.id,
        )
    );
}

export function createEncounter(
    document: CollectionDocument,
    runId: string,
    id: string,
    name: string,
    createdAt: string,
): CollectionDocument {
    assertId(id);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(createdAt) || !Number.isFinite(Date.parse(createdAt)))
        throw new Error('Invalid encounter creation date.');
    const run = document.playthroughs[runId];
    if (!run || run.deleted || document.encounters?.[id])
        throw new Error('This playthrough changed. Try creating the encounter again.');
    return {
        ...document,
        encounters: {
            ...document.encounters,
            [id]: {
                id,
                playthroughId: runId,
                name: encounterName(name),
                party: [],
                deleted: false,
                createdAt,
            },
        },
    };
}

export function renameEncounter(
    document: CollectionDocument,
    expected: BattleEncounter,
    name: string,
): CollectionDocument {
    const current = activeEncounter(document, expected.id);
    if (current.playthroughId !== expected.playthroughId || current.name !== expected.name)
        throw new Error('The encounter name changed. Check its saved name and try again.');
    const value = encounterName(name);
    if (current.name === value) return document;
    return {
        ...document,
        encounters: { ...document.encounters, [current.id]: { ...current, name: value } },
    };
}

export function duplicateEncounter(
    document: CollectionDocument,
    expected: BattleEncounter,
    id: string,
    opponentIds: readonly string[],
    name: string,
    createdAt: string,
): CollectionDocument {
    const current = activeEncounter(document, expected.id);
    if (
        current.playthroughId !== expected.playthroughId ||
        JSON.stringify(current.party) !== JSON.stringify(expected.party)
    )
        throw new Error('The enemy party changed. Check it before duplicating this encounter.');
    const opponents = getEncounterOpponents(document, current);
    if (opponentIds.length !== opponents.length || new Set(opponentIds).size !== opponentIds.length)
        throw new Error('The enemy party changed. Try duplicating it again.');
    const result = createEncounter(document, current.playthroughId, id, name, createdAt);
    const copies: Record<string, EncounterOpponent> = {};
    for (const [index, opponent] of opponents.entries()) {
        const copyId = opponentIds[index];
        assertId(copyId);
        if (document.opponents?.[copyId])
            throw new Error('An opponent with this identity already exists.');
        copies[copyId] = {
            ...opponent,
            id: copyId,
            encounterId: id,
            moves: opponent.moves.map((move) => ({ ...move })),
        };
    }
    return {
        ...result,
        encounters: {
            ...result.encounters,
            [id]: { ...result.encounters![id], party: [...opponentIds] },
        },
        opponents: { ...document.opponents, ...copies },
    };
}

export function addEncounterOpponent(
    document: CollectionDocument,
    encounterId: string,
    id: string,
    speciesId: number,
    level: number,
): CollectionDocument {
    assertId(id);
    assertLevel(level);
    if (!Number.isInteger(speciesId) || speciesId < 1 || speciesId > 100000)
        throw new Error('Choose a valid species.');
    const encounter = activeEncounter(document, encounterId);
    if (document.opponents?.[id] || getEncounterOpponents(document, encounter).length >= 6)
        throw new Error('The enemy party is full or has changed.');
    return {
        ...document,
        encounters: {
            ...document.encounters,
            [encounterId]: { ...encounter, party: [...encounter.party, id] },
        },
        opponents: {
            ...document.opponents,
            [id]: { id, encounterId, speciesId, level, moves: [], deleted: false },
        },
    };
}

export function setEncounterOpponentLevel(
    document: CollectionDocument,
    expected: EncounterOpponent,
    level: number,
): CollectionDocument {
    assertLevel(level);
    const current = currentOpponent(document, expected);
    if (current.level !== expected.level)
        throw new Error('The saved level changed. Check it before saving.');
    if (current.level === level) return document;
    return {
        ...document,
        opponents: { ...document.opponents, [current.id]: { ...current, level } },
    };
}

export function setEncounterOpponentMoves(
    document: CollectionDocument,
    expected: EncounterOpponent,
    moves: readonly KnownMove[],
): CollectionDocument {
    const current = currentOpponent(document, expected);
    if (!sameMoves(current.moves, expected.moves))
        throw new Error('The revealed moves changed. Check them before saving.');
    if (
        moves.length > 4 ||
        new Set(moves.map((move) => move.moveId)).size !== moves.length ||
        moves.some(
            (move) =>
                !Number.isInteger(move.moveId) ||
                move.moveId < 1 ||
                move.moveId > 100000 ||
                !move.name.trim() ||
                move.name.length > 80,
        )
    )
        throw new Error('Record up to four different moves.');
    return {
        ...document,
        opponents: {
            ...document.opponents,
            [current.id]: { ...current, moves: moves.map((move) => ({ ...move })) },
        },
    };
}

export function recordEncounterMove(
    document: CollectionDocument,
    expected: EncounterOpponent,
    move: KnownMove,
    targetMoveId?: number,
): CollectionDocument {
    if (
        targetMoveId !== undefined &&
        !expected.moves.some((known) => known.moveId === targetMoveId)
    )
        throw new Error(
            'The move being replaced is no longer recorded. Choose a current move to replace.',
        );
    const recorded = { moveId: move.moveId, name: move.name };
    const moves =
        targetMoveId === undefined
            ? [...expected.moves, recorded]
            : expected.moves.map((known) => (known.moveId === targetMoveId ? recorded : known));
    return setEncounterOpponentMoves(document, expected, moves);
}

export function removeEncounterOpponent(
    document: CollectionDocument,
    expected: EncounterOpponent,
): CollectionDocument {
    const current = currentOpponent(document, expected);
    if (!sameOpponent(current, expected))
        throw new Error('The opponent changed. Check its saved details before removing it.');
    const encounter = activeEncounter(document, current.encounterId);
    return {
        ...document,
        encounters: {
            ...document.encounters,
            [encounter.id]: {
                ...encounter,
                party: encounter.party.filter((id) => id !== current.id),
            },
        },
        opponents: { ...document.opponents, [current.id]: { ...current, deleted: true } },
    };
}

export function restoreEncounterOpponent(
    document: CollectionDocument,
    expected: EncounterOpponent,
    position: number,
): CollectionDocument {
    const current = currentOpponent(document, expected, true);
    if (!sameOpponent(current, { ...expected, deleted: true }))
        throw new Error('The removed opponent changed. Check the saved encounter first.');
    const encounter = activeEncounter(document, current.encounterId);
    if (
        getEncounterOpponents(document, encounter).length >= 6 ||
        encounter.party.includes(current.id)
    )
        throw new Error('The enemy party is full or has changed.');
    const party = [...encounter.party];
    party.splice(Math.max(0, Math.min(position, party.length)), 0, current.id);
    return {
        ...document,
        encounters: { ...document.encounters, [encounter.id]: { ...encounter, party } },
        opponents: { ...document.opponents, [current.id]: { ...current, deleted: false } },
    };
}
