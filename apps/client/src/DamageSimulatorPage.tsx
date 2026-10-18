import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pokemonNatures, getNatureStatEffect } from '@pokemon-emerald-ex-dex/shared';
import type {
    BaseStats,
    CollectionConflict,
    CollectionDocument,
    KnownMove,
    OwnedPokemon,
    SpeciesDetails,
    TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { NatureStat } from './NatureStat.js';
import { BattleTypeMatchups } from './BattleTypeMatchups.js';
import { getSimulatorParty, SimulatorParty } from './SimulatorParty.js';
import { getAbilityChoices, getSelectedAbility } from './pokemonTraits.js';
import { useCollection } from './collectionStore.js';
import { setOwnedPokemonLevel } from './collectionLevel.js';
import { SimulatorLevelControls } from './SimulatorLevelControls.js';
import { SimulatorEncounters } from './SimulatorEncounters.js';
import { IncomingDamage } from './IncomingDamage.js';
import { DamageHitSummary, DamagePerHit } from './DamageHitDetails.js';
import { getIncomingStats } from './incomingStats.js';
import { MyPokemonConflicts } from './MyPokemonConflicts.js';
import type { CollectionStatus } from './collectionSync.js';
import {
    readEncounterSelection,
    rememberEncounterSelection,
    resolveEncounterSelection,
    type EncounterSelection,
} from './simulatorEncounterSession.js';
import { getCurrentStats } from './collectionStats.js';
import { loadCollectionMove, loadCollectionSpecies } from './collectionSpecies.js';
import { loadCollectionTypeEffectiveness } from './collectionTypeEffectiveness.js';
import { estimateEnemyStats, simulateMoveDamage } from './damageSimulation.js';
import { getSimulatorMoveOptions, type SimulatorMoveOption } from './simulatorMoves.js';
import { DexHeader } from './DexHeader.js';
import { DexFooter } from './DexFooter.js';
import { SpeciesPicker } from './MyPokemonForms.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { TypeBadges } from './TypeBadges.js';
import { MoveCategory } from './MoveCategory.js';
import { MoveEffectBadges } from './MoveEffectBadges.js';
import { damageSimulatorHref, ownedPokemonHref } from './navigation.js';
import { useLanguage } from './language.js';
import { typeSurfaceStyle } from './theme.js';
import {
    attackerFingerprint,
    emptyEnemySetup,
    readSimulatorAttacker,
    readSimulatorOpponent,
    rememberSimulatorAttacker,
    rememberSimulatorOpponent,
    resetSimulatorSession,
    type EnemySetup,
} from './simulatorSession.js';
import {
    readWorkspaceSession,
    rememberWorkspaceSelection,
    type WorkspaceSelection,
} from './workspaceSession.js';

type AttackStat = 'attack' | 'spAttack' | 'defense';
type EnemyStat = 'hp' | 'attack' | 'defense' | 'spAttack' | 'spDefense';

const attackKeys: readonly AttackStat[] = ['attack', 'spAttack', 'defense'];
const enemyKeys: readonly EnemyStat[] = ['hp', 'attack', 'defense', 'spAttack', 'spDefense'];
const statLabels = {
    hp: ['HP', 'HP'],
    attack: ['Attack', 'Útok'],
    spAttack: ['Sp. Atk', 'Sp. útok'],
    defense: ['Defense', 'Obrana'],
    spDefense: ['Sp. Def', 'Sp. obrana'],
} as const;

function integerInput(value: string, max = 65535): number | undefined {
    if (!/^\d+$/.test(value)) return undefined;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 1 && number <= max ? number : undefined;
}

function conflictMentionsPokemon(conflict: CollectionConflict, pokemonId: string): boolean {
    return [conflict.base, conflict.local, conflict.remote].some(
        (value) =>
            (conflict.field === 'pokemonId' && value === pokemonId) ||
            (typeof value === 'object' &&
                value !== null &&
                !Array.isArray(value) &&
                value.pokemonId === pokemonId),
    );
}

function MoveSources({ option, level }: { option: SimulatorMoveOption; level: number }) {
    const { t } = useLanguage();
    return (
        <span className="sim-move-sources">
            {option.levels.map((required) => (
                <span key={required} className={required > level ? 'sim-future' : undefined}>
                    {required === 0
                        ? t('On evolution', 'Při evoluci')
                        : required > level
                          ? t(`Lv. ${required} · future`, `Lv. ${required} · později`)
                          : t(`Learnset Lv. ${required}`, `Učení Lv. ${required}`)}
                </span>
            ))}
            {option.machines.map((machine) => (
                <span key={machine}>{machine}</span>
            ))}
            {option.recorded && option.levels.length === 0 && option.machines.length === 0 && (
                <span>{t('Recorded / inherited', 'Zaznamenaný / zděděný')}</span>
            )}
        </span>
    );
}

function DamageMove({
    option,
    level,
    stats,
    typeIds,
    enemyStats,
    enemyTypeIds,
    chart,
    abilityId,
    attackerSpeciesId,
    onRemove,
}: {
    option: SimulatorMoveOption;
    level: number;
    stats: Partial<BaseStats>;
    typeIds: readonly number[];
    enemyStats: Partial<BaseStats>;
    enemyTypeIds?: readonly number[];
    chart?: TypeEffectivenessChart;
    abilityId?: number;
    attackerSpeciesId?: number;
    onRemove?: () => void;
}) {
    const { language, t } = useLanguage();
    const lookup = useQuery({
        queryKey: ['collection-move', option.move.moveId],
        queryFn: () => loadCollectionMove(option.move.moveId),
        enabled: !option.reference,
    });
    const move = option.reference ?? lookup.data;
    const damage = simulateMoveDamage({
        move,
        level,
        stats,
        typeIds,
        enemyStats,
        enemyTypeIds,
        chart,
        abilityId,
        attackerSpeciesId,
    });
    const reason =
        damage.status === 'not-applicable'
            ? t('No ordinary damage', 'Bez běžného poškození')
            : damage.status === 'unsupported'
              ? t('Needs additional battle information', 'Vyžaduje další údaje o boji')
              : !move && lookup.isError
                ? t('Move data unavailable', 'Údaje o útoku nejsou dostupné')
                : !enemyTypeIds
                  ? t('Choose an opponent', 'Vyberte soupeře')
                  : t(
                        'Required stats or type data missing',
                        'Chybí potřebné statistiky nebo údaje o typech',
                    );
    return (
        <article
            className={`sim-move${move ? ' type-surface' : ''}`}
            style={move ? typeSurfaceStyle([move.type]) : undefined}
        >
            <div className="sim-move-heading">
                <div>
                    {move && (
                        <TypeBadges types={[move.type]} iconFiles={[move.typeIconFile]} iconOnly />
                    )}
                    <h3>{option.move.name}</h3>
                    <MoveEffectBadges move={move} />
                </div>
                {onRemove && (
                    <button
                        type="button"
                        className="sim-remove"
                        onClick={onRemove}
                        aria-label={t(
                            `Remove preview ${option.move.name}`,
                            `Odebrat náhled ${option.move.name}`,
                        )}
                    >
                        ×
                    </button>
                )}
            </div>
            <MoveSources option={option} level={level} />
            <div className="sim-damage-row">
                <span className="sim-category">
                    {move && (
                        <MoveCategory
                            category={move.category}
                            iconFile={move.categoryIconFile}
                            iconOnly
                        />
                    )}
                </span>
                <div className="sim-damage-values">
                    {damage.status === 'available' && (
                        <span className="sim-damage-percent">
                            <DamageHitSummary damage={damage} />
                        </span>
                    )}
                    <strong className="sim-damage-number">
                        {damage.status === 'available' ? (
                            <>
                                {damage.min.toLocaleString(language)}–
                                {damage.max.toLocaleString(language)} <span>HP</span>
                            </>
                        ) : (
                            '—'
                        )}
                    </strong>
                    <span className="sim-damage-percent">
                        {damage.status === 'available'
                            ? damage.minPercent !== null && damage.maxPercent !== null
                                ? t(
                                      `${damage.minPercent.toLocaleString(language, { maximumFractionDigits: 1 })}–${damage.maxPercent.toLocaleString(language, { maximumFractionDigits: 1 })}% of enemy HP`,
                                      `${damage.minPercent.toLocaleString(language, { maximumFractionDigits: 1 })}–${damage.maxPercent.toLocaleString(language, { maximumFractionDigits: 1 })} % HP soupeře`,
                                  )
                                : t('Enemy HP unavailable', 'HP soupeře není dostupné')
                            : reason}
                    </span>
                    <span className="sim-base-power">
                        {t('Base power', 'Základní síla')} <b>{move ? move.power || '—' : '?'}</b>
                    </span>
                </div>
            </div>
            {damage.status === 'available' && (
                <details className="sim-move-detail">
                    <summary>
                        {t('Calculation', 'Výpočet')}{' '}
                        <span>
                            STAB ×{damage.stab} · {t('type', 'typ')} ×{damage.effectiveness}
                        </span>
                    </summary>
                    <p>
                        {t(statLabels[damage.attackStat][0], statLabels[damage.attackStat][1])}{' '}
                        {stats[damage.attackStat]} →{' '}
                        {t(statLabels[damage.defenseStat][0], statLabels[damage.defenseStat][1])}{' '}
                        {enemyStats[damage.defenseStat]}. {t('Attacker level', 'Úroveň útočníka')}{' '}
                        {level}.{' '}
                        {t(
                            'Random roll 85–100% for each hit. The headline totals the shown hit counts, assuming the first hit lands.',
                            'Náhodný faktor 85–100 % pro každý zásah. Hlavní výsledek sčítá uvedený počet zásahů a předpokládá, že první zásah uspěje.',
                        )}
                    </p>
                    <DamagePerHit damage={damage} />
                    {move && <p>{t(move.description, move.descriptionCs || move.description)}</p>}
                </details>
            )}
        </article>
    );
}

function StatInput({
    stat,
    value,
    fallback,
    source,
    onChange,
    prefix,
    natureId,
}: {
    stat: AttackStat | EnemyStat;
    value: string;
    fallback: number | undefined;
    source: string;
    onChange: (value: string) => void;
    prefix: string;
    natureId?: number | null;
}) {
    const { t } = useLanguage();
    const invalid = value !== '' && integerInput(value) === undefined;
    return (
        <label className="filter-label sim-stat-field">
            <NatureStat stat={stat} natureId={natureId}>
                {t(statLabels[stat][0], statLabels[stat][1])}
            </NatureStat>
            <input
                className="filter-input"
                type="text"
                inputMode="numeric"
                value={value}
                placeholder={fallback === undefined ? '—' : String(fallback)}
                onChange={(event) => onChange(event.target.value)}
                aria-label={`${prefix}: ${t(statLabels[stat][0], statLabels[stat][1])}`}
                aria-invalid={invalid}
                data-nature-effect={getNatureStatEffect(natureId, stat) ?? undefined}
                maxLength={6}
            />
            <small className={invalid ? 'sim-invalid' : undefined}>
                {invalid
                    ? t('Enter 1–65,535', 'Zadejte 1–65 535')
                    : value !== ''
                      ? t('Temporary', 'Dočasné')
                      : source}
            </small>
        </label>
    );
}

function SimulatorScenario({
    pokemon,
    species,
    recordedStats,
    observationConflict,
    natureId,
    abilityConflict,
    datasetId,
    enemySetup,
    setEnemySetup,
    enemyMoves,
    savedEncounter,
    chart,
    chartStatus,
}: {
    pokemon: OwnedPokemon;
    species: SpeciesDetails;
    recordedStats: Partial<BaseStats>;
    observationConflict: boolean;
    natureId?: number | null;
    abilityConflict: boolean;
    datasetId?: string;
    enemySetup: EnemySetup;
    setEnemySetup: Dispatch<SetStateAction<EnemySetup>>;
    enemyMoves: readonly KnownMove[];
    savedEncounter: boolean;
    chart: TypeEffectivenessChart | undefined;
    chartStatus: 'pending' | 'error' | 'success';
}) {
    const { t } = useLanguage();
    const {
        pokemon: enemy,
        level: enemyLevel,
        picking: pickingEnemy,
        overrides: enemyOverrides,
    } = enemySetup;
    const sessionKey = `${datasetId ?? 'default'}:${pokemon.id}`;
    const fingerprint = attackerFingerprint(pokemon, recordedStats);
    const [ownOverrides, setOwnOverrides] = useState<Record<AttackStat, string>>(
        () => readSimulatorAttacker(sessionKey, fingerprint).overrides,
    );
    const [previewIds, setPreviewIds] = useState<number[]>(
        () => readSimulatorAttacker(sessionKey, fingerprint).previewIds,
    );
    const [moveSearch, setMoveSearch] = useState(
        () => readSimulatorAttacker(sessionKey, fingerprint).search,
    );
    useEffect(() => {
        rememberSimulatorAttacker(sessionKey, fingerprint, {
            overrides: ownOverrides,
            previewIds,
            search: moveSearch,
        });
    }, [sessionKey, fingerprint, ownOverrides, previewIds, moveSearch]);
    const parsedEnemyLevel = integerInput(enemyLevel, 100);
    const automatic =
        enemy && parsedEnemyLevel !== undefined
            ? estimateEnemyStats(enemy, parsedEnemyLevel)
            : null;
    const stats: Partial<BaseStats> = {};
    const enemyStats: Partial<BaseStats> = {};
    for (const stat of attackKeys) {
        const value =
            ownOverrides[stat] === '' ? recordedStats[stat] : integerInput(ownOverrides[stat]);
        if (value !== undefined) stats[stat] = value;
    }
    // An invalid level suppresses results, including any otherwise valid overrides.
    if (automatic) {
        for (const stat of enemyKeys) {
            const override = enemyOverrides[stat] ?? '';
            const value = override === '' ? automatic[stat] : integerInput(override);
            if (value !== undefined) enemyStats[stat] = value;
        }
    }
    const incoming = getIncomingStats(species, pokemon.state.level, recordedStats, natureId);
    if (ownOverrides.defense !== '') {
        incoming.stats.defense = integerInput(ownOverrides.defense);
    }
    const options = getSimulatorMoveOptions(species, pokemon.state.moves ?? []);
    const current = (pokemon.state.moves ?? []).flatMap((known) =>
        options.filter((option) => option.move.moveId === known.moveId),
    );
    const previews = previewIds.flatMap((id) =>
        options.filter((option) => option.move.moveId === id && !option.recorded),
    );
    const candidates = options.filter(
        (option) =>
            !option.recorded &&
            option.move.name.toLocaleLowerCase().includes(moveSearch.trim().toLocaleLowerCase()),
    );
    const ownName = pokemon.nickname || species.name;
    const nature = pokemonNatures.find((entry) => entry.id === natureId);
    const abilityChoices = getAbilityChoices(species);
    const selectedAbility = abilityConflict
        ? null
        : (getSelectedAbility(pokemon, species) ??
          (abilityChoices.length === 1 ? abilityChoices[0] : null));
    const moveProps = {
        level: pokemon.state.level,
        stats,
        typeIds: species.typeIds,
        enemyStats,
        enemyTypeIds: enemy?.typeIds,
        chart,
        abilityId: selectedAbility?.ability.abilityId,
        attackerSpeciesId: pokemon.state.speciesId,
    };
    function resetEnemyStats() {
        setEnemySetup((previous) => ({
            ...previous,
            overrides: { hp: '', defense: '', spDefense: '' },
        }));
    }
    return (
        <>
            <div className="sim-setup-grid">
                <section className="sim-attacker-panel">
                    <div className="sim-arena" aria-label={t('Battle preview', 'Náhled boje')}>
                        <span className="sim-arena-kicker">
                            {t('DAMAGE LAB', 'SIMULACE POŠKOZENÍ')}
                        </span>
                        <div className="sim-combatant sim-enemy">
                            {enemy && (
                                <BattleTypeMatchups
                                    defendingTypeIds={enemy.typeIds}
                                    attackingTypeIds={species.typeIds}
                                    chart={chart}
                                    defenderName={enemy.name}
                                />
                            )}
                            <div className="sim-combatant-label">
                                <small>{t('Opponent', 'Soupeř')}</small>
                                <strong>
                                    {enemy?.name ?? t('Choose an opponent', 'Vyberte soupeře')}
                                </strong>
                                {enemy && (
                                    <>
                                        <span>
                                            Lv. {parsedEnemyLevel ?? '—'} · HP{' '}
                                            {enemyStats.hp ?? '—'}
                                        </span>
                                        <TypeBadges
                                            types={enemy.types}
                                            iconFiles={enemy.typeIconFiles}
                                            iconOnly
                                        />
                                    </>
                                )}
                            </div>
                            <div className="sim-sprite-platform">
                                {enemy ? (
                                    <SpeciesSprite
                                        key={enemy.speciesId}
                                        datasetId={datasetId}
                                        file={enemy.sprites?.front ?? null}
                                        name={enemy.name}
                                        size={128}
                                        loading="eager"
                                    />
                                ) : (
                                    <span className="sim-enemy-placeholder" aria-hidden="true">
                                        ?
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="sim-combatant sim-own">
                            <div className="sim-sprite-platform">
                                <SpeciesSprite
                                    datasetId={datasetId}
                                    file={species.sprites?.back ?? null}
                                    name={species.name}
                                    orientation="back"
                                    size={128}
                                    loading="eager"
                                />
                            </div>
                            <div className="sim-combatant-label">
                                <small>{t('Your Pokémon', 'Váš Pokémon')}</small>
                                <strong>{ownName}</strong>
                                <span>
                                    {pokemon.nickname ? `${species.name} · ` : ''}Lv.{' '}
                                    {pokemon.state.level}
                                </span>
                                <TypeBadges
                                    types={species.types}
                                    iconFiles={species.typeIconFiles}
                                    iconOnly
                                />
                            </div>
                            {enemy && (
                                <BattleTypeMatchups
                                    defendingTypeIds={species.typeIds}
                                    attackingTypeIds={enemy.typeIds}
                                    chart={chart}
                                    defenderName={ownName}
                                />
                            )}
                        </div>
                    </div>
                    <div className="sim-own-stats">
                        <p className="my-muted sim-traits-summary">
                            {t('Nature', 'Povaha')}:{' '}
                            {nature?.name ?? t('Not recorded', 'Nezaznamenána')} ·{' '}
                            {t('Ability', 'Schopnost')}:{' '}
                            {abilityConflict
                                ? t('Sync conflict', 'Konflikt synchronizace')
                                : (selectedAbility?.ability.name ??
                                  t('Not recorded', 'Nezaznamenána'))}
                        </p>
                        <div className="sim-section-heading">
                            <h2>{t('Attacking stats', 'Útočné statistiky')}</h2>
                            <button
                                type="button"
                                className="my-text-button"
                                onClick={() =>
                                    setOwnOverrides({ attack: '', spAttack: '', defense: '' })
                                }
                            >
                                {t('Reset', 'Obnovit')}
                            </button>
                        </div>
                        <div className="sim-stat-grid">
                            {attackKeys.map((stat) => (
                                <StatInput
                                    key={stat}
                                    stat={stat}
                                    value={ownOverrides[stat]}
                                    fallback={recordedStats[stat]}
                                    natureId={natureId}
                                    source={
                                        recordedStats[stat] === undefined
                                            ? t('Missing · enter value', 'Chybí · zadejte hodnotu')
                                            : t('Recorded', 'Zaznamenané')
                                    }
                                    prefix={t('Your Pokémon', 'Váš Pokémon')}
                                    onChange={(value) =>
                                        setOwnOverrides((previous) => ({
                                            ...previous,
                                            [stat]: value,
                                        }))
                                    }
                                />
                            ))}
                        </div>
                        <p className="my-muted">
                            {t(
                                'Current recorded level and form. Defense is used by Body Press. Blank fields use recorded stats; entered values apply only here. Recorded values already include nature. Saved Skill Link affects supported multi-hit moves; other abilities are not modeled.',
                                'Aktuální zaznamenaná úroveň a forma. Body Press používá Obranu. Prázdná pole použijí zaznamenané statistiky; zadané hodnoty platí jen zde. Zaznamenané hodnoty již zahrnují povahu. Uložený Skill Link ovlivňuje podporované vícenásobné útoky; ostatní schopnosti nejsou modelovány.',
                            )}
                        </p>
                        {observationConflict && (
                            <p role="status" className="sim-notice">
                                {t(
                                    'Recorded stats have a sync conflict. Enter temporary values to simulate.',
                                    'Zaznamenané statistiky mají konflikt synchronizace. Pro simulaci zadejte dočasné hodnoty.',
                                )}
                            </p>
                        )}
                    </div>
                </section>
                <section className="my-panel sim-enemy-panel">
                    <div className="sim-section-heading">
                        <h2>
                            {savedEncounter
                                ? t('Opponent estimates', 'Odhady soupeře')
                                : t('Set the opponent', 'Nastavte soupeře')}
                        </h2>
                        {enemy && !savedEncounter && (
                            <button
                                type="button"
                                className="my-text-button"
                                onClick={() =>
                                    setEnemySetup((previous) => ({
                                        ...previous,
                                        picking: !previous.picking,
                                    }))
                                }
                            >
                                {pickingEnemy
                                    ? t('Close search', 'Zavřít hledání')
                                    : t('Change species', 'Změnit druh')}
                            </button>
                        )}
                    </div>
                    {pickingEnemy && !savedEncounter && (
                        <SpeciesPicker
                            datasetId={datasetId}
                            onSelect={(selected) => {
                                setEnemySetup({
                                    pokemon: selected,
                                    level: String(pokemon.state.level),
                                    overrides: { hp: '', defense: '', spDefense: '' },
                                    picking: false,
                                });
                            }}
                        />
                    )}
                    {enemy && (
                        <>
                            <div className="sim-enemy-summary">
                                <strong>{enemy.name}</strong>
                                <TypeBadges
                                    types={enemy.types}
                                    iconFiles={enemy.typeIconFiles}
                                    iconOnly
                                />
                            </div>
                            {!savedEncounter && (
                                <label className="filter-label sim-level-field">
                                    {t('Enemy level', 'Úroveň soupeře')}
                                    <input
                                        className="filter-input"
                                        type="text"
                                        inputMode="numeric"
                                        value={enemyLevel}
                                        aria-label={t('Enemy level', 'Úroveň soupeře')}
                                        maxLength={3}
                                        aria-invalid={parsedEnemyLevel === undefined}
                                        onChange={(event) => {
                                            const level = event.target.value;
                                            setEnemySetup((previous) => ({
                                                ...previous,
                                                level,
                                                overrides: { hp: '', defense: '', spDefense: '' },
                                            }));
                                        }}
                                    />
                                    {parsedEnemyLevel === undefined && (
                                        <small className="sim-invalid">
                                            {t(
                                                'Enter a whole level from 1 to 100.',
                                                'Zadejte celou úroveň od 1 do 100.',
                                            )}
                                        </small>
                                    )}
                                </label>
                            )}
                            <p className="my-muted">
                                {t(
                                    'Assumed stats: neutral nature, 31 IVs, 0 EVs. Override any value below if you know the actual stat.',
                                    'Odhad statistik: neutrální povaha, 31 IV, 0 EV. Pokud znáte skutečnou statistiku, přepište její hodnotu níže.',
                                )}
                            </p>
                            <div className="sim-stat-grid">
                                {enemyKeys.map((stat) => (
                                    <StatInput
                                        key={stat}
                                        stat={stat}
                                        value={enemyOverrides[stat] ?? ''}
                                        fallback={automatic?.[stat]}
                                        source={
                                            automatic
                                                ? t('Estimated', 'Odhadované')
                                                : t('Unavailable', 'Nedostupné')
                                        }
                                        prefix={t('Opponent', 'Soupeř')}
                                        onChange={(value) =>
                                            setEnemySetup((previous) => ({
                                                ...previous,
                                                overrides: { ...previous.overrides, [stat]: value },
                                            }))
                                        }
                                    />
                                ))}
                            </div>
                            <button
                                type="button"
                                className="my-text-button"
                                onClick={resetEnemyStats}
                            >
                                {t('Reset enemy overrides', 'Obnovit odhad soupeře')}
                            </button>
                            <p className="my-muted">
                                {t(
                                    'Changing the enemy species or level clears its overrides.',
                                    'Změna druhu nebo úrovně soupeře vymaže jeho přepsané hodnoty.',
                                )}
                            </p>
                        </>
                    )}
                </section>
            </div>
            {savedEncounter && (
                <IncomingDamage
                    moves={enemyMoves}
                    enemy={enemy}
                    enemyLevel={parsedEnemyLevel ?? 0}
                    enemyStats={enemyStats}
                    ownTypeIds={species.typeIds}
                    ownStats={incoming.stats}
                    ownName={ownName}
                    chart={chart}
                    estimatedOwnStats={incoming.estimated}
                    disabled={observationConflict}
                />
            )}
            {(!datasetId || chartStatus === 'error') && (
                <p className="sim-notice" role="status">
                    {t(
                        'Type matchup data is unavailable. Reconnect to calculate damage.',
                        'Údaje o účinnosti typů nejsou dostupné. Pro výpočet poškození obnovte připojení.',
                    )}
                </p>
            )}
            {datasetId && chartStatus === 'pending' && (
                <p className="my-muted" role="status">
                    {t('Loading type matchups…', 'Načítání účinnosti typů…')}
                </p>
            )}
            <section className="sim-moves-section">
                <div className="sim-section-heading">
                    <h2>{t('Current moves', 'Aktuální útoky')}</h2>
                    <span className="my-muted">
                        {t('Total HP damage / move use', 'Celkové poškození HP / použití útoku')}
                    </span>
                </div>
                {current.length ? (
                    <div className="sim-move-grid">
                        {current.map((option) => (
                            <DamageMove key={option.move.moveId} option={option} {...moveProps} />
                        ))}
                    </div>
                ) : (
                    <p className="sim-notice">
                        {t(
                            'No moves are recorded. Preview a learnable move below.',
                            'Nejsou zaznamenané žádné útoky. Níže můžete vyzkoušet útok z nabídky učení.',
                        )}
                    </p>
                )}
            </section>
            <section className="sim-moves-section">
                <div className="sim-section-heading">
                    <h2>{t('Move previews', 'Náhledy útoků')}</h2>
                    <span className="sim-session-badge">
                        {t('Temporary only', 'Pouze dočasně')}
                    </span>
                </div>
                <p className="my-muted">
                    {t(
                        `Explore ${species.name}’s full current-form learnset and TM/HM moves. Future moves use today’s recorded level, stats and types.`,
                        `Prozkoumejte všechny útoky současné formy ${species.name} včetně TM/HM. Budoucí útoky používají aktuální zaznamenanou úroveň, statistiky a typy.`,
                    )}
                </p>
                {previews.length > 0 && (
                    <div className="sim-move-grid sim-preview-grid">
                        {previews.map((option) => (
                            <DamageMove
                                key={option.move.moveId}
                                option={option}
                                {...moveProps}
                                onRemove={() =>
                                    setPreviewIds((ids) =>
                                        ids.filter((id) => id !== option.move.moveId),
                                    )
                                }
                            />
                        ))}
                    </div>
                )}
                <details
                    className="sim-preview-picker"
                    open={previews.length === 0 ? true : undefined}
                >
                    <summary>
                        {t('Add a move to compare', 'Přidat útok ke srovnání')}{' '}
                        <span>{options.filter((option) => !option.recorded).length}</span>
                    </summary>
                    <div className="sim-preview-picker-body">
                        <label className="filter-label">
                            {t('Search learnable moves', 'Hledat v naučitelných útocích')}
                            <input
                                className="filter-input"
                                type="search"
                                value={moveSearch}
                                onChange={(event) => setMoveSearch(event.target.value)}
                                placeholder={t('Move name', 'Název útoku')}
                                maxLength={100}
                            />
                        </label>
                        <div className="sim-candidate-list">
                            {candidates.map((option) => (
                                <button
                                    className="sim-candidate"
                                    type="button"
                                    key={option.move.moveId}
                                    disabled={previewIds.includes(option.move.moveId)}
                                    onClick={() =>
                                        setPreviewIds((ids) => [...ids, option.move.moveId])
                                    }
                                >
                                    <span className="sim-candidate-name">
                                        {option.reference && (
                                            <TypeBadges
                                                types={[option.reference.type]}
                                                iconFiles={[option.reference.typeIconFile]}
                                                iconOnly
                                            />
                                        )}
                                        <strong>{option.move.name}</strong>
                                    </span>
                                    <MoveSources option={option} level={pokemon.state.level} />
                                    <span className="sim-candidate-action">
                                        {previewIds.includes(option.move.moveId)
                                            ? t('Previewing', 'V náhledu')
                                            : t('+ Preview', '+ Náhled')}
                                    </span>
                                </button>
                            ))}
                            {candidates.length === 0 && (
                                <p className="my-muted">
                                    {t(
                                        'No matching moves in this form’s learnset.',
                                        'V nabídce této formy nejsou odpovídající útoky.',
                                    )}
                                </p>
                            )}
                        </div>
                        <p className="my-muted">
                            {t(
                                'Level labels describe the learnset, not immediate availability. Recorded inherited moves remain above.',
                                'Úrovně popisují nabídku učení, nikoli okamžitou dostupnost. Zaznamenané zděděné útoky zůstávají výše.',
                            )}
                        </p>
                    </div>
                </details>
            </section>
            <details className="my-panel sim-assumptions">
                <summary>{t('How this simulation works', 'Jak simulace počítá')}</summary>
                <p>
                    {t(
                        'Uses attacker level, move category, attacking and defending stats, STAB, type effectiveness, and the 85–100% random damage range. Results total the shown hit counts for one move use, assuming the first hit lands. Moves that check accuracy on every strike can stop early; other accuracy checks are not included.',
                        'Používá úroveň útočníka, kategorii útoku, útočné a obranné statistiky, STAB, účinnost typů a náhodný rozsah poškození 85–100 %. Výsledek sčítá uvedený počet zásahů jednoho použití útoku za předpokladu, že první zásah uspěje. Útoky s kontrolou přesnosti při každém zásahu mohou skončit dříve; ostatní kontroly přesnosti nejsou zahrnuté.',
                    )}
                </p>
                <p>
                    {t(
                        'Saved Skill Link changes the hit count for supported moves. Other abilities, held items, weather, critical hits, status conditions and stat boosts are excluded. Conditional-power moves use their listed base power; unsupported special damage shows a dash. These assumptions can differ from an actual battle.',
                        'Uložený Skill Link mění počet zásahů podporovaných útoků. Ostatní schopnosti, držené předměty, počasí, kritické zásahy, stavové podmínky a změny statistik nejsou zahrnuté. Útoky s podmíněnou silou používají uvedenou základní sílu; nepodporované zvláštní poškození zobrazuje pomlčku. Tyto předpoklady se mohou lišit od skutečného boje.',
                    )}
                </p>
                <p>
                    {t(
                        'Level changes save to your collection. Named encounters also save their opponents, levels and revealed moves and sync when signed in. Quick matchups, stat overrides and move previews are temporary. New recorded stats, moves, level or form clear stale attacker overrides. Reset scenario clears temporary inputs without deleting saved encounters.',
                        'Změny úrovně se ukládají do sbírky. Pojmenované souboje ukládají soupeře, úrovně a odhalené útoky a po přihlášení se synchronizují. Rychlé porovnání, úpravy statistik a náhledy útoků jsou dočasné. Nové statistiky, útoky, úroveň či forma vymažou zastaralé úpravy útočníka. Obnovení scénáře vymaže dočasné hodnoty, ale zachová uložené souboje.',
                    )}
                </p>
            </details>
        </>
    );
}

function OwnedPokemonOption({ pokemon, runName }: { pokemon: OwnedPokemon; runName: string }) {
    const species = useQuery({
        queryKey: ['collection-species', pokemon.state.speciesId],
        queryFn: () => loadCollectionSpecies(pokemon.state.speciesId),
    });
    return (
        <option value={pokemon.id}>
            {pokemon.nickname || species.data?.name || `#${pokemon.state.speciesId}`} · Lv.{' '}
            {pokemon.state.level} · {runName}
        </option>
    );
}
interface DamageSimulatorProps {
    pokemonId?: string;
    version: string;
    datasetId?: string;
}

/** Resolve the global simulator entry within the playthrough the user is working in. */
export function getDefaultSimulatorPokemonId(
    document: CollectionDocument,
    conflicts: readonly CollectionConflict[],
    selection: WorkspaceSelection | null,
): string | undefined {
    const runs = Object.values(document.playthroughs).filter((entry) => !entry.deleted);
    const run = runs.find((entry) => entry.id === selection?.playthroughId) ?? runs[0];
    if (!run) return undefined;
    const selected = selection?.pokemonId ? document.pokemon[selection.pokemonId] : undefined;
    if (selected && !selected.deleted && selected.playthroughId === run.id) return selected.id;
    const party = getSimulatorParty(document, run, conflicts);
    return (
        party?.[0]?.id ??
        Object.values(document.pokemon).find(
            (entry) => !entry.deleted && entry.playthroughId === run.id,
        )?.id
    );
}

export function DamageSimulatorPage(props: DamageSimulatorProps) {
    const { document, conflicts, ready, update, resolve, status, user, error } = useCollection();
    return (
        <DamageSimulatorView
            {...props}
            document={document}
            conflicts={conflicts}
            ready={ready}
            onUpdateCollection={update}
            onResolveConflict={resolve}
            syncStatus={status}
            syncError={error}
            signedIn={Boolean(user)}
            onSaveLevel={(pokemon, level) =>
                update((current) => setOwnedPokemonLevel(current, pokemon, level))
            }
        />
    );
}

export function DamageSimulatorView({
    pokemonId: requestedPokemonId,
    version,
    datasetId,
    document,
    conflicts,
    ready,
    onSaveLevel,
    onUpdateCollection,
    onResolveConflict,
    syncStatus = 'local',
    syncError,
    signedIn = false,
}: DamageSimulatorProps & {
    document: CollectionDocument;
    conflicts: readonly CollectionConflict[];
    ready: boolean;
    onSaveLevel: (pokemon: OwnedPokemon, level: number) => Promise<void>;
    onUpdateCollection: (
        updater: (current: CollectionDocument) => CollectionDocument,
    ) => Promise<void>;
    onResolveConflict?: (id: string, choice: 'local' | 'remote') => Promise<void>;
    syncStatus?: CollectionStatus;
    syncError?: string | null;
    signedIn?: boolean;
}) {
    const { t } = useLanguage();
    const [workspaceSelection, setWorkspaceSelection] = useState(readWorkspaceSession);
    const pokemonId =
        requestedPokemonId ?? getDefaultSimulatorPokemonId(document, conflicts, workspaceSelection);
    // This state belongs to the simulator page, above the keyed attacker scenario.
    const datasetKey = datasetId ?? 'default';
    const [quickEnemySetup, setQuickEnemySetup] = useState<EnemySetup>(() =>
        readSimulatorOpponent(datasetKey),
    );
    const [scenarioRevision, setScenarioRevision] = useState(0);
    const [encounterSelections, setEncounterSelections] = useState<
        Record<string, EncounterSelection>
    >({});
    const [, refreshEnemyOverrides] = useState(0);
    useEffect(
        () => rememberSimulatorOpponent(datasetKey, quickEnemySetup),
        [datasetKey, quickEnemySetup],
    );
    const chart = useQuery({
        queryKey: ['collection-type-effectiveness', datasetId],
        queryFn: () => loadCollectionTypeEffectiveness(datasetId!),
        enabled: ready && Boolean(datasetId),
    });
    const pokemon = pokemonId === undefined ? undefined : document.pokemon[pokemonId];
    const run = pokemon ? document.playthroughs[pokemon.playthroughId] : undefined;
    const missing = !pokemon || pokemon.deleted || !run || run.deleted;
    const encounterSelectionKey = `${datasetKey}:${run?.id ?? ''}`;
    const encounterSelection =
        encounterSelections[encounterSelectionKey] ?? readEncounterSelection(encounterSelectionKey);
    const { encounter, opponent } = resolveEncounterSelection(
        document,
        run?.id,
        encounterSelection,
    );
    const encounterConflict = conflicts.some(
        (conflict) =>
            (conflict.entity === 'encounters' && conflict.entityId === encounter?.id) ||
            (conflict.entity === 'opponents' && conflict.entityId === opponent?.id) ||
            (conflict.entity === 'playthroughs' &&
                conflict.entityId === run?.id &&
                ['$entity', 'deleted'].includes(conflict.field)),
    );
    const enemySpecies = useQuery({
        queryKey: ['collection-species', opponent?.speciesId],
        queryFn: () => loadCollectionSpecies(opponent!.speciesId),
        enabled: ready && !missing && Boolean(opponent) && !encounterConflict,
    });
    const enemyOverrideKey = `${datasetKey}:opponent:${opponent?.id}`;
    const cachedEnemy = readSimulatorOpponent(enemyOverrideKey);
    const enemyOverridesCurrent =
        opponent &&
        cachedEnemy.pokemon?.speciesId === opponent.speciesId &&
        cachedEnemy.level === String(opponent.level);
    const enemySetup: EnemySetup = encounter
        ? {
              pokemon: encounterConflict || !opponent ? null : (enemySpecies.data ?? null),
              level: opponent ? String(opponent.level) : '',
              picking: false,
              overrides: enemyOverridesCurrent
                  ? cachedEnemy.overrides
                  : emptyEnemySetup().overrides,
          }
        : quickEnemySetup;
    useEffect(() => {
        if (!opponent || !enemySpecies.data || encounterConflict) return;
        const previous = readSimulatorOpponent(enemyOverrideKey);
        if (
            previous.pokemon?.speciesId !== opponent.speciesId ||
            previous.level !== String(opponent.level)
        ) {
            rememberSimulatorOpponent(enemyOverrideKey, {
                ...emptyEnemySetup(),
                pokemon: enemySpecies.data,
                level: String(opponent.level),
                picking: false,
            });
        }
    }, [
        enemyOverrideKey,
        opponent?.id,
        opponent?.speciesId,
        opponent?.level,
        enemySpecies.data,
        encounterConflict,
    ]);
    const enemyMoves = encounterConflict ? [] : (opponent?.moves ?? []);
    const setEnemySetup: Dispatch<SetStateAction<EnemySetup>> = (update) => {
        if (!encounter) {
            setQuickEnemySetup(update);
            return;
        }
        if (!opponent || encounterConflict) return;
        const next = typeof update === 'function' ? update(enemySetup) : update;
        rememberSimulatorOpponent(enemyOverrideKey, next);
        refreshEnemyOverrides((value) => value + 1);
    };
    function selectEncounter(encounterId: string | undefined, opponentId: string | undefined) {
        const selection = { encounterId, opponentId };
        rememberEncounterSelection(encounterSelectionKey, selection);
        setEncounterSelections((previous) => ({ ...previous, [encounterSelectionKey]: selection }));
    }
    const syncLabel = {
        local: t('Saved on this device', 'Uloženo v tomto zařízení'),
        syncing: t('Syncing…', 'Synchronizace…'),
        pending: t('Waiting to sync', 'Čeká na synchronizaci'),
        synced: t('Synced', 'Synchronizováno'),
        offline: t('Offline · edits saved here', 'Offline · změny jsou uloženy zde'),
        error: t('Sync needs attention', 'Synchronizace vyžaduje pozornost'),
    }[syncStatus];
    useEffect(() => {
        if (ready && !missing) {
            const selection = { playthroughId: run.id, pokemonId: pokemon.id };
            rememberWorkspaceSelection(selection);
            setWorkspaceSelection(selection);
        }
    }, [ready, missing, run?.id, pokemon?.id]);
    const stateConflict = conflicts.some(
        (conflict) =>
            (conflict.entity === 'pokemon' &&
                conflict.entityId === pokemonId &&
                ['state', '$entity', 'deleted', 'playthroughId'].includes(conflict.field)) ||
            (conflict.entity === 'playthroughs' &&
                conflict.entityId === run?.id &&
                ['$entity', 'deleted'].includes(conflict.field)),
    );
    const species = useQuery({
        queryKey: ['collection-species', pokemon?.state.speciesId],
        queryFn: () => loadCollectionSpecies(pokemon!.state.speciesId),
        enabled: ready && !missing && !stateConflict,
    });
    const observationConflict = conflicts.some(
        (conflict) =>
            conflict.entity === 'observations' &&
            (document.observations[conflict.entityId]?.pokemonId === pokemonId ||
                (pokemonId !== undefined && conflictMentionsPokemon(conflict, pokemonId))),
    );
    const recordedStats =
        pokemon && !observationConflict
            ? getCurrentStats(pokemon, Object.values(document.observations))
            : {};
    const ownOptions = Object.values(document.pokemon)
        .filter(
            (entry) =>
                !entry.deleted &&
                document.playthroughs[entry.playthroughId] &&
                !document.playthroughs[entry.playthroughId].deleted,
        )
        .sort(
            (a, b) =>
                Number(b.playthroughId === run?.id) - Number(a.playthroughId === run?.id) ||
                a.nickname.localeCompare(b.nickname),
        );
    return (
        <>
            <DexHeader
                active="simulator"
                version={version}
                backHref={missing ? '#/my-pokemon' : ownedPokemonHref(pokemon.id)}
                backLabel={
                    missing
                        ? t('Back to collection', 'Zpět do sbírky')
                        : t(
                              `Back to ${pokemon.nickname || species.data?.name || 'Pokémon'}`,
                              `Zpět: ${pokemon.nickname || species.data?.name || 'Pokémon'}`,
                          )
                }
            />
            <main className="dex-browse-main my-pokemon-main sim-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8">
                <div className="my-page-heading sim-page-heading">
                    <div>
                        <p className="eyebrow">{t('BATTLE WORKSPACE', 'BOJOVÉ PRACOVIŠTĚ')}</p>
                        <h1>{t('Damage simulator', 'Simulátor poškození')}</h1>
                        <p className="my-muted">
                            {t(
                                'Compare attacks against any opponent and update your Pokémon’s level as you play.',
                                'Porovnejte útoky proti libovolnému soupeři a během hraní aktualizujte úroveň svého Pokémona.',
                            )}
                        </p>
                        <button
                            type="button"
                            className="my-text-button"
                            onClick={() => {
                                resetSimulatorSession(datasetKey);
                                setQuickEnemySetup(emptyEnemySetup());
                                refreshEnemyOverrides((value) => value + 1);
                                setScenarioRevision((value) => value + 1);
                            }}
                        >
                            {t('Reset scenario', 'Obnovit scénář')}
                        </button>
                    </div>
                    {ready && ownOptions.length > 0 && (
                        <label className="filter-label sim-owned-selector">
                            {t('Collection Pokémon', 'Pokémon ze sbírky')}
                            <select
                                className="filter-input"
                                value={missing ? '' : pokemonId}
                                onChange={(event) => {
                                    window.location.hash = damageSimulatorHref(event.target.value);
                                }}
                            >
                                {missing && (
                                    <option value="" disabled>
                                        {t('Choose your Pokémon', 'Vyberte svého Pokémona')}
                                    </option>
                                )}
                                {ownOptions.map((entry) => (
                                    <OwnedPokemonOption
                                        key={entry.id}
                                        pokemon={entry}
                                        runName={document.playthroughs[entry.playthroughId].name}
                                    />
                                ))}
                            </select>
                        </label>
                    )}
                </div>
                {ready && !missing && (
                    <>
                        <div className="sim-save-status">
                            <span className={`my-sync-status my-sync-${syncStatus}`} role="status">
                                {syncLabel}
                            </span>
                            {!signedIn && (
                                <a className="my-text-button" href="#/my-pokemon">
                                    {t(
                                        'Sign in from My Pokémon to sync encounters across devices',
                                        'Pro synchronizaci soubojů mezi zařízeními se přihlaste v Moji Pokémoni',
                                    )}
                                </a>
                            )}
                            {syncError && <p role="alert">{syncError}</p>}
                        </div>
                        {onResolveConflict && (
                            <MyPokemonConflicts
                                document={document}
                                conflicts={conflicts.filter(
                                    (entry) =>
                                        entry.entity === 'encounters' ||
                                        entry.entity === 'opponents',
                                )}
                                resolve={onResolveConflict}
                            />
                        )}
                        <SimulatorEncounters
                            key={`${datasetKey}:${run.id}`}
                            document={document}
                            conflicts={conflicts}
                            runId={run.id}
                            datasetId={datasetId}
                            defaultLevel={pokemon.state.level}
                            selectedEncounterId={encounter?.id}
                            selectedOpponentId={opponent?.id}
                            onSelect={selectEncounter}
                            onUpdate={onUpdateCollection}
                        />
                        {encounterConflict && (
                            <p className="sim-notice" role="alert">
                                {t(
                                    'Resolve the encounter conflict before using its matchup or damage estimates.',
                                    'Před použitím účinnosti a odhadů poškození vyřešte konflikt souboje.',
                                )}
                            </p>
                        )}
                        {opponent && !encounterConflict && enemySpecies.isError && (
                            <p className="sim-notice" role="alert">
                                {t(
                                    'Opponent data could not be loaded.',
                                    'Údaje o soupeři se nepodařilo načíst.',
                                )}{' '}
                                <button
                                    type="button"
                                    className="my-text-button"
                                    onClick={() => {
                                        void enemySpecies.refetch();
                                    }}
                                >
                                    {t('Retry', 'Zkusit znovu')}
                                </button>
                            </p>
                        )}
                    </>
                )}
                {ready && !missing && (
                    <SimulatorParty
                        document={document}
                        run={run}
                        selectedPokemonId={pokemon.id}
                        enemy={enemySetup.pokemon}
                        enemyMoves={enemyMoves}
                        datasetId={datasetId}
                        chart={chart.data}
                        conflicts={conflicts}
                    />
                )}
                {!ready ? (
                    <p className="my-panel" role="status">
                        {t('Loading collection…', 'Načítání sbírky…')}
                    </p>
                ) : missing ? (
                    <div className="my-panel" role="status">
                        <p>
                            {requestedPokemonId !== undefined
                                ? t(
                                      'This Pokémon or its playthrough is unavailable. Choose another Pokémon from your collection.',
                                      'Tento Pokémon nebo jeho průchod není dostupný. Vyberte jiného Pokémona ze sbírky.',
                                  )
                                : Object.values(document.playthroughs).some(
                                        (entry) => !entry.deleted,
                                    )
                                  ? t(
                                        'Add a Pokémon to your active playthrough to start a simulation, or choose one from another playthrough above.',
                                        'Pro simulaci přidejte Pokémona do aktivního průchodu, nebo výše vyberte Pokémona z jiného průchodu.',
                                    )
                                  : t(
                                        'Create a playthrough and add your first Pokémon to start a simulation.',
                                        'Pro simulaci vytvořte průchod a přidejte prvního Pokémona.',
                                    )}
                        </p>
                        <a className="my-text-button" href="#/my-pokemon">
                            {t('Open My Pokémon', 'Otevřít Moje Pokémony')}
                        </a>
                    </div>
                ) : stateConflict ? (
                    <p className="my-panel" role="alert">
                        {t(
                            'Resolve this Pokémon’s collection conflict before simulating. Its form, level or identity is uncertain.',
                            'Před simulací vyřešte konflikt tohoto Pokémona ve sbírce. Jeho forma, úroveň nebo identita není jistá.',
                        )}{' '}
                        <a className="my-text-button" href={ownedPokemonHref(pokemon.id)}>
                            {t('Open collection', 'Otevřít sbírku')}
                        </a>
                    </p>
                ) : species.isError ? (
                    <p className="my-panel" role="alert">
                        {t(
                            'Species data could not be loaded. Reconnect and try again.',
                            'Údaje o druhu se nepodařilo načíst. Obnovte připojení a zkuste to znovu.',
                        )}
                    </p>
                ) : !species.data ? (
                    <p className="my-panel" role="status">
                        {t('Loading Pokémon data…', 'Načítání údajů Pokémona…')}
                    </p>
                ) : (
                    <>
                        <SimulatorLevelControls
                            key={`${pokemon.id}:${pokemon.state.formEpoch}`}
                            pokemon={pokemon}
                            species={species.data}
                            onSave={onSaveLevel}
                        />
                        <SimulatorScenario
                            key={`${pokemon.id}:${attackerFingerprint(pokemon, recordedStats)}:${observationConflict}:${scenarioRevision}`}
                            pokemon={pokemon}
                            species={species.data}
                            recordedStats={recordedStats}
                            natureId={
                                conflicts.some(
                                    (conflict) =>
                                        conflict.entity === 'pokemon' &&
                                        conflict.entityId === pokemonId &&
                                        conflict.field === 'natureId',
                                )
                                    ? null
                                    : pokemon.natureId
                            }
                            abilityConflict={conflicts.some(
                                (conflict) =>
                                    conflict.entity === 'pokemon' &&
                                    conflict.entityId === pokemonId &&
                                    conflict.field === 'ability',
                            )}
                            observationConflict={observationConflict}
                            datasetId={datasetId}
                            enemySetup={enemySetup}
                            setEnemySetup={setEnemySetup}
                            enemyMoves={enemyMoves}
                            savedEncounter={Boolean(encounter)}
                            chart={chart.data}
                            chartStatus={chart.status}
                        />
                    </>
                )}
                <DexFooter />
            </main>
        </>
    );
}
