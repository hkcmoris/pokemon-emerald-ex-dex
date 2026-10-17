import {
    statKeys,
    type BaseStats,
    type OwnedPokemon,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';
import { getCurrentStats } from './collectionStats.js';
import { statName } from './MyPokemonHistory.js';
import { useLanguage } from './language.js';

export function getPreviousObservedStats(
    pokemon: OwnedPokemon,
    observations: readonly StatObservation[],
): Partial<BaseStats> {
    const sameStage = observations.filter(
        (entry) =>
            !entry.deleted &&
            entry.pokemonId === pokemon.id &&
            entry.formEpoch === pokemon.state.formEpoch &&
            entry.speciesId === pokemon.state.speciesId,
    );
    const latestTime = Math.max(
        ...sameStage
            .filter((entry) => entry.level === pokemon.state.level)
            .map((entry) => Date.parse(entry.recordedAt)),
    );
    const previousTime = Math.max(
        ...sameStage
            .filter(
                (entry) =>
                    Date.parse(entry.recordedAt) < latestTime && entry.level <= pokemon.state.level,
            )
            .map((entry) => Date.parse(entry.recordedAt)),
    );
    const previous = sameStage.filter((entry) => Date.parse(entry.recordedAt) === previousTime);
    if (!previous[0] || !previous.every((entry) => entry.level === previous[0].level)) return {};
    return getCurrentStats(
        { ...pokemon, state: { ...pokemon.state, level: previous[0].level } },
        previous,
    );
}

export function MyPokemonCurrentStats({
    pokemon,
    observations,
}: {
    pokemon: OwnedPokemon;
    observations: readonly StatObservation[];
}) {
    const { t } = useLanguage();
    const current = getCurrentStats(pokemon, observations);
    const previous = getPreviousObservedStats(pokemon, observations);
    return (
        <section
            className="my-current-stat-summary"
            aria-label={t('Current measured stats', 'Aktuální naměřené statistiky')}
        >
            <dl>
                {statKeys.map((key) => {
                    const value = current[key];
                    const delta =
                        value === undefined || previous[key] === undefined
                            ? undefined
                            : value - previous[key];
                    return (
                        <div key={key}>
                            <dt>{statName(key, t)}</dt>
                            <dd>
                                <strong>{value ?? '—'}</strong>
                                {delta !== undefined && (
                                    <small className={delta > 0 ? 'my-stat-increase' : undefined}>
                                        {delta > 0 ? '+' : ''}
                                        {delta}
                                    </small>
                                )}
                            </dd>
                        </div>
                    );
                })}
            </dl>
            <p className="my-muted">
                {t(
                    'Measured at the current level · changes since the previous observation in this form.',
                    'Naměřeno na aktuální úrovni · změny od předchozího měření v této formě.',
                )}
            </p>
        </section>
    );
}
