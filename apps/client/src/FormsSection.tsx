import type { FormChange, SpeciesFormGroup } from '@pokemon-emerald-ex-dex/shared';

import { formDisplayName, formKindLabel } from './forms.js';
import { speciesHref } from './navigation.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { RuleItems } from './ItemIcon.js';

export function FormsSection({
    forms,
    changes,
    speciesId,
    datasetId,
}: {
    forms: SpeciesFormGroup | null;
    changes: readonly FormChange[];
    speciesId: number;
    datasetId: string | undefined;
}) {
    if (!forms && changes.length === 0) return null;
    const rules = forms?.changes ?? changes;
    const names = new Map(
        forms?.members.map((member) => [member.speciesId, formDisplayName(member.name, member)]),
    );
    return (
        <section className="species-section" aria-labelledby="forms-title">
            <div className="section-heading">
                <p className="eyebrow">Species forms</p>
                <h2 id="forms-title">{forms ? 'Forms' : 'Form changes'}</h2>
            </div>
            {forms && (
                <ul className="form-members p-5 sm:p-6">
                    {forms.members.map((member) => {
                        const current = member.speciesId === speciesId;
                        const applicable = rules.filter(
                            (rule) =>
                                rule.targetSpeciesId === member.speciesId &&
                                !rule.restorePreviousForm,
                        );
                        const summaries = [...new Set(applicable.map((rule) => rule.summary))];
                        return (
                            <li
                                key={member.speciesId}
                                className={`evolution-node${current ? ' evolution-node-current' : ''}`}
                            >
                                <a
                                    className="evolution-species"
                                    href={speciesHref(member.speciesId)}
                                    aria-current={current ? 'page' : undefined}
                                >
                                    <SpeciesSprite
                                        datasetId={datasetId}
                                        file={member.sprite}
                                        name={formDisplayName(member.name, member)}
                                    />
                                    <span className="font-semibold">
                                        {formDisplayName(member.name, member)}
                                    </span>
                                    <span className="font-mono text-xs">
                                        #{String(member.speciesId).padStart(4, '0')}
                                    </span>
                                    <span className="text-xs">
                                        {member.formLabel ?? formKindLabel(member.formKind)}
                                    </span>
                                    {current && (
                                        <span className="current-stage-label">Current form</span>
                                    )}
                                </a>
                                {summaries.length > 0 && (
                                    <ul className="form-summaries">
                                        {summaries.map((summary) => (
                                            <li key={summary}>{summary}</li>
                                        ))}
                                    </ul>
                                )}
                                <RuleItems
                                    items={[
                                        ...new Map(
                                            applicable
                                                .flatMap((rule) => rule.items)
                                                .map((item) => [item.itemId, item]),
                                        ).values(),
                                    ]}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
            {rules.length > 0 && (
                <details className="form-change-rules">
                    <summary>
                        Form-change rules <span className="count-label">{rules.length}</span>
                    </summary>
                    <ul className="evolution-rules mt-5">
                        {rules.map((rule) => (
                            <li key={`${rule.sourceSpeciesId}/${rule.changeOrder}`}>
                                <p className="text-sm font-semibold">
                                    <a
                                        className="species-link"
                                        href={speciesHref(rule.sourceSpeciesId)}
                                    >
                                        {names.get(rule.sourceSpeciesId) ?? rule.sourceName} #
                                        {rule.sourceSpeciesId}
                                    </a>
                                    {' → '}
                                    {rule.restorePreviousForm
                                        ? 'Previously saved form'
                                        : rule.targetSpeciesId !== null && (
                                              <a
                                                  className="species-link"
                                                  href={speciesHref(rule.targetSpeciesId)}
                                              >
                                                  {names.get(rule.targetSpeciesId) ??
                                                      rule.targetName}{' '}
                                                  #{rule.targetSpeciesId}
                                              </a>
                                          )}
                                </p>
                                <p className="mt-2 text-sm leading-relaxed">{rule.summary}</p>
                                <RuleItems items={rule.items} />
                                <dl className="rom-fields mt-3">
                                    <div>
                                        <dt>Method</dt>
                                        <dd>{rule.method.replaceAll('_', ' ')}</dd>
                                    </div>
                                    <div>
                                        <dt>Form kind</dt>
                                        <dd>{formKindLabel(rule.formKind)}</dd>
                                    </div>
                                    <div>
                                        <dt>Battle only</dt>
                                        <dd>{rule.battleOnly ? 'Yes' : 'No'}</dd>
                                    </div>
                                    <div>
                                        <dt>Method ID / rule order</dt>
                                        <dd>
                                            {rule.methodId} / {rule.changeOrder}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Raw target species ID</dt>
                                        <dd>{rule.rawTargetSpeciesId}</dd>
                                    </div>
                                    <div>
                                        <dt>Raw parameters</dt>
                                        <dd>
                                            {rule.rawParams.param1} / {rule.rawParams.param2} /{' '}
                                            {rule.rawParams.param3}
                                        </dd>
                                    </div>
                                </dl>
                                {Object.keys(rule.details).length > 0 && (
                                    <pre className="condition-data mt-3">
                                        {JSON.stringify(rule.details, null, 2)}
                                    </pre>
                                )}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}
