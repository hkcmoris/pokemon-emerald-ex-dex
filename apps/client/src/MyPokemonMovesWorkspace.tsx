import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { KnownMove, OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { useLanguage, type Translate } from './language.js';
import { MyPokemonMove, findReferenceMove } from './MyPokemonMove.js';
import { searchCollectionMoves } from './collectionSpecies.js';
import { ReorderList } from './ReorderList.js';
import { getMoveCandidates, type MoveCandidate } from './moveCandidates.js';
import {
    applyMoveChoice,
    clearMoveChoice,
    moveChoiceContext,
    moveChoiceIsCurrent,
    moveChoicesAreDurable,
    replaceKnownMove,
    requestMoveReplacement,
    setMoveChoice,
    takeAutomaticMoveChoice,
    runMoveChoiceSave,
    useMoveChoice,
    useMoveChoiceSaving,
    type MoveChoice,
} from './moveChoices.js';

function sourceLabel(candidate: MoveCandidate, level: number, t: Translate): string {
    const source = candidate.source;
    if (!source)
        return t('Check how this move was learned.', 'Ověřte způsob naučení tohoto útoku.');
    if (source.machine)
        return `${source.species} · ${source.machine} · ${t('if you have it', 'pokud jej máte')}`;
    if (source.level === 0)
        return `${source.species} · ${t('on evolution; verify it happened', 'při vývoji; ověřte, že proběhl')}`;
    const timing = !source.currentForm
        ? t('another form', 'jiná forma')
        : (source.level ?? 0) > level
          ? t('future level', 'budoucí úroveň')
          : (source.level ?? 0) < level
            ? t('earlier level; check access', 'dřívější úroveň; ověřte dostupnost')
            : t('this level', 'tato úroveň');
    return `${source.species} · Lv. ${source.level} · ${timing}`;
}

export function MyPokemonMovesWorkspace({
    pokemon,
    family,
    paused = false,
    showMoves = true,
    actions,
    onUpdate,
    previousLevel,
}: {
    pokemon: OwnedPokemon;
    family: readonly SpeciesDetails[];
    paused?: boolean;
    showMoves?: boolean;
    actions?: ReactNode;
    previousLevel?: number;
    onUpdate: (updater: (current: OwnedPokemon) => OwnedPokemon) => Promise<void>;
}) {
    const { t } = useLanguage();
    const id = useId();
    const choice = useMoveChoice(pokemon.id);
    const pickerRef = useRef<HTMLElement>(null);
    const [localBusy, setBusy] = useState(false);
    const saving = useMoveChoiceSaving(pokemon.id);
    const busy = localBusy || saving;
    const [error, setError] = useState<string>();
    const [limit, setLimit] = useState(16);
    const [undo, setUndo] = useState<{ context: MoveChoice; moves: KnownMove[] | null }>();
    const moves = pokemon.state.moves ?? [];
    const stale = choice && !moveChoiceIsCurrent(pokemon, choice);
    const search = useQuery({
        queryKey: ['collection-move-search', choice?.query.trim() ?? ''],
        queryFn: () => searchCollectionMoves(choice?.query.trim() ?? ''),
        enabled: Boolean(choice && !choice.candidate && choice.query.trim().length > 0),
    });
    const candidates = getMoveCandidates(pokemon, family, search.data, previousLevel).filter(
        (candidate) =>
            candidate.name
                .toLocaleLowerCase()
                .includes(choice?.query.trim().toLocaleLowerCase() ?? ''),
    );
    const groups: Record<MoveCandidate['group'], string> = {
        reached: t('Recently reached moves', 'Nově dosažené útoky'),
        wanted: t('Wanted moves', 'Požadované útoky'),
        level: t('Earlier level-up moves', 'Útoky z dřívějších úrovní'),
        machine: t('Machines for this form', 'Stroje pro tuto formu'),
        other: t('Other moves · verify access', 'Další útoky · ověřte dostupnost'),
    };
    const pickerKey = choice
        ? `${choice.pokemonId}:${choice.targetMoveId ?? 'add'}:${choice.candidate?.moveId ?? 'search'}`
        : undefined;
    useEffect(() => {
        if (!pickerKey) return;
        if (choice?.candidate && (choice.moves?.length ?? 0) < 4) return;
        pickerRef.current?.scrollIntoView({ block: 'nearest' });
        pickerRef.current
            ?.querySelector<HTMLInputElement>('input[type="search"]')
            ?.focus({ preventScroll: true });
    }, [pickerKey]);
    useEffect(() => {
        if (!choice?.candidate || paused || stale || !takeAutomaticMoveChoice(choice)) return;
        void save(choice, replaceKnownMove(choice, choice.candidate));
    }, [choice, paused, stale]);
    async function save(
        context: MoveChoice,
        next: KnownMove[] | null,
        closePicker = true,
        recordUndo = true,
    ): Promise<void> {
        setBusy(true);
        setError(undefined);
        try {
            const saved = await runMoveChoiceSave(pokemon.id, () =>
                onUpdate((current) => applyMoveChoice(current, context, next)),
            );
            if (!saved) return;
            setUndo(
                recordUndo
                    ? { context: { ...context, moves: next }, moves: context.moves }
                    : undefined,
            );
            if (closePicker) clearMoveChoice(pokemon.id, context);
        } catch {
            setError(
                t(
                    'Moves could not be saved. Your choice is kept; check for another update and try again.',
                    'Útoky se nepodařilo uložit. Výběr zůstává rozepsaný; ověřte další změny a zkuste to znovu.',
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    function choose(candidate: KnownMove, targetMoveId = choice?.targetMoveId): void {
        if (!choice || paused || busy || stale) return;
        void save(choice, replaceKnownMove(choice, candidate, targetMoveId));
    }
    return (
        <section className="my-moves-workspace" aria-label={t('Current moves', 'Aktuální útoky')}>
            {showMoves && (
                <>
                    <div className="my-section-heading">
                        <h3>{t('Current moves', 'Aktuální útoky')}</h3>
                        <div className="my-actions">
                            {actions}
                            {pokemon.state.moves !== null && (
                                <details className="my-move-more">
                                    <summary>{t('More', 'Další')}</summary>
                                    <button
                                        type="button"
                                        className="page-button"
                                        disabled={paused || busy}
                                        onClick={() => {
                                            void save(moveChoiceContext(pokemon), null, false);
                                        }}
                                    >
                                        {t(
                                            'Mark moves unrecorded',
                                            'Označit útoky jako nezaznamenané',
                                        )}
                                    </button>
                                </details>
                            )}
                        </div>
                    </div>
                    {pokemon.state.moves === null && (
                        <p className="my-muted">
                            {t(
                                'Moves have not been recorded yet.',
                                'Útoky zatím nejsou zaznamenány.',
                            )}
                        </p>
                    )}
                    <ReorderList
                        items={moves.map((move) => ({ id: String(move.moveId), label: move.name }))}
                        label={t('Current move order', 'Pořadí aktuálních útoků')}
                        className="my-moves-reorder"
                        layout="grid"
                        disabled={paused || busy}
                        onReorder={async (ids) => {
                            const context = moveChoiceContext(pokemon);
                            const next = ids.map((moveId) =>
                                moves.find((move) => String(move.moveId) === moveId)!,
                            );
                            if (next.some((move) => !move) || next.length !== moves.length)
                                throw new Error('moves-changed');
                            await onUpdate((current) => applyMoveChoice(current, context, next));
                            setUndo(undefined);
                        }}
                        renderItem={(item, controls) => {
                            const slot = moves.findIndex((move) => String(move.moveId) === item.id);
                            const move = moves[slot];
                            return (
                                <div className="my-move-slot">
                                    {controls}
                                    <span
                                        className="my-move-slot-number"
                                        aria-label={t(
                                            `Move slot ${slot + 1}`,
                                            `Pozice útoku ${slot + 1}`,
                                        )}
                                    >
                                        {slot + 1}
                                    </span>
                                    <MyPokemonMove
                                        move={move}
                                        reference={findReferenceMove(move.moveId, family)}
                                        showStats
                                    />
                                    <div className="my-move-slot-actions">
                                        <button
                                            type="button"
                                            className="page-button"
                                            disabled={paused || busy}
                                            aria-label={t(
                                                `Replace ${move.name}`,
                                                `Nahradit ${move.name}`,
                                            )}
                                            onClick={() => {
                                                setError(undefined);
                                                setLimit(16);
                                                requestMoveReplacement(pokemon, move.moveId);
                                            }}
                                        >
                                            {t('Replace', 'Nahradit')}
                                        </button>
                                        <details className="my-move-more">
                                            <summary
                                                aria-label={t(
                                                    `More actions for ${move.name}`,
                                                    `Další akce pro ${move.name}`,
                                                )}
                                            >
                                                ⋯
                                            </summary>
                                            <button
                                                type="button"
                                                className="page-button"
                                                disabled={paused || busy}
                                                onClick={() => {
                                                    void save(
                                                        moveChoiceContext(pokemon),
                                                        moves.filter(
                                                            (entry) => entry.moveId !== move.moveId,
                                                        ),
                                                        false,
                                                    );
                                                }}
                                            >
                                                {t('Remove', 'Odebrat')}
                                            </button>
                                        </details>
                                    </div>
                                </div>
                            );
                        }}
                    />
                    {moves.length < 4 && (
                        <button
                            className="my-add-move"
                            type="button"
                            disabled={paused || busy}
                            onClick={() => {
                                setError(undefined);
                                setLimit(16);
                                requestMoveReplacement(pokemon);
                            }}
                        >
                            ＋ {t('Add move', 'Přidat útok')} <span>{moves.length}/4</span>
                        </button>
                    )}
                </>
            )}
            {choice && (
                <section
                    className="my-move-picker my-inset my-stack"
                    aria-labelledby={`${id}-picker`}
                    ref={pickerRef}
                >
                    <div className="my-section-heading">
                        <h4 id={`${id}-picker`}>
                            {choice.candidate
                                ? t(
                                      `Record learning ${choice.candidate.name}`,
                                      `Zapsat naučení ${choice.candidate.name}`,
                                  )
                                : choice.targetMoveId
                                  ? t('Replace a move', 'Nahradit útok')
                                  : t('Add a move', 'Přidat útok')}
                        </h4>
                        <button
                            type="button"
                            className="my-text-button"
                            disabled={busy}
                            onClick={() => clearMoveChoice(pokemon.id)}
                        >
                            {t('Cancel', 'Zrušit')}
                        </button>
                    </div>
                    {!moveChoicesAreDurable() && (
                        <p role="status">
                            {t(
                                'Browser storage is unavailable. This choice lasts only until you close the page.',
                                'Úložiště prohlížeče není dostupné. Výběr zůstane zachován pouze do zavření stránky.',
                            )}
                        </p>
                    )}
                    {stale ? (
                        <div className="my-stack" role="status">
                            <p>
                                {t(
                                    'This Pokémon’s moves or form changed. Review the current moves before continuing.',
                                    'Útoky nebo forma tohoto Pokémona se změnily. Před pokračováním zkontrolujte aktuální útoky.',
                                )}
                            </p>
                            <button
                                type="button"
                                className="page-button"
                                disabled={paused || busy}
                                onClick={() =>
                                    setMoveChoice({
                                        ...moveChoiceContext(pokemon),
                                        ...(choice.candidate
                                            ? { candidate: choice.candidate }
                                            : {}),
                                        query: choice.query,
                                    })
                                }
                            >
                                {t('Use current moves', 'Použít aktuální útoky')}
                            </button>
                        </div>
                    ) : paused ? (
                        <p role="status">
                            {t(
                                'Resolve the Pokémon sync conflict before recording moves.',
                                'Před zapsáním útoků vyřešte konflikt synchronizace Pokémona.',
                            )}
                        </p>
                    ) : choice.candidate ? (
                        <>
                            <MyPokemonMove
                                move={choice.candidate}
                                reference={findReferenceMove(choice.candidate.moveId, family)}
                                showStats
                            />
                            <p className="my-muted">
                                {t(
                                    'Record only a move that was actually learned in the game.',
                                    'Zapište pouze útok, který se Pokémon skutečně naučil ve hře.',
                                )}
                            </p>
                            {moves.some((move) => move.moveId === choice.candidate!.moveId) ? (
                                <p role="status">
                                    {t(
                                        'This move is already recorded.',
                                        'Tento útok už je zaznamenán.',
                                    )}
                                </p>
                            ) : (
                                <div className="my-move-replacement-options">
                                    {moves.length < 4 && (
                                        <button
                                            type="button"
                                            className="my-primary"
                                            disabled={busy}
                                            onClick={() => choose(choice.candidate!)}
                                        >
                                            {t('Add to free slot', 'Přidat na volné místo')}
                                        </button>
                                    )}
                                    {moves.map((move) => (
                                        <button
                                            type="button"
                                            className="page-button"
                                            key={move.moveId}
                                            disabled={busy}
                                            onClick={() => choose(choice.candidate!, move.moveId)}
                                        >
                                            {t(`Replace ${move.name}`, `Nahradit ${move.name}`)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <label className="filter-label">
                                {t('Find a move', 'Najít útok')}
                                <input
                                    type="search"
                                    className="filter-input"
                                    value={choice.query}
                                    disabled={busy}
                                    onChange={(event) => {
                                        setLimit(16);
                                        setMoveChoice({ ...choice, query: event.target.value });
                                    }}
                                />
                            </label>
                            {search.isError && (
                                <p role="status" className="my-muted">
                                    {t(
                                        'Search is unavailable. Showing moves from the loaded evolution family.',
                                        'Vyhledávání není dostupné. Zobrazeny jsou útoky z načtené vývojové rodiny.',
                                    )}
                                </p>
                            )}
                            <ul className="my-direct-move-candidates">
                                {candidates.slice(0, limit).map((candidate, index, visible) => (
                                    <li key={candidate.moveId}>
                                        {(index === 0 ||
                                            candidate.group !== visible[index - 1].group) && (
                                            <h5>{groups[candidate.group]}</h5>
                                        )}
                                        <div className="my-direct-move-option">
                                            <MyPokemonMove
                                                move={candidate}
                                                reference={candidate.reference}
                                                showStats
                                            />
                                            <button
                                                type="button"
                                                className="page-button"
                                                disabled={
                                                    busy ||
                                                    moves.some(
                                                        (move) => move.moveId === candidate.moveId,
                                                    )
                                                }
                                                aria-label={t(
                                                    `Choose ${candidate.name}`,
                                                    `Vybrat ${candidate.name}`,
                                                )}
                                                onClick={() => choose(candidate)}
                                            >
                                                {moves.some(
                                                    (move) => move.moveId === candidate.moveId,
                                                )
                                                    ? t('Known', 'Známý')
                                                    : t('Choose', 'Vybrat')}
                                            </button>
                                        </div>
                                        <p className="my-muted">
                                            {sourceLabel(candidate, pokemon.state.level, t)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                            {candidates.length === 0 && (
                                <p className="my-muted">
                                    {t(
                                        'No matching moves. Try searching by name.',
                                        'Žádné odpovídající útoky. Zkuste hledat podle názvu.',
                                    )}
                                </p>
                            )}
                            {candidates.length > limit && (
                                <button
                                    type="button"
                                    className="page-button"
                                    onClick={() => setLimit(limit + 16)}
                                >
                                    {t('Show more moves', 'Zobrazit další útoky')}
                                </button>
                            )}
                        </>
                    )}
                </section>
            )}
            {error && <p role="alert">{error}</p>}
            {undo && moveChoiceIsCurrent(pokemon, undo.context) && (
                <div className="my-moves-saved" role="status">
                    <span>{t('Moves saved', 'Útoky uloženy')}</span>
                    <button
                        type="button"
                        className="my-text-button"
                        disabled={busy || paused}
                        onClick={() => {
                            void save(undo.context, undo.moves, false, false);
                        }}
                    >
                        {t('Undo', 'Zpět')}
                    </button>
                </div>
            )}
        </section>
    );
}
