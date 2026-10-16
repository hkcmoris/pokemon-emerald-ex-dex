import { useQuery } from '@tanstack/react-query';
import {
    getTypeDefenses,
    type CollectionConflict,
    type CollectionDocument,
    type OwnedPokemon,
    type Playthrough,
    type Pokemon,
    type TypeDefense,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionSpecies } from './collectionSpecies.js';
import { useLanguage } from './language.js';
import { damageSimulatorHref } from './navigation.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { TypeBadges } from './TypeBadges.js';

export interface PartyTypeMatchup {
    kind: 'effective' | 'neutral' | 'ineffective' | 'immune';
    multiplier: number;
    types: TypeDefense[];
}

/** Best outgoing matchup among this Pokemon's own types, without assuming its moves. */
export function getPartyTypeMatchup(
    attackingTypeIds: readonly number[],
    defendingTypeIds: readonly number[],
    chart: TypeEffectivenessChart | undefined,
): PartyTypeMatchup | null {
    if (!chart || attackingTypeIds.length === 0) return null;
    const defenses = getTypeDefenses(defendingTypeIds, chart);
    if (!defenses) return null;
    const knownTypes = new Set(chart.types.map((type) => type.typeId));
    if (attackingTypeIds.some((typeId) => !knownTypes.has(typeId))) return null;
    const ownTypes = new Set(attackingTypeIds);
    const matchups = defenses.filter((type) => ownTypes.has(type.typeId));
    const multiplier = Math.max(...matchups.map((type) => type.multiplier));
    return {
        kind:
            multiplier === 0
                ? 'immune'
                : multiplier > 1
                  ? 'effective'
                  : multiplier < 1
                    ? 'ineffective'
                    : 'neutral',
        multiplier,
        types: matchups.filter((type) => type.multiplier === multiplier),
    };
}

export function getSimulatorParty(
    document: CollectionDocument,
    run: Playthrough,
    conflicts: readonly CollectionConflict[],
): OwnedPokemon[] | null {
    if (
        conflicts.some(
            (conflict) =>
                conflict.entity === 'playthroughs' &&
                conflict.entityId === run.id &&
                ['party', '$entity', 'deleted'].includes(conflict.field),
        )
    )
        return null;
    if (run.deleted) return [];
    return [...new Set(run.party)].flatMap((id) => {
        const pokemon = document.pokemon[id];
        return pokemon && !pokemon.deleted && pokemon.playthroughId === run.id ? [pokemon] : [];
    });
}

function PartyMember({
    pokemon,
    selected,
    enemy,
    chart,
    conflicts,
    datasetId,
}: {
    pokemon: OwnedPokemon;
    selected: boolean;
    enemy: Pokemon | null;
    chart: TypeEffectivenessChart | undefined;
    conflicts: readonly CollectionConflict[];
    datasetId?: string;
}) {
    const { t } = useLanguage();
    const uncertain = conflicts.some(
        (conflict) =>
            conflict.entity === 'pokemon' &&
            conflict.entityId === pokemon.id &&
            ['state', '$entity', 'deleted', 'playthroughId'].includes(conflict.field),
    );
    const species = useQuery({
        queryKey: ['collection-species', pokemon.state.speciesId],
        queryFn: () => loadCollectionSpecies(pokemon.state.speciesId),
        enabled: !uncertain,
    });
    const details = uncertain ? undefined : species.data;
    const matchup =
        details && enemy ? getPartyTypeMatchup(details.typeIds, enemy.typeIds, chart) : null;
    const name = pokemon.nickname || details?.name || `#${pokemon.state.speciesId}`;
    const status = uncertain
        ? t('Sync conflict', 'Konflikt synchronizace')
        : !enemy
          ? t('Choose an opponent', 'Vyberte soupeře')
          : !matchup
            ? t('Type data unavailable', 'Typové údaje nejsou dostupné')
            : matchup.kind === 'effective'
              ? t('Effective', 'Účinný')
              : matchup.kind === 'ineffective'
                ? t('Ineffective', 'Málo účinný')
                : matchup.kind === 'immune'
                  ? t('No effect', 'Bez účinku')
                  : t('Neutral', 'Neutrální');
    const multiplier =
        matchup?.multiplier === 0.5
            ? '½×'
            : matchup?.multiplier === 0.25
              ? '¼×'
              : matchup
                ? `${matchup.multiplier}×`
                : '';
    return (
        <li>
            <a
                className="sim-party-member"
                href={damageSimulatorHref(pokemon.id)}
                aria-current={selected ? 'page' : undefined}
                data-matchup={matchup?.kind ?? 'unknown'}
            >
                <span className="sim-party-slot">
                    <SpeciesSprite
                        datasetId={datasetId}
                        file={details?.sprites?.front ?? null}
                        name={details?.name ?? name}
                    />
                    {selected && (
                        <span className="sim-party-selected">{t('Selected', 'Vybraný')}</span>
                    )}
                </span>
                <strong className="sim-party-name">{name}</strong>
                <span className="sim-party-species">
                    {details && pokemon.nickname ? `${details.name} · ` : ''}
                    {uncertain ? 'Lv. ?' : `Lv. ${pokemon.state.level}`}
                </span>
                <span className="sim-party-result">
                    {matchup && (
                        <span className="sim-party-types">
                            <TypeBadges
                                types={matchup.types.map((type) => type.name)}
                                iconFiles={matchup.types.map((type) => type.iconFile)}
                                iconOnly
                            />
                            <b>{multiplier}</b>
                        </span>
                    )}
                    <span>{status}</span>
                </span>
            </a>
        </li>
    );
}

export function SimulatorParty({
    document,
    run,
    selectedPokemonId,
    enemy,
    chart,
    conflicts,
    datasetId,
}: {
    document: CollectionDocument;
    run: Playthrough;
    selectedPokemonId: string;
    enemy: Pokemon | null;
    chart: TypeEffectivenessChart | undefined;
    conflicts: readonly CollectionConflict[];
    datasetId?: string;
}) {
    const { t } = useLanguage();
    const party = getSimulatorParty(document, run, conflicts);
    if (party?.length === 0) return null;
    return (
        <section className="sim-party" aria-label={t('Party matchups', 'Účinnost týmu')}>
            <div className="sim-party-heading">
                <h2>{t('Your party', 'Váš tým')}</h2>
                <p>
                    {t(
                        'Best own type against the opponent. Moves and abilities are not included.',
                        'Nejlepší vlastní typ proti soupeři. Útoky a schopnosti nejsou zahrnuty.',
                    )}
                </p>
            </div>
            {party === null ? (
                <p className="sim-party-notice">
                    {t(
                        'Resolve the party sync conflict to compare your team.',
                        'Pro porovnání týmu vyřešte konflikt synchronizace sestavy.',
                    )}
                </p>
            ) : (
                <ol className="sim-party-grid">
                    {party.map((pokemon) => (
                        <PartyMember
                            key={pokemon.id}
                            pokemon={pokemon}
                            selected={pokemon.id === selectedPokemonId}
                            enemy={enemy}
                            chart={chart}
                            conflicts={conflicts}
                            datasetId={datasetId}
                        />
                    ))}
                </ol>
            )}
        </section>
    );
}
