import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import {
    statKeys,
    getNatureStatEffect,
    type BaseStats,
    type OwnedPokemon,
    type SpeciesDetails,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { useLanguage } from './language.js';
import { statName } from './MyPokemonHistory.js';
import { NatureStat } from './NatureStat.js';
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
    const measurements = new Map<
        string,
        { level: number; time: number; values: Set<number | undefined> }
    >();
    for (const observation of observations) {
        const time = Date.parse(observation.recordedAt);
        const key = `${observation.level}:${time}`;
        const measurement = measurements.get(key) ?? {
            level: observation.level,
            time,
            values: new Set<number | undefined>(),
        };
        measurement.values.add(observation.stats[stat]);
        measurements.set(key, measurement);
    }
    const segments: StatPoint[][] = [];
    let segment: StatPoint[] = [];
    const ordered = [...measurements.values()].sort(
        (left, right) => left.level - right.level || left.time - right.time,
    );
    for (const { level, values } of ordered) {
        const value = values.values().next().value;
        if (values.size !== 1 || value === undefined) {
            if (segment.length > 1) segments.push(segment);
            segment = [];
        } else {
            // Training can change a stat without a level-up; retain that vertical step.
            const previous = segment.at(-1);
            if (previous?.level !== level || previous.value !== value)
                segment.push({ level, value });
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
    natureId = pokemon.natureId,
}: {
    pokemon: OwnedPokemon;
    observations: readonly StatObservation[];
    family: readonly SpeciesDetails[];
    compact?: boolean;
    natureId?: number | null;
}) {
    const { t, locale } = useLanguage();
    const id = useId();
    const plotRef = useRef<HTMLDivElement>(null);
    const [hint, setHint] = useState<{ key: string; pinned: boolean } | null>(null);
    useEffect(() => {
        const dismissOutside = (event: globalThis.PointerEvent): void => {
            if (event.target instanceof Node && !plotRef.current?.contains(event.target))
                setHint(null);
        };
        const dismissWithEscape = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') setHint(null);
        };
        document.addEventListener('pointerdown', dismissOutside);
        document.addEventListener('keydown', dismissWithEscape);
        return () => {
            document.removeEventListener('pointerdown', dismissOutside);
            document.removeEventListener('keydown', dismissWithEscape);
        };
    }, []);
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
    const width = compact ? 320 : 400;
    const height = compact ? 220 : 240;
    const points = active.flatMap((entry) =>
        statKeys.flatMap((stat) => {
            const value = entry.stats[stat];
            return value === undefined ? [] : [{ key: `${entry.id}:${stat}`, entry, stat, value }];
        }),
    );
    const selected = points.find((point) => point.key === hint?.key);
    // Compare in screen pixels so a nearby point stays easy to select at any chart size.
    const nearestPoint = (event: MouseEvent<SVGSVGElement>): string | null => {
        const bounds = event.currentTarget.getBoundingClientRect();
        let nearest: string | null = null;
        let distance = 16 ** 2;
        for (const point of points) {
            const dx = bounds.left + (x(point.entry.level) / width) * bounds.width - event.clientX;
            const dy = bounds.top + (y(point.value) / height) * bounds.height - event.clientY;
            const candidate = dx * dx + dy * dy;
            if (candidate <= distance) {
                nearest = point.key;
                distance = candidate;
            }
        }
        return nearest;
    };
    const speciesName = (speciesId: number): string =>
        family.find((entry) => entry.speciesId === speciesId)?.name ?? `#${speciesId}`;
    const description = t(
        'Recorded battle stats by level. Readings at the same level connect in measurement-time order. Lines stay within one species/form period and stop at missing values or conflicting readings at the same time. No stats are estimated.',
        'Zaznamenané bojové statistiky podle úrovně. Měření na stejné úrovni se spojují podle času záznamu. Čáry zůstávají ve stejném období druhu a formy. Chybějící hodnoty nebo rozporná měření ve stejný čas čáru přerušují. Graf neobsahuje odhady.',
    );

    return (
        <figure className="my-stats-graph">
            <div
                className="my-stats-plot"
                ref={plotRef}
                onPointerLeave={() => setHint((current) => (current?.pinned ? current : null))}
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setHint(null);
                }}
            >
                <div className="my-stats-plot-content">
                    <svg
                        className="my-stats-chart"
                        viewBox={`0 0 ${width} ${height}`}
                        role="group"
                        aria-labelledby={`${id}-title`}
                        aria-describedby={`${id}-description`}
                        onPointerMove={(event) => {
                            if (event.pointerType === 'touch') return;
                            const key = nearestPoint(event);
                            if (key)
                                setHint((current) =>
                                    current?.key === key ? current : { key, pinned: false },
                                );
                        }}
                        onClick={(event) => {
                            const key = nearestPoint(event);
                            setHint(key ? { key, pinned: true } : null);
                        }}
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
                                                    .map(
                                                        (point) =>
                                                            `${x(point.level)},${y(point.value)}`,
                                                    )
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
                                            const key = `${entry.id}:${stat}`;
                                            return [
                                                <circle
                                                    key={entry.id}
                                                    className="my-stats-point"
                                                    cx={x(entry.level)}
                                                    cy={y(value)}
                                                    r="3.5"
                                                    fill={statColors[stat]}
                                                    stroke="transparent"
                                                    strokeWidth="16"
                                                    vectorEffect="non-scaling-stroke"
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label={`${statName(stat, t)}: ${value} · ${t('Level', 'Úroveň')} ${entry.level} · ${speciesName(entry.speciesId)} · ${new Date(entry.recordedAt).toLocaleString(locale)}`}
                                                    aria-describedby={
                                                        selected?.key === key
                                                            ? `${id}-hint`
                                                            : undefined
                                                    }
                                                    data-active={selected?.key === key || undefined}
                                                    onFocus={() => setHint({ key, pinned: true })}
                                                    onClick={(event) => {
                                                        if (event.detail === 0) {
                                                            event.stopPropagation();
                                                            setHint({ key, pinned: true });
                                                        }
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (
                                                            event.key === 'Enter' ||
                                                            event.key === ' '
                                                        ) {
                                                            event.preventDefault();
                                                            setHint({ key, pinned: true });
                                                        }
                                                    }}
                                                />,
                                            ];
                                        })}
                                    </g>
                                ))}
                            </g>
                        ))}
                    </svg>
                    {selected && (
                        <div
                            className="my-stats-hint"
                            id={`${id}-hint`}
                            role="tooltip"
                            style={{
                                left: `clamp(0px, calc(${(x(selected.entry.level) / width) * 100}% - 4.5rem), max(0px, calc(100% - 9rem)))`,
                                top: `${(y(selected.value) / height) * 100}%`,
                                borderColor: statColors[selected.stat],
                            }}
                        >
                            <strong>
                                {statName(selected.stat, t)}: {selected.value}
                            </strong>
                            <span>
                                {t('Level', 'Úroveň')} {selected.entry.level}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <ul className="my-stats-legend" aria-label={t('Current stats', 'Aktuální statistiky')}>
                {statKeys.map((stat) => (
                    <li key={stat} data-stat={stat}>
                        <span aria-hidden="true" style={{ backgroundColor: statColors[stat] }} />
                        <span>
                            <NatureStat stat={stat} natureId={natureId}>
                                {statName(stat, t)}
                            </NatureStat>
                        </span>
                        <strong
                            data-nature-effect={getNatureStatEffect(natureId, stat) ?? undefined}
                        >
                            {currentStats[stat] ?? '—'}
                        </strong>
                    </li>
                ))}
            </ul>
            <figcaption className="my-muted">
                {t(
                    'Recorded stats. Changes at the same level connect in time order. Gaps mark missing values, conflicting readings at the same time, or a change of form.',
                    'Zaznamenané statistiky. Změny na stejné úrovni se spojují podle času. Mezery označují chybějící hodnoty, rozporná měření ve stejný čas nebo změnu formy.',
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
