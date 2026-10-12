import { useState, type SubmitEvent } from 'react';
import {
    interpolateStats,
    type BaseStats,
    type OwnedPokemon,
    type SpeciesDetails,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { useLanguage, type Translate } from './language.js';

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
    onSave,
    onCancel,
}: {
    pokemon: OwnedPokemon;
    observation?: StatObservation;
    onSave: (value: StatObservation) => Promise<void>;
    onCancel: () => void;
}) {
    const { t } = useLanguage();
    const [level, setLevel] = useState(String(observation?.level ?? pokemon.state.level));
    const [recordedAt, setRecordedAt] = useState(() =>
        localDateTime(observation?.recordedAt ?? new Date().toISOString()),
    );
    const [stats, setStats] = useState<Partial<Record<keyof BaseStats, string>>>(() =>
        Object.fromEntries(
            Object.entries(observation?.stats ?? {}).map(([key, value]) => [key, String(value)]),
        ),
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    async function submit(event: SubmitEvent) {
        event.preventDefault();
        const measured: Partial<BaseStats> = {};
        for (const key of statKeys) {
            const value = stats[key];
            if (value !== undefined && value !== '') measured[key] = Number(value);
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
        setBusy(true);
        setError(null);
        try {
            await onSave({
                id: observation?.id ?? crypto.randomUUID(),
                pokemonId: pokemon.id,
                speciesId: observation?.speciesId ?? pokemon.state.speciesId,
                formEpoch: observation?.formEpoch ?? pokemon.state.formEpoch,
                level: Number(level),
                recordedAt: new Date(recordedAt).toISOString(),
                stats: measured,
                deleted: false,
            });
        } catch {
            setError(
                t(
                    'Could not save this observation. Try again.',
                    'Záznam se nepodařilo uložit. Zkuste to znovu.',
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <form
            className="my-inset my-stack"
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
            <div className="my-fields">
                <label className="filter-label">
                    {t('Observed level', 'Úroveň při měření')}
                    <input
                        className="filter-input"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        required
                        value={level}
                        onChange={(event) => setLevel(event.target.value)}
                    />
                </label>
                <label className="filter-label">
                    {t('Observed at', 'Datum měření')}
                    <input
                        className="filter-input"
                        type="datetime-local"
                        required
                        value={recordedAt}
                        onChange={(event) => setRecordedAt(event.target.value)}
                    />
                </label>
            </div>
            <div className="my-stat-inputs">
                {statKeys.map((key) => (
                    <label className="filter-label" key={key}>
                        {statName(key, t)}
                        <input
                            className="filter-input"
                            type="number"
                            min="1"
                            max="65535"
                            step="1"
                            value={stats[key] ?? ''}
                            onChange={(event) => setStats({ ...stats, [key]: event.target.value })}
                        />
                    </label>
                ))}
            </div>
            {error && <p role="alert">{error}</p>}
            <div className="my-actions">
                <button className="my-primary" disabled={busy} type="submit">
                    {observation
                        ? t('Save correction', 'Uložit opravu')
                        : t('Save observation', 'Uložit záznam')}
                </button>
                <button className="page-button" type="button" onClick={onCancel}>
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
}: {
    pokemon: OwnedPokemon;
    observations: readonly StatObservation[];
    family: readonly SpeciesDetails[];
    saveObservation: (observation: StatObservation) => Promise<void>;
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
                <button className="page-button" type="button" onClick={() => setEditing('new')}>
                    {t('Record stats', 'Zapsat statistiky')}
                </button>
            </div>
            <p className="my-muted">
                {t(
                    'Estimates fill gaps between measurements of the same continuous species/form stage. They are not measured stats and never predict future levels.',
                    'Odhady vyplňují mezery mezi měřeními ve stejném souvislém období druhu či formy. Nejde o naměřené statistiky ani o předpovědi dalších úrovní.',
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
                    key={editing === 'new' ? 'new' : editing.id}
                    pokemon={pokemon}
                    observation={editing === 'new' ? undefined : editing}
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
