import { useId } from 'react';
import {
    statKeys,
    type BaseStats,
    type OwnedPokemon,
    type SpeciesDetails,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { useLanguage } from './language.js';
import { statName } from './MyPokemonHistory.js';
import { getCurrentStats } from './collectionStats.js';

/** Theme colors shared by the plot and its stat legend. */
const statColors: Readonly<Record<keyof BaseStats, string>> = {
    hp: 'var(--stat-hp)',
    attack: 'var(--stat-attack)',
    defense: 'var(--stat-defense)',
    spAttack: 'var(--stat-sp-attack)',
    spDefense: 'var(--stat-sp-defense)',
    speed: 'var(--stat-speed)',
};

interface StatPoint {
    level: number;
    value: number;
}

function statSegments(
    observations: readonly StatObservation[],
    stat: keyof BaseStats,
): StatPoint[][] {
    const byLevel = new Map<number, Set<number>>();
    for (const observation of observations) {
        const values = byLevel.get(observation.level) ?? new Set<number>();
        const value = observation.stats[stat];
        if (value !== undefined) values.add(value);
        byLevel.set(observation.level, values);
    }
    const segments: StatPoint[][] = [];
    let segment: StatPoint[] = [];
    for (const [level, values] of [...byLevel].sort(([left], [right]) => left - right)) {
        if (values.size !== 1) {
            if (segment.length > 1) segments.push(segment);
            segment = [];
        } else {
            segment.push({ level, value: [...values][0] });
        }
    }
    if (segment.length > 1) segments.push(segment);
    return segments;
}

export function MyPokemonStatsGraph({
    pokemon,
    observations,
    family,
    compact = false,
}: {
    pokemon: OwnedPokemon;
    observations: readonly StatObservation[];
    family: readonly SpeciesDetails[];
    compact?: boolean;
}) {
    const { t, locale } = useLanguage();
    const id = useId();
    const currentStats = getCurrentStats(pokemon, observations);
    const active = observations
        .filter(
            (entry) =>
                !entry.deleted &&
                entry.pokemonId === pokemon.id &&
                statKeys.some((stat) => entry.stats[stat] !== undefined),
        )
        .sort(
            (left, right) =>
                left.level - right.level ||
                Date.parse(left.recordedAt) - Date.parse(right.recordedAt),
        );
    if (active.length === 0)
        return (
            <p className="my-muted">
                {t(
                    'No battle stats recorded. Record stats in Growth history to see progression over levels.',
                    'Bojové statistiky zatím nejsou zaznamenány. Zapište je v historii růstu a zobrazte jejich průběh podle úrovně.',
                )}
            </p>
        );

    const periods = new Map<string, StatObservation[]>();
    for (const entry of active) {
        const key = `${entry.speciesId}:${entry.formEpoch}`;
        const period = periods.get(key) ?? [];
        period.push(entry);
        periods.set(key, period);
    }
    const firstLevel = active[0].level;
    const lastLevel = active[active.length - 1].level;
    const maximum = Math.max(
        ...active.flatMap((entry) => statKeys.map((stat) => entry.stats[stat] ?? 0)),
    );
    const magnitude = Math.max(1, 10 ** Math.floor(Math.log10(maximum / 4)));
    const interval =
        ([1, 2, 5, 10].find((step) => step * magnitude >= maximum / 4) ?? 10) * magnitude;
    const ceiling = Math.ceil(maximum / interval) * interval;
    const yTicks = Array.from(
        { length: Math.round(ceiling / interval) + 1 },
        (_, index) => index * interval,
    );
    const xTicks = [
        ...new Set(
            Array.from({ length: 5 }, (_, index) =>
                Math.round(firstLevel + ((lastLevel - firstLevel) * index) / 4),
            ),
        ),
    ];
    const left = 76;
    const right = compact ? 306 : 386;
    const top = 12;
    const bottom = compact ? 172 : 192;
    const x = (level: number): number =>
        firstLevel === lastLevel
            ? (left + right) / 2
            : left + ((level - firstLevel) / (lastLevel - firstLevel)) * (right - left);
    const y = (value: number): number => bottom - (value / ceiling) * (bottom - top);
    const speciesName = (speciesId: number): string =>
        family.find((entry) => entry.speciesId === speciesId)?.name ?? `#${speciesId}`;
    const description = t(
        'Recorded battle stats by level. Lines stay within one species/form period and stop at missing or contradictory values. No stats are estimated.',
        'Zaznamenané bojové statistiky podle úrovně. Čáry spojují pouze stejné období druhu a formy. Chybějící nebo rozporné hodnoty čáru přerušují. Graf neobsahuje odhady.',
    );

    return (
        <figure className="my-stats-graph">
            <svg
                className="my-stats-chart"
                viewBox={compact ? '0 0 320 220' : '0 0 400 240'}
                role="img"
                aria-labelledby={`${id}-title ${id}-description`}
            >
                <title id={`${id}-title`}>
                    {t('Stat progression over levels', 'Průběh statistik podle úrovně')}
                </title>
                <desc id={`${id}-description`}>{description}</desc>
                {yTicks.map((value) => (
                    <g key={value}>
                        <line
                            className="my-stats-gridline"
                            x1={left}
                            x2={right}
                            y1={y(value)}
                            y2={y(value)}
                        />
                        <text
                            className="my-stats-axis"
                            x={left - 8}
                            y={y(value)}
                            textAnchor="end"
                            dominantBaseline="middle"
                        >
                            {value}
                        </text>
                    </g>
                ))}
                {xTicks.map((level) => (
                    <text
                        className="my-stats-axis"
                        key={level}
                        x={x(level)}
                        y={bottom + 18}
                        textAnchor="middle"
                    >
                        {level}
                    </text>
                ))}
                <text
                    className="my-stats-axis"
                    x={(left + right) / 2}
                    y={bottom + 42}
                    textAnchor="middle"
                >
                    {t('Level', 'Úroveň')}
                </text>
                <text
                    className="my-stats-axis"
                    transform={`translate(12 ${(top + bottom) / 2}) rotate(-90)`}
                    textAnchor="middle"
                >
                    {t('Stat value', 'Hodnota statistiky')}
                </text>
                {[...periods].map(([period, entries]) => (
                    <g
                        key={period}
                        data-species-id={entries[0].speciesId}
                        data-form-epoch={entries[0].formEpoch}
                    >
                        {statKeys.map((stat) => (
                            <g key={stat} data-stat={stat}>
                                {statSegments(entries, stat).map((segment, index) => (
                                    <polyline
                                        key={index}
                                        points={segment
                                            .map((point) => `${x(point.level)},${y(point.value)}`)
                                            .join(' ')}
                                        fill="none"
                                        stroke={statColors[stat]}
                                        strokeWidth="2"
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                ))}
                                {entries.flatMap((entry) => {
                                    const value = entry.stats[stat];
                                    if (value === undefined) return [];
                                    return [
                                        <circle
                                            key={entry.id}
                                            cx={x(entry.level)}
                                            cy={y(value)}
                                            r="3.5"
                                            fill={statColors[stat]}
                                        >
                                            <title>
                                                {`${statName(stat, t)}: ${value} · ${t('Level', 'Úroveň')} ${entry.level} · ${speciesName(entry.speciesId)} · ${new Date(entry.recordedAt).toLocaleString(locale)}`}
                                            </title>
                                        </circle>,
                                    ];
                                })}
                            </g>
                        ))}
                    </g>
                ))}
            </svg>
            <ul className="my-stats-legend" aria-label={t('Current stats', 'Aktuální statistiky')}>
                {statKeys.map((stat) => (
                    <li key={stat} data-stat={stat}>
                        <span aria-hidden="true" style={{ backgroundColor: statColors[stat] }} />
                        <span>{statName(stat, t)}</span>
                        <strong>{currentStats[stat] ?? '—'}</strong>
                    </li>
                ))}
            </ul>
            <figcaption className="my-muted">
                {t(
                    'Recorded stats. Gaps mark missing or conflicting data, or a change of form.',
                    'Zaznamenané statistiky. Mezery označují chybějící či rozporné údaje nebo změnu formy.',
                )}
            </figcaption>
            <div className="sr-only">
                <table>
                    <caption>
                        {t('Recorded stat progression', 'Zaznamenaný průběh statistik')}
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">{t('Species/form', 'Druh/forma')}</th>
                            <th scope="col">{t('Level', 'Úroveň')}</th>
                            <th scope="col">{t('Observed at', 'Datum měření')}</th>
                            {statKeys.map((stat) => (
                                <th key={stat} scope="col">
                                    {statName(stat, t)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {active.map((entry) => (
                            <tr key={entry.id}>
                                <th scope="row">{speciesName(entry.speciesId)}</th>
                                <td>{entry.level}</td>
                                <td>{new Date(entry.recordedAt).toLocaleString(locale)}</td>
                                {statKeys.map((stat) => (
                                    <td key={stat}>{entry.stats[stat] ?? '—'}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </figure>
    );
}
