import { useSyncExternalStore } from 'react';
import type { KnownMove, OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';

export interface MoveChoice {
    pokemonId: string;
    playthroughId: string;
    speciesId: number;
    formEpoch: string;
    moves: KnownMove[] | null;
    targetMoveId?: number;
    candidate?: KnownMove;
    query: string;
}

const storageKey = 'emerald-ex-move-choices-v1';
const storagePrefix = 'emerald-ex-move-choice-v1:';
const choices = new Map<string, MoveChoice>();
const listeners = new Set<() => void>();
const automaticChoices = new WeakSet<MoveChoice>();
const pendingSaves = new Set<string>();
let initialized = false;
let durable = true;

function validMove(value: unknown): value is KnownMove {
    if (!value || typeof value !== 'object') return false;
    const entry = value as KnownMove;
    return Number.isInteger(entry.moveId) && entry.moveId > 0 && typeof entry.name === 'string';
}

/** Ignore malformed browser storage rather than letting it become a recorded moveset. */
export function parseMoveChoices(raw: string | null): MoveChoice[] {
    try {
        const values: unknown = JSON.parse(raw ?? '[]');
        if (!Array.isArray(values)) return [];
        return values.filter((value): value is MoveChoice => {
            if (!value || typeof value !== 'object') return false;
            const entry = value as MoveChoice;
            return (
                typeof entry.pokemonId === 'string' &&
                typeof entry.playthroughId === 'string' &&
                Number.isInteger(entry.speciesId) &&
                typeof entry.formEpoch === 'string' &&
                typeof entry.query === 'string' &&
                (entry.targetMoveId === undefined || Number.isInteger(entry.targetMoveId)) &&
                (entry.candidate === undefined || validMove(entry.candidate)) &&
                (entry.moves === null ||
                    (Array.isArray(entry.moves) &&
                        entry.moves.length <= 4 &&
                        entry.moves.every(validMove) &&
                        new Set(entry.moves.map((move) => move.moveId)).size ===
                            entry.moves.length))
            );
        });
    } catch {
        return [];
    }
}

function notify(): void {
    for (const listener of listeners) listener();
}

function initialize(): void {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    try {
        const storage = window.localStorage;
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index);
            if (!key?.startsWith(storagePrefix)) continue;
            for (const choice of parseMoveChoices(storage.getItem(key)))
                if (key === `${storagePrefix}${encodeURIComponent(choice.pokemonId)}`)
                    choices.set(choice.pokemonId, choice);
        }
        for (const choice of parseMoveChoices(storage.getItem(storageKey))) {
            if (choices.has(choice.pokemonId)) continue;
            choices.set(choice.pokemonId, choice);
            writeMoveChoiceRecord(storage, choice.pokemonId, choice);
        }
        storage.removeItem(storageKey);
    } catch {
        durable = false;
    }
    window.addEventListener('storage', (event) => {
        if (event.key === null) choices.clear();
        else {
            if (!event.key.startsWith(storagePrefix)) return;
            const pokemonId = decodeURIComponent(event.key.slice(storagePrefix.length));
            const choice = parseMoveChoices(event.newValue).find(
                (entry) => entry.pokemonId === pokemonId,
            );
            if (choice) choices.set(pokemonId, choice);
            else choices.delete(pokemonId);
        }
        notify();
    });
}

/** Independent per-member records cannot erase another tab's unrelated draft. */
export function writeMoveChoiceRecord(
    storage: Pick<Storage, 'setItem' | 'removeItem'>,
    pokemonId: string,
    choice?: MoveChoice,
): void {
    const key = `${storagePrefix}${encodeURIComponent(pokemonId)}`;
    if (choice) storage.setItem(key, JSON.stringify([choice]));
    else storage.removeItem(key);
}

function persist(pokemonId: string): void {
    try {
        if (typeof window !== 'undefined')
            writeMoveChoiceRecord(window.localStorage, pokemonId, choices.get(pokemonId));
        durable = true;
    } catch {
        durable = false;
    }
    notify();
}

export function moveChoiceContext(pokemon: OwnedPokemon): MoveChoice {
    return {
        pokemonId: pokemon.id,
        playthroughId: pokemon.playthroughId,
        speciesId: pokemon.state.speciesId,
        formEpoch: pokemon.state.formEpoch,
        moves: pokemon.state.moves?.map(({ moveId, name }) => ({ moveId, name })) ?? null,
        query: '',
    };
}

export function setMoveChoice(choice: MoveChoice): void {
    initialize();
    choices.set(choice.pokemonId, choice);
    persist(choice.pokemonId);
}

export function requestMoveLearning(
    pokemon: OwnedPokemon,
    candidate: KnownMove,
    autoAdd = true,
): void {
    const choice = {
        ...moveChoiceContext(pokemon),
        candidate: { moveId: candidate.moveId, name: candidate.name },
    };
    if (
        autoAdd &&
        (pokemon.state.moves?.length ?? 0) < 4 &&
        !pokemon.state.moves?.some((move) => move.moveId === candidate.moveId)
    )
        automaticChoices.add(choice);
    setMoveChoice(choice);
}

/** Only a fresh click can auto-save; restoring a draft after reload never does. */
export function takeAutomaticMoveChoice(choice: MoveChoice): boolean {
    return automaticChoices.delete(choice);
}

export function requestMoveReplacement(pokemon: OwnedPokemon, targetMoveId?: number): void {
    setMoveChoice({ ...moveChoiceContext(pokemon), targetMoveId });
}

export function clearMoveChoice(pokemonId: string, expected?: MoveChoice): void {
    initialize();
    if (expected && choices.get(pokemonId) !== expected) return;
    choices.delete(pokemonId);
    persist(pokemonId);
}

export function getMoveChoice(pokemonId: string): MoveChoice | undefined {
    initialize();
    return choices.get(pokemonId);
}

function subscribe(listener: () => void): () => void {
    initialize();
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useMoveChoice(pokemonId: string): MoveChoice | undefined {
    return useSyncExternalStore(
        subscribe,
        () => getMoveChoice(pokemonId),
        () => undefined,
    );
}

export function useHasMoveChoice(pokemonId: string): boolean {
    return Boolean(useMoveChoice(pokemonId));
}

export function useMoveChoiceSaving(pokemonId: string): boolean {
    return useSyncExternalStore(
        subscribe,
        () => pendingSaves.has(pokemonId),
        () => false,
    );
}

/** Remounted views share the pending write, so the same action cannot submit twice. */
export async function runMoveChoiceSave(
    pokemonId: string,
    save: () => Promise<void>,
): Promise<boolean> {
    if (pendingSaves.has(pokemonId)) return false;
    pendingSaves.add(pokemonId);
    notify();
    try {
        await save();
        return true;
    } finally {
        pendingSaves.delete(pokemonId);
        notify();
    }
}

export function moveChoicesAreDurable(): boolean {
    return durable;
}

export function sameMoves(
    left: readonly KnownMove[] | null,
    right: readonly KnownMove[] | null,
): boolean {
    return left === null || right === null
        ? left === right
        : left.length === right.length &&
              left.every((move, index) => move.moveId === right[index].moveId);
}

export function moveChoiceIsCurrent(pokemon: OwnedPokemon, context: MoveChoice): boolean {
    return (
        !pokemon.deleted &&
        pokemon.id === context.pokemonId &&
        pokemon.playthroughId === context.playthroughId &&
        pokemon.state.speciesId === context.speciesId &&
        pokemon.state.formEpoch === context.formEpoch &&
        sameMoves(pokemon.state.moves, context.moves)
    );
}

/** Change only moves; a level, nickname or stats update made meanwhile is preserved. */
export function applyMoveChoice(
    pokemon: OwnedPokemon,
    context: MoveChoice,
    moves: KnownMove[] | null,
): OwnedPokemon {
    if (!moveChoiceIsCurrent(pokemon, context)) throw new Error('moves-changed');
    if (
        moves &&
        (moves.length > 4 || new Set(moves.map((move) => move.moveId)).size !== moves.length)
    )
        throw new Error('invalid-moves');
    return {
        ...pokemon,
        state: {
            ...pokemon.state,
            moves: moves?.map(({ moveId, name }) => ({ moveId, name })) ?? null,
        },
    };
}

export function replaceKnownMove(
    context: MoveChoice,
    candidate: KnownMove,
    targetMoveId?: number,
): KnownMove[] {
    const moves = [...(context.moves ?? [])];
    if (moves.some((move) => move.moveId === candidate.moveId))
        throw new Error('move-already-known');
    if (targetMoveId !== undefined) {
        const index = moves.findIndex((move) => move.moveId === targetMoveId);
        if (index === -1) throw new Error('moves-changed');
        moves[index] = { moveId: candidate.moveId, name: candidate.name };
    } else {
        if (moves.length >= 4) throw new Error('choose-replacement');
        moves.push({ moveId: candidate.moveId, name: candidate.name });
    }
    return moves;
}
