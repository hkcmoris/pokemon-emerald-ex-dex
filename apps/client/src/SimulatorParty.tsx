import { useQueries, useQuery } from '@tanstack/react-query';
import {
    type CollectionConflict,
    type CollectionDocument,
    type KnownMove,
    type Move,
    type OwnedPokemon,
    type Playthrough,
    type Pokemon,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionMove, loadCollectionSpecies } from './collectionSpecies.js';
import { getMoveEffectiveness } from './damageSimulation.js';
import { getRecordedMoveMatchups, type RecordedMoveMatchups } from './recordedMoveMatchups.js';
import { useLanguage } from './language.js';
import { damageSimulatorHref } from './navigation.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { TypeBadges } from './TypeBadges.js';
import { MoveDisplay } from './MoveDisplay.js';

export interface PartyMoveMatchup {
    kind: 'effective' | 'neutral' | 'ineffective' | 'immune';
    multiplier: number;
    moves: readonly Move[];
}

/** Best verified matchup among the Pokémon's recorded damaging moves. */
export function getPartyMoveMatchup(results: RecordedMoveMatchups): PartyMoveMatchup | null {
    if (results.status !== 'available') return null;
    const multiplier = Math.max(...results.moves.map((result) => result.multiplier));
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
        moves: results.moves
            .filter((result) => result.multiplier === multiplier)
            .map(({ move }) => move),
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

function PartyThreats({
    name,
    moves,
    moveDetails,
    typeIds,
    chart,
    failed,
    onRetry,
}: {
    name: string;
    moves: readonly KnownMove[];
    moveDetails: ReadonlyMap<number, Move>;
    typeIds: readonly number[];
    chart: TypeEffectivenessChart | undefined;
    failed: boolean;
    onRetry: () => void;
}) {
    const { t } = useLanguage();
    if (moves.length === 0)
        return (
            <p className="sim-party-threat-note">
                {t('Enemy moves unknown', 'Útoky soupeře neznámé')}
            </p>
        );
    const results = moves.map((move) => ({
        move,
        matchup: getMoveEffectiveness(moveDetails.get(move.moveId), typeIds, chart),
    }));
    const threats = results.filter(
        ({ matchup }) => matchup.status === 'available' && matchup.multiplier > 1,
    );
    const unmodeled = results.filter(({ matchup }) => matchup.status !== 'available');
    if (threats.length === 0 && unmodeled.length === 0)
        return (
            <p className="sim-party-threat-note">
                {t('No known type weakness', 'Bez známé typové slabiny')}
            </p>
        );
    return (
        <details className="sim-party-threats" data-warning={threats.length > 0}>
            <summary
                aria-label={
                    threats.length > 0
                        ? t(
                              `Known move weaknesses for ${name}`,
                              `Slabiny vůči známým útokům: ${name}`,
                          )
                        : t(`Unmodeled moves against ${name}`, `Nevyhodnocené útoky proti ${name}`)
                }
            >
                <span aria-hidden="true">{threats.length > 0 ? '⚠' : '?'}</span>{' '}
                {threats.length > 0
                    ? t('Known move weakness', 'Známý účinný útok')
                    : t('Moves not fully modeled', 'Útoky nejsou plně vyhodnoceny')}
            </summary>
            <ul>
                {threats.map(({ move, matchup }) => (
                    <MoveDisplay
                        as="li"
                        key={move.moveId}
                        move={move}
                        reference={moveDetails.get(move.moveId)}
                        size="small"
                        show={{ effects: false }}
                        passive
                        metadata={
                            <strong>
                                {matchup.status === 'available' ? matchup.multiplier : ''}×{' '}
                                {t('weakness', 'slabina')}
                            </strong>
                        }
                    />
                ))}
                {unmodeled.map(({ move, matchup }) => (
                    <MoveDisplay
                        as="li"
                        key={move.moveId}
                        move={move}
                        reference={moveDetails.get(move.moveId)}
                        size="small"
                        show={{ effects: false }}
                        passive
                        metadata={
                            matchup.status === 'not-applicable'
                                ? t(
                                      'Status effects not modeled',
                                      'Účinky stavového útoku nejsou modelovány',
                                  )
                                : matchup.status === 'unsupported'
                                  ? t(
                                        'Special mechanics not modeled',
                                        'Zvláštní mechanika není modelována',
                                    )
                                  : t(
                                        'Move or type data unavailable',
                                        'Údaje o útoku nebo typech nejsou dostupné',
                                    )
                        }
                    />
                ))}
            </ul>
            {failed && (
                <button type="button" className="my-text-button" onClick={onRetry}>
                    {t('Retry move data', 'Načíst útoky znovu')}
                </button>
            )}
        </details>
    );
}

function PartyMember({
    pokemon,
    selected,
    enemy,
    chart,
    conflicts,
    datasetId,
    enemyMoves,
    moveDetails,
    moveLookupFailed,
    ownMoveLookupFailed,
    onRetryMoves,
    compact,
}: {
    pokemon: OwnedPokemon;
    selected: boolean;
    enemy: Pokemon | null;
    chart: TypeEffectivenessChart | undefined;
    conflicts: readonly CollectionConflict[];
    datasetId?: string;
    enemyMoves: readonly KnownMove[];
    moveDetails: ReadonlyMap<number, Move>;
    moveLookupFailed: boolean;
    ownMoveLookupFailed: boolean;
    onRetryMoves: () => void;
    compact: boolean;
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
    const moveResults =
        details && enemy
            ? getRecordedMoveMatchups(pokemon.state.moves, moveDetails, enemy.typeIds, chart)
            : null;
    const matchup = moveResults ? getPartyMoveMatchup(moveResults) : null;
    const bestTypes = [...new Map(matchup?.moves.map((move) => [move.typeId, move])).values()];
    const name = pokemon.nickname || details?.name || `#${pokemon.state.speciesId}`;
    const status = uncertain
        ? t('Sync conflict', 'Konflikt synchronizace')
        : !enemy
          ? t('Choose an opponent', 'Vyberte soupeře')
          : !details
            ? t('Species data unavailable', 'Údaje o druhu nejsou dostupné')
            : moveResults?.status === 'unknown-moves'
              ? t('Moves not recorded', 'Útoky nejsou zaznamenané')
              : moveResults?.status === 'no-damaging-moves'
                ? t('No damaging moves', 'Bez útoků s poškozením')
                : moveResults?.status === 'unsupported'
                  ? t('Moves not fully modeled', 'Útoky nejsou plně vyhodnoceny')
                  : !matchup
                    ? t(
                          'Move or type data unavailable',
                          'Údaje o útoku nebo typech nejsou dostupné',
                      )
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
    if (compact) {
        const threats =
            enemy && details
                ? enemyMoves.flatMap((move) => {
                      const result = getMoveEffectiveness(
                          moveDetails.get(move.moveId),
                          details.typeIds,
                          chart,
                      );
                      return result.status === 'available' && result.multiplier > 1
                          ? [`${move.name} ${result.multiplier}×`]
                          : [];
                  })
                : [];
        const label = [
            name,
            details && pokemon.nickname ? details.name : null,
            uncertain ? 'Lv. ?' : `Lv. ${pokemon.state.level}`,
            status,
            threats.length > 0
                ? t(
                      `Known move weakness: ${threats.join(', ')}`,
                      `Známý účinný útok: ${threats.join(', ')}`,
                  )
                : null,
        ]
            .filter(Boolean)
            .join(' · ');
        return (
            <li>
                <a
                    className="sim-sprite-choice"
                    href={damageSimulatorHref(pokemon.id)}
                    aria-current={selected ? 'page' : undefined}
                    aria-label={label}
                    title={label}
                    data-matchup={matchup?.kind ?? 'unknown'}
                    data-warning={uncertain || threats.length > 0 || undefined}
                >
                    <SpeciesSprite
                        datasetId={datasetId}
                        file={details?.sprites?.front ?? null}
                        name={details?.name ?? name}
                    />
                    {(uncertain || threats.length > 0) && (
                        <span className="sim-sprite-warning" aria-hidden="true">
                            ⚠
                        </span>
                    )}
                </a>
            </li>
        );
    }
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
                                types={bestTypes.map((move) => move.type)}
                                iconFiles={bestTypes.map((move) => move.typeIconFile)}
                                iconOnly
                            />
                            <b>{multiplier}</b>
                        </span>
                    )}
                    <span>{status}</span>
                    {matchup && (
                        <span className="sim-party-move">
                            {matchup.moves.map((move) => (
                                <MoveDisplay
                                    key={move.moveId}
                                    move={move}
                                    reference={move}
                                    size="small"
                                    show={{ type: false, effects: false }}
                                    passive
                                />
                            ))}
                        </span>
                    )}
                </span>
            </a>
            {ownMoveLookupFailed && moveResults?.status === 'missing-data' && (
                <button type="button" className="my-text-button" onClick={onRetryMoves}>
                    {t('Retry move data', 'Načíst útoky znovu')}
                </button>
            )}
            {enemy && details && (
                <PartyThreats
                    name={name}
                    moves={enemyMoves}
                    moveDetails={moveDetails}
                    typeIds={details.typeIds}
                    chart={chart}
                    failed={moveLookupFailed}
                    onRetry={onRetryMoves}
                />
            )}
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
    enemyMoves = [],
    compact = false,
}: {
    document: CollectionDocument;
    run: Playthrough;
    selectedPokemonId: string;
    enemy: Pokemon | null;
    chart: TypeEffectivenessChart | undefined;
    conflicts: readonly CollectionConflict[];
    datasetId?: string;
    enemyMoves?: readonly KnownMove[];
    compact?: boolean;
}) {
    const { t } = useLanguage();
    const party = getSimulatorParty(document, run, conflicts);
    const moveIds = [
        ...new Set([
            ...enemyMoves.map((move) => move.moveId),
            ...(party ?? []).flatMap(
                (pokemon) => pokemon.state.moves?.map((move) => move.moveId) ?? [],
            ),
        ]),
    ];
    const moveLookups = useQueries({
        queries: moveIds.map((moveId) => ({
            queryKey: ['collection-move', moveId],
            queryFn: () => loadCollectionMove(moveId),
            enabled: Boolean(enemy),
        })),
    });
    const moveDetails = new Map(
        moveLookups.flatMap((lookup): [number, Move][] =>
            lookup.data ? [[lookup.data.moveId, lookup.data]] : [],
        ),
    );
    const failedMoveIds = new Set(moveIds.filter((_, index) => moveLookups[index].isError));
    if (party?.length === 0 && !compact) return null;
    return (
        <section
            className={compact ? 'sim-quick-party' : 'sim-party'}
            aria-label={
                compact
                    ? t('Switch your Pokémon', 'Přepnout svého Pokémona')
                    : t('Party matchups', 'Účinnost týmu')
            }
        >
            <div className="sim-party-heading">
                <h2>{t('Your party', 'Váš tým')}</h2>
                {!compact && (
                    <p>
                        {t(
                            'Best type matchup among recorded damaging moves. Warnings use revealed enemy moves; unrevealed moves and abilities remain unknown.',
                            'Nejvyšší typová účinnost zaznamenaných útoků s poškozením. Varování vycházejí z odhalených útoků soupeře; neodhalené útoky a schopnosti zůstávají neznámé.',
                        )}
                    </p>
                )}
            </div>
            {party === null ? (
                <p className="sim-party-notice">
                    {t(
                        'Resolve the party sync conflict to compare your team.',
                        'Pro porovnání týmu vyřešte konflikt synchronizace sestavy.',
                    )}
                </p>
            ) : party.length === 0 ? (
                <p className="sim-party-notice">{t('No party members', 'Tým je prázdný')}</p>
            ) : (
                <ol className={compact ? 'sim-sprite-strip' : 'sim-party-grid'}>
                    {party.map((pokemon) => (
                        <PartyMember
                            key={pokemon.id}
                            pokemon={pokemon}
                            compact={compact}
                            selected={pokemon.id === selectedPokemonId}
                            enemy={enemy}
                            chart={chart}
                            conflicts={conflicts}
                            datasetId={datasetId}
                            enemyMoves={enemyMoves}
                            moveDetails={moveDetails}
                            moveLookupFailed={enemyMoves.some((move) =>
                                failedMoveIds.has(move.moveId),
                            )}
                            ownMoveLookupFailed={Boolean(
                                pokemon.state.moves?.some((move) => failedMoveIds.has(move.moveId)),
                            )}
                            onRetryMoves={() => {
                                for (const lookup of moveLookups) {
                                    if (lookup.isError) void lookup.refetch();
                                }
                            }}
                        />
                    ))}
                </ol>
            )}
        </section>
    );
}
