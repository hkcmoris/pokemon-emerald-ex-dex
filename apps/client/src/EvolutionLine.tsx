import type { Pokemon, SpeciesEvolution } from '@pokemon-emerald-ex-dex/shared';

import { speciesHref } from './navigation.js';
import { SpeciesSprite } from './SpeciesSprite.js';

interface EvolutionStage {
    speciesId: number;
    name: string;
    sprite: string | null;
    incoming: SpeciesEvolution[];
}

function evolutionStages(entry: Pokemon, links: readonly SpeciesEvolution[]): EvolutionStage[][] {
    const species = new Map<number, EvolutionStage>();
    for (const link of links) {
        if (link.internalOnly) continue;
        if (!species.has(link.fromSpeciesId)) {
            species.set(link.fromSpeciesId, {
                speciesId: link.fromSpeciesId,
                name: link.fromName,
                sprite: link.fromSprite,
                incoming: [],
            });
        }
        if (!species.has(link.toSpeciesId)) {
            species.set(link.toSpeciesId, {
                speciesId: link.toSpeciesId,
                name: link.toName,
                sprite: link.toSprite,
                incoming: [],
            });
        }
        species.get(link.toSpeciesId)?.incoming.push(link);
    }
    if (!species.has(entry.speciesId)) {
        species.set(entry.speciesId, {
            speciesId: entry.speciesId,
            name: entry.name,
            sprite: entry.sprites?.front ?? null,
            incoming: [],
        });
    }
    const stages: EvolutionStage[][] = [];
    while (species.size > 0) {
        const remaining = [...species.values()];
        const roots = remaining.filter(
            (node) => !node.incoming.some((link) => species.has(link.fromSpeciesId)),
        );
        // Cyclic relationships still display every species once without looping.
        const stage = (roots.length ? roots : remaining).sort((a, b) => a.speciesId - b.speciesId);
        stages.push(stage);
        for (const node of stage) species.delete(node.speciesId);
    }
    return stages;
}

export function EvolutionRuleDetails({ link }: { link: SpeciesEvolution }) {
    return (
        <details className="rule-details mt-3">
            <summary>Rule details</summary>
            <dl className="rom-fields mt-3">
                <div>
                    <dt>Method</dt>
                    <dd>{link.method.replaceAll('_', ' ')}</dd>
                </div>
                <div>
                    <dt>Trigger</dt>
                    <dd>{link.trigger.replaceAll('_', ' ')}</dd>
                </div>
                <div>
                    <dt>Level</dt>
                    <dd>{link.level ?? 'No level requirement'}</dd>
                </div>
                <div>
                    <dt>ROM method ID</dt>
                    <dd>{link.methodId}</dd>
                </div>
                <div>
                    <dt>Raw parameter</dt>
                    <dd>{link.rawParam}</dd>
                </div>
                <div>
                    <dt>Rule order</dt>
                    <dd>{link.edgeOrder}</dd>
                </div>
            </dl>
            {Object.keys(link.conditions).length > 0 && (
                <div className="mt-3">
                    <p className="text-xs font-semibold">Full conditions</p>
                    <pre className="condition-data mt-2">
                        {JSON.stringify(link.conditions, null, 2)}
                    </pre>
                </div>
            )}
        </details>
    );
}

export function EvolutionLine({
    entry,
    links,
    datasetId,
}: {
    entry: Pokemon;
    links: readonly SpeciesEvolution[];
    datasetId: string | undefined;
}) {
    const stages = evolutionStages(entry, links);
    return (
        <div className="evolution-family">
            <ol className="evolution-stages" aria-label="Full evolution line">
                {stages.map((stage, index) => (
                    <li
                        key={stage[0].speciesId}
                        className={`evolution-stage${stage.length > 1 ? ' evolution-stage-branched' : ''}`}
                    >
                        <p className="eyebrow mb-3">Stage {index + 1}</p>
                        <ul className="evolution-branches">
                            {stage.map((node) => {
                                const current = node.speciesId === entry.speciesId;
                                return (
                                    <li
                                        key={node.speciesId}
                                        className={`evolution-node${current ? ' evolution-node-current' : ''}`}
                                    >
                                        <a
                                            className="evolution-species"
                                            href={speciesHref(node.speciesId)}
                                            aria-current={current ? 'page' : undefined}
                                        >
                                            <SpeciesSprite
                                                datasetId={datasetId}
                                                file={node.sprite}
                                                name={node.name}
                                            />
                                            <span className="font-semibold">{node.name}</span>
                                            <span className="font-mono text-xs">
                                                #{String(node.speciesId).padStart(4, '0')}
                                            </span>
                                            {current && (
                                                <span className="current-stage-label">
                                                    Current stage
                                                </span>
                                            )}
                                        </a>
                                        {node.incoming.length > 0 && (
                                            <ul className="evolution-methods">
                                                {node.incoming.map((link) => (
                                                    <li key={link.edgeOrder}>
                                                        <p className="text-xs text-stone-600">
                                                            From {link.fromName}
                                                        </p>
                                                        <p className="mt-1 text-sm leading-relaxed">
                                                            {link.summary}
                                                        </p>
                                                        <EvolutionRuleDetails link={link} />
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </li>
                ))}
            </ol>
            {links.length === 0 && (
                <p className="empty-note mt-4">No evolution recorded for this species.</p>
            )}
        </div>
    );
}
