import {
    planMoveWishlist,
    type OwnedPokemon,
    type SpeciesDetails,
} from '@pokemon-emerald-ex-dex/shared';

import { evolutionSummary } from './evolutionText.js';
import { useLanguage } from './language.js';
import { MyPokemonMove } from './MyPokemonMove.js';
import { MyPokemonWishlistAction } from './MyPokemonWishlistAction.js';
import { typeSurfaceStyle } from './theme.js';

const evolutionIcon = new URL('./assets/evolution-dna.svg', import.meta.url).href;

type Milestone =
    | { kind: 'move'; level: number; move: SpeciesDetails['learnset'][number] }
    | {
          kind: 'evolution';
          level: number | null;
          evolution: SpeciesDetails['evolutionLinks'][number];
          planned?: boolean;
      };

export function MyPokemonMilestones({
    pokemon,
    details,
    family = [details],
    wishlistPaused = false,
    onUpdate,
}: {
    pokemon: OwnedPokemon;
    details: SpeciesDetails;
    family?: readonly SpeciesDetails[];
    wishlistPaused?: boolean;
    onUpdate?: (updater: (current: OwnedPokemon) => OwnedPokemon) => Promise<void>;
}) {
    const { language, t } = useLanguage();
    const hasWishlist = (pokemon.moveWishlist?.moves.length ?? 0) > 0;
    const plan =
        hasWishlist && !wishlistPaused
            ? planMoveWishlist(
                  pokemon,
                  Object.fromEntries([...family, details].map((entry) => [entry.speciesId, entry])),
                  { t },
              )
            : null;
    const plannedEvolution =
        plan?.status === 'ready'
            ? plan.steps.find(
                  (step) =>
                      step.kind === 'evolve' && step.fromSpeciesId === pokemon.state.speciesId,
              )
            : undefined;
    const nextEvolution = plannedEvolution?.kind === 'evolve' ? plannedEvolution : undefined;
    const waitingFor =
        nextEvolution && plan
            ? plan.steps.flatMap((step) =>
                  step.kind === 'learn' &&
                  step.source.kind === 'level-up' &&
                  step.speciesId === pokemon.state.speciesId &&
                  step.level <= nextEvolution.level
                      ? [step.name]
                      : [],
              )
            : [];
    const delayedEvolution =
        nextEvolution &&
        nextEvolution.level > Math.max(pokemon.state.level, nextEvolution.evolution.level ?? 0);
    const machineRequirements =
        plan?.status === 'ready'
            ? [
                  ...new Set(
                      plan.steps.flatMap((step) =>
                          step.kind === 'learn' && step.source.kind === 'machine'
                              ? [`${step.name} (${step.source.machine})`]
                              : [],
                      ),
                  ),
              ]
            : [];
    const seenMoves = new Set<string>();
    const milestones: Milestone[] = [];
    for (const move of details.learnset) {
        const key = `${move.moveId}:${move.level}`;
        if (
            move.level <= pokemon.state.level ||
            move.level === 0 ||
            seenMoves.has(key) ||
            (nextEvolution && move.level > nextEvolution.level)
        )
            continue;
        seenMoves.add(key);
        milestones.push({ kind: 'move', level: move.level, move });
    }
    if (nextEvolution) {
        milestones.push({
            kind: 'evolution',
            level: nextEvolution.level,
            evolution: nextEvolution.evolution,
            planned: true,
        });
    } else if (!hasWishlist && !wishlistPaused) {
        for (const evolution of details.evolutionLinks) {
            if (evolution.internalOnly || evolution.fromSpeciesId !== pokemon.state.speciesId)
                continue;
            milestones.push({ kind: 'evolution', level: evolution.level, evolution });
        }
    }
    milestones.sort((left, right) => {
        const leftLevel = left.level ?? Infinity;
        const rightLevel = right.level ?? Infinity;
        if (leftLevel !== rightLevel) return leftLevel - rightLevel;
        return left.kind === right.kind ? 0 : left.kind === 'move' ? -1 : 1;
    });

    const notes: { summary: string; message: string; highlight: boolean }[] = [];
    if (wishlistPaused) {
        notes.push({
            summary: t('Plan paused', 'Plán pozastaven'),
            message: t(
                'Resolve conflicting Pokémon or wishlist changes before planning evolution.',
                'Před plánováním vývoje vyřešte konfliktní změny Pokémona nebo seznamu přání.',
            ),
            highlight: false,
        });
    } else if (plan && plan.status !== 'ready') {
        notes.push({
            summary: t('Check the plan', 'Ověřte plán'),
            message: `${t(
                'Evolution timing cannot yet be confirmed from the wishlist.',
                'Termín vývoje zatím nelze podle seznamu přání potvrdit.',
            )} ${plan.warnings[0] ?? ''}`.trim(),
            highlight: false,
        });
    }
    if (delayedEvolution && waitingFor.length > 0) {
        notes.push({
            summary: t(
                `Wait until Lv. ${nextEvolution.level}`,
                `Nevyvíjet do Lv. ${nextEvolution.level}`,
            ),
            message: t(
                `Keep ${details.name} unevolved until Lv. ${nextEvolution.level} to learn ${waitingFor.join(', ')}, then evolve into ${nextEvolution.evolution.toName}.`,
                `Ponechte ${details.name} bez vývoje do úrovně ${nextEvolution.level}, aby se naučil ${waitingFor.join(', ')}. Poté jej vyviňte na ${nextEvolution.evolution.toName}.`,
            ),
            highlight: true,
        });
    }
    if (machineRequirements.length > 0) {
        notes.push({
            summary: t('TM/HM required', 'Nutné TM/HM'),
            message: t(
                `This wishlist plan requires ${machineRequirements.join(', ')}. Confirm access to these machines before evolving.`,
                `Tento plán přání vyžaduje ${machineRequirements.join(', ')}. Před vývojem ověřte, že máte k těmto TM/HM přístup.`,
            ),
            highlight: true,
        });
    }
    const noteSummary = notes.map((note) => note.summary).join(' · ');
    const noteContent = notes.map((note) => (
        <p key={note.summary} className={note.highlight ? 'my-milestone-plan' : 'my-muted'}>
            {note.message}
        </p>
    ));
    return (
        <section className="my-guidance my-milestones">
            <div className="my-milestones-heading">
                <h3>{t('Coming up', 'Co vás čeká')}</h3>
                {notes.length > 0 && (
                    <>
                        <details className="my-milestone-note-details">
                            <summary
                                title={notes.map((note) => note.message).join(' ')}
                                aria-label={`${noteSummary} — ${t('Plan details', 'Podrobnosti plánu')}`}
                            >
                                <span>{noteSummary}</span>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="m6 9 6 6 6-6" />
                                </svg>
                            </summary>
                            <div className="my-milestone-note-popover">{noteContent}</div>
                        </details>
                        <div className="my-milestone-notes-inline">{noteContent}</div>
                    </>
                )}
            </div>
            {milestones.length === 0 ? (
                <p className="my-muted">{t('No upcoming milestones', 'Žádné další milníky')}</p>
            ) : (
                <ul className="my-upcoming my-milestone-row">
                    {milestones.slice(0, 2).map((milestone) => {
                        if (milestone.kind === 'move') {
                            return (
                                <MyPokemonMove
                                    as="li"
                                    key={`move:${milestone.move.moveId}:${milestone.level}`}
                                    move={milestone.move}
                                    reference={milestone.move}
                                    prefix={
                                        <span className="my-level-badge">
                                            Lv. {milestone.level}
                                        </span>
                                    }
                                    suffix={
                                        <MyPokemonWishlistAction
                                            pokemon={pokemon}
                                            family={family}
                                            move={milestone.move}
                                            paused={wishlistPaused}
                                            onUpdate={onUpdate}
                                        />
                                    }
                                />
                            );
                        }
                        const { evolution } = milestone;
                        const plainLevel =
                            evolution.method === 'level' &&
                            evolution.level !== null &&
                            Object.keys(evolution.conditions).length === 0 &&
                            evolution.summary === `Reach level ${evolution.level}.`;
                        const description = plainLevel
                            ? `${t('Evolution', 'Vývoj')}: ${evolution.toName} (Lv. ${milestone.level})`
                            : `${t('Evolution', 'Vývoj')}: ${evolution.toName}${milestone.planned ? t(` (planned Lv. ${milestone.level})`, ` (plánovaná úroveň ${milestone.level})`) : ''} — ${evolutionSummary(evolution.summary, language)}`;
                        return (
                            <li
                                key={`evolution:${evolution.edgeOrder}:${evolution.toSpeciesId}`}
                                className="my-move my-evolution-milestone type-surface"
                                style={typeSurfaceStyle(details.types)}
                                title={description}
                                aria-label={description}
                            >
                                {milestone.level !== null && (
                                    <span className="my-level-badge">Lv. {milestone.level}</span>
                                )}
                                <img
                                    src={evolutionIcon}
                                    width={24}
                                    height={24}
                                    alt=""
                                    aria-hidden="true"
                                />
                                <span className="my-milestone-name">{evolution.toName}</span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
