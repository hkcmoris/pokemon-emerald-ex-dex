import type {
    ApiResponse,
    Move,
    PageResponse,
    Pokemon,
    SpeciesDetails,
} from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError, fetchSpecies, fetchSpeciesDetails } from './api.js';
import { apiUrl } from './apiUrl.js';
import {
    changeCollectionRecord,
    readCollectionRecord,
    writeCollectionRecord,
} from './collectionDatabase.js';

const memory = new Map<number, SpeciesDetails>();
const pending = new Map<number, Promise<SpeciesDetails>>();
const pendingMoves = new Map<number, Promise<Move>>();

export async function loadCollectionSpecies(id: number): Promise<SpeciesDetails> {
    const cached = memory.get(id) ?? (await readCollectionRecord<SpeciesDetails>(`species:${id}`));
    if (cached) {
        memory.set(id, cached);
        return cached;
    }
    let request = pending.get(id);
    if (!request) {
        request = fetchSpeciesDetails(id)
            .then(async (details) => {
                memory.set(id, details);
                await writeCollectionRecord(`species:${id}`, details);
                await rememberSpecies([details]);
                return details;
            })
            .finally(() => pending.delete(id));
        pending.set(id, request);
    }
    return request;
}

export async function loadCollectionFamily(id: number): Promise<SpeciesDetails[]> {
    const current = await loadCollectionSpecies(id);
    const ids = new Set([
        id,
        ...current.evolutionFamily.flatMap((edge) => [edge.fromSpeciesId, edge.toSpeciesId]),
    ]);
    const results = await Promise.allSettled([...ids].map(loadCollectionSpecies));
    // Partial offline coverage is represented by missing entries, never a fictitious empty learnset.
    return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

export async function loadCollectionMove(id: number): Promise<Move> {
    for (const details of memory.values()) {
        const move = [...details.learnset, ...details.machines].find(
            (entry) => entry.moveId === id,
        );
        if (move) return move;
    }
    const cached = (await readCollectionRecord<Record<number, Move>>('move-index'))?.[id];
    if (cached) return cached;
    let request = pendingMoves.get(id);
    if (!request) {
        request = fetch(apiUrl(`v1/moves/${id}`))
            .then(async (response) => {
                if (!response.ok) throw new ApiRequestError(response.status);
                const { data: move } = (await response.json()) as ApiResponse<Move>;
                await changeCollectionRecord<Record<number, Move>>(
                    'move-index',
                    (previous = {}) => ({
                        ...previous,
                        [id]: move,
                    }),
                );
                return move;
            })
            .finally(() => pendingMoves.delete(id));
        pendingMoves.set(id, request);
    }
    return request;
}

async function rememberSpecies(entries: readonly Pokemon[]): Promise<void> {
    await changeCollectionRecord<Record<number, Pokemon>>('species-index', (previous = {}) => {
        for (const entry of entries) previous[entry.speciesId] = entry;
        return previous;
    });
}

export async function searchCollectionSpecies(query: string): Promise<Pokemon[]> {
    try {
        const result = await fetchSpecies({
            q: query.trim(),
            type: '',
            sort: 'id',
            page: 1,
            pageSize: 40,
        });
        await rememberSpecies(result.data);
        return result.data;
    } catch (error) {
        const entries = Object.values(
            (await readCollectionRecord<Record<number, Pokemon>>('species-index')) ?? {},
        );
        if (entries.length === 0) throw error;
        const q = query.trim().toLocaleLowerCase();
        return entries
            .filter(
                (entry) =>
                    entry.name.toLocaleLowerCase().includes(q) ||
                    String(entry.speciesId) === q.replace(/^#0*/, ''),
            )
            .slice(0, 40);
    }
}

export async function searchCollectionMoves(query: string): Promise<Move[]> {
    try {
        const response = await fetch(
            apiUrl(
                `v1/moves?${new URLSearchParams({ q: query.trim(), page: '1', pageSize: '40' })}`,
            ),
        );
        if (!response.ok) throw new Error('Could not load moves.');
        const result = (await response.json()) as PageResponse<Move>;
        await changeCollectionRecord<Record<number, Move>>('move-index', (previous = {}) => {
            for (const move of result.data) previous[move.moveId] = move;
            return previous;
        });
        return result.data;
    } catch (error) {
        const moves = Object.values(
            (await readCollectionRecord<Record<number, Move>>('move-index')) ?? {},
        );
        for (const details of memory.values()) moves.push(...details.learnset, ...details.machines);
        const unique = [...new Map(moves.map((move) => [move.moveId, move])).values()];
        if (unique.length === 0) throw error;
        return unique
            .filter((move) =>
                move.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
            )
            .slice(0, 40);
    }
}
