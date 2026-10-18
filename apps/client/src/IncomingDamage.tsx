import { useQuery } from '@tanstack/react-query';
import type {
    BaseStats,
    KnownMove,
    Pokemon,
    TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionMove } from './collectionSpecies.js';
import { simulateMoveDamage } from './damageSimulation.js';
import { DamageHitSummary, DamagePerHit } from './DamageHitDetails.js';
import { useLanguage } from './language.js';
import { MoveCategory } from './MoveCategory.js';
import { TypeBadges } from './TypeBadges.js';
import { typeSurfaceStyle } from './theme.js';

export interface IncomingDamageProps {
    moves: readonly KnownMove[];
    enemy: Pokemon | null;
    enemyLevel: number;
    enemyStats: Partial<BaseStats>;
    ownTypeIds: readonly number[];
    ownStats: Partial<BaseStats>;
    ownName: string;
    chart: TypeEffectivenessChart | undefined;
    estimatedOwnStats?: boolean;
    disabled?: boolean;
}

function IncomingMove({
    knownMove,
    enemy,
    enemyLevel,
    enemyStats,
    ownTypeIds,
    ownStats,
    ownName,
    chart,
}: Omit<IncomingDamageProps, 'moves'> & { knownMove: KnownMove }) {
    const { language, t } = useLanguage();
    const lookup = useQuery({
        queryKey: ['collection-move', knownMove.moveId],
        queryFn: () => loadCollectionMove(knownMove.moveId),
    });
    const move = lookup.data;
    const damage = simulateMoveDamage({
        move,
        level: enemyLevel,
        stats: enemyStats,
        typeIds: enemy?.typeIds,
        enemyStats: ownStats,
        enemyTypeIds: ownTypeIds,
        chart,
        attackerSpeciesId: enemy?.speciesId,
    });
    const reason =
        damage.status === 'not-applicable'
            ? t(
                  'No ordinary damage · status effects not modeled',
                  'Bez běžného poškození · stavové účinky nejsou modelovány',
              )
            : damage.status === 'unsupported'
              ? t('Special mechanics not modeled', 'Zvláštní mechanika není modelována')
              : lookup.isPending
                ? t('Loading move data…', 'Načítání údajů o útoku…')
                : lookup.isError
                  ? t('Move data unavailable', 'Údaje o útoku nejsou dostupné')
                  : t(
                        'Required stats or type data missing',
                        'Chybí potřebné statistiky nebo údaje o typech',
                    );
    return (
        <article
            className={`sim-incoming-move${move ? ' type-surface' : ''}`}
            style={move ? typeSurfaceStyle([move.type]) : undefined}
        >
            <div className="sim-incoming-move-heading">
                <h3>{knownMove.name}</h3>
                {move && (
                    <span>
                        <TypeBadges types={[move.type]} iconFiles={[move.typeIconFile]} iconOnly />
                        <MoveCategory
                            category={move.category}
                            iconFile={move.categoryIconFile}
                            iconOnly
                        />
                    </span>
                )}
            </div>
            {damage.status === 'available' ? (
                <>
                    <p>
                        <DamageHitSummary damage={damage} />
                    </p>
                    <strong className="sim-incoming-range">
                        {damage.min.toLocaleString(language)}–{damage.max.toLocaleString(language)}{' '}
                        HP
                    </strong>
                    <p>
                        {damage.minPercent !== null && damage.maxPercent !== null
                            ? t(
                                  `${damage.minPercent.toLocaleString(language, { maximumFractionDigits: 1 })}–${damage.maxPercent.toLocaleString(language, { maximumFractionDigits: 1 })}% of ${ownName}’s HP`,
                                  `${damage.minPercent.toLocaleString(language, { maximumFractionDigits: 1 })}–${damage.maxPercent.toLocaleString(language, { maximumFractionDigits: 1 })} % HP: ${ownName}`,
                              )
                            : t(
                                  'Your HP is unknown; percentage unavailable',
                                  'Vaše HP není známé; procento nelze vypočítat',
                              )}
                    </p>
                    <p className={damage.effectiveness > 1 ? 'sim-incoming-weakness' : undefined}>
                        {damage.effectiveness > 1 && <span aria-hidden="true">⚠ </span>}
                        {t('Type effectiveness', 'Typová účinnost')} {damage.effectiveness}× · STAB{' '}
                        {damage.stab}×
                    </p>
                    {damage.hits.max > 1 && (
                        <details className="sim-move-detail">
                            <summary>{t('Calculation', 'Výpočet')}</summary>
                            <DamagePerHit damage={damage} />
                        </details>
                    )}
                </>
            ) : (
                <p className="sim-incoming-unavailable">{reason}</p>
            )}
            {lookup.isError && (
                <button
                    type="button"
                    className="my-text-button"
                    onClick={() => void lookup.refetch()}
                >
                    {t('Retry move data', 'Načíst útok znovu')}
                </button>
            )}
        </article>
    );
}

export function IncomingDamage({
    moves,
    enemy,
    estimatedOwnStats = false,
    disabled = false,
    ...props
}: IncomingDamageProps) {
    const { t } = useLanguage();
    return (
        <section
            className="sim-incoming"
            aria-label={t('Estimated incoming damage', 'Odhad příchozího poškození')}
        >
            <div className="sim-incoming-heading">
                <h2>{t('Estimated incoming damage', 'Odhad příchozího poškození')}</h2>
                {enemy && (
                    <p>
                        {enemy.name} → {props.ownName}
                    </p>
                )}
            </div>
            <p className="sim-incoming-assumptions">
                {t(
                    'Unspecified enemy stats assume neutral nature, 31 IVs and 0 EVs.',
                    'Nezadané statistiky soupeře předpokládají neutrální povahu, 31 IV a 0 EV.',
                )}{' '}
                {estimatedOwnStats
                    ? t(
                          'Missing own stats are estimated with 31 IVs, 0 EVs and the saved nature (neutral if unknown).',
                          'Chybějící vlastní statistiky jsou odhadnuté s 31 IV, 0 EV a uloženou povahou (neutrální, pokud není známá).',
                      )
                    : t(
                          'Uses your recorded stats or simulator overrides.',
                          'Používá vaše naměřené statistiky nebo hodnoty nastavené v simulátoru.',
                      )}{' '}
                {t(
                    'Totals cover the shown hit counts of one move use, assuming the first hit lands. Moves with repeated accuracy checks can stop early; other accuracy checks are not included. The enemy ability is unknown, so its normal hit count applies. Abilities, items, weather, critical hits and other battle modifiers are excluded. Unrevealed moves remain unknown.',
                    'Součty zahrnují uvedený počet zásahů jednoho použití útoku za předpokladu, že první zásah uspěje. Útoky s opakovanou kontrolou přesnosti mohou skončit dříve; ostatní kontroly přesnosti nejsou zahrnuté. Schopnost soupeře není známá, proto platí běžný počet zásahů. Schopnosti, předměty, počasí, kritické zásahy a další bojové úpravy nejsou zahrnuté. Neodhalené útoky zůstávají neznámé.',
                )}
            </p>
            {disabled ? (
                <p className="sim-incoming-unavailable">
                    {t(
                        'Resolve the sync conflict before estimating incoming damage.',
                        'Před výpočtem příchozího poškození vyřešte konflikt synchronizace.',
                    )}
                </p>
            ) : !enemy ? (
                <p className="sim-incoming-unavailable">
                    {t('Choose an opponent', 'Vyberte soupeře')}
                </p>
            ) : moves.length === 0 ? (
                <p className="sim-incoming-unavailable">
                    {t(
                        'No revealed moves yet. Record a move when the opponent uses it; no warning does not mean a safe matchup.',
                        'Zatím nejsou odhalené útoky. Zaznamenejte útok, až ho soupeř použije; chybějící varování neznamená bezpečný souboj.',
                    )}
                </p>
            ) : (
                <div className="sim-incoming-grid">
                    {moves.map((knownMove) => (
                        <IncomingMove
                            key={knownMove.moveId}
                            knownMove={knownMove}
                            enemy={enemy}
                            {...props}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
