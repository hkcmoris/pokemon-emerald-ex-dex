import type { OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { evolutionSummary } from './evolutionText.js';
import { useLanguage } from './language.js';
import { MyPokemonMove } from './MyPokemonMove.js';
import { typeSurfaceStyle } from './theme.js';

const evolutionIcon = new URL('./assets/evolution-dna.svg', import.meta.url).href;

type Milestone =
    | { kind: 'move'; level: number; move: SpeciesDetails['learnset'][number] }
    | {
          kind: 'evolution';
          level: number | null;
          evolution: SpeciesDetails['evolutionLinks'][number];
      };

export function MyPokemonMilestones({
    pokemon,
    details,
}: {
    pokemon: OwnedPokemon;
    details: SpeciesDetails;
}) {
    const { language, t } = useLanguage();
    const seenMoves = new Set<string>();
    const milestones: Milestone[] = [];
    for (const move of details.learnset) {
        const key = `${move.moveId}:${move.level}`;
        if (move.level <= pokemon.state.level || move.level === 0 || seenMoves.has(key)) continue;
        seenMoves.add(key);
        milestones.push({ kind: 'move', level: move.level, move });
    }
    for (const evolution of details.evolutionLinks) {
        if (evolution.internalOnly || evolution.fromSpeciesId !== pokemon.state.speciesId) continue;
        milestones.push({ kind: 'evolution', level: evolution.level, evolution });
    }
    milestones.sort((left, right) => {
        const leftLevel = left.level ?? Infinity;
        const rightLevel = right.level ?? Infinity;
        if (leftLevel !== rightLevel) return leftLevel - rightLevel;
        return left.kind === right.kind ? 0 : left.kind === 'move' ? -1 : 1;
    });

    return (
        <section className="my-guidance my-milestones">
            <h3>{t('Coming up', 'Co vás čeká')}</h3>
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
                            ? `${t('Evolution', 'Vývoj')}: ${evolution.toName} (Lv. ${evolution.level})`
                            : `${t('Evolution', 'Vývoj')}: ${evolution.toName} — ${evolutionSummary(evolution.summary, language)}`;
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
