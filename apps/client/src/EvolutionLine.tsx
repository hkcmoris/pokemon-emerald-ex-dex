import type { SpeciesEvolution } from '@pokemon-emerald-ex-dex/shared';

import { speciesHref } from './navigation.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { RuleItems } from './ItemIcon.js';
import { useLanguage } from './language.js';

interface EvolutionStage {
    speciesId: number;
    name: string;
    sprite: string | null;
    incoming: SpeciesEvolution[];
}

interface EvolutionEntry {
    speciesId: number;
    name: string;
    sprites: { front: string | null } | null;
}

function evolutionStages(
    entry: EvolutionEntry,
    links: readonly SpeciesEvolution[],
): EvolutionStage[][] {
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
    const current = species.get(entry.speciesId);
    if (current) current.name = entry.name;
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
    const { t } = useLanguage();
    return (
        <details className="rule-details mt-3">
            <summary>{t('Rule details', 'Podrobnosti pravidla')}</summary>
            <dl className="rom-fields mt-3">
                <div>
                    <dt>{t('Method', 'Metoda')}</dt>
                    <dd>{link.method.replaceAll('_', ' ')}</dd>
                </div>
                <div>
                    <dt>{t('Trigger', 'Spouštěč')}</dt>
                    <dd>{link.trigger.replaceAll('_', ' ')}</dd>
                </div>
                <div>
                    <dt>{t('Level', 'Úroveň')}</dt>
                    <dd>{link.level ?? t('No level requirement', 'Bez požadavku na úroveň')}</dd>
                </div>
                <div>
                    <dt>{t('ROM method ID', 'ID metody v ROM')}</dt>
                    <dd>{link.methodId}</dd>
                </div>
                <div>
                    <dt>{t('Raw parameter', 'Původní parametr')}</dt>
                    <dd>{link.rawParam}</dd>
                </div>
                <div>
                    <dt>{t('Rule order', 'Pořadí pravidla')}</dt>
                    <dd>{link.edgeOrder}</dd>
                </div>
            </dl>
            {Object.keys(link.conditions).length > 0 && (
                <div className="mt-3">
                    <p className="text-xs font-semibold">
                        {t('Full conditions', 'Úplné podmínky')}
                    </p>
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
    currentLabel,
    currentPageSpeciesId = entry.speciesId,
}: {
    entry: EvolutionEntry;
    links: readonly SpeciesEvolution[];
    datasetId: string | undefined;
    currentLabel?: string;
    currentPageSpeciesId?: number;
}) {
    const { t } = useLanguage();
    const stages = evolutionStages(entry, links);
    return (
        <div className="evolution-family">
            <ol
                className="evolution-stages"
                aria-label={t('Full evolution line', 'Celá vývojová řada')}
            >
                {stages.map((stage, index) => (
                    <li
                        key={stage[0].speciesId}
                        className={`evolution-stage${stage.length > 1 ? ' evolution-stage-branched' : ''}`}
                    >
                        <p className="eyebrow mb-3">
                            {t('Stage', 'Stupeň')} {index + 1}
                        </p>
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
                                            aria-current={
                                                node.speciesId === currentPageSpeciesId
                                                    ? 'page'
                                                    : undefined
                                            }
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
                                                    {currentLabel ??
                                                        t('Current stage', 'Aktuální stupeň')}
                                                </span>
                                            )}
                                        </a>
                                        {node.incoming.length > 0 && (
                                            <ul className="evolution-methods">
                                                {node.incoming.map((link) => (
                                                    <li key={link.edgeOrder}>
                                                        <p className="text-xs text-stone-600">
                                                            {t('From', 'Z')} {link.fromName}
                                                        </p>
                                                        <p className="mt-1 text-sm leading-relaxed">
                                                            {link.summary}
                                                        </p>
                                                        <EvolutionRuleDetails link={link} />
                                                        <RuleItems items={link.items} />
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
                <p className="empty-note mt-4">
                    {t(
                        'No evolution recorded for this species.',
                        'Pro tento druh není zaznamenán žádný vývoj.',
                    )}
                </p>
            )}
        </div>
    );
}
