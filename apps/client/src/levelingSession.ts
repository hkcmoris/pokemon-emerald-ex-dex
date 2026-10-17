import { useSyncExternalStore } from 'react';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';

export interface PendingLevelReview {
    speciesId: number;
    formEpoch: string;
    oldLevel: number;
    newLevel: number;
    evolutionSpeciesId?: number;
}

const legacyStorageKey = 'emerald-ex:pending-level-reviews:v1';
const storagePrefix = 'emerald-ex:pending-level-review:v2:';
const reviews = new Map<string, PendingLevelReview>();
const listeners = new Set<() => void>();
const failedWrites = new Set<string>();
let hydrated = false;

export function decodePendingLevelReview(raw: string | null): PendingLevelReview | null {
    try {
        const value = JSON.parse(raw ?? 'null') as Partial<PendingLevelReview> | null;
        if (
            !value ||
            typeof value !== 'object' ||
            typeof value.formEpoch !== 'string' ||
            !Number.isInteger(value.speciesId) ||
            value.speciesId! < 1 ||
            !Number.isInteger(value.oldLevel) ||
            !Number.isInteger(value.newLevel) ||
            value.oldLevel! < 1 ||
            value.newLevel! > 100 ||
            value.oldLevel! >= value.newLevel! ||
            (value.evolutionSpeciesId !== undefined &&
                (!Number.isInteger(value.evolutionSpeciesId) || value.evolutionSpeciesId < 1))
        )
            return null;
        return {
            speciesId: value.speciesId!,
            formEpoch: value.formEpoch,
            oldLevel: value.oldLevel!,
            newLevel: value.newLevel!,
            ...(value.evolutionSpeciesId === undefined
                ? {}
                : { evolutionSpeciesId: value.evolutionSpeciesId }),
        };
    } catch {
        return null;
    }
}

/** New observations extend a pending interval; remote choices also carry an explicit cancellation. */
export function mergePendingLevelReviews(
    previous: PendingLevelReview | undefined,
    next: PendingLevelReview,
    keepPreviousChoice = true,
): PendingLevelReview {
    if (!previous || previous.speciesId !== next.speciesId || previous.formEpoch !== next.formEpoch)
        return { ...next };
    const evolutionSpeciesId = keepPreviousChoice
        ? (next.evolutionSpeciesId ?? previous.evolutionSpeciesId)
        : next.evolutionSpeciesId;
    return {
        speciesId: next.speciesId,
        formEpoch: next.formEpoch,
        oldLevel: Math.min(previous.oldLevel, next.oldLevel),
        newLevel: Math.max(previous.newLevel, next.newLevel),
        ...(evolutionSpeciesId === undefined ? {} : { evolutionSpeciesId }),
    };
}

function browserStorage(): Storage | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        return window.localStorage;
    } catch {
        failedWrites.add('*');
        return undefined;
    }
}

function recordKey(pokemonId: string): string {
    return storagePrefix + encodeURIComponent(pokemonId);
}

function notify(): void {
    listeners.forEach((listener) => listener());
}

function persist(pokemonId: string): void {
    const storage = browserStorage();
    if (!storage) return;
    try {
        // A tombstone prevents an interrupted v1 migration from restoring an already reviewed entry.
        storage.setItem(recordKey(pokemonId), JSON.stringify(reviews.get(pokemonId) ?? null));
        failedWrites.delete(pokemonId);
    } catch {
        failedWrites.add(pokemonId);
    }
}

function reconcileStorage(event: StorageEvent): void {
    const storage = browserStorage();
    if (event.storageArea && event.storageArea !== storage) return;
    if (event.key === null) {
        reviews.clear();
        failedWrites.clear();
        notify();
        return;
    }
    if (!event.key.startsWith(storagePrefix)) return;
    let pokemonId: string;
    try {
        pokemonId = decodeURIComponent(event.key.slice(storagePrefix.length));
    } catch {
        return;
    }
    let raw = event.newValue;
    try {
        if (storage) raw = storage.getItem(event.key);
        failedWrites.delete('*');
    } catch {
        failedWrites.add('*');
    }
    if (event.newValue === null || event.newValue === 'null') reviews.delete(pokemonId);
    const incoming = decodePendingLevelReview(raw);
    if (!incoming) {
        reviews.delete(pokemonId);
        failedWrites.delete(pokemonId);
    } else {
        const merged = mergePendingLevelReviews(reviews.get(pokemonId), incoming, false);
        reviews.set(pokemonId, merged);
        // Concurrent entries for the same stage converge on the full unreviewed interval.
        if (JSON.stringify(merged) !== JSON.stringify(incoming)) persist(pokemonId);
    }
    notify();
}

function hydrate(): void {
    if (hydrated || typeof window === 'undefined') return;
    hydrated = true;
    window.addEventListener('storage', reconcileStorage);
    const storage = browserStorage();
    if (!storage) return;
    try {
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index);
            if (!key?.startsWith(storagePrefix)) continue;
            let pokemonId: string;
            try {
                pokemonId = decodeURIComponent(key.slice(storagePrefix.length));
            } catch {
                continue;
            }
            const review = decodePendingLevelReview(storage.getItem(key));
            if (review) reviews.set(pokemonId, review);
        }
        const legacyRaw = storage.getItem(legacyStorageKey);
        if (legacyRaw !== null) {
            let entries: unknown;
            try {
                entries = JSON.parse(legacyRaw);
            } catch {
                entries = [];
            }
            if (Array.isArray(entries))
                for (const entry of entries) {
                    if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
                    const review = decodePendingLevelReview(JSON.stringify(entry[1]));
                    if (!review || storage.getItem(recordKey(entry[0])) !== null) continue;
                    reviews.set(entry[0], review);
                    persist(entry[0]);
                }
            if (failedWrites.size === 0) storage.removeItem(legacyStorageKey);
        }
        failedWrites.delete('*');
    } catch {
        failedWrites.add('*');
    }
}

/** Re-read only this member before writing, so independent tabs cannot overwrite other members. */
function latestReview(pokemonId: string): PendingLevelReview | undefined {
    const local = reviews.get(pokemonId);
    if (!local && failedWrites.has(pokemonId)) return undefined;
    const storage = browserStorage();
    if (!storage) return local;
    try {
        const stored = decodePendingLevelReview(storage.getItem(recordKey(pokemonId)));
        failedWrites.delete('*');
        if (!stored) return failedWrites.has(pokemonId) ? local : undefined;
        return mergePendingLevelReviews(local, stored, false);
    } catch {
        failedWrites.add('*');
        return local;
    }
}

function subscribe(listener: () => void): () => void {
    hydrate();
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function readLevelReview(pokemon: OwnedPokemon): PendingLevelReview | null {
    hydrate();
    const value = reviews.get(pokemon.id);
    return value &&
        value.speciesId === pokemon.state.speciesId &&
        value.formEpoch === pokemon.state.formEpoch &&
        value.newLevel <= pokemon.state.level
        ? value
        : null;
}

export function rememberLevelReview(pokemonId: string, review: PendingLevelReview): void {
    hydrate();
    reviews.set(pokemonId, mergePendingLevelReviews(latestReview(pokemonId), review));
    persist(pokemonId);
    notify();
}

export function chooseReviewEvolution(pokemonId: string, speciesId?: number): void {
    hydrate();
    const review = latestReview(pokemonId);
    if (!review) return;
    const next = { ...review };
    if (speciesId === undefined) delete next.evolutionSpeciesId;
    else next.evolutionSpeciesId = speciesId;
    reviews.set(pokemonId, next);
    persist(pokemonId);
    notify();
}

export function clearLevelReview(pokemonId: string): void {
    hydrate();
    if (!reviews.has(pokemonId) && !failedWrites.has(pokemonId) && !latestReview(pokemonId)) return;
    reviews.delete(pokemonId);
    persist(pokemonId);
    notify();
}

export function useLevelReview(pokemon: OwnedPokemon): PendingLevelReview | null {
    return useSyncExternalStore(
        subscribe,
        () => readLevelReview(pokemon),
        () => readLevelReview(pokemon),
    );
}

export function useLevelReviewStorageError(): boolean {
    hydrate();
    return useSyncExternalStore(
        subscribe,
        () => failedWrites.size > 0,
        () => false,
    );
}
