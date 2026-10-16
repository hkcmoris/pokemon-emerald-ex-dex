import { useState, type Dispatch, type SetStateAction } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pokemonNatures, getNatureStatEffect } from '@pokemon-emerald-ex-dex/shared';
import type {
    BaseStats,
    CollectionConflict,
    CollectionDocument,
    OwnedPokemon,
    Pokemon,
    SpeciesDetails,
    TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { NatureStat } from './NatureStat.js';
import { BattleTypeMatchups } from './BattleTypeMatchups.js';
import { SimulatorParty } from './SimulatorParty.js';
import { getAbilityChoices, getSelectedAbility } from './pokemonTraits.js';
import { useCollection } from './collectionStore.js';
import { getCurrentStats } from './collectionStats.js';
import { loadCollectionMove, loadCollectionSpecies } from './collectionSpecies.js';
import { loadCollectionTypeEffectiveness } from './collectionTypeEffectiveness.js';
import { estimateEnemyStats, simulateMoveDamage } from './damageSimulation.js';
import { getSimulatorMoveOptions, type SimulatorMoveOption } from './simulatorMoves.js';
import { DexHeader } from './DexHeader.js';
import { DexNavigation } from './DexNavigation.js';
import { DexFooter } from './DexFooter.js';
import { SpeciesPicker } from './MyPokemonForms.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { TypeBadges } from './TypeBadges.js';
import { MoveCategory } from './MoveCategory.js';
import { MoveEffectBadges } from './MoveEffectBadges.js';
import { damageSimulatorHref, ownedPokemonHref } from './navigation.js';
import { useLanguage } from './language.js';
import { typeSurfaceStyle } from './theme.js';

type AttackStat = 'attack' | 'spAttack' | 'defense';
type EnemyStat = 'hp' | 'defense' | 'spDefense';
interface EnemySetup {
    pokemon: Pokemon | null;
    level: string;
    picking: boolean;
    overrides: Record<EnemyStat, string>;
}

const attackKeys: readonly AttackStat[] = ['attack', 'spAttack', 'defense'];
const enemyKeys: readonly EnemyStat[] = ['hp', 'defense', 'spDefense'];
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
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            value.pokemonId === pokemonId,
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
    onRemove,
}: {
    option: SimulatorMoveOption;
    level: number;
    stats: Partial<BaseStats>;
    typeIds: readonly number[];
    enemyStats: Partial<BaseStats>;
    enemyTypeIds?: readonly number[];
    chart?: TypeEffectivenessChart;
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
                            'Random roll 85–100%. Damage per successful hit.',
                            'Náhodný faktor 85–100 %. Poškození za jeden úspěšný zásah.',
                        )}
                    </p>
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
    const [ownOverrides, setOwnOverrides] = useState<Record<AttackStat, string>>({
        attack: '',
        spAttack: '',
        defense: '',
    });
    const [previewIds, setPreviewIds] = useState<number[]>([]);
    const [moveSearch, setMoveSearch] = useState('');
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
            const value =
                enemyOverrides[stat] === '' ? automatic[stat] : integerInput(enemyOverrides[stat]);
            if (value !== undefined) enemyStats[stat] = value;
        }
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
    const moveProps = {
        level: pokemon.state.level,
        stats,
        typeIds: species.typeIds,
        enemyStats,
        enemyTypeIds: enemy?.typeIds,
        chart,
    };
    const ownName = pokemon.nickname || species.name;
    const nature = pokemonNatures.find((entry) => entry.id === natureId);
    const abilityChoices = getAbilityChoices(species);
    const selectedAbility = abilityConflict
        ? null
        : (getSelectedAbility(pokemon, species) ??
          (abilityChoices.length === 1 ? abilityChoices[0] : null));
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
                                'Current recorded level and form. Defense is used by Body Press. Blank fields use recorded stats; entered values apply only here. Recorded values already include nature. The selected ability is not applied to damage.',
                                'Aktuální zaznamenaná úroveň a forma. Body Press používá Obranu. Prázdná pole použijí zaznamenané statistiky; zadané hodnoty platí jen zde. Zaznamenané hodnoty již zahrnují povahu. Vybraná schopnost se do poškození nezapočítává.',
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
                        <h2>{t('Set the opponent', 'Nastavte soupeře')}</h2>
                        {enemy && (
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
                    {pickingEnemy && (
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
                                        value={enemyOverrides[stat]}
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
                        {t('HP damage / successful hit', 'Poškození HP / úspěšný zásah')}
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
                        'Uses attacker level, move category, attacking and defending stats, STAB, type effectiveness, and the 85–100% random damage range. Every result is per successful hit; accuracy and multi-hit totals are not simulated.',
                        'Používá úroveň útočníka, kategorii útoku, útočné a obranné statistiky, STAB, účinnost typů a náhodný rozsah poškození 85–100 %. Každý výsledek platí pro jeden úspěšný zásah; přesnost ani součty vícenásobných zásahů se nesimulují.',
                    )}
                </p>
                <p>
                    {t(
                        'Abilities, held items, weather, critical hits, status conditions and stat boosts are excluded. Conditional-power moves use their listed base power; unsupported special damage shows a dash. These assumptions can differ from an actual battle.',
                        'Schopnosti, držené předměty, počasí, kritické zásahy, stavové podmínky a změny statistik nejsou zahrnuté. Útoky s podmíněnou silou používají uvedenou základní sílu; nepodporované zvláštní poškození zobrazuje pomlčku. Tyto předpoklady se mohou lišit od skutečného boje.',
                    )}
                </p>
                <p>
                    {t(
                        'No changes are saved to your collection. Switching the attacker, form or recorded level keeps the opponent and clears your temporary stats and move previews. Leaving the simulator clears the scenario.',
                        'Žádné změny se neukládají do sbírky. Změna útočníka, formy nebo zaznamenané úrovně zachová soupeře a vymaže vaše dočasné statistiky a náhledy útoků. Odchod ze simulátoru vymaže scénář.',
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
    pokemonId: string;
    version: string;
    datasetId?: string;
}

export function DamageSimulatorPage(props: DamageSimulatorProps) {
    const { document, conflicts, ready } = useCollection();
    return (
        <DamageSimulatorView {...props} document={document} conflicts={conflicts} ready={ready} />
    );
}

export function DamageSimulatorView({
    pokemonId,
    version,
    datasetId,
    document,
    conflicts,
    ready,
}: DamageSimulatorProps & {
    document: CollectionDocument;
    conflicts: readonly CollectionConflict[];
    ready: boolean;
}) {
    const { t } = useLanguage();
    // This state belongs to the simulator page, above the keyed attacker scenario.
    const [enemySetup, setEnemySetup] = useState<EnemySetup>({
        pokemon: null,
        level: '',
        picking: true,
        overrides: { hp: '', defense: '', spDefense: '' },
    });
    const chart = useQuery({
        queryKey: ['collection-type-effectiveness', datasetId],
        queryFn: () => loadCollectionTypeEffectiveness(datasetId!),
        enabled: ready && Boolean(datasetId),
    });
    const pokemon = document.pokemon[pokemonId];
    const run = pokemon ? document.playthroughs[pokemon.playthroughId] : undefined;
    const missing = !pokemon || pokemon.deleted || !run || run.deleted;
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
        queryFn: () => loadCollectionSpecies(pokemon.state.speciesId),
        enabled: ready && !missing && !stateConflict,
    });
    const observationConflict = conflicts.some(
        (conflict) =>
            conflict.entity === 'observations' &&
            (document.observations[conflict.entityId]?.pokemonId === pokemonId ||
                conflictMentionsPokemon(conflict, pokemonId)),
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
                version={version}
                backHref={missing ? '#/my-pokemon' : ownedPokemonHref(pokemonId)}
                backLabel={t('Back to collection', 'Zpět do sbírky')}
            />
            <main className="dex-browse-main my-pokemon-main sim-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8">
                <DexNavigation active="my-pokemon" />
                <div className="my-page-heading sim-page-heading">
                    <div>
                        <p className="eyebrow">
                            {t('MY POKÉMON / SIMULATOR', 'MOJI POKÉMONI / SIMULÁTOR')}
                        </p>
                        <h1>{t('Damage simulator', 'Simulátor poškození')}</h1>
                        <p className="my-muted">
                            {t(
                                'Compare attacks against any opponent. Your saved collection stays untouched.',
                                'Porovnejte útoky proti libovolnému soupeři. Uložená sbírka zůstane beze změn.',
                            )}
                        </p>
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
                    <SimulatorParty
                        document={document}
                        run={run}
                        selectedPokemonId={pokemonId}
                        enemy={enemySetup.pokemon}
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
                    <p className="my-panel" role="status">
                        {t(
                            'This Pokémon or its playthrough is unavailable. Choose another Pokémon from your collection.',
                            'Tento Pokémon nebo jeho průchod není dostupný. Vyberte jiného Pokémona ze sbírky.',
                        )}
                    </p>
                ) : stateConflict ? (
                    <p className="my-panel" role="alert">
                        {t(
                            'Resolve this Pokémon’s collection conflict before simulating. Its form, level or identity is uncertain.',
                            'Před simulací vyřešte konflikt tohoto Pokémona ve sbírce. Jeho forma, úroveň nebo identita není jistá.',
                        )}{' '}
                        <a className="my-text-button" href={ownedPokemonHref(pokemonId)}>
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
                    <SimulatorScenario
                        key={`${pokemon.id}:${pokemon.state.speciesId}:${pokemon.state.formEpoch}:${pokemon.state.level}`}
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
                        chart={chart.data}
                        chartStatus={chart.status}
                    />
                )}
                <DexFooter />
            </main>
        </>
    );
}
