import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getCatchUpRecap,
    getEvolutionConditions,
    getEvolutionGuidance,
    type EvolutionMoveAdvice,
    type OwnedPokemon,
    type Pokemon,
    type SpeciesDetails,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionFamily, loadCollectionSpecies } from './collectionSpecies.js';
import { getCurrentStats, getCurrentStatTotal } from './collectionStats.js';
import { useLanguage } from './language.js';
import { LevelEditor } from './LevelEditor.js';
import { evolutionConditionLabel, evolutionSummary } from './evolutionText.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { damageSimulatorHref, ownedPokemonHref, speciesHref } from './navigation.js';
import { SpeciesPicker } from './MyPokemonForms.js';
import { MyPokemonHistory, ObservationForm } from './MyPokemonHistory.js';
import { MyPokemonCurrentStats } from './MyPokemonCurrentStats.js';
import { CatchUpRecap } from './CatchUpRecap.js';
export { CatchUpRecap } from './CatchUpRecap.js';
import {
    clearLevelReview,
    rememberLevelReview,
    useLevelReview,
    useLevelReviewStorageError,
} from './levelingSession.js';
import { MyPokemonMovesWorkspace } from './MyPokemonMovesWorkspace.js';
import { requestMoveLearning } from './moveChoices.js';
import { ScreenshotObservationQueue } from './ScreenshotObservationQueue.js';
import { MyPokemonTraits } from './MyPokemonTraits.js';
import { MyPokemonStatsGraph } from './MyPokemonStatsGraph.js';
import type { MyPokemonView } from './MyPokemonViewToggle.js';
import { MyPokemonTypeDefenses } from './MyPokemonTypeDefenses.js';
import { MyPokemonMove, findReferenceMove } from './MyPokemonMove.js';
import { MyPokemonMilestones } from './MyPokemonMilestones.js';
import { MyPokemonWishlist } from './MyPokemonWishlist.js';
import { MyPokemonWishlistAction } from './MyPokemonWishlistAction.js';
import { WishIcon } from './WishIcon.js';
import { TypeBadges } from './TypeBadges.js';
import { OffensiveStatIndicator } from './OffensiveStatIndicator.js';
import { MoveAffinityProvider } from './MoveAffinity.js';
import { MovePowerProvider } from './MovePower.js';
import { typeSurfaceStyle } from './theme.js';
import { BattleStrengthBadge } from './BattleStrengthBadge.js';
import type { OwnedBattleStrength } from './useBattleStrength.js';
import { applyCatchUpChanges } from './catchUpChanges.js';
import {
    clearObservationDraft,
    isObservationDraftSaving,
    observationDraftKey,
    useObservationDrafts,
} from './observationDrafts.js';

function NicknameEditor({
    value,
    onSave,
}: {
    value: string;
    onSave: (nickname: string) => Promise<void>;
}) {
    const { t } = useLanguage();
    const [nickname, setNickname] = useState(value);
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(false);
    async function submit(event: SubmitEvent) {
        event.preventDefault();
        setError(false);
        setBusy(true);
        try {
            await onSave(nickname.trim());
        } catch {
            setError(true);
        } finally {
            setBusy(false);
        }
    }
    return (
        <form
            className="my-inline-form"
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <label className="filter-label">
                {t('Nickname (optional)', 'Přezdívka (volitelná)')}
                <input
                    className="filter-input"
                    maxLength={40}
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                />
            </label>
            <button
                className="page-button"
                type="submit"
                disabled={busy || nickname.trim() === value}
            >
                {t('Save name', 'Uložit jméno')}
            </button>
            {error && (
                <p role="alert">
                    {t('Could not save the nickname.', 'Přezdívku se nepodařilo uložit.')}
                </p>
            )}
        </form>
    );
}

function groupTradeoffs(entries: readonly EvolutionMoveAdvice[]): EvolutionMoveAdvice[][] {
    const groups = new Map<string, EvolutionMoveAdvice[]>();
    for (const entry of entries) {
        const key = `${entry.sourceSpeciesId}:${entry.moveId}:${entry.currentLevel ?? 'machine'}`;
        groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.values()];
}

function EvolutionTradeoff({
    entries,
    pokemon,
    details,
    showBranches,
    wishlistPaused,
    onUpdate,
}: {
    entries: readonly EvolutionMoveAdvice[];
    pokemon: OwnedPokemon;
    details: Readonly<Record<number, SpeciesDetails>>;
    showBranches: boolean;
    wishlistPaused?: boolean;
    onUpdate?: (updater: (current: OwnedPokemon) => OwnedPokemon) => Promise<void>;
}) {
    const { t } = useLanguage();
    const entry = entries[0];
    const gained = entry.kind === 'evolution-gain';
    const name = (id: number) => details[id]?.name ?? `#${id}`;
    const machines = new Map<string, Set<number>>();
    for (const opportunity of entries.flatMap((value) => value.opportunities)) {
        if (!opportunity.machine) continue;
        const species = machines.get(opportunity.machine) ?? new Set<number>();
        species.add(opportunity.speciesId);
        machines.set(opportunity.machine, species);
    }
    const currentMachines = gained
        ? (details[pokemon.state.speciesId]?.machines
              .filter((move) => move.moveId === entry.moveId)
              .map((move) => move.machine) ?? [])
        : [];
    const conditionalLevel =
        gained &&
        entries.some((value) =>
            value.opportunities.some(
                (opportunity) =>
                    opportunity.speciesId === entry.sourceSpeciesId &&
                    opportunity.level === entry.currentLevel &&
                    opportunity.conditional,
            ),
        );
    return (
        <li className="my-tradeoff-move">
            <div className="my-tradeoff-title">
                <MyPokemonMove
                    move={entry}
                    reference={findReferenceMove(entry.moveId, Object.values(details))}
                    suffix={
                        <MyPokemonWishlistAction
                            pokemon={pokemon}
                            family={Object.values(details)}
                            move={entry}
                            paused={wishlistPaused}
                            onUpdate={onUpdate}
                        />
                    }
                />
                <span className="my-level-badge">
                    {name(entry.sourceSpeciesId)} · Lv. {entry.currentLevel}
                </span>
            </div>
            {gained && conditionalLevel && (
                <p>
                    {t(
                        'Learning at the evolution level is conditional; verify the order in the game.',
                        'Naučení na úrovni vývoje je podmíněné. Ověřte pořadí ve hře.',
                    )}
                </p>
            )}
            {[...machines].map(([machine, ids]) => (
                <p className="my-tradeoff-alternative" key={machine}>
                    {t(
                        `${[...ids].map(name).join(' / ')} can also learn it via ${machine}, if you have the machine.`,
                        `${[...ids].map(name).join(' / ')} se ho mohou naučit i přes ${machine}, pokud tento přístroj máte.`,
                    )}
                </p>
            ))}
            {currentMachines.length > 0 && (
                <p className="my-tradeoff-alternative">
                    {t(
                        `${name(pokemon.state.speciesId)} can already learn it via ${[...new Set(currentMachines)].join(' / ')} if you have the machine; evolution is needed only for the listed level-up route.`,
                        `${name(pokemon.state.speciesId)} se ho může naučit už nyní přes ${[...new Set(currentMachines)].join(' / ')}, pokud přístroj máte. Vývoj je nutný jen pro uvedené naučení za úroveň.`,
                    )}
                </p>
            )}
            {showBranches && (
                <small>
                    {t('Applies to', 'Platí pro')}:{' '}
                    {[...new Set(entries.map((value) => value.branch.map(name).join(' → ')))].join(
                        ' / ',
                    )}
                </small>
            )}
        </li>
    );
}

function EvolutionTradeoffGroup({
    entries,
    gained,
    pokemon,
    details,
    showBranches,
    wishlistPaused,
    onUpdate,
}: {
    entries: readonly EvolutionMoveAdvice[][];
    gained: boolean;
    pokemon: OwnedPokemon;
    details: Readonly<Record<number, SpeciesDetails>>;
    showBranches: boolean;
    wishlistPaused?: boolean;
    onUpdate?: (updater: (current: OwnedPokemon) => OwnedPokemon) => Promise<void>;
}) {
    const { t } = useLanguage();
    if (entries.length === 0) return null;
    const currentName = details[pokemon.state.speciesId]?.name ?? `#${pokemon.state.speciesId}`;
    const renderMove = (values: EvolutionMoveAdvice[]) => (
        <EvolutionTradeoff
            key={`${values[0].sourceSpeciesId}-${values[0].moveId}`}
            entries={values}
            pokemon={pokemon}
            details={details}
            showBranches={showBranches}
            wishlistPaused={wishlistPaused}
            onUpdate={onUpdate}
        />
    );
    return (
        <section
            className={`my-tradeoff-group ${gained ? 'my-tradeoff-gain' : 'my-tradeoff-delay'}`}
            aria-label={
                gained
                    ? t('New moves after evolving', 'Nové útoky po vývoji')
                    : t('Learn before evolving', 'Naučit před vývojem')
            }
        >
            <h4>
                {gained
                    ? t('New moves after evolving', 'Nové útoky po vývoji')
                    : t('Learn before evolving', 'Naučit před vývojem')}
            </h4>
            <p className="my-muted">
                {gained
                    ? t(
                          `${currentName} does not learn these by leveling up. For level-up moves, reach the listed form before its learning level. Evolution moves remain available if evolution is delayed. Evolution conditions still apply.`,
                          `${currentName} se tyto útoky za úrovně neučí. U útoků za úrovně dosáhněte uvedené formy před úrovní naučení. Útoky při vývoji zůstávají dostupné i při odložení vývoje. Stále platí podmínky vývoje.`,
                      )
                    : t(
                          'Later forms on the listed path do not learn these moves by leveling up. Learn them before leaving that stage; TM/HM alternatives are noted below.',
                          'Pozdější formy v uvedené větvi se tyto útoky za úrovně neučí. Naučte je před opuštěním daného stupně. Případné alternativy přes TM/HM jsou uvedeny níže.',
                      )}
            </p>
            <ul className="my-tradeoff-list">{entries.slice(0, 3).map(renderMove)}</ul>
            {entries.length > 3 && (
                <details className="my-details">
                    <summary>
                        {t('More move trade-offs', 'Další rozdíly v útocích')} ({entries.length - 3}
                        )
                    </summary>
                    <ul className="my-tradeoff-list">{entries.slice(3).map(renderMove)}</ul>
                </details>
            )}
        </section>
    );
}

export function EvolutionAdvice({
    pokemon,
    family,
    party,
    observations = [],
    wishlistPaused = false,
    onUpdate,
}: {
    pokemon: OwnedPokemon;
    family: readonly SpeciesDetails[];
    party?: readonly OwnedPokemon[];
    observations?: readonly StatObservation[];
    wishlistPaused?: boolean;
    onUpdate?: (updater: (current: OwnedPokemon) => OwnedPokemon) => Promise<void>;
}) {
    const { t, language } = useLanguage();
    const current = family.find((entry) => entry.speciesId === pokemon.state.speciesId);
    const details = Object.fromEntries(family.map((entry) => [entry.speciesId, entry]));
    const guidance = getEvolutionGuidance(pokemon, details, t);
    const evolutions =
        current?.evolutionLinks.filter(
            (entry) => entry.fromSpeciesId === pokemon.state.speciesId && !entry.internalOnly,
        ) ?? [];
    const actionable = guidance.filter((entry) => entry.actionable);
    const beforeEvolving = groupTradeoffs(
        actionable
            .filter((entry) => entry.kind === 'check-before-evolving')
            .sort(
                (a, b) =>
                    Number(b.sourceSpeciesId === pokemon.state.speciesId) -
                        Number(a.sourceSpeciesId === pokemon.state.speciesId) ||
                    (a.currentLevel ?? 101) - (b.currentLevel ?? 101),
            ),
    );
    const gained = groupTradeoffs(actionable.filter((entry) => entry.kind === 'evolution-gain'));
    const showBranches = new Set(guidance.map((entry) => entry.branch.join('-'))).size > 1;
    const kindLabel = (kind: EvolutionMoveAdvice['kind']) =>
        kind === 'check-before-evolving'
            ? t('Learn before evolving', 'Naučit před vývojem')
            : kind === 'evolution-gain'
              ? t('Gained after evolving', 'Dostupný po vývoji')
              : kind === 'machine-alternative'
                ? t('TM/HM alternative', 'Alternativa TM/HM')
                : t('Different timing', 'Jiná úroveň naučení');
    return (
        <section
            className="my-evolution-advice"
            aria-label={t('Evolution guidance', 'Doporučení k vývoji')}
        >
            {current && (
                <MyPokemonMilestones
                    pokemon={pokemon}
                    details={current}
                    family={family}
                    wishlistPaused={wishlistPaused}
                    onUpdate={onUpdate}
                />
            )}
            {evolutions.map((entry) => {
                const levelOnly =
                    entry.method === 'level' &&
                    entry.level !== null &&
                    Object.keys(entry.conditions).length === 0 &&
                    entry.summary === `Reach level ${entry.level}.`;
                if (levelOnly)
                    return (
                        <p className="my-evolution-note" key={entry.edgeOrder}>
                            <span>
                                <strong>→ {entry.toName}</strong> —{' '}
                                {pokemon.moveWishlist?.moves.length
                                    ? t(
                                          `Evolution requirement: level ${entry.level}. Follow the wishlist plan above.`,
                                          `Podmínka vývoje: úroveň ${entry.level}. Řiďte se plánem požadovaných útoků výše.`,
                                      )
                                    : t(
                                          `evolves at level ${entry.level}.`,
                                          `vývoj na úrovni ${entry.level}.`,
                                      )}
                            </span>
                        </p>
                    );
                return (
                    <p className="my-evolution-note" key={entry.edgeOrder}>
                        <strong>→ {entry.toName}</strong>
                        <span>{evolutionSummary(entry.summary, language)}</span>
                        {getEvolutionConditions(pokemon, entry, {
                            party,
                            observations,
                            details,
                        }).map((condition, index) => (
                            <small
                                key={index}
                                className={`my-condition my-condition-${condition.status}`}
                            >
                                {condition.status === 'met'
                                    ? t('Recorded evidence', 'Zaznamenané údaje souhlasí')
                                    : condition.status === 'unmet'
                                      ? t(
                                            'Not met in recorded data',
                                            'Zaznamenané údaje nesplňují podmínku',
                                        )
                                      : t('Unknown / check in game', 'Neznámé / ověřte ve hře')}
                                : {evolutionConditionLabel(condition.label, language)}
                            </small>
                        ))}
                    </p>
                );
            })}
            <EvolutionTradeoffGroup
                entries={beforeEvolving}
                gained={false}
                pokemon={pokemon}
                details={details}
                showBranches={showBranches}
                wishlistPaused={wishlistPaused}
                onUpdate={onUpdate}
            />
            <EvolutionTradeoffGroup
                entries={gained}
                gained
                pokemon={pokemon}
                details={details}
                showBranches={showBranches}
                wishlistPaused={wishlistPaused}
                onUpdate={onUpdate}
            />
            {(beforeEvolving.length > 0 || gained.length > 0) && (
                <p className="my-muted">
                    {t(
                        'Level-up and TM/HM only. Tutors and move reminders are excluded.',
                        'Pouze útoky za úrovně a TM/HM. Učitelé útoků a připomínači nejsou zahrnuti.',
                    )}
                </p>
            )}
            {guidance.length > 0 && (
                <details className="my-details">
                    <summary>
                        {t(
                            'Compare all future evolution paths',
                            'Porovnat všechny další vývojové větve',
                        )}{' '}
                        ({guidance.length})
                    </summary>
                    <p className="my-muted">
                        {t(
                            'Level-up and TM/HM only. Tutors and move reminders are excluded. TM/HM compatibility does not mean you own the machine. Timing depends on when you evolve.',
                            'Pouze útoky za úrovně a TM/HM. Učitelé útoků a připomínači nejsou zahrnuti. Kompatibilita s TM/HM neznamená, že přístroj vlastníte. Načasování závisí na době vývoje.',
                        )}
                    </p>
                    <ul className="my-comparison-list">
                        {guidance.map((entry, index) => (
                            <li key={`${entry.moveId}-${index}`}>
                                <strong>
                                    <MyPokemonMove
                                        move={entry}
                                        reference={findReferenceMove(entry.moveId, family)}
                                    />{' '}
                                    · {kindLabel(entry.kind)}
                                </strong>
                                <p>
                                    {entry.branch
                                        .map((id) => details[id]?.name ?? `#${id}`)
                                        .join(' → ')}
                                </p>
                                <p className="my-muted">{entry.message}</p>
                                {entry.opportunities.length > 0 && (
                                    <ul>
                                        {entry.opportunities.map((opportunity, i) => (
                                            <li key={i}>
                                                {details[opportunity.speciesId]?.name ??
                                                    `#${opportunity.speciesId}`}{' '}
                                                ·{' '}
                                                {opportunity.machine ??
                                                    (opportunity.level === 0
                                                        ? t(
                                                              'Special entry — verify in game',
                                                              'Zvláštní záznam — ověřit ve hře',
                                                          )
                                                        : `Lv. ${opportunity.level ?? '?'}`)}
                                                {opportunity.conditional
                                                    ? ` · ${t('conditional timing', 'podmíněné načasování')}`
                                                    : ''}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}

export function MyPokemonCard({
    pokemon,
    strength,
    detail = false,
    view,
    observations,
    datasetId,
    partyIndex,
    partySize,
    partyMembers,
    stateConflict,
    observationConflict = false,
    wishlistConflict = false,
    natureConflict = false,
    abilityConflict = false,
    onUpdate,
    onParty,
    onMove,
    saveObservation,
    onRemove,
    recordingStats,
    onRecordingStatsChange,
    onRecordNext,
    allObservations,
    blockedRecordingIds,
    predictionDisabledPokemonIds,
}: {
    pokemon: OwnedPokemon;
    strength?: OwnedBattleStrength;
    detail?: boolean;
    view: MyPokemonView;
    observations: readonly StatObservation[];
    datasetId?: string;
    partyIndex: number;
    partySize: number;
    partyMembers?: readonly OwnedPokemon[];
    stateConflict: boolean;
    observationConflict?: boolean;
    wishlistConflict?: boolean;
    natureConflict?: boolean;
    abilityConflict?: boolean;
    onUpdate: (updater: (pokemon: OwnedPokemon) => OwnedPokemon) => Promise<void>;
    onParty: () => Promise<void>;
    onMove: (direction: -1 | 1) => Promise<void>;
    saveObservation: (observation: StatObservation) => Promise<void>;
    onRemove: () => Promise<void>;
    recordingStats?: boolean;
    onRecordingStatsChange?: (recording: boolean) => void;
    onRecordNext?: () => void;
    allObservations?: readonly StatObservation[];
    blockedRecordingIds?: readonly string[];
    predictionDisabledPokemonIds?: readonly string[];
}) {
    const { t } = useLanguage();
    const species = useQuery({
        queryKey: ['collection-species', pokemon.state.speciesId],
        queryFn: () => loadCollectionSpecies(pokemon.state.speciesId),
    });
    const relatives = useQuery({
        queryKey: ['collection-family', pokemon.state.speciesId],
        queryFn: () => loadCollectionFamily(pokemon.state.speciesId),
    });
    const family = relatives.data ?? (species.data ? [species.data] : []);
    const [localRecordingStats, setLocalRecordingStats] = useState(false);
    const [resumingDraftKey, setResumingDraftKey] = useState<string>();
    const isRecordingStats = recordingStats ?? localRecordingStats;
    const statsFormId = useId();
    const drafts = useObservationDrafts(pokemon.id);
    const hasDraft = drafts.some(({ key }) => !key.startsWith('screenshot:'));
    const earlierDrafts = drafts.filter(
        ({ key, value }) =>
            !key.startsWith('screenshot:') &&
            !value.observationId &&
            (value.speciesId !== pokemon.state.speciesId ||
                value.formEpoch !== pokemon.state.formEpoch),
    );
    const activeDraftKey = resumingDraftKey ?? observationDraftKey(pokemon);
    function setRecordingStats(value: boolean) {
        setLocalRecordingStats(value);
        onRecordingStatsChange?.(value);
    }
    const wishlistPanelId = useId();
    const [showWishlist, setShowWishlist] = useState(false);
    const [changingSpecies, setChangingSpecies] = useState(false);
    const [nextSpecies, setNextSpecies] = useState<Pokemon | null>(null);
    const recap = useLevelReview(pokemon);
    const recapStorageError = useLevelReviewStorageError();
    const [savedNotice, setSavedNotice] = useState(false);
    useEffect(() => {
        if (!savedNotice) return;
        const timeout = window.setTimeout(() => setSavedNotice(false), 3000);
        return () => clearTimeout(timeout);
    }, [savedNotice]);
    useEffect(() => {
        if (!recap || !species.data || stateConflict) return;
        const opportunities = getCatchUpRecap(species.data, recap.oldLevel, recap.newLevel);
        if (opportunities.moves.length === 0 && opportunities.evolutions.length === 0)
            clearLevelReview(pokemon.id);
    }, [recap, species.data, stateConflict, pokemon.id]);
    const [showScreenshotQueue, setShowScreenshotQueue] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const name = species.data?.name ?? `#${pokemon.state.speciesId}`;
    const statsConflict = stateConflict || observationConflict;
    const currentStatTotal = statsConflict ? null : getCurrentStatTotal(pokemon, observations);
    async function perform(action: () => Promise<void>) {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch {
            setError(
                t(
                    'Could not save this change. Try again.',
                    'Změnu se nepodařilo uložit. Zkuste to znovu.',
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    function reviewLevelChange(previous: number, level: number) {
        if (level <= previous) return;
        const opportunities = species.data
            ? getCatchUpRecap(species.data, previous, level)
            : undefined;
        setSavedNotice(true);
        if (
            !opportunities ||
            opportunities.moves.length > 0 ||
            opportunities.evolutions.length > 0
        ) {
            rememberLevelReview(pokemon.id, {
                speciesId: pokemon.state.speciesId,
                oldLevel: previous,
                newLevel: level,
                formEpoch: pokemon.state.formEpoch,
            });
        }
    }
    async function levelChange(level: number) {
        const previous = pokemon.state.level;
        await onUpdate((current) => ({ ...current, state: { ...current.state, level } }));
        reviewLevelChange(previous, level);
    }
    async function recordObservation(observation: StatObservation) {
        const target =
            observation.pokemonId === pokemon.id
                ? pokemon
                : partyMembers?.find((member) => member.id === observation.pokemonId);
        const wasRecorded = (allObservations ?? observations).some(
            (entry) => entry.id === observation.id,
        );
        await saveObservation(observation);
        setSavedNotice(true);
        if (
            target &&
            !observation.deleted &&
            !wasRecorded &&
            observation.level > target.state.level &&
            observation.speciesId === target.state.speciesId &&
            observation.formEpoch === target.state.formEpoch
        ) {
            // Persist another member's review without waiting for reference data.
            // Opening that member reconciles ranges with no actionable opportunities.
            const details = target.id === pokemon.id ? species.data : undefined;
            const opportunities = details
                ? getCatchUpRecap(details, target.state.level, observation.level)
                : undefined;
            if (
                !opportunities ||
                opportunities.moves.length > 0 ||
                opportunities.evolutions.length > 0
            ) {
                rememberLevelReview(target.id, {
                    speciesId: target.state.speciesId,
                    formEpoch: target.state.formEpoch,
                    oldLevel: target.state.level,
                    newLevel: observation.level,
                });
            }
        }
    }
    const card = (
        <article
            className={`my-pokemon-card${detail ? ' my-card-detail' : ' my-card-summary'}${species.data ? ' type-surface' : ''}`}
            style={species.data ? typeSurfaceStyle(species.data.types) : undefined}
        >
            <div className="my-card-heading">
                <div className="my-pokemon-title">
                    <div className="my-pokemon-portrait">
                        <SpeciesSprite
                            datasetId={datasetId}
                            file={species.data?.sprites?.front ?? null}
                            name={name}
                        />
                    </div>
                    <div>
                        <p className="eyebrow">
                            {partyIndex >= 0
                                ? `${t('Party', 'Tým')} ${partyIndex + 1} / 6`
                                : t('Collection', 'Sbírka')}
                        </p>
                        <h2>
                            {detail ? (
                                pokemon.nickname || name
                            ) : (
                                <a
                                    className="my-card-detail-link"
                                    href={ownedPokemonHref(pokemon.id)}
                                    aria-label={t(
                                        `Open details for ${pokemon.nickname || name}`,
                                        `Otevřít detail: ${pokemon.nickname || name}`,
                                    )}
                                >
                                    {pokemon.nickname || name}
                                </a>
                            )}
                        </h2>
                        {species.data && (
                            <div className="my-pokemon-icons">
                                <TypeBadges
                                    types={species.data.types}
                                    iconFiles={species.data.typeIconFiles}
                                    iconOnly
                                />
                                <OffensiveStatIndicator stats={species.data.stats} />
                            </div>
                        )}
                        <a className="my-text-button" href={speciesHref(pokemon.state.speciesId)}>
                            {pokemon.nickname ? name : t('View in Pokédex', 'Zobrazit v Pokédexu')}{' '}
                            ↗
                        </a>
                    </div>
                </div>
                <div className="my-card-metrics">
                    <LevelEditor
                        key={pokemon.state.level}
                        value={pokemon.state.level}
                        disabled={stateConflict}
                        onSave={levelChange}
                    />
                    <div className="my-card-stat-totals">
                        {strength && (
                            <BattleStrengthBadge
                                result={strength.result}
                                loading={strength.loading}
                                compact
                                onRetry={strength.retry}
                            />
                        )}
                        <div
                            className="my-pokemon-stat-total"
                            title={
                                statsConflict
                                    ? t(
                                          'Resolve conflicting updates to show the current stat total.',
                                          'Pro zobrazení aktuálního součtu vyřešte konfliktní úpravy.',
                                      )
                                    : currentStatTotal === null
                                      ? t(
                                            'Record or correct all six battle stats at the current level in Growth history to show this total.',
                                            'Pro zobrazení součtu zapište nebo opravte v historii růstu všech šest bojových statistik na aktuální úrovni.',
                                        )
                                      : t(
                                            'Total of the latest recorded battle stats at the current level and form.',
                                            'Součet naposledy zaznamenaných bojových statistik na aktuální úrovni a v aktuální formě.',
                                        )
                            }
                        >
                            <strong>{currentStatTotal ?? '—'}</strong>
                            <span>{t('Curr.', 'Nyní')}</span>
                        </div>
                        <div
                            className="my-pokemon-stat-total"
                            title={t('Base stat total', 'Součet základních statistik')}
                        >
                            <strong>{species.data?.baseStatTotal ?? '—'}</strong>
                            <span>{t('Base', 'Základ')}</span>
                        </div>
                    </div>
                </div>
            </div>
            {earlierDrafts.length > 0 && (
                <section
                    className="my-inset my-stack"
                    aria-label={t(
                        'Unfinished stats from earlier forms',
                        'Rozepsané statistiky dřívějších forem',
                    )}
                >
                    <h3>
                        {t(
                            'Unfinished stats from earlier forms',
                            'Rozepsané statistiky dřívějších forem',
                        )}
                    </h3>
                    <p className="my-muted">
                        {t(
                            'Resume an entry to save it under its original form, or discard it.',
                            'Pokračujte v zápisu a uložte jej k původní formě, nebo jej zahoďte.',
                        )}
                    </p>
                    {earlierDrafts.map(({ key, value }) => {
                        const draftName =
                            family.find((entry) => entry.speciesId === value.speciesId)?.name ??
                            `#${value.speciesId}`;
                        return (
                            <div className="my-list-row" key={key}>
                                <span>
                                    {draftName} · Lv. {value.level || '—'}
                                </span>
                                <div className="my-actions">
                                    <button
                                        className="page-button"
                                        type="button"
                                        disabled={stateConflict}
                                        onClick={() => {
                                            setResumingDraftKey(key);
                                            setRecordingStats(true);
                                        }}
                                    >
                                        {t('Resume entry', 'Pokračovat v zápisu')}
                                    </button>
                                    <button
                                        className="my-text-button"
                                        type="button"
                                        disabled={isObservationDraftSaving(key)}
                                        onClick={() => {
                                            clearObservationDraft(key);
                                            if (resumingDraftKey === key) {
                                                setResumingDraftKey(undefined);
                                                setRecordingStats(false);
                                            }
                                        }}
                                    >
                                        {t('Discard entry', 'Zahodit záznam')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </section>
            )}
            {!onRecordingStatsChange && (
                <div className="my-actions">
                    <button
                        className="my-primary"
                        type="button"
                        disabled={stateConflict}
                        aria-expanded={isRecordingStats}
                        aria-controls={statsFormId}
                        onClick={() => setRecordingStats(!isRecordingStats)}
                    >
                        {hasDraft
                            ? t('Resume stats', 'Pokračovat v zápisu')
                            : t('Record stats', 'Zapsat statistiky')}
                    </button>
                </div>
            )}
            <div id={statsFormId} hidden={!isRecordingStats || stateConflict}>
                {isRecordingStats && !stateConflict && (
                    <ObservationForm
                        key={activeDraftKey}
                        draftKey={activeDraftKey}
                        pokemon={pokemon}
                        natureId={natureConflict ? null : pokemon.natureId}
                        observations={observations}
                        predictionsEnabled={!statsConflict}
                        family={family}
                        allowNextMember={Boolean(onRecordNext)}
                        onSave={async (entry, intent) => {
                            await recordObservation(entry);
                            if (intent !== 'another') {
                                setResumingDraftKey(undefined);
                                setRecordingStats(false);
                            }
                            if (intent === 'next-member') onRecordNext?.();
                        }}
                        onCancel={() => {
                            setResumingDraftKey(undefined);
                            setRecordingStats(false);
                        }}
                    />
                )}
            </div>
            {detail && (
                <div className="my-actions">
                    <button
                        className="my-text-button"
                        type="button"
                        disabled={stateConflict}
                        aria-expanded={showScreenshotQueue}
                        onClick={() => setShowScreenshotQueue(!showScreenshotQueue)}
                    >
                        {showScreenshotQueue
                            ? t('Close screenshot queue', 'Zavřít frontu snímků')
                            : t('Record from screenshots', 'Zapsat ze snímků')}
                    </button>
                </div>
            )}
            {showScreenshotQueue && !stateConflict && (
                <ScreenshotObservationQueue
                    pokemon={pokemon}
                    members={partyMembers}
                    observations={allObservations ?? observations}
                    family={family}
                    blockedPokemonIds={blockedRecordingIds}
                    predictionDisabledPokemonIds={
                        statsConflict
                            ? [...(predictionDisabledPokemonIds ?? []), pokemon.id]
                            : predictionDisabledPokemonIds
                    }
                    onSave={recordObservation}
                    onClose={() => setShowScreenshotQueue(false)}
                />
            )}
            <MyPokemonTraits
                pokemon={pokemon}
                species={species.data}
                stateConflict={stateConflict}
                natureConflict={natureConflict}
                abilityConflict={abilityConflict}
                onUpdate={onUpdate}
            />
            {stateConflict && (
                <p className="my-advice-highlight" role="status">
                    {t(
                        'This Pokémon has conflicting offline updates. Resolve them above before changing its level, moves or species; guidance is paused.',
                        'Tento Pokémon má konfliktní úpravy z více zařízení. Než změníte úroveň, útoky nebo druh, vyřešte je výše. Doporučení jsou pozastavena.',
                    )}
                </p>
            )}
            {savedNotice && !recap && (
                <p role="status" className="my-muted">
                    {t('Saved', 'Uloženo')}
                </p>
            )}
            {recapStorageError && (
                <p role="alert">
                    {t(
                        'Pending decisions are available until this page closes; browser storage is unavailable.',
                        'Nevyřízená rozhodnutí jsou dostupná do zavření stránky; úložiště prohlížeče není dostupné.',
                    )}
                </p>
            )}
            {recap && !stateConflict && species.data && (
                <CatchUpRecap
                    key={`${recap.formEpoch}-${recap.oldLevel}-${recap.newLevel}`}
                    details={species.data}
                    oldLevel={recap.oldLevel}
                    newLevel={recap.newLevel}
                    pokemon={pokemon}
                    datasetId={datasetId}
                    natureId={natureConflict ? null : pokemon.natureId}
                    observations={observations}
                    predictionsEnabled={!statsConflict}
                    moves={pokemon.state.moves}
                    onSave={async (changes) => {
                        await onUpdate((current) =>
                            applyCatchUpChanges(current, pokemon.state, changes),
                        );
                    }}
                    saveObservation={recordObservation}
                    onRecord={() => setRecordingStats(true)}
                    onClose={() => clearLevelReview(pokemon.id)}
                />
            )}
            <div className="my-card-view">
                <MyPokemonMovesWorkspace
                    pokemon={pokemon}
                    family={family}
                    paused={stateConflict}
                    previousLevel={recap?.oldLevel}
                    onUpdate={onUpdate}
                    showMoves={view === 'moves'}
                    actions={
                        <>
                            <button
                                className="my-wishlist-toggle"
                                type="button"
                                aria-label={t('Wanted moves', 'Požadované útoky')}
                                title={t('Wanted moves', 'Požadované útoky')}
                                aria-expanded={showWishlist}
                                aria-controls={wishlistPanelId}
                                onClick={() => setShowWishlist(!showWishlist)}
                            >
                                <WishIcon />
                            </button>
                            <a className="my-text-button" href={damageSimulatorHref(pokemon.id)}>
                                {t('Simulate damage', 'Simulovat poškození')} →
                            </a>
                        </>
                    }
                />
                {view === 'stats' && (
                    <div className="my-stat-graph-panel">
                        {statsConflict ? (
                            <p className="my-muted" role="status">
                                {t(
                                    'Resolve conflicting updates to view stat progression.',
                                    'Pro zobrazení vývoje statistik vyřešte konfliktní úpravy.',
                                )}
                            </p>
                        ) : (
                            <>
                                <MyPokemonCurrentStats
                                    pokemon={pokemon}
                                    observations={observations}
                                />
                                <MyPokemonStatsGraph
                                    pokemon={pokemon}
                                    natureId={natureConflict ? null : pokemon.natureId}
                                    observations={observations}
                                    family={family}
                                    compact={!detail}
                                />
                            </>
                        )}
                    </div>
                )}
                {view === 'matchups' && (
                    <div className="my-matchup-panels">
                        <MyPokemonTypeDefenses
                            species={species.data}
                            datasetId={datasetId}
                            mode="weaknesses"
                            conflict={stateConflict}
                        />
                        <MyPokemonTypeDefenses
                            species={species.data}
                            datasetId={datasetId}
                            mode="resistances"
                            conflict={stateConflict}
                        />
                    </div>
                )}
                {(view === 'stats' || view === 'history') && (
                    <MyPokemonHistory
                        pokemon={pokemon}
                        natureId={natureConflict || stateConflict ? null : pokemon.natureId}
                        observations={observations}
                        predictionsEnabled={!statsConflict}
                        family={family}
                        saveObservation={recordObservation}
                        onRecord={() => setRecordingStats(true)}
                        recentOnly={view === 'stats'}
                    />
                )}
            </div>
            <div id={wishlistPanelId} hidden={!showWishlist || view !== 'moves'}>
                {showWishlist && (
                    <MyPokemonWishlist
                        pokemon={pokemon}
                        family={family}
                        paused={stateConflict || wishlistConflict}
                        onLearnMove={(move) => requestMoveLearning(pokemon, move)}
                        onUpdate={onUpdate}
                    />
                )}
            </div>
            {!stateConflict && species.data && (
                <>
                    <MyPokemonMilestones
                        pokemon={pokemon}
                        details={species.data}
                        family={family}
                        wishlistPaused={wishlistConflict}
                        onUpdate={onUpdate}
                        onRecordEvolution={(speciesId) => {
                            const target = family.find((entry) => entry.speciesId === speciesId);
                            if (target) {
                                setNextSpecies(target);
                                setChangingSpecies(true);
                            }
                        }}
                    />
                    {detail && (
                        <details className="my-details">
                            <summary>
                                {t(
                                    'Evolution advice & move comparisons',
                                    'Rady k vývoji a porovnání útoků',
                                )}
                            </summary>
                            <EvolutionAdvice
                                pokemon={pokemon}
                                family={family}
                                party={partyMembers}
                                observations={observations}
                                wishlistPaused={wishlistConflict}
                                onUpdate={onUpdate}
                            />
                        </details>
                    )}
                </>
            )}
            {changingSpecies && !stateConflict && (
                <div className="my-inset my-stack">
                    {nextSpecies ? (
                        <>
                            <h4>
                                {name} → {nextSpecies.name}
                            </h4>
                            <p className="my-muted">
                                {t(
                                    'No evolution date or past level is required. Future stat observations start a new stage record.',
                                    'Datum vývoje ani minulá úroveň nejsou nutné. Další měření statistik začnou nové období formy.',
                                )}
                            </p>
                            <div className="my-actions">
                                <button
                                    className="my-primary"
                                    disabled={
                                        busy || nextSpecies.speciesId === pokemon.state.speciesId
                                    }
                                    type="button"
                                    onClick={() => {
                                        void perform(async () => {
                                            await onUpdate((current) => ({
                                                ...current,
                                                state: {
                                                    ...current.state,
                                                    speciesId: nextSpecies.speciesId,
                                                    formEpoch: crypto.randomUUID(),
                                                },
                                            }));
                                            setChangingSpecies(false);
                                            setNextSpecies(null);
                                            clearLevelReview(pokemon.id);
                                        });
                                    }}
                                >
                                    {t('Confirm species / form', 'Potvrdit druh / formu')}
                                </button>
                                <button
                                    className="page-button"
                                    type="button"
                                    onClick={() => setNextSpecies(null)}
                                >
                                    {t('Choose another', 'Vybrat jiný')}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="my-actions">
                                {family
                                    .filter((entry) => entry.speciesId !== pokemon.state.speciesId)
                                    .map((entry) => (
                                        <button
                                            className="page-button"
                                            key={entry.speciesId}
                                            type="button"
                                            onClick={() => setNextSpecies(entry)}
                                        >
                                            {entry.name}
                                        </button>
                                    ))}
                            </div>
                            <SpeciesPicker datasetId={datasetId} onSelect={setNextSpecies} />
                        </>
                    )}
                </div>
            )}
            {(species.isError || relatives.isError) && (
                <p className="my-muted" role="status">
                    {t(
                        'Some reference data is unavailable offline. Your saved Pokémon remains editable; reconnect for complete guidance.',
                        'Část referenčních dat není dostupná offline. Uloženého Pokémona lze upravovat. Pro úplná doporučení se připojte k internetu.',
                    )}
                    <button
                        className="my-text-button"
                        type="button"
                        onClick={() => {
                            void species.refetch();
                            void relatives.refetch();
                        }}
                    >
                        {t('Retry', 'Zkusit znovu')}
                    </button>
                </p>
            )}
            {detail && (
                <>
                    <details className="my-details my-pokemon-details">
                        <summary>{t('Pokémon details', 'Podrobnosti Pokémona')}</summary>
                        <div className="my-stack">
                            <NicknameEditor
                                key={pokemon.nickname}
                                value={pokemon.nickname}
                                onSave={async (nickname) => {
                                    await onUpdate((current) => ({ ...current, nickname }));
                                }}
                            />
                            <div>
                                <button
                                    className="page-button"
                                    type="button"
                                    disabled={stateConflict}
                                    onClick={() => {
                                        setChangingSpecies(!changingSpecies);
                                        setNextSpecies(null);
                                    }}
                                >
                                    {t('Record evolution / form', 'Zapsat vývoj / formu')}
                                </button>
                                <p className="my-muted">
                                    {t(
                                        'Record what happened in your game, or correct the species. Earlier stats keep their original form. Current moves are retained.',
                                        'Zapište změnu ve hře nebo opravte druh. Starší statistiky zůstanou přiřazené k původní formě. Aktuální útoky zůstanou zachovány.',
                                    )}
                                </p>
                            </div>
                        </div>
                    </details>
                    <div className="my-card-footer">
                        <button
                            className="page-button"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                void perform(onParty);
                            }}
                        >
                            {partyIndex >= 0
                                ? t('Remove from party', 'Odebrat z týmu')
                                : partySize >= 6
                                  ? t('Replace party member', 'Nahradit člena týmu')
                                  : t('Add to party', 'Přidat do týmu')}
                        </button>
                        {partyIndex >= 0 && (
                            <div className="my-actions">
                                <button
                                    className="page-button"
                                    type="button"
                                    disabled={busy || partyIndex === 0}
                                    aria-label={t(
                                        'Move earlier in party',
                                        'Přesunout v týmu dopředu',
                                    )}
                                    onClick={() => {
                                        void perform(() => onMove(-1));
                                    }}
                                >
                                    ↑
                                </button>
                                <button
                                    className="page-button"
                                    type="button"
                                    disabled={busy || partyIndex === partySize - 1}
                                    aria-label={t('Move later in party', 'Přesunout v týmu dozadu')}
                                    onClick={() => {
                                        void perform(() => onMove(1));
                                    }}
                                >
                                    ↓
                                </button>
                            </div>
                        )}
                        <button
                            className="my-text-button my-danger"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                void perform(onRemove);
                            }}
                        >
                            {t('Release from collection', 'Propustit ze sbírky')}
                        </button>
                    </div>
                </>
            )}
            {error && <p role="alert">{error}</p>}
        </article>
    );
    return (
        <MoveAffinityProvider stats={stateConflict ? undefined : species.data?.stats}>
            <MovePowerProvider
                stats={statsConflict ? {} : getCurrentStats(pokemon, observations)}
                typeIds={stateConflict ? undefined : species.data?.typeIds}
            >
                {card}
            </MovePowerProvider>
        </MoveAffinityProvider>
    );
}
