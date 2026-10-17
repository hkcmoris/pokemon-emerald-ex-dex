import { useId, useMemo, useState, type ReactNode } from 'react';
import {
    assessMoveWishlistAddition,
    planMoveWishlist,
    recordLearnedWishlistMoves,
    type KnownMove,
    type Move,
    type MovePlanSource,
    type OwnedPokemon,
    type SpeciesDetails,
} from '@pokemon-emerald-ex-dex/shared';

import { MyPokemonMove, MyPokemonMoveStats, findReferenceMove } from './MyPokemonMove.js';
import { useLanguage, type Translate } from './language.js';
import { evolutionSummary } from './evolutionText.js';
import { setWishlistMove } from './moveWishlistActions.js';
import { moveAffinityLabel, useMoveAffinity } from './MoveAffinity.js';
import { MoveEffectBadges } from './MoveEffectBadges.js';

function WishlistTimelineStep({ move, children }: { move?: Move; children: ReactNode }) {
    const { t } = useLanguage();
    const affinity = useMoveAffinity(move);
    const label = moveAffinityLabel(affinity, t);
    return (
        <li
            className={affinity ? 'my-move-affinity' : undefined}
            data-affinity={affinity ?? undefined}
            title={label}
        >
            {label && <span className="sr-only">{label}</span>}
            {children}
        </li>
    );
}

function sourceLabel(
    source: MovePlanSource,
    family: readonly SpeciesDetails[],
    t: Translate,
): string {
    const name =
        family.find((species) => species.speciesId === source.speciesId)?.name ??
        `#${source.speciesId}`;
    if (source.kind === 'evolution')
        return t(
            `${name} · on evolution at Lv. ${source.level}`,
            `${name} · při vývoji na Lv. ${source.level}`,
        );
    return source.kind === 'machine'
        ? t(
              `${name} · ${source.machine}, if you have it`,
              `${name} · ${source.machine}, pokud jej máte`,
          )
        : `${name} · Lv. ${source.level}`;
}

export function MyPokemonWishlist({
    pokemon,
    family,
    paused = false,
    onUpdate,
    onLearnMove,
}: {
    pokemon: OwnedPokemon;
    family: readonly SpeciesDetails[];
    paused?: boolean;
    onUpdate: (updater: (current: OwnedPokemon) => OwnedPokemon) => Promise<void>;
    onLearnMove?: (move: KnownMove) => void;
}) {
    const { t, language } = useLanguage();
    const id = useId();
    const [query, setQuery] = useState('');
    const [pickerOpen, setPickerOpen] = useState((pokemon.moveWishlist?.moves.length ?? 0) === 0);
    const [limit, setLimit] = useState(16);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const details = useMemo(
        () => Object.fromEntries(family.map((species) => [species.speciesId, species])),
        [family],
    );
    const plan = useMemo(() => planMoveWishlist(pokemon, details, { t }), [pokemon, details, t]);
    const wishlist = pokemon.moveWishlist?.moves ?? [];
    const candidates = useMemo(() => {
        const moves = new Map<number, KnownMove>();
        for (const species of family) {
            for (const move of [...species.learnset, ...species.machines])
                moves.set(move.moveId, { moveId: move.moveId, name: move.name });
        }
        return [...moves.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [family]);
    const filtered = candidates.filter(
        (move) =>
            !wishlist.some((wanted) => wanted.moveId === move.moveId) &&
            move.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    );
    const visible = useMemo(
        () =>
            filtered.slice(0, limit).map((move) => ({
                move,
                assessment: assessMoveWishlistAddition(pokemon, details, move, { t }),
            })),
        // The solver evaluates joint timing; cache these calculations while only save status changes.
        [pokemon, details, candidates, query, limit, t],
    );
    async function change(updater: (current: OwnedPokemon) => OwnedPokemon) {
        setBusy(true);
        setError(null);
        try {
            await onUpdate((current) => recordLearnedWishlistMoves(updater(current)));
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : t(
                          'Could not save the wishlist. Try again.',
                          'Seznam se nepodařilo uložit. Zkuste to znovu.',
                      ),
            );
        } finally {
            setBusy(false);
        }
    }
    function remove(moveId: number) {
        const move = wishlist.find((entry) => entry.moveId === moveId);
        if (move) void change((current) => setWishlistMove(current, details, move, false, t));
    }
    function add(move: KnownMove) {
        void change((current) => setWishlistMove(current, details, move, true, t));
    }
    const learned = plan.moves.filter((move) => move.status === 'learned').length;
    const staleTarget = pokemon.moveWishlist?.targetSpeciesId;
    return (
        <section className="my-wishlist my-inset my-stack" aria-labelledby={`${id}-title`}>
            <div className="my-wishlist-heading">
                <div>
                    <h3 id={`${id}-title`}>{t('Wanted moves', 'Požadované útoky')}</h3>
                    <p className="my-muted">
                        {t(
                            'Plan what to learn and when to evolve.',
                            'Naplánujte naučení útoků a vhodnou chvíli pro vývoj.',
                        )}
                    </p>
                </div>
                <span className="my-level-badge">
                    {learned} / {wishlist.length} {t('learned', 'naučeno')}
                </span>
            </div>
            {paused ? (
                <p role="status">
                    {t(
                        'Resolve conflicting Pokémon or wishlist changes to resume planning.',
                        'Pro obnovení plánu vyřešte konfliktní změny Pokémona nebo požadovaných útoků.',
                    )}
                </p>
            ) : (
                <>
                    <p className="my-muted">
                        {t(
                            'Highlighted borders mark moves suited to the higher base Attack or Sp. Attack. Equal stats highlight both categories.',
                            'Zvýrazněný okraj označuje útoky vhodné pro vyšší základní statistiku Útok nebo Speciální útok. Při shodě hodnot se zvýrazní obě kategorie.',
                        )}
                    </p>
                    {plan.branches.length > 1 ||
                    (staleTarget &&
                        !plan.branches.some((branch) => branch.speciesId === staleTarget)) ? (
                        <label className="my-wishlist-target">
                            <span>{t('Final evolution', 'Konečný vývoj')}</span>
                            <select
                                value={staleTarget ?? plan.targetSpeciesId ?? ''}
                                disabled={busy}
                                onChange={(event) => {
                                    const targetSpeciesId = event.target.value
                                        ? Number(event.target.value)
                                        : null;
                                    void change((current) => ({
                                        ...current,
                                        moveWishlist: {
                                            moves: current.moveWishlist?.moves ?? [],
                                            learnedMoveIds:
                                                current.moveWishlist?.learnedMoveIds ?? [],
                                            targetSpeciesId,
                                        },
                                    }));
                                }}
                            >
                                <option value="">
                                    {t('Choose an evolution branch', 'Vyberte vývojovou větev')}
                                </option>
                                {staleTarget &&
                                    !plan.branches.some(
                                        (branch) => branch.speciesId === staleTarget,
                                    ) && (
                                        <option value={staleTarget}>
                                            {family.find(
                                                (species) => species.speciesId === staleTarget,
                                            )?.name ?? `#${staleTarget}`}{' '}
                                            · {t('previous target', 'předchozí cíl')}
                                        </option>
                                    )}
                                {plan.branches.map((branch) => (
                                    <option key={branch.speciesId} value={branch.speciesId}>
                                        {branch.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : (
                        plan.targetSpeciesId !== null && (
                            <p className="my-muted">
                                {t('Final evolution', 'Konečný vývoj')}:{' '}
                                <strong>
                                    {family.find(
                                        (species) => species.speciesId === plan.targetSpeciesId,
                                    )?.name ?? `#${plan.targetSpeciesId}`}
                                </strong>
                            </p>
                        )
                    )}
                    {plan.status === 'choose-branch' && (
                        <p role="status">
                            {t(
                                'Choose a branch before adding moves.',
                                'Před přidáním útoků vyberte vývojovou větev.',
                            )}
                        </p>
                    )}
                    {plan.warnings.length > 0 && (
                        <ul
                            className="my-wishlist-warnings"
                            aria-label={t('Planning notices', 'Upozornění k plánu')}
                        >
                            {plan.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                            ))}
                        </ul>
                    )}
                    {wishlist.length === 0 ? (
                        <p>
                            {t(
                                'Choose moves below. You can want more than four; this tracks learning, not your equipped moveset.',
                                'Níže vyberte útoky. Můžete jich chtít více než čtyři. Seznam sleduje naučení, nikoli sestavu aktuálních útoků.',
                            )}
                        </p>
                    ) : (
                        <ul
                            className="my-wishlist-selected"
                            aria-label={t('Your wanted moves', 'Vaše požadované útoky')}
                        >
                            {wishlist.map((move) => {
                                const result = plan.moves.find(
                                    (entry) => entry.moveId === move.moveId,
                                );
                                const status = result?.status ?? 'unknown';
                                const label =
                                    status === 'learned'
                                        ? t('Learned', 'Naučeno')
                                        : status === 'natural'
                                          ? result?.source?.kind === 'evolution'
                                              ? t('On evolution', 'Při vývoji')
                                              : t('Level-up route', 'Naučení za úrovně')
                                          : status === 'conditional'
                                            ? t('Conditional route', 'Podmíněná možnost')
                                            : status === 'conflict'
                                              ? t('Conflicting wishes', 'Neslučitelné požadavky')
                                              : status === 'unreachable'
                                                ? t('No verified route', 'Bez ověřené možnosti')
                                                : t('Not yet confirmed', 'Zatím nepotvrzeno');
                                return (
                                    <li key={move.moveId} data-status={status}>
                                        <div className="my-wishlist-move-heading">
                                            <MyPokemonMove
                                                move={move}
                                                reference={findReferenceMove(move.moveId, family)}
                                                showStats
                                            />
                                            <span className="my-wishlist-status">{label}</span>
                                            {onLearnMove &&
                                                !pokemon.state.moves?.some(
                                                    (known) => known.moveId === move.moveId,
                                                ) && (
                                                    <button
                                                        type="button"
                                                        className="page-button"
                                                        disabled={busy}
                                                        onClick={() => onLearnMove(move)}
                                                    >
                                                        {t(
                                                            'Learn / Replace…',
                                                            'Naučit / Nahradit…',
                                                        )}
                                                    </button>
                                                )}
                                            <button
                                                type="button"
                                                className="my-text-button"
                                                disabled={busy}
                                                aria-label={t(
                                                    `Remove ${move.name} from wishlist`,
                                                    `Odebrat ${move.name} z požadovaných útoků`,
                                                )}
                                                onClick={() => remove(move.moveId)}
                                            >
                                                {t('Remove', 'Odebrat')}
                                            </button>
                                        </div>
                                        {result?.source && (
                                            <p className="my-muted">
                                                {sourceLabel(result.source, family, t)}
                                            </p>
                                        )}
                                        {result && result.conflictingMoveIds.length > 0 && (
                                            <p className="my-muted">
                                                {t('Conflicts with', 'Konflikt s útoky')}:{' '}
                                                {result.conflictingMoveIds
                                                    .map(
                                                        (moveId) =>
                                                            wishlist.find(
                                                                (entry) => entry.moveId === moveId,
                                                            )?.name ?? `#${moveId}`,
                                                    )
                                                    .join(', ')}
                                            </p>
                                        )}
                                        {result?.reason && (
                                            <p className="my-muted">{result.reason}</p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {wishlist.length > 0 && plan.steps.length > 0 && (
                        <div className="my-wishlist-timeline">
                            <h4>{t('Learning & evolution plan', 'Plán naučení a vývoje')}</h4>
                            <p className="my-muted">
                                {t(
                                    'Follow these steps in order. Update current moves when a move is actually learned.',
                                    'Postupujte v uvedeném pořadí. Po skutečném naučení zaznamenejte útok mezi aktuální útoky.',
                                )}
                            </p>
                            <ol>
                                {plan.steps.map((step, index) => (
                                    <WishlistTimelineStep
                                        key={index}
                                        move={
                                            step.kind === 'learn'
                                                ? findReferenceMove(step.moveId, family)
                                                : undefined
                                        }
                                    >
                                        <span className="my-level-badge">Lv. {step.level}</span>
                                        <div>
                                            {step.kind === 'learn' ? (
                                                <>
                                                    <span className="my-move-heading">
                                                        <strong>
                                                            {t(
                                                                `Learn ${step.name}`,
                                                                `Naučit ${step.name}`,
                                                            )}
                                                        </strong>
                                                        <MoveEffectBadges
                                                            move={findReferenceMove(
                                                                step.moveId,
                                                                family,
                                                            )}
                                                        />
                                                    </span>
                                                    <MyPokemonMoveStats
                                                        move={findReferenceMove(
                                                            step.moveId,
                                                            family,
                                                        )}
                                                    />
                                                    <p className="my-muted">
                                                        {sourceLabel(step.source, family, t)}
                                                    </p>
                                                    {step.source.requirement && (
                                                        <p className="my-muted">
                                                            {step.source.requirement}
                                                        </p>
                                                    )}
                                                    {onLearnMove &&
                                                        !pokemon.state.moves?.some(
                                                            (known) => known.moveId === step.moveId,
                                                        ) && (
                                                            <button
                                                                type="button"
                                                                className="page-button"
                                                                disabled={busy}
                                                                onClick={() =>
                                                                    onLearnMove({
                                                                        moveId: step.moveId,
                                                                        name: step.name,
                                                                    })
                                                                }
                                                            >
                                                                {t(
                                                                    'Learn / Replace…',
                                                                    'Naučit / Nahradit…',
                                                                )}
                                                            </button>
                                                        )}
                                                </>
                                            ) : (
                                                <>
                                                    <strong>
                                                        {t('Evolve', 'Vyvinout')}:{' '}
                                                        {family.find(
                                                            (species) =>
                                                                species.speciesId ===
                                                                step.fromSpeciesId,
                                                        )?.name ?? `#${step.fromSpeciesId}`}{' '}
                                                        →{' '}
                                                        {family.find(
                                                            (species) =>
                                                                species.speciesId ===
                                                                step.toSpeciesId,
                                                        )?.name ?? `#${step.toSpeciesId}`}
                                                    </strong>
                                                    {step.conditional && (
                                                        <p className="my-muted">
                                                            {t('Requires', 'Podmínka')}:{' '}
                                                            {evolutionSummary(
                                                                step.evolution.summary,
                                                                language,
                                                            )}
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </WishlistTimelineStep>
                                ))}
                            </ol>
                        </div>
                    )}
                    <details
                        className="my-details"
                        open={pickerOpen}
                        onToggle={(event) => setPickerOpen(event.currentTarget.open)}
                    >
                        <summary>{t('Add wanted moves', 'Přidat požadované útoky')}</summary>
                        <div className="my-stack">
                            <label className="my-wishlist-search">
                                <span>
                                    {t(
                                        'Search moves in this evolution family',
                                        'Hledat útoky v této vývojové rodině',
                                    )}
                                </span>
                                <input
                                    type="search"
                                    value={query}
                                    placeholder={t('Move name', 'Název útoku')}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setLimit(16);
                                    }}
                                />
                            </label>
                            <ul className="my-wishlist-candidates">
                                {visible.map(({ move, assessment }) => {
                                    const result = assessment.plan.moves.find(
                                        (entry) => entry.moveId === move.moveId,
                                    );
                                    const note =
                                        assessment.reason ??
                                        (result?.source
                                            ? sourceLabel(result.source, family, t)
                                            : t('Already learned', 'Již naučeno'));
                                    return (
                                        <li key={move.moveId}>
                                            <MyPokemonMove
                                                as="label"
                                                move={move}
                                                reference={findReferenceMove(move.moveId, family)}
                                                showStats
                                                prefix={
                                                    <input
                                                        type="checkbox"
                                                        checked={false}
                                                        disabled={busy || !assessment.allowed}
                                                        aria-describedby={`${id}-move-${move.moveId}`}
                                                        onChange={() => add(move)}
                                                    />
                                                }
                                            />
                                            <p
                                                id={`${id}-move-${move.moveId}`}
                                                className="my-muted"
                                            >
                                                {note}
                                            </p>
                                        </li>
                                    );
                                })}
                            </ul>
                            {filtered.length === 0 && (
                                <p className="my-muted">
                                    {t(
                                        'No matching moves in the loaded family data.',
                                        'V načtených údajích vývojové rodiny nejsou odpovídající útoky.',
                                    )}
                                </p>
                            )}
                            {filtered.length > limit && (
                                <button
                                    type="button"
                                    className="page-button"
                                    onClick={() => setLimit(limit + 16)}
                                >
                                    {t('Show more moves', 'Zobrazit další útoky')}
                                </button>
                            )}
                        </div>
                    </details>
                    <p className="my-muted my-wishlist-footnote">
                        {t(
                            'Learned moves stay completed even after replacement. Move Reminder alternatives are disabled until Emerald EX 1.0.4 rules are verified.',
                            'Naučené útoky zůstanou splněné i po nahrazení. Možnosti přes Move Reminder jsou vypnuté, dokud nebudou ověřena pravidla Emerald EX 1.0.4.',
                        )}
                    </p>
                </>
            )}
            {error && <p role="alert">{error}</p>}
        </section>
    );
}
