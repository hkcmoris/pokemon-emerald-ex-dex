import { useSyncExternalStore } from 'react';
import type { BaseStats, OwnedPokemon, StatObservation } from '@pokemon-emerald-ex-dex/shared';

export interface ObservationDraft {
    speciesId: number;
    formEpoch: string;
    observationId?: string;
    level: string;
    recordedAt: string;
    stats: Partial<Record<keyof BaseStats, string>>;
}

// Each draft has its own local record so editing one member cannot overwrite another tab's drafts.
const storagePrefix = 'emerald-ex:observation-draft:';
const drafts = new Map<string, { pokemonId: string; value: ObservationDraft }>();
const pendingSaves = new Set<string>();
const completedSaves = new Map<string, number>();
const listeners = new Set<() => void>();
let revision = 0;
let storageError = false;
const failedWrites = new Set<string>();
let restored = false;

export function decodeObservationDraftRecord(
    raw: string,
): { pokemonId: string; value: ObservationDraft } | undefined {
    try {
        const record = JSON.parse(raw) as {
            pokemonId?: unknown;
            value?: Partial<ObservationDraft>;
        };
        const value = record.value;
        if (
            typeof record.pokemonId !== 'string' ||
            !value ||
            !Number.isInteger(value.speciesId) ||
            typeof value.formEpoch !== 'string' ||
            typeof value.level !== 'string' ||
            typeof value.recordedAt !== 'string' ||
            (value.observationId !== undefined && typeof value.observationId !== 'string') ||
            !value.stats ||
            typeof value.stats !== 'object' ||
            Object.values(value.stats).some((stat) => typeof stat !== 'string')
        )
            return undefined;
        return { pokemonId: record.pokemonId, value: value as ObservationDraft };
    } catch {
        return undefined;
    }
}

function browserStorage(): Storage | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        return window.localStorage;
    } catch {
        storageError = true;
        return undefined;
    }
}

function restoreDrafts(): void {
    if (restored) return;
    restored = true;
    const storage = browserStorage();
    if (!storage) return;
    if (typeof window.addEventListener === 'function')
        window.addEventListener('storage', (event) => {
            if (!event.key?.startsWith(storagePrefix)) return;
            try {
                const key = decodeURIComponent(event.key.slice(storagePrefix.length));
                const record = event.newValue
                    ? decodeObservationDraftRecord(event.newValue)
                    : undefined;
                if (record) drafts.set(key, record);
                else drafts.delete(key);
                notifyDraftChange();
            } catch {
                /* Ignore unrelated malformed records. */
            }
        });
    try {
        for (let index = 0; index < storage.length; index++) {
            const storedKey = storage.key(index);
            if (!storedKey?.startsWith(storagePrefix)) continue;
            const raw = storage.getItem(storedKey);
            const record = raw ? decodeObservationDraftRecord(raw) : undefined;
            if (record)
                drafts.set(decodeURIComponent(storedKey.slice(storagePrefix.length)), record);
        }
    } catch {
        storageError = true;
    }
}

function persistDraft(key: string): void {
    const storage = browserStorage();
    if (!storage) return;
    try {
        const storedKey = `${storagePrefix}${encodeURIComponent(key)}`;
        const record = drafts.get(key);
        if (record) storage.setItem(storedKey, JSON.stringify(record));
        else storage.removeItem(storedKey);
        failedWrites.delete(key);
        storageError = failedWrites.size > 0;
    } catch {
        failedWrites.add(key);
        storageError = true;
    }
}

export function useObservationDraftStorageError(): boolean {
    restoreDrafts();
    return useSyncExternalStore(
        subscribe,
        () => storageError,
        () => false,
    );
}

function notifyDraftChange(): void {
    revision++;
    for (const listener of listeners) listener();
}

export function observationDraftKey(pokemon: OwnedPokemon, observation?: StatObservation): string {
    return JSON.stringify([
        pokemon.id,
        observation?.id ?? 'new',
        observation?.speciesId ?? pokemon.state.speciesId,
        observation?.formEpoch ?? pokemon.state.formEpoch,
    ]);
}

export function getObservationDraft(key: string): ObservationDraft | undefined {
    restoreDrafts();
    return drafts.get(key)?.value;
}

export function setObservationDraft(key: string, pokemonId: string, value: ObservationDraft): void {
    restoreDrafts();
    drafts.set(key, { pokemonId, value });
    persistDraft(key);
    notifyDraftChange();
}

export function clearObservationDraft(key: string): void {
    restoreDrafts();
    if (!drafts.delete(key)) return;
    persistDraft(key);
    notifyDraftChange();
}

/** Install the new recording context before a queue commit can publish the member change. */
export async function reassignObservationDraft<T>(
    sourceKey: string,
    targetKey: string,
    pokemon: OwnedPokemon,
    commit: () => Promise<T>,
): Promise<T> {
    const source = getObservationDraft(sourceKey);
    const previousTarget = getObservationDraft(targetKey);
    const now = new Date();
    const next: ObservationDraft = {
        speciesId: pokemon.state.speciesId,
        formEpoch: pokemon.state.formEpoch,
        level: source?.level ?? String(pokemon.state.level),
        recordedAt:
            source?.recordedAt ??
            new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19),
        stats: source?.stats ?? {},
    };
    setObservationDraft(targetKey, pokemon.id, next);
    try {
        const result = await commit();
        if (sourceKey !== targetKey && getObservationDraft(sourceKey) === source)
            clearObservationDraft(sourceKey);
        return result;
    } catch (error) {
        if (getObservationDraft(targetKey) === next) {
            if (previousTarget) setObservationDraft(targetKey, pokemon.id, previousTarget);
            else clearObservationDraft(targetKey);
        }
        throw error;
    }
}

export function isObservationDraftSaving(key: string): boolean {
    return pendingSaves.has(key);
}

export function useObservationDraftSaving(key: string): boolean {
    return useSyncExternalStore(
        subscribe,
        () => isObservationDraftSaving(key),
        () => isObservationDraftSaving(key),
    );
}

export function useObservationDraftSaveCount(key: string): number {
    return useSyncExternalStore(
        subscribe,
        () => completedSaves.get(key) ?? 0,
        () => completedSaves.get(key) ?? 0,
    );
}

/** A remounted editor shares the pending write and cannot submit it twice. */
export async function runObservationDraftSave(
    key: string,
    save: () => Promise<void>,
): Promise<boolean> {
    if (pendingSaves.has(key)) return false;
    const submitted = drafts.get(key);
    pendingSaves.add(key);
    notifyDraftChange();
    try {
        await save();
        // A later draft must never be erased by completion of this submission.
        if (drafts.get(key) === submitted) {
            clearObservationDraft(key);
            completedSaves.set(key, (completedSaves.get(key) ?? 0) + 1);
        }
        return true;
    } finally {
        pendingSaves.delete(key);
        notifyDraftChange();
    }
}

export function getObservationDrafts(
    pokemonId: string,
): { key: string; value: ObservationDraft }[] {
    restoreDrafts();
    return [...drafts.entries()]
        .filter(([, draft]) => draft.pokemonId === pokemonId)
        .map(([key, draft]) => ({ key, value: draft.value }));
}

export function useObservationDrafts(
    pokemonId: string,
): { key: string; value: ObservationDraft }[] {
    useSyncExternalStore(
        subscribe,
        () => revision,
        () => revision,
    );
    return getObservationDrafts(pokemonId);
}

export function hasObservationDraft(pokemonId: string): boolean {
    restoreDrafts();
    return [...drafts.values()].some((draft) => draft.pokemonId === pokemonId);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useHasObservationDraft(pokemonId: string): boolean {
    return useSyncExternalStore(
        subscribe,
        () => hasObservationDraft(pokemonId),
        () => hasObservationDraft(pokemonId),
    );
}
