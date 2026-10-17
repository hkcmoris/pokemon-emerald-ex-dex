import { useLayoutEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    statKeys,
    type CollectionConflict,
    type CollectionDocument,
    type OwnedPokemon,
} from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionSpecies } from './collectionSpecies.js';
import { getCurrentStats } from './collectionStats.js';
import { useLanguage } from './language.js';
import { statName } from './MyPokemonHistory.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { useHasObservationDraft } from './observationDrafts.js';

function hasStateConflict(
    pokemon: OwnedPokemon,
    conflicts: readonly CollectionConflict[],
): boolean {
    return conflicts.some(
        (conflict) =>
            conflict.entity === 'pokemon' &&
            conflict.entityId === pokemon.id &&
            ['state', 'deleted', '$entity', 'playthroughId'].includes(conflict.field),
    );
}

function PartyMemberName({
    pokemon,
    uncertain,
    datasetId,
}: {
    pokemon: OwnedPokemon;
    uncertain: boolean;
    datasetId?: string;
}) {
    const { t } = useLanguage();
    const hasDraft = useHasObservationDraft(pokemon.id);
    const species = useQuery({
        queryKey: ['collection-species', pokemon.state.speciesId],
        queryFn: () => loadCollectionSpecies(pokemon.state.speciesId),
        enabled: !uncertain,
    });
    const details = uncertain ? undefined : species.data;
    const name = pokemon.nickname || details?.name || `#${pokemon.state.speciesId}`;
    return (
        <>
            <SpeciesSprite
                datasetId={datasetId}
                file={details?.sprites?.front ?? null}
                name={details?.name ?? name}
            />
            <span className="my-party-member-copy">
                <strong>{name}</strong>
                <span>
                    {uncertain ? (
                        t('Sync conflict', 'Konflikt synchronizace')
                    ) : (
                        <>
                            {details && pokemon.nickname && (
                                <span className="my-party-member-species">{details.name} · </span>
                            )}
                            Lv. {pokemon.state.level}
                        </>
                    )}
                </span>
                {hasDraft && (
                    <span className="my-party-member-draft">
                        {t('Unfinished stats', 'Rozepsané statistiky')}
                    </span>
                )}
            </span>
        </>
    );
}

export function PartyRoster({
    party,
    selectedPokemonId,
    conflicts,
    datasetId,
    onSelect,
    onOverview,
}: {
    party: readonly OwnedPokemon[];
    selectedPokemonId?: string;
    conflicts: readonly CollectionConflict[];
    datasetId?: string;
    onSelect: (pokemon: OwnedPokemon) => void;
    onOverview: () => void;
}) {
    const { t } = useLanguage();
    const rosterRef = useRef<HTMLElement>(null);
    const listRef = useRef<HTMLOListElement>(null);
    useLayoutEffect(() => {
        const roster = rosterRef.current;
        const workspace = roster?.closest<HTMLElement>('.my-pokemon-workspace');
        if (!roster || !workspace) return;
        const measure = () => {
            workspace.style.setProperty(
                '--my-party-roster-height',
                `${Math.ceil(roster.getBoundingClientRect().height)}px`,
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(roster);
        return () => observer.disconnect();
    }, []);
    useLayoutEffect(() => {
        const list = listRef.current;
        const selected = list?.querySelector<HTMLElement>('[aria-current="true"]');
        if (!list || !selected) return;
        const bounds = selected.getBoundingClientRect();
        const listBounds = list.getBoundingClientRect();
        if (bounds.left < listBounds.left) list.scrollLeft += bounds.left - listBounds.left;
        else if (bounds.right > listBounds.right)
            list.scrollLeft += bounds.right - listBounds.right;
    }, [selectedPokemonId]);
    return (
        <nav
            className="my-party-roster"
            ref={rosterRef}
            aria-label={t('Party members', 'Členové týmu')}
        >
            <div className="my-party-roster-heading">
                <h2>{t('Your party', 'Váš tým')}</h2>
                <a className="my-text-button" href="#/my-pokemon" onClick={onOverview}>
                    {t('Overview', 'Přehled')}
                </a>
            </div>
            {party.length === 0 ? (
                <p className="my-muted">
                    {t('No active party members yet.', 'Tým zatím nemá žádné členy.')}
                </p>
            ) : (
                <ol className="my-party-roster-list" ref={listRef}>
                    {party.map((pokemon) => (
                        <li key={pokemon.id}>
                            <a
                                className="my-party-member"
                                href={`#/my-pokemon/${encodeURIComponent(pokemon.id)}`}
                                aria-current={pokemon.id === selectedPokemonId ? 'true' : undefined}
                                onClick={() => onSelect(pokemon)}
                            >
                                <PartyMemberName
                                    pokemon={pokemon}
                                    uncertain={hasStateConflict(pokemon, conflicts)}
                                    datasetId={datasetId}
                                />
                            </a>
                        </li>
                    ))}
                </ol>
            )}
        </nav>
    );
}

export function PartyOverview({
    party,
    document,
    conflicts,
    datasetId,
    onSelect,
}: {
    party: readonly OwnedPokemon[];
    document: CollectionDocument;
    conflicts: readonly CollectionConflict[];
    datasetId?: string;
    onSelect: (pokemon: OwnedPokemon) => void;
}) {
    const { t } = useLanguage();
    const observations = Object.values(document.observations);
    return (
        <section
            className="my-panel my-party-overview"
            aria-label={t('Party stats', 'Statistiky týmu')}
        >
            <h2>{t('Party overview', 'Přehled týmu')}</h2>
            <p className="my-muted">
                {t(
                    'Recorded stats at each member’s current level. — means missing or conflicting data.',
                    'Zapsané statistiky na aktuální úrovni každého člena. — označuje chybějící nebo rozporné údaje.',
                )}
            </p>
            <div
                className="my-party-overview-scroll"
                role="region"
                aria-label={t('Party stat comparison', 'Porovnání statistik týmu')}
                tabIndex={0}
            >
                <table>
                    <thead>
                        <tr>
                            <th scope="col">{t('Pokémon', 'Pokémon')}</th>
                            {statKeys.map((stat) => (
                                <th scope="col" key={stat}>
                                    {statName(stat, t)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {party.map((pokemon) => {
                            const uncertain = hasStateConflict(pokemon, conflicts);
                            const observationConflict = conflicts.some(
                                (conflict) =>
                                    conflict.entity === 'observations' &&
                                    document.observations[conflict.entityId]?.pokemonId ===
                                        pokemon.id,
                            );
                            const stats =
                                uncertain || observationConflict
                                    ? {}
                                    : getCurrentStats(pokemon, observations);
                            return (
                                <tr key={pokemon.id}>
                                    <th scope="row">
                                        <a
                                            className="my-party-member"
                                            href={`#/my-pokemon/${encodeURIComponent(pokemon.id)}`}
                                            onClick={() => onSelect(pokemon)}
                                        >
                                            <PartyMemberName
                                                pokemon={pokemon}
                                                uncertain={uncertain}
                                                datasetId={datasetId}
                                            />
                                        </a>
                                    </th>
                                    {statKeys.map((stat) => (
                                        <td key={stat}>{stats[stat] ?? '—'}</td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
