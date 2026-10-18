import type {
    BattleEncounter,
    CollectionDocument,
    EncounterOpponent,
} from '@pokemon-emerald-ex-dex/shared';

export interface EncounterSelection {
    encounterId?: string;
    opponentId?: string;
}

const selections = new Map<string, EncounterSelection>();
const prefix = 'emerald-ex:simulator-encounter:';

/** Selection is a device preference; the encounter data itself belongs to collection sync. */
export function readEncounterSelection(key: string): EncounterSelection | null {
    const cached = selections.get(key);
    if (cached) return { ...cached };
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(prefix + key);
        if (!raw) return null;
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const entry = value as EncounterSelection;
        if (
            (entry.encounterId !== undefined && typeof entry.encounterId !== 'string') ||
            (entry.opponentId !== undefined && typeof entry.opponentId !== 'string')
        )
            return null;
        selections.set(key, entry);
        return { ...entry };
    } catch {
        return null;
    }
}

export function rememberEncounterSelection(key: string, selection: EncounterSelection): void {
    selections.set(key, { ...selection });
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(prefix + key, JSON.stringify(selection));
    } catch {
        // Losing only the selected tab must not prevent saving or using an encounter.
    }
}

export function resolveEncounterSelection(
    document: CollectionDocument,
    runId: string | undefined,
    selection: EncounterSelection | null,
): { encounter?: BattleEncounter; opponent?: EncounterOpponent } {
    if (!runId || !document.playthroughs[runId] || document.playthroughs[runId].deleted) return {};
    const entries = Object.values(document.encounters ?? {}).filter(
        (entry) => entry.playthroughId === runId && !entry.deleted,
    );
    // An explicit empty selection means the user chose a temporary quick matchup.
    const encounter = selection
        ? entries.find((entry) => entry.id === selection.encounterId)
        : entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!encounter) return {};
    const party = encounter.party.flatMap((id) => {
        const opponent = document.opponents?.[id];
        return opponent && !opponent.deleted && opponent.encounterId === encounter.id
            ? [opponent]
            : [];
    });
    return {
        encounter,
        opponent: party.find((entry) => entry.id === selection?.opponentId) ?? party[0],
    };
}
