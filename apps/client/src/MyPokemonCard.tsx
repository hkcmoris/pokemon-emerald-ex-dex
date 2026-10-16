import { useId, useState, type SubmitEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getCatchUpRecap,
    getEvolutionConditions,
    getEvolutionGuidance,
    type EvolutionMoveAdvice,
    type KnownMove,
    type OwnedPokemon,
    type Pokemon,
    type SpeciesDetails,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionFamily, loadCollectionSpecies } from './collectionSpecies.js';
import { getCurrentStats, getCurrentStatTotal } from './collectionStats.js';
import { useLanguage } from './language.js';
import { evolutionConditionLabel, evolutionSummary } from './evolutionText.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { damageSimulatorHref, ownedPokemonHref, speciesHref } from './navigation.js';
import { MovesEditor, SpeciesPicker } from './MyPokemonForms.js';
import { MyPokemonHistory, ObservationForm } from './MyPokemonHistory.js';
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

function LevelEditor({
    value,
    disabled,
    onSave,
}: {
    value: number;
    disabled: boolean;
    onSave: (level: number) => Promise<void>;
}) {
    const { t } = useLanguage();
    const [level, setLevel] = useState(String(value));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nextLevel = Number(level);
    const valid = Number.isInteger(nextLevel) && nextLevel >= 1 && nextLevel <= 100;
    const changed = nextLevel !== value;
    function step(direction: -1 | 1) {
        const current = valid ? nextLevel : value;
        setLevel(String(Math.max(1, Math.min(100, current + direction))));
        setError(null);
    }
    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (disabled || busy || !valid || !changed) return;
        setError(null);
        setBusy(true);
        try {
            await onSave(nextLevel);
        } catch {
            setError(
                t(
                    'Could not save the level. Try again.',
                    'Úroveň se nepodařilo uložit. Zkuste to znovu.',
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <form
            className="my-level-editor"
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <div className="my-level-controls">
                {changed && (
                    <button
                        className="my-level-save"
                        disabled={disabled || busy || !valid}
                        type="submit"
                        aria-label={t('Save level', 'Uložit úroveň')}
                        title={t('Save level', 'Uložit úroveň')}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m5 12 4 4L19 6" />
                        </svg>
                    </button>
                )}
                <label className="my-level-display">
                    <span aria-hidden="true">LV.</span>
                    <input
                        aria-label={t('Level', 'Úroveň')}
                        style={{ width: `${Math.max(2, Math.min(3, level.length))}ch` }}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="100"
                        step="1"
                        required
                        value={level}
                        onChange={(event) => {
                            setLevel(event.target.value);
                            setError(null);
                        }}
                        disabled={disabled || busy}
                    />
                </label>
                <div className="my-level-arrows">
                    <button
                        type="button"
                        aria-label={t('Increase level', 'Zvýšit úroveň')}
                        title={t('Increase level', 'Zvýšit úroveň')}
                        disabled={disabled || busy || (valid && nextLevel >= 100)}
                        onClick={() => step(1)}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m6 15 6-6 6 6" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        aria-label={t('Decrease level', 'Snížit úroveň')}
                        title={t('Decrease level', 'Snížit úroveň')}
                        disabled={disabled || busy || (valid && nextLevel <= 1)}
                        onClick={() => step(-1)}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </button>
                </div>
            </div>
            {error && <p role="alert">{error}</p>}
        </form>
    );
}

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

export function CatchUpRecap({
    pokemon,
    natureId = pokemon.natureId,
    observations = [],
    predictionsEnabled = true,
    details,
    oldLevel,
    newLevel,
    moves,
    onSaveMoves,
    saveObservation,
    onClose,
}: {
    pokemon: OwnedPokemon;
    natureId?: number | null;
    observations?: readonly StatObservation[];
    predictionsEnabled?: boolean;
    details: SpeciesDetails;
    oldLevel: number;
    newLevel: number;
    moves: KnownMove[] | null;
    onSaveMoves: (moves: KnownMove[]) => Promise<void>;
    saveObservation: (observation: StatObservation) => Promise<void>;
    onClose: () => void;
}) {
    const { t, language } = useLanguage();
    const recap = getCatchUpRecap(details, oldLevel, newLevel);
    const statsFormId = useId();
    const [recordingStats, setRecordingStats] = useState(false);
    const [selected, setSelected] = useState<KnownMove[]>(moves ?? []);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    async function save() {
        setBusy(true);
        setError(null);
        try {
            await onSaveMoves(selected);
            onClose();
        } catch {
            setError(t('Could not save selected moves.', 'Vybrané útoky se nepodařilo uložit.'));
        } finally {
            setBusy(false);
        }
    }
    return (
        <section
            className="my-recap my-stack"
            aria-label={t('Optional catch-up recap', 'Volitelný přehled změn')}
        >
            <div className="my-section-heading flex-wrap">
                <h3>
                    {t('Level saved', 'Úroveň uložena')} · {oldLevel} → {newLevel}
                </h3>
                <div className="my-actions">
                    <button
                        className="page-button"
                        type="button"
                        aria-expanded={recordingStats}
                        aria-controls={statsFormId}
                        onClick={() => setRecordingStats(!recordingStats)}
                    >
                        {t('Record stats', 'Zapsat statistiky')}
                    </button>
                    <button className="my-text-button" type="button" onClick={onClose}>
                        {t('Skip recap', 'Přeskočit přehled')}
                    </button>
                </div>
            </div>
            <div id={statsFormId} hidden={!recordingStats}>
                {recordingStats && (
                    <ObservationForm
                        key={`${pokemon.state.speciesId}-${pokemon.state.formEpoch}-${pokemon.state.level}`}
                        pokemon={pokemon}
                        natureId={natureId}
                        observations={observations}
                        predictionsEnabled={predictionsEnabled}
                        onSave={async (entry) => {
                            await saveObservation(entry);
                            setRecordingStats(false);
                        }}
                        onCancel={() => setRecordingStats(false)}
                    />
                )}
            </div>
            <p className="my-muted">
                {t(
                    'These opportunities assume this species throughout the interval. If you evolved during it, check the timing. Species and moves stay unchanged until you record them.',
                    'Tyto možnosti předpokládají stejný druh po celé období. Pokud došlo k vývoji, ověřte načasování. Druh ani útoky se bez vašeho záznamu nemění.',
                )}
            </p>
            {recap.moves.length === 0 && recap.evolutions.length === 0 && (
                <p>
                    {t(
                        'No new opportunities recorded in this interval.',
                        'V tomto období nejsou zaznamenány nové možnosti.',
                    )}
                </p>
            )}
            {recap.moves.length > 0 && (
                <>
                    <h4>{t('Did you learn any of these?', 'Naučil se některý z těchto útoků?')}</h4>
                    <p className="my-muted">
                        {t(
                            'Select your current moves, up to four. Remove an old move if needed.',
                            'Vyberte až čtyři aktuální útoky. Podle potřeby odeberte starý útok.',
                        )}
                    </p>
                    <div className="my-move-chips">
                        {selected.map((move) => (
                            <MyPokemonMove
                                as="button"
                                key={move.moveId}
                                move={move}
                                reference={findReferenceMove(move.moveId, [details])}
                                suffix={<span aria-hidden="true">×</span>}
                                onClick={() =>
                                    setSelected(
                                        selected.filter((entry) => entry.moveId !== move.moveId),
                                    )
                                }
                            />
                        ))}
                    </div>
                    {recap.moves.map((move) => (
                        <MyPokemonMove
                            as="label"
                            className="my-check"
                            key={`${move.moveId}-${move.level}`}
                            move={move}
                            reference={move}
                            prefix={
                                <input
                                    type="checkbox"
                                    checked={selected.some((entry) => entry.moveId === move.moveId)}
                                    disabled={
                                        selected.length >= 4 &&
                                        !selected.some((entry) => entry.moveId === move.moveId)
                                    }
                                    onChange={(event) =>
                                        setSelected(
                                            event.target.checked
                                                ? [
                                                      ...selected,
                                                      { moveId: move.moveId, name: move.name },
                                                  ]
                                                : selected.filter(
                                                      (entry) => entry.moveId !== move.moveId,
                                                  ),
                                        )
                                    }
                                />
                            }
                            suffix={<span className="my-level-badge">Lv. {move.level}</span>}
                        />
                    ))}
                    <button
                        className="my-primary"
                        disabled={busy}
                        type="button"
                        onClick={() => {
                            void save();
                        }}
                    >
                        {t('Save chosen current moves', 'Uložit vybrané aktuální útoky')}
                    </button>
                </>
            )}
            {recap.evolutions.map(({ evolution, condition, note }, index) => (
                <p key={index}>
                    <strong>→ {evolution.toName}</strong> ·{' '}
                    {evolutionSummary(evolution.summary, language)}
                    <small className="my-block">
                        {t(
                            note,
                            condition === 'level-met'
                                ? 'Požadované úrovně dosaženo; potvrďte, zda vývoj skutečně proběhl.'
                                : `Ostatní podmínky je nutné ověřit: ${evolutionSummary(evolution.summary, 'cs')}`,
                        )}
                    </small>
                </p>
            ))}
            {recap.evolutions.length > 0 && (
                <p className="my-muted">
                    {t(
                        'If you evolved, use “Record evolution / form” in this Pokémon’s details.',
                        'Pokud došlo k vývoji, použijte v podrobnostech volbu „Zapsat vývoj / formu“.',
                    )}
                </p>
            )}
            {error && <p role="alert">{error}</p>}
        </section>
    );
}

export function MyPokemonCard({
    pokemon,
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
}: {
    pokemon: OwnedPokemon;
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
    const [editingMoves, setEditingMoves] = useState(false);
    const wishlistPanelId = useId();
    const [showWishlist, setShowWishlist] = useState(false);
    const [changingSpecies, setChangingSpecies] = useState(false);
    const [nextSpecies, setNextSpecies] = useState<Pokemon | null>(null);
    const [recap, setRecap] = useState<{
        details: SpeciesDetails;
        oldLevel: number;
        newLevel: number;
    } | null>(null);
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
    async function saveMoves(moves: KnownMove[] | null) {
        await onUpdate((current) => ({ ...current, state: { ...current.state, moves } }));
        setEditingMoves(false);
    }
    async function levelChange(level: number) {
        const previous = pokemon.state.level;
        await onUpdate((current) => ({ ...current, state: { ...current.state, level } }));
        if (level > previous && species.data)
            setRecap({ details: species.data, oldLevel: previous, newLevel: level });
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
                <div className="flex flex-col justify-between">
                    <LevelEditor
                        key={pokemon.state.level}
                        value={pokemon.state.level}
                        disabled={stateConflict}
                        onSave={levelChange}
                    />
                    <div className="flex justify-between">
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
            {recap && !stateConflict && (
                <CatchUpRecap
                    {...recap}
                    pokemon={pokemon}
                    natureId={natureConflict ? null : pokemon.natureId}
                    observations={observations}
                    predictionsEnabled={!statsConflict}
                    moves={pokemon.state.moves}
                    onSaveMoves={saveMoves}
                    saveObservation={saveObservation}
                    onClose={() => setRecap(null)}
                />
            )}
            <div className="my-card-view">
                <div className="my-current-moves" hidden={view !== 'moves'}>
                    <div className="my-section-heading">
                        <h3>{t('Current moves', 'Aktuální útoky')}</h3>
                        <div className="my-actions">
                            <button
                                className="my-text-button"
                                type="button"
                                disabled={stateConflict}
                                onClick={() => {
                                    setEditingMoves(!editingMoves);
                                    setShowWishlist(false);
                                }}
                            >
                                {t('Edit', 'Upravit')}
                            </button>
                            <button
                                className="my-wishlist-toggle"
                                type="button"
                                aria-label={t('Wanted moves', 'Požadované útoky')}
                                title={t('Wanted moves', 'Požadované útoky')}
                                aria-expanded={showWishlist}
                                aria-controls={wishlistPanelId}
                                onClick={() => {
                                    setShowWishlist(!showWishlist);
                                    setEditingMoves(false);
                                }}
                            >
                                <WishIcon />
                            </button>
                        </div>
                    </div>
                    <ul
                        className="my-move-grid"
                        aria-label={
                            pokemon.state.moves?.length === 0
                                ? t(
                                      'No moves recorded as known',
                                      'Žádné útoky nejsou označeny jako známé',
                                  )
                                : undefined
                        }
                    >
                        {Array.from({ length: 4 }, (_, slot) => {
                            const move = pokemon.state.moves?.[slot];
                            return move ? (
                                <MyPokemonMove
                                    as="li"
                                    key={slot}
                                    move={move}
                                    reference={findReferenceMove(move.moveId, family)}
                                    showStats
                                />
                            ) : (
                                <li className="my-move my-move-detailed my-move-empty" key={slot}>
                                    <span
                                        className={
                                            pokemon.state.moves === null ? undefined : 'sr-only'
                                        }
                                    >
                                        {pokemon.state.moves === null
                                            ? t('Not recorded', 'Nezaznamenány')
                                            : t(
                                                  'Free move slot ' + (slot + 1),
                                                  'Volné místo pro útok ' + (slot + 1),
                                              )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    <a
                        className="my-text-button mt-3 inline-block"
                        href={damageSimulatorHref(pokemon.id)}
                    >
                        {t('Simulate damage', 'Simulovat poškození')} →
                    </a>
                </div>
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
                            <MyPokemonStatsGraph
                                pokemon={pokemon}
                                natureId={natureConflict ? null : pokemon.natureId}
                                observations={observations}
                                family={family}
                                compact={!detail}
                            />
                        )}
                    </div>
                )}
                {(view === 'weaknesses' || view === 'resistances') && (
                    <MyPokemonTypeDefenses
                        species={species.data}
                        datasetId={datasetId}
                        mode={view}
                        conflict={stateConflict}
                    />
                )}
            </div>
            {editingMoves && !stateConflict && (
                <div hidden={view !== 'moves'}>
                    <MovesEditor
                        key={JSON.stringify(pokemon.state.moves)}
                        moves={pokemon.state.moves}
                        family={family}
                        onSave={saveMoves}
                        onCancel={() => setEditingMoves(false)}
                    />
                </div>
            )}
            <div id={wishlistPanelId} hidden={!showWishlist || view !== 'moves'}>
                {showWishlist && (
                    <MyPokemonWishlist
                        pokemon={pokemon}
                        family={family}
                        paused={stateConflict || wishlistConflict}
                        onUpdate={onUpdate}
                    />
                )}
            </div>
            {!stateConflict &&
                species.data &&
                (detail ? (
                    <EvolutionAdvice
                        pokemon={pokemon}
                        family={family}
                        party={partyMembers}
                        observations={observations}
                        wishlistPaused={wishlistConflict}
                        onUpdate={onUpdate}
                    />
                ) : (
                    <MyPokemonMilestones
                        pokemon={pokemon}
                        details={species.data}
                        family={family}
                        wishlistPaused={wishlistConflict}
                        onUpdate={onUpdate}
                    />
                ))}
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
                    <details className="my-details my-pokemon-details" open>
                        <summary>
                            {t('Details, evolution & growth', 'Podrobnosti, vývoj a růst')}
                        </summary>
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
                                                        busy ||
                                                        nextSpecies.speciesId ===
                                                            pokemon.state.speciesId
                                                    }
                                                    type="button"
                                                    onClick={() => {
                                                        void perform(async () => {
                                                            await onUpdate((current) => ({
                                                                ...current,
                                                                state: {
                                                                    ...current.state,
                                                                    speciesId:
                                                                        nextSpecies.speciesId,
                                                                    formEpoch: crypto.randomUUID(),
                                                                },
                                                            }));
                                                            setChangingSpecies(false);
                                                            setNextSpecies(null);
                                                            setRecap(null);
                                                        });
                                                    }}
                                                >
                                                    {t(
                                                        'Confirm species / form',
                                                        'Potvrdit druh / formu',
                                                    )}
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
                                                    .filter(
                                                        (entry) =>
                                                            entry.speciesId !==
                                                            pokemon.state.speciesId,
                                                    )
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
                                            <SpeciesPicker
                                                datasetId={datasetId}
                                                onSelect={setNextSpecies}
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                            <MyPokemonHistory
                                pokemon={pokemon}
                                natureId={natureConflict || stateConflict ? null : pokemon.natureId}
                                observations={observations}
                                predictionsEnabled={!statsConflict}
                                family={family}
                                saveObservation={saveObservation}
                            />
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
