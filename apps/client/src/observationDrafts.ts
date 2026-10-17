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

// Session-only drafts survive route and member changes without becoming saved observations.
const drafts = new Map<string, { pokemonId: string; value: ObservationDraft }>();
const pendingSaves = new Set<string>();
const completedSaves = new Map<string, number>();
const listeners = new Set<() => void>();
let revision = 0;

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
    return drafts.get(key)?.value;
}

export function setObservationDraft(key: string, pokemonId: string, value: ObservationDraft): void {
    drafts.set(key, { pokemonId, value });
    notifyDraftChange();
}

export function clearObservationDraft(key: string): void {
    if (!drafts.delete(key)) return;
    notifyDraftChange();
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
