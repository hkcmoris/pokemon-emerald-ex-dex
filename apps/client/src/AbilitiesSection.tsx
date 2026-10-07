import type { SpeciesAbilitySlot } from '@pokemon-emerald-ex-dex/shared';

import { abilityHref } from './navigation.js';

export function AbilitiesSection({ slots }: { slots: readonly SpeciesAbilitySlot[] }) {
    return (
        <section className="species-section" aria-labelledby="abilities-title">
            <div className="section-heading">
                <p className="eyebrow">Species traits</p>
                <h2 id="abilities-title">Abilities</h2>
            </div>
            <div className="p-5 sm:p-6">
                <ul className="item-catalog">
                    {slots.map(({ slot, kind, ability }) => (
                        <li key={slot} className="evolution-node">
                            <p className="eyebrow">
                                {kind === 'hidden' ? 'Hidden ability' : `Normal ability ${slot}`}
                            </p>
                            {ability ? (
                                <>
                                    <a
                                        className="species-link mt-2 inline-block font-semibold"
                                        href={abilityHref(ability.abilityId)}
                                    >
                                        {ability.name}
                                    </a>
                                    <span className="ml-2 font-mono text-xs text-stone-600">
                                        #{String(ability.abilityId).padStart(3, '0')}
                                    </span>
                                    <p className="mt-2 text-sm leading-relaxed">
                                        {ability.description}
                                    </p>
                                </>
                            ) : (
                                <p className="empty-note mt-2">None</p>
                            )}
                        </li>
                    ))}
                </ul>
                {slots.length === 0 && <p className="empty-note">No ability data recorded.</p>}
            </div>
        </section>
    );
}
