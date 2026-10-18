import { useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    BattleEncounter,
    CollectionConflict,
    CollectionDocument,
    EncounterOpponent,
    KnownMove,
    Pokemon,
} from '@pokemon-emerald-ex-dex/shared';

import {
    loadCollectionMove,
    loadCollectionSpecies,
    searchCollectionMoves,
} from './collectionSpecies.js';
import { useLanguage } from './language.js';
import { SpeciesPicker } from './MyPokemonForms.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { MoveDisplay } from './MoveDisplay.js';
import {
    addEncounterOpponent,
    createEncounter,
    duplicateEncounter,
    encounterHasConflict,
    getEncounterOpponents,
    opponentHasConflict,
    recordEncounterMove,
    removeEncounterOpponent,
    rematchEncounterName,
    renameEncounter,
    restoreEncounterOpponent,
    setEncounterOpponentLevel,
    setEncounterOpponentMoves,
} from './encounterEdits.js';

type Update = (current: CollectionDocument) => CollectionDocument;
type Scope = { encounterId?: string; opponentId?: string };
type MoveDraft = { query: string; targetMoveId?: number };

function RevealedMove({ move, actions }: { move: KnownMove; actions: ReactNode }) {
    const lookup = useQuery({
        queryKey: ['collection-move', move.moveId],
        queryFn: () => loadCollectionMove(move.moveId),
    });
    return (
        <MoveDisplay
            as="li"
            move={move}
            reference={lookup.data}
            size="medium"
            show={{ effectivePower: false }}
            actions={actions}
        />
    );
}

function parseLevel(value: string): number | undefined {
    if (!/^\d+$/.test(value)) return undefined;
    const level = Number(value);
    return Number.isInteger(level) && level >= 1 && level <= 100 ? level : undefined;
}

function OpponentButton({
    opponent,
    selected,
    uncertain,
    datasetId,
    onSelect,
    compact = false,
}: {
    opponent: EncounterOpponent;
    selected: boolean;
    uncertain: boolean;
    datasetId?: string;
    onSelect: () => void;
    compact?: boolean;
}) {
    const { t } = useLanguage();
    const species = useQuery({
        queryKey: ['collection-species', opponent.speciesId],
        queryFn: () => loadCollectionSpecies(opponent.speciesId),
    });
    const name = species.data?.name ?? `#${opponent.speciesId}`;
    const label = `${name} · Lv. ${opponent.level}${uncertain ? ` · ${t('Sync conflict', 'Konflikt synchronizace')}` : ''}`;
    return (
        <li>
            <button
                type="button"
                className={compact ? 'sim-sprite-choice' : 'sim-opponent-button'}
                aria-pressed={selected}
                aria-label={compact ? label : undefined}
                title={compact ? label : undefined}
                data-warning={compact && uncertain ? true : undefined}
                onClick={onSelect}
            >
                <SpeciesSprite
                    datasetId={datasetId}
                    file={species.data?.sprites?.front ?? null}
                    name={name}
                />
                {compact ? (
                    uncertain && (
                        <span className="sim-sprite-warning" aria-hidden="true">
                            ⚠
                        </span>
                    )
                ) : (
                    <span>
                        <strong>{name}</strong>
                        <small>
                            {uncertain
                                ? t('Sync conflict', 'Konflikt synchronizace')
                                : t(
                                      `Lv. ${opponent.level} · ${opponent.moves.length}/4 revealed`,
                                      `Lv. ${opponent.level} · ${opponent.moves.length}/4 odhaleny`,
                                  )}
                        </small>
                    </span>
                )}
            </button>
        </li>
    );
}

export function SimulatorOpponentStrip({
    document,
    encounter,
    selectedOpponentId,
    conflicts,
    datasetId,
    onSelect,
}: {
    document: CollectionDocument;
    encounter: BattleEncounter;
    selectedOpponentId?: string;
    conflicts: readonly CollectionConflict[];
    datasetId?: string;
    onSelect: (opponentId: string) => void;
}) {
    const { t } = useLanguage();
    const opponents = getEncounterOpponents(document, encounter);
    return (
        <ul className="sim-sprite-strip" aria-label={t('Switch opponent', 'Přepnout soupeře')}>
            {opponents.length === 0 && (
                <li className="sim-party-notice">{t('No opponents yet', 'Zatím žádný soupeř')}</li>
            )}
            {opponents.map((opponent) => (
                <OpponentButton
                    key={opponent.id}
                    opponent={opponent}
                    selected={opponent.id === selectedOpponentId}
                    uncertain={opponentHasConflict(document, conflicts, opponent)}
                    datasetId={datasetId}
                    onSelect={() => onSelect(opponent.id)}
                    compact
                />
            ))}
        </ul>
    );
}

export function SimulatorEncounters({
    document,
    conflicts,
    runId,
    datasetId,
    defaultLevel,
    selectedEncounterId,
    selectedOpponentId,
    onSelect,
    onUpdate,
}: {
    document: CollectionDocument;
    conflicts: readonly CollectionConflict[];
    runId: string;
    datasetId?: string;
    defaultLevel: number;
    selectedEncounterId?: string;
    selectedOpponentId?: string;
    onSelect: (encounterId: string | undefined, opponentId: string | undefined) => void;
    onUpdate: (updater: Update) => Promise<void>;
}) {
    const { t } = useLanguage();
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const latestConflicts = useRef(conflicts);
    latestConflicts.current = conflicts;
    const [adding, setAdding] = useState(false);
    const [editName, setEditName] = useState<{
        value: string;
        runId: string;
        expected?: BattleEncounter;
    }>();
    const [levelDrafts, setLevelDrafts] = useState<
        Record<
            string,
            {
                value: string;
                expected: EncounterOpponent;
            }
        >
    >({});
    const [moveDrafts, setMoveDrafts] = useState<Record<string, MoveDraft | undefined>>({});
    const [error, setError] = useState<{ message: string; retry?: () => void }>();
    const [saved, setSaved] = useState(false);
    const [undo, setUndo] = useState<{ label: string; run: () => void }>();
    const encounters = Object.values(document.encounters ?? {})
        .filter((entry) => !entry.deleted && entry.playthroughId === runId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
    const encounter = encounters.find((entry) => entry.id === selectedEncounterId);
    const opponents = encounter ? getEncounterOpponents(document, encounter) : [];
    const selected = opponents.find((opponent) => opponent.id === selectedOpponentId);
    const runConflict = conflicts.some(
        (conflict) =>
            conflict.entity === 'playthroughs' &&
            conflict.entityId === runId &&
            ['$entity', 'deleted'].includes(conflict.field),
    );
    const encounterConflict = encounter
        ? encounterHasConflict(document, conflicts, encounter.id)
        : false;
    const selectedConflict = selected ? opponentHasConflict(document, conflicts, selected) : false;
    const disabled =
        busy ||
        runConflict ||
        !document.playthroughs[runId] ||
        document.playthroughs[runId].deleted;
    const paused = disabled || encounterConflict;
    const selectedPaused = paused || selectedConflict;
    const moveDraft = selected && moveDrafts[selected.id];
    const moveTargetMissing =
        moveDraft?.targetMoveId !== undefined &&
        !selected?.moves.some((move) => move.moveId === moveDraft.targetMoveId);
    const search = useQuery({
        queryKey: ['collection-move-search', moveDraft?.query.trim() ?? ''],
        queryFn: () => searchCollectionMoves(moveDraft?.query.trim() ?? ''),
        enabled: Boolean(moveDraft?.query.trim()),
    });
    const selectedSpecies = useQuery({
        queryKey: ['collection-species', selected?.speciesId],
        queryFn: () => loadCollectionSpecies(selected!.speciesId),
        enabled: Boolean(selected),
    });
    const levelDraft = selected && levelDrafts[selected.id];

    async function save(update: Update, scope: Scope = {}, after?: () => void): Promise<void> {
        if (saving.current) return;
        saving.current = true;
        setBusy(true);
        setError(undefined);
        setSaved(false);
        try {
            await onUpdate((current) => {
                const currentConflicts = latestConflicts.current;
                if (
                    currentConflicts.some(
                        (conflict) =>
                            conflict.entity === 'playthroughs' &&
                            conflict.entityId === runId &&
                            ['$entity', 'deleted'].includes(conflict.field),
                    ) ||
                    (scope.encounterId &&
                        encounterHasConflict(current, currentConflicts, scope.encounterId)) ||
                    (scope.opponentId &&
                        currentConflicts.some(
                            (conflict) =>
                                conflict.entity === 'opponents' &&
                                conflict.entityId === scope.opponentId,
                        ))
                )
                    throw new Error('Resolve the sync conflict before editing this encounter.');
                return update(current);
            });
            setSaved(true);
            after?.();
        } catch {
            setError({
                message: t(
                    'Could not save this change. Your input is kept. Check for changes from another device or retry.',
                    'Změnu se nepodařilo uložit. Zadané údaje zůstávají rozepsané. Ověřte změny z jiného zařízení nebo zkuste uložení znovu.',
                ),
                retry: () => {
                    void save(update, scope, after);
                },
            });
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    function saveLevel(opponent: EncounterOpponent): void {
        const draft = levelDrafts[opponent.id];
        if (!draft || selectedPaused) return;
        const level = parseLevel(draft.value);
        if (level === undefined) {
            setError({
                message: t(
                    'Enter a whole level from 1 to 100. Your input is kept.',
                    'Zadejte celou úroveň od 1 do 100. Zadaná hodnota zůstává rozepsaná.',
                ),
            });
            return;
        }
        void save(
            (current) => setEncounterOpponentLevel(current, draft.expected, level),
            { encounterId: opponent.encounterId, opponentId: opponent.id },
            () => {
                setLevelDrafts((current) => {
                    if (current[opponent.id] !== draft) return current;
                    const next = { ...current };
                    delete next[opponent.id];
                    return next;
                });
            },
        );
    }

    function discardLevel(opponentId: string): void {
        setLevelDrafts((current) => {
            const next = { ...current };
            delete next[opponentId];
            return next;
        });
        setError(undefined);
    }

    function submitName(event: SubmitEvent): void {
        event.preventDefault();
        if (!editName || disabled) return;
        const value = editName.value.trim();
        if (!value) return;
        if (editName.expected) {
            const expected = editName.expected;
            void save(
                (current) => renameEncounter(current, expected, value),
                { encounterId: expected.id },
                () => setEditName(undefined),
            );
        } else {
            const id = crypto.randomUUID();
            const createdAt = new Date().toISOString();
            void save(
                (current) => createEncounter(current, editName.runId, id, value, createdAt),
                {},
                () => {
                    setEditName(undefined);
                    setAdding(true);
                    onSelect(id, undefined);
                },
            );
        }
    }

    function addOpponent(species: Pokemon): void {
        if (!encounter || paused || opponents.length >= 6) return;
        const id = crypto.randomUUID();
        const level = Math.max(1, Math.min(100, Math.round(defaultLevel)));
        void save(
            (current) => addEncounterOpponent(current, encounter.id, id, species.speciesId, level),
            { encounterId: encounter.id },
            () => onSelect(encounter.id, id),
        );
    }

    function chooseMove(move: KnownMove): void {
        if (!selected || !moveDraft || selectedPaused || moveTargetMissing) return;
        void save(
            (current) => recordEncounterMove(current, selected, move, moveDraft.targetMoveId),
            { encounterId: selected.encounterId, opponentId: selected.id },
            () => {
                setMoveDrafts((current) => ({ ...current, [selected.id]: undefined }));
            },
        );
    }

    return (
        <section
            className="my-panel sim-encounters"
            aria-label={t('Enemy encounters', 'Soupeřovy týmy')}
        >
            <div className="sim-encounter-toolbar">
                <label className="filter-label sim-encounter-select">
                    {t('Encounter', 'Souboj')}
                    <select
                        className="filter-select"
                        value={encounter?.id ?? ''}
                        onChange={(event) => {
                            const next = encounters.find(
                                (entry) => entry.id === event.target.value,
                            );
                            onSelect(
                                next?.id,
                                next ? getEncounterOpponents(document, next)[0]?.id : undefined,
                            );
                            setAdding(false);
                            setEditName(undefined);
                        }}
                    >
                        <option value="">{t('Quick matchup', 'Rychlé porovnání')}</option>
                        {encounters.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                                {entry.name}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="my-actions">
                    <button
                        className="page-button"
                        type="button"
                        disabled={disabled}
                        onClick={() => setEditName({ value: '', runId })}
                    >
                        {t('New encounter', 'Nový souboj')}
                    </button>
                    {encounter && (
                        <>
                            <button
                                className="page-button"
                                type="button"
                                disabled={paused}
                                onClick={() =>
                                    setEditName({
                                        value: encounter.name,
                                        runId,
                                        expected: encounter,
                                    })
                                }
                            >
                                {t('Rename', 'Přejmenovat')}
                            </button>
                            <button
                                className="page-button"
                                type="button"
                                disabled={
                                    paused ||
                                    opponents.some((opponent) =>
                                        opponentHasConflict(document, conflicts, opponent),
                                    )
                                }
                                onClick={() => {
                                    const id = crypto.randomUUID();
                                    const ids = opponents.map(() => crypto.randomUUID());
                                    const name = rematchEncounterName(
                                        encounter.name,
                                        t(' · rematch', ' · odveta'),
                                    );
                                    const createdAt = new Date().toISOString();
                                    void save(
                                        (current) => {
                                            if (
                                                getEncounterOpponents(current, encounter).some(
                                                    (opponent) =>
                                                        opponentHasConflict(
                                                            current,
                                                            latestConflicts.current,
                                                            opponent,
                                                        ),
                                                )
                                            )
                                                throw new Error(
                                                    'Resolve opponent conflicts first.',
                                                );
                                            return duplicateEncounter(
                                                current,
                                                encounter,
                                                id,
                                                ids,
                                                name,
                                                createdAt,
                                            );
                                        },
                                        { encounterId: encounter.id },
                                        () => {
                                            onSelect(id, ids[0]);
                                            setAdding(false);
                                        },
                                    );
                                }}
                            >
                                {t('Duplicate for rematch', 'Duplikovat pro odvetu')}
                            </button>
                        </>
                    )}
                </div>
            </div>
            {editName && (
                <form className="sim-encounter-name" onSubmit={submitName}>
                    <label className="filter-label">
                        {t('Encounter name', 'Název souboje')}
                        <input
                            className="filter-input"
                            value={editName.value}
                            maxLength={80}
                            required
                            autoFocus
                            placeholder={t('Rival · Route 110', 'Rival · Route 110')}
                            disabled={disabled}
                            onChange={(event) =>
                                setEditName({ ...editName, value: event.target.value })
                            }
                        />
                    </label>
                    <button
                        className="my-primary"
                        type="submit"
                        disabled={disabled || !editName.value.trim()}
                    >
                        {editName.expected
                            ? t('Save name', 'Uložit název')
                            : t('Create encounter', 'Vytvořit souboj')}
                    </button>
                    <button
                        className="page-button"
                        type="button"
                        disabled={busy}
                        onClick={() => setEditName(undefined)}
                    >
                        {t('Cancel', 'Zrušit')}
                    </button>
                </form>
            )}
            {!encounter && (
                <p className="my-muted">
                    {t(
                        'Save a named encounter to switch quickly between opponents and remember the moves they reveal.',
                        'Uložte pojmenovaný souboj pro rychlé přepínání soupeřových Pokémonů a zaznamenávání odhalených útoků.',
                    )}
                </p>
            )}
            {encounter && (
                <>
                    <div className="sim-encounter-party-heading">
                        <h2>
                            {t('Enemy party', 'Soupeřův tým')}{' '}
                            <span className="my-muted">{opponents.length}/6</span>
                        </h2>
                        <button
                            className="page-button"
                            type="button"
                            disabled={paused || opponents.length >= 6}
                            aria-expanded={adding}
                            onClick={() => setAdding(!adding)}
                        >
                            {adding
                                ? t('Close species search', 'Zavřít hledání druhů')
                                : t('Add opponent', 'Přidat soupeře')}
                        </button>
                    </div>
                    {opponents.length > 0 ? (
                        <ul
                            className="sim-opponent-roster"
                            aria-label={t('Switch opponent', 'Přepnout soupeře')}
                        >
                            {opponents.map((opponent) => (
                                <OpponentButton
                                    key={opponent.id}
                                    opponent={opponent}
                                    selected={opponent.id === selected?.id}
                                    uncertain={opponentHasConflict(document, conflicts, opponent)}
                                    datasetId={datasetId}
                                    onSelect={() => onSelect(encounter.id, opponent.id)}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="my-muted">
                            {t(
                                'Add the Pokémon you have seen. Each starts with four unknown moves.',
                                'Přidejte Pokémony, které jste viděli. Každý začíná se čtyřmi neznámými útoky.',
                            )}
                        </p>
                    )}
                    {adding && opponents.length < 6 && (
                        <fieldset className="sim-encounter-picker" disabled={paused}>
                            <legend>
                                {t('Add an enemy Pokémon', 'Přidat soupeřova Pokémona')}
                            </legend>
                            <SpeciesPicker datasetId={datasetId} onSelect={addOpponent} />
                        </fieldset>
                    )}
                    {selected && (
                        <div className="sim-opponent-details">
                            <div className="sim-encounter-party-heading">
                                <div>
                                    <h3>
                                        {selectedSpecies.data?.name ?? `#${selected.speciesId}`}
                                    </h3>
                                    <p className="my-muted">
                                        {t(
                                            'Level saves when you leave the field. Revealed moves save immediately.',
                                            'Úroveň se uloží po opuštění pole. Odhalené útoky se ukládají ihned.',
                                        )}
                                    </p>
                                </div>
                                <button
                                    className="my-text-button"
                                    type="button"
                                    disabled={selectedPaused}
                                    onClick={() => {
                                        const position = encounter.party.indexOf(selected.id);
                                        void save(
                                            (current) => removeEncounterOpponent(current, selected),
                                            { encounterId: encounter.id, opponentId: selected.id },
                                            () => {
                                                onSelect(
                                                    encounter.id,
                                                    opponents.find(
                                                        (entry) => entry.id !== selected.id,
                                                    )?.id,
                                                );
                                                setUndo({
                                                    label: t(
                                                        'Opponent removed.',
                                                        'Soupeř odstraněn.',
                                                    ),
                                                    run: () => {
                                                        void save(
                                                            (current) =>
                                                                restoreEncounterOpponent(
                                                                    current,
                                                                    selected,
                                                                    position,
                                                                ),
                                                            {
                                                                encounterId: encounter.id,
                                                                opponentId: selected.id,
                                                            },
                                                            () => {
                                                                onSelect(encounter.id, selected.id);
                                                                setUndo(undefined);
                                                            },
                                                        );
                                                    },
                                                });
                                            },
                                        );
                                    }}
                                >
                                    {t('Remove opponent', 'Odebrat soupeře')}
                                </button>
                            </div>
                            <div className="sim-opponent-level-row">
                                <label className="filter-label">
                                    {t('Opponent level', 'Úroveň soupeře')}
                                    <input
                                        className="filter-input"
                                        type="number"
                                        min={1}
                                        max={100}
                                        step={1}
                                        inputMode="numeric"
                                        title={t(
                                            'Enter or Tab saves. Escape restores the saved level.',
                                            'Enter nebo Tab uloží úroveň. Escape obnoví uloženou úroveň.',
                                        )}
                                        value={levelDraft?.value ?? selected.level}
                                        disabled={selectedPaused}
                                        aria-invalid={
                                            levelDraft && parseLevel(levelDraft.value) === undefined
                                                ? true
                                                : undefined
                                        }
                                        onChange={(event) => {
                                            setSaved(false);
                                            setLevelDrafts((current) => ({
                                                ...current,
                                                [selected.id]: {
                                                    value: event.target.value,
                                                    expected:
                                                        current[selected.id]?.expected ?? selected,
                                                },
                                            }));
                                        }}
                                        onBlur={() => saveLevel(selected)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                event.currentTarget.blur();
                                            } else if (event.key === 'Escape') {
                                                event.preventDefault();
                                                discardLevel(selected.id);
                                            }
                                        }}
                                    />
                                </label>
                                {levelDraft && (
                                    <span className="my-muted">
                                        {t(
                                            `Saved: Lv. ${selected.level}`,
                                            `Uloženo: Lv. ${selected.level}`,
                                        )}{' '}
                                        <button
                                            type="button"
                                            className="my-text-button"
                                            disabled={busy}
                                            onPointerDown={(event) => event.preventDefault()}
                                            onClick={() => discardLevel(selected.id)}
                                        >
                                            {t('Use saved level', 'Použít uloženou úroveň')}
                                        </button>
                                        {' · '}
                                        {t('Esc to reset', 'Esc obnoví uloženou úroveň')}
                                    </span>
                                )}
                            </div>
                            <div className="sim-encounter-party-heading">
                                <h3>
                                    {t('Revealed moves', 'Odhalené útoky')}{' '}
                                    <span className="my-muted">{selected.moves.length}/4</span>
                                </h3>
                                {selected.moves.length < 4 && (
                                    <button
                                        className="page-button"
                                        type="button"
                                        disabled={selectedPaused}
                                        onClick={() =>
                                            setMoveDrafts((current) => ({
                                                ...current,
                                                [selected.id]: { query: '' },
                                            }))
                                        }
                                    >
                                        {t('Record revealed move', 'Zapsat odhalený útok')}
                                    </button>
                                )}
                            </div>
                            <ul className="sim-revealed-moves">
                                {selected.moves.map((move) => (
                                    <RevealedMove
                                        key={move.moveId}
                                        move={move}
                                        actions={
                                            <div className="my-actions">
                                                <button
                                                    className="my-text-button"
                                                    type="button"
                                                    disabled={selectedPaused}
                                                    aria-label={t(
                                                        `Replace ${move.name}`,
                                                        `Nahradit ${move.name}`,
                                                    )}
                                                    onClick={() =>
                                                        setMoveDrafts((current) => ({
                                                            ...current,
                                                            [selected.id]: {
                                                                query: '',
                                                                targetMoveId: move.moveId,
                                                            },
                                                        }))
                                                    }
                                                >
                                                    {t('Replace', 'Nahradit')}
                                                </button>
                                                <button
                                                    className="my-text-button"
                                                    type="button"
                                                    disabled={selectedPaused}
                                                    aria-label={t(
                                                        `Remove ${move.name}`,
                                                        `Odebrat ${move.name}`,
                                                    )}
                                                    onClick={() => {
                                                        const moves = selected.moves.filter(
                                                            (known) => known.moveId !== move.moveId,
                                                        );
                                                        void save(
                                                            (current) =>
                                                                setEncounterOpponentMoves(
                                                                    current,
                                                                    selected,
                                                                    moves,
                                                                ),
                                                            {
                                                                encounterId: selected.encounterId,
                                                                opponentId: selected.id,
                                                            },
                                                            () => {
                                                                setUndo({
                                                                    label: t(
                                                                        `${move.name} removed.`,
                                                                        `${move.name} odebrán.`,
                                                                    ),
                                                                    run: () => {
                                                                        void save(
                                                                            (current) =>
                                                                                setEncounterOpponentMoves(
                                                                                    current,
                                                                                    {
                                                                                        ...selected,
                                                                                        moves,
                                                                                    },
                                                                                    selected.moves,
                                                                                ),
                                                                            {
                                                                                encounterId:
                                                                                    selected.encounterId,
                                                                                opponentId:
                                                                                    selected.id,
                                                                            },
                                                                            () =>
                                                                                setUndo(undefined),
                                                                        );
                                                                    },
                                                                });
                                                            },
                                                        );
                                                    }}
                                                >
                                                    {t('Remove', 'Odebrat')}
                                                </button>
                                            </div>
                                        }
                                    />
                                ))}
                                {Array.from({ length: 4 - selected.moves.length }, (_, index) => (
                                    <li key={`unknown-${index}`} className="sim-unknown-move">
                                        <span aria-hidden="true">?</span>{' '}
                                        {t('Unknown move', 'Neznámý útok')}
                                    </li>
                                ))}
                            </ul>
                            {moveDraft && (
                                <div className="sim-revealed-picker">
                                    <div className="sim-encounter-party-heading">
                                        <label className="filter-label">
                                            {moveDraft.targetMoveId === undefined
                                                ? t('Find the revealed move', 'Najít odhalený útok')
                                                : t(
                                                      'Choose replacement move',
                                                      'Vybrat náhradní útok',
                                                  )}
                                            <input
                                                key={`${selected.id}:${moveDraft.targetMoveId ?? 'add'}`}
                                                className="filter-input"
                                                type="search"
                                                maxLength={100}
                                                autoFocus
                                                value={moveDraft.query}
                                                disabled={selectedPaused}
                                                onChange={(event) =>
                                                    setMoveDrafts((current) => ({
                                                        ...current,
                                                        [selected.id]: {
                                                            ...moveDraft,
                                                            query: event.target.value,
                                                        },
                                                    }))
                                                }
                                            />
                                        </label>
                                        <button
                                            className="page-button"
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                setMoveDrafts((current) => ({
                                                    ...current,
                                                    [selected.id]: undefined,
                                                }))
                                            }
                                        >
                                            {t('Cancel', 'Zrušit')}
                                        </button>
                                    </div>
                                    {moveDraft.query.trim() && search.isPending && (
                                        <p role="status">
                                            {t('Searching moves…', 'Vyhledávání útoků…')}
                                        </p>
                                    )}
                                    {search.isError && (
                                        <p role="alert">
                                            {t(
                                                'Move search is unavailable. Reconnect to find uncached moves.',
                                                'Hledání útoků není dostupné. Pro dosud nenačtené útoky se připojte k internetu.',
                                            )}
                                        </p>
                                    )}
                                    {moveTargetMissing && (
                                        <p role="alert">
                                            {t(
                                                'The move you were replacing has changed. Cancel and choose a current move to replace.',
                                                'Nahrazovaný útok se změnil. Zrušte výběr a zvolte aktuální útok k nahrazení.',
                                            )}
                                        </p>
                                    )}
                                    {moveDraft.query.trim() && search.data && (
                                        <ul className="sim-move-search-results">
                                            {search.data.map((move) => (
                                                <li key={move.moveId}>
                                                    <MoveDisplay
                                                        move={move}
                                                        reference={move}
                                                        size="medium"
                                                        show={{ effectivePower: false }}
                                                        interaction={{
                                                            kind: 'button',
                                                            label: t(
                                                                `Record ${move.name}`,
                                                                `Zapsat ${move.name}`,
                                                            ),
                                                            disabled:
                                                                selectedPaused ||
                                                                moveTargetMissing ||
                                                                selected.moves.some(
                                                                    (known) =>
                                                                        known.moveId ===
                                                                        move.moveId,
                                                                ),
                                                            onClick: () => chooseMove(move),
                                                        }}
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {moveDraft.query.trim() && search.data?.length === 0 && (
                                        <p className="my-muted">
                                            {t('No matching moves.', 'Žádné odpovídající útoky.')}
                                        </p>
                                    )}
                                </div>
                            )}
                            <p className="my-muted">
                                {t(
                                    'Only record moves you have seen. Unknown moves can still be dangerous.',
                                    'Zapisujte pouze útoky, které jste viděli. I neznámé útoky mohou být nebezpečné.',
                                )}
                            </p>
                        </div>
                    )}
                </>
            )}
            {(runConflict || encounterConflict || selectedConflict) && (
                <p role="alert">
                    {t(
                        'Resolve this encounter’s sync conflict in My Pokémon before editing its affected details.',
                        'Před úpravou dotčených údajů vyřešte konflikt synchronizace v sekci Moji Pokémoni.',
                    )}
                </p>
            )}
            {error && (
                <div className="sim-encounter-feedback" role="alert">
                    <p>{error.message}</p>
                    {error.retry && (
                        <button
                            className="page-button"
                            type="button"
                            disabled={busy}
                            onClick={error.retry}
                        >
                            {t('Retry save', 'Zkusit uložit znovu')}
                        </button>
                    )}
                </div>
            )}
            {undo && (
                <div className="sim-encounter-feedback">
                    <span>{undo.label}</span>
                    <button
                        type="button"
                        className="page-button"
                        disabled={busy || runConflict}
                        onClick={undo.run}
                    >
                        {t('Undo', 'Vrátit zpět')}
                    </button>
                </div>
            )}
            <span className="sim-encounter-save-state my-muted" role="status">
                {busy
                    ? t('Saving…', 'Ukládání…')
                    : saved
                      ? t('Saved to your collection.', 'Uloženo do sbírky.')
                      : ''}
            </span>
        </section>
    );
}
