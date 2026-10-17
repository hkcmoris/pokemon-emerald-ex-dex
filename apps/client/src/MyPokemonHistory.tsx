import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import {
    interpolateStats,
    getNatureStatEffect,
    type BaseStats,
    type OwnedPokemon,
    type SpeciesDetails,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { useLanguage, type Translate } from './language.js';
import { NatureStat } from './NatureStat.js';
import { predictStats } from './collectionStats.js';
import {
    clearObservationDraft,
    getObservationDraft,
    observationDraftKey,
    runObservationDraftSave,
    setObservationDraft,
    useObservationDraftSaveCount,
    useObservationDraftSaving,
    type ObservationDraft,
} from './observationDrafts.js';

const statKeys: readonly (keyof BaseStats)[] = [
    'hp',
    'attack',
    'defense',
    'spAttack',
    'spDefense',
    'speed',
];

export function statName(key: keyof BaseStats, t: Translate): string {
    const labels: Record<keyof BaseStats, string> = {
        hp: t('HP', 'HP'),
        attack: t('Attack', 'Útok'),
        defense: t('Defense', 'Obrana'),
        spAttack: t('Sp. Attack', 'Spec. útok'),
        spDefense: t('Sp. Defense', 'Spec. obrana'),
        speed: t('Speed', 'Rychlost'),
    };
    return labels[key];
}

function localDateTime(iso: string): string {
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ObservationForm({
    pokemon,
    observation,
    observations = [],
    predictionsEnabled = true,
    natureId = pokemon.natureId,
    draftKey: selectedDraftKey,
    onSave,
    onCancel,
}: {
    pokemon: OwnedPokemon;
    observation?: StatObservation;
    observations?: readonly StatObservation[];
    predictionsEnabled?: boolean;
    natureId?: number | null;
    draftKey?: string;
    onSave: (value: StatObservation) => Promise<void>;
    onCancel: () => void;
}) {
    const { t } = useLanguage();
    const draftKey = selectedDraftKey ?? observationDraftKey(pokemon, observation);
    const [draft, setDraft] = useState<ObservationDraft>(
        () =>
            getObservationDraft(draftKey) ?? {
                speciesId: observation?.speciesId ?? pokemon.state.speciesId,
                formEpoch: observation?.formEpoch ?? pokemon.state.formEpoch,
                observationId: observation?.id,
                level: String(observation?.level ?? pokemon.state.level),
                recordedAt: localDateTime(observation?.recordedAt ?? new Date().toISOString()),
                stats: Object.fromEntries(
                    Object.entries(observation?.stats ?? {}).map(([key, value]) => [
                        key,
                        String(value),
                    ]),
                ),
            },
    );
    const { level, recordedAt, stats } = draft;
    const currentForm =
        draft.speciesId === pokemon.state.speciesId && draft.formEpoch === pokemon.state.formEpoch;
    function changeDraft(next: ObservationDraft) {
        setDraft(next);
        setObservationDraft(draftKey, pokemon.id, next);
    }
    const predictionHintId = useId();
    const recordingNatureId =
        !observation && currentForm && Number(level) === pokemon.state.level ? natureId : null;
    const predictions =
        !observation && currentForm && predictionsEnabled
            ? predictStats(pokemon, observations, Number(level))
            : {};
    const isPredicted = (key: keyof BaseStats): boolean =>
        stats[key] === undefined && predictions[key] !== undefined;
    const hasPredictions = statKeys.some(isPredicted);
    // Explicit edits, including clearing a field, always win over changing predictions.
    const statValue = (key: keyof BaseStats): string =>
        stats[key] ?? (predictions[key] === undefined ? '' : String(predictions[key]));
    const busy = useObservationDraftSaving(draftKey);
    const completedSaves = useObservationDraftSaveCount(draftKey);
    const initialCompletedSaves = useRef(completedSaves);
    useEffect(() => {
        if (completedSaves !== initialCompletedSaves.current) {
            initialCompletedSaves.current = completedSaves;
            // Also close a replacement editor mounted while the original save was pending.
            onCancel();
        }
    }, [completedSaves, onCancel]);
    const [error, setError] = useState<string | null>(null);
    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (busy) return;
        const measured: Partial<BaseStats> = {};
        for (const key of statKeys) {
            const value = statValue(key);
            if (value !== '') measured[key] = Number(value);
        }
        if (Object.keys(measured).length === 0) {
            setError(
                t(
                    'Enter at least one observed stat.',
                    'Zadejte alespoň jednu naměřenou statistiku.',
                ),
            );
            return;
        }
        setError(null);
        try {
            await runObservationDraftSave(draftKey, () =>
                onSave({
                    id: observation?.id ?? crypto.randomUUID(),
                    pokemonId: pokemon.id,
                    speciesId: draft.speciesId,
                    formEpoch: draft.formEpoch,
                    level: Number(level),
                    recordedAt: new Date(recordedAt).toISOString(),
                    stats: measured,
                    deleted: false,
                }),
            );
        } catch {
            setError(
                t(
                    'Could not save this observation. Try again.',
                    'Záznam se nepodařilo uložit. Zkuste to znovu.',
                ),
            );
        }
    }
    return (
        <form
            className="my-inset my-stack"
            data-stat-observation-form
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <h4>
                {observation
                    ? t('Correct observation', 'Opravit záznam')
                    : t('Record battle stats', 'Zaznamenat bojové statistiky')}
            </h4>
            <p className="my-muted">
                {t(
                    'Enter values shown in the game. Leave unknown stats blank.',
                    'Zadejte hodnoty zobrazené ve hře. Neznámé statistiky nechte prázdné.',
                )}
            </p>
            {!observation && (
                <p className="my-muted">
                    {!currentForm
                        ? t(
                              'This unfinished entry belongs to an earlier form. Saving adds it to history and keeps the current species and level unchanged.',
                              'Rozepsaný záznam patří k dřívější formě. Uloží se do historie. Aktuální druh ani úroveň se nezmění.',
                          )
                        : t(
                              'Saving a higher level also updates this Pokémon’s current level. Older screenshots stay in history without lowering it. Unfinished entries stay available while you switch Pokémon or views.',
                              'Vyšší zapsaná úroveň aktualizuje i aktuální úroveň Pokémona. Starší snímky zůstanou v historii a úroveň nesníží. Rozepsané údaje zůstanou zachované při přepnutí Pokémona nebo zobrazení.',
                          )}
                </p>
            )}
            {hasPredictions && (
                <p className="my-muted" id={predictionHintId}>
                    {t(
                        'Prefilled values are estimates from your last two recorded levels in this form. Check them against the game before saving.',
                        'Předvyplněné hodnoty jsou odhady ze dvou posledních zaznamenaných úrovní této formy. Před uložením je ověřte ve hře.',
                    )}
                </p>
            )}
            <div className="my-fields">
                <label className="filter-label">
                    {t('Observed level', 'Úroveň při měření')}
                    <input
                        className="filter-input"
                        type="number"
                        inputMode="numeric"
                        autoFocus
                        min="1"
                        max="100"
                        step="1"
                        required
                        disabled={busy}
                        value={level}
                        onChange={(event) => changeDraft({ ...draft, level: event.target.value })}
                    />
                </label>
                <label className="filter-label">
                    {t('Observed at', 'Datum měření')}
                    <input
                        className="filter-input"
                        type="datetime-local"
                        required
                        disabled={busy}
                        value={recordedAt}
                        onChange={(event) =>
                            changeDraft({ ...draft, recordedAt: event.target.value })
                        }
                    />
                </label>
            </div>
            <div className="my-stat-inputs">
                {statKeys.map((key) => (
                    <label className="filter-label" key={key}>
                        <NatureStat stat={key} natureId={recordingNatureId}>
                            {statName(key, t)}
                        </NatureStat>
                        {isPredicted(key) && (
                            <>
                                {' '}
                                <small className="my-muted">{t('Estimate', 'Odhad')}</small>
                            </>
                        )}
                        <input
                            className="filter-input"
                            type="number"
                            min="1"
                            max="65535"
                            step="1"
                            inputMode="numeric"
                            disabled={busy}
                            value={statValue(key)}
                            data-nature-effect={
                                getNatureStatEffect(recordingNatureId, key) ?? undefined
                            }
                            aria-label={statName(key, t)}
                            aria-describedby={isPredicted(key) ? predictionHintId : undefined}
                            onChange={(event) =>
                                changeDraft({
                                    ...draft,
                                    stats: { ...stats, [key]: event.target.value },
                                })
                            }
                        />
                    </label>
                ))}
            </div>
            {error && <p role="alert">{error}</p>}
            <div className="my-actions">
                <button className="my-primary" disabled={busy} type="submit">
                    {observation
                        ? t('Save correction', 'Uložit opravu')
                        : currentForm
                          ? t('Save observation', 'Uložit záznam')
                          : t('Save to history', 'Uložit do historie')}
                </button>
                <button
                    className="page-button"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                        clearObservationDraft(draftKey);
                        onCancel();
                    }}
                >
                    {t('Cancel', 'Zrušit')}
                </button>
            </div>
        </form>
    );
}

export function GrowthTable({
    observations,
    family,
    showEstimates,
    onEdit,
    onDelete,
}: {
    observations: readonly StatObservation[];
    family: readonly SpeciesDetails[];
    showEstimates: boolean;
    onEdit: (observation: StatObservation) => void;
    onDelete: (observation: StatObservation) => void;
}) {
    const { t, locale } = useLanguage();
    const active = observations.filter((entry) => !entry.deleted);
    const estimates = showEstimates ? interpolateStats(active) : [];
    const epochs = [
        ...new Set(
            active
                .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
                .map((entry) => entry.formEpoch),
        ),
    ];
    if (active.length === 0)
        return (
            <p className="my-muted">
                {t(
                    'No battle stats recorded. Tracking stats is optional.',
                    'Bojové statistiky zatím nejsou zaznamenány. Jejich sledování je volitelné.',
                )}
            </p>
        );
    return (
        <div className="my-stack">
            {epochs.map((epoch, index) => {
                const observed = active.filter((entry) => entry.formEpoch === epoch);
                const speciesId = observed[0].speciesId;
                const species =
                    family.find((entry) => entry.speciesId === speciesId)?.name ?? `#${speciesId}`;
                const rows = [
                    ...observed.map((entry) => ({
                        key: entry.id,
                        level: entry.level,
                        stats: entry.stats,
                        observation: entry,
                        estimated: false,
                    })),
                    ...estimates
                        .filter((entry) => entry.formEpoch === epoch)
                        .map((entry) => ({
                            key: `${epoch}-${entry.level}`,
                            level: entry.level,
                            stats: entry.stats,
                            observation: null,
                            estimated: true,
                        })),
                ].sort((a, b) => a.level - b.level || Number(a.estimated) - Number(b.estimated));
                return (
                    <div key={epoch}>
                        <h4 className="my-history-heading">
                            {species} · {t('Stage record', 'Období formy')} {index + 1}
                        </h4>
                        <div className="my-table-scroll">
                            <table className="my-history-table">
                                <caption className="sr-only">
                                    {t(
                                        'Observed growth and optional estimates',
                                        'Naměřený růst a volitelné odhady',
                                    )}
                                </caption>
                                <thead>
                                    <tr>
                                        <th>{t('Level', 'Úroveň')}</th>
                                        {statKeys.map((key) => (
                                            <th key={key}>{statName(key, t)}</th>
                                        ))}
                                        <th>{t('Source', 'Zdroj')}</th>
                                        <th>{t('Actions', 'Akce')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={row.key}
                                            className={row.estimated ? 'my-estimate' : undefined}
                                        >
                                            <th scope="row">{row.level}</th>
                                            {statKeys.map((key) => (
                                                <td key={key}>
                                                    {row.stats[key] === undefined
                                                        ? '—'
                                                        : row.estimated
                                                          ? `≈${Number(row.stats[key].toFixed(1))}`
                                                          : row.stats[key]}
                                                </td>
                                            ))}
                                            <td>
                                                {row.observation ? (
                                                    <>
                                                        <strong>{t('Observed', 'Naměřeno')}</strong>
                                                        <small>
                                                            {new Date(
                                                                row.observation.recordedAt,
                                                            ).toLocaleString(locale)}
                                                        </small>
                                                    </>
                                                ) : (
                                                    t('Estimate', 'Odhad')
                                                )}
                                            </td>
                                            <td>
                                                {row.observation && (
                                                    <div className="my-actions">
                                                        <button
                                                            className="my-text-button"
                                                            type="button"
                                                            onClick={() => {
                                                                if (row.observation)
                                                                    onEdit(row.observation);
                                                            }}
                                                        >
                                                            {t('Correct', 'Opravit')}
                                                        </button>
                                                        <button
                                                            className="my-text-button"
                                                            type="button"
                                                            onClick={() => {
                                                                if (row.observation)
                                                                    onDelete(row.observation);
                                                            }}
                                                        >
                                                            {t('Remove', 'Odstranit')}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function MyPokemonHistory({
    pokemon,
    observations,
    family,
    saveObservation,
    predictionsEnabled = true,
    natureId = pokemon.natureId,
    onRecord,
}: {
    pokemon: OwnedPokemon;
    observations: readonly StatObservation[];
    family: readonly SpeciesDetails[];
    saveObservation: (observation: StatObservation) => Promise<void>;
    predictionsEnabled?: boolean;
    natureId?: number | null;
    onRecord?: () => void;
}) {
    const { t } = useLanguage();
    const [editing, setEditing] = useState<StatObservation | 'new' | null>(null);
    const [showEstimates, setShowEstimates] = useState(false);
    const [error, setError] = useState<string | null>(null);
    async function change(observation: StatObservation) {
        setError(null);
        try {
            await saveObservation(observation);
        } catch {
            setError(
                t(
                    'Could not update history. Try again.',
                    'Historii se nepodařilo upravit. Zkuste to znovu.',
                ),
            );
        }
    }
    return (
        <section
            className="my-stack"
            aria-label={t('Battle stat history', 'Historie bojových statistik')}
        >
            <div className="my-section-heading">
                <h3>{t('Growth history', 'Historie růstu')}</h3>
                <button
                    className="page-button"
                    type="button"
                    onClick={() => {
                        if (onRecord) onRecord();
                        else setEditing('new');
                    }}
                >
                    {t('Record stats', 'Zapsat statistiky')}
                </button>
            </div>
            <p className="my-muted">
                {t(
                    'Table estimates fill gaps between measurements of the same continuous species/form stage. They are not measured stats. Predictions for a new level appear only in the entry form until you save them.',
                    'Odhady v tabulce vyplňují mezery mezi měřeními ve stejném souvislém období druhu či formy. Nejde o naměřené statistiky. Předpovědi pro novou úroveň se do uložení zobrazují pouze ve formuláři.',
                )}
            </p>
            <label className="my-check">
                <input
                    type="checkbox"
                    checked={showEstimates}
                    onChange={(event) => setShowEstimates(event.target.checked)}
                />
                {t('Show estimates between observations', 'Zobrazit odhady mezi měřeními')}
            </label>
            {editing && (
                <ObservationForm
                    key={
                        editing === 'new'
                            ? `new-${pokemon.state.speciesId}-${pokemon.state.formEpoch}`
                            : editing.id
                    }
                    pokemon={pokemon}
                    observation={editing === 'new' ? undefined : editing}
                    natureId={natureId}
                    observations={observations}
                    predictionsEnabled={predictionsEnabled}
                    onSave={async (entry) => {
                        await saveObservation(entry);
                        setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                />
            )}
            {error && <p role="alert">{error}</p>}
            <GrowthTable
                observations={observations}
                family={family}
                showEstimates={showEstimates}
                onEdit={setEditing}
                onDelete={(entry) => {
                    void change({ ...entry, deleted: true });
                }}
            />
            {observations.some((entry) => entry.deleted) && (
                <details className="my-details">
                    <summary>{t('Removed observations', 'Odstraněné záznamy')}</summary>
                    {observations
                        .filter((entry) => entry.deleted)
                        .map((entry) => (
                            <div className="my-list-row" key={entry.id}>
                                <span>
                                    {t('Level', 'Úroveň')} {entry.level} ·{' '}
                                    {new Date(entry.recordedAt).toLocaleDateString()}
                                </span>
                                <button
                                    className="page-button"
                                    type="button"
                                    onClick={() => {
                                        void change({ ...entry, deleted: false });
                                    }}
                                >
                                    {t('Restore', 'Obnovit')}
                                </button>
                            </div>
                        ))}
                </details>
            )}
        </section>
    );
}
