import type { SpeciesAbilitySlot } from '@pokemon-emerald-ex-dex/shared';

import { abilityHref } from './navigation.js';
import { useLanguage } from './language.js';

export function AbilitiesSection({ slots }: { slots: readonly SpeciesAbilitySlot[] }) {
    const { t } = useLanguage();
    return (
        <section className="species-section" aria-labelledby="abilities-title">
            <div className="section-heading">
                <p className="eyebrow">{t('Species traits', 'Vlastnosti druhu')}</p>
                <h2 id="abilities-title">{t('Abilities', 'Schopnosti')}</h2>
            </div>
            <div className="p-5 sm:p-6">
                <ul className="item-catalog">
                    {slots.map(({ slot, kind, ability }) => (
                        <li key={slot} className="evolution-node">
                            <p className="eyebrow">
                                {kind === 'hidden'
                                    ? t('Hidden ability', 'Skrytá schopnost')
                                    : t(`Normal ability ${slot}`, `Běžná schopnost ${slot}`)}
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
                                <p className="empty-note mt-2">{t('None', 'Žádná')}</p>
                            )}
                        </li>
                    ))}
                </ul>
                {slots.length === 0 && (
                    <p className="empty-note">
                        {t('No ability data recorded.', 'Nejsou zaznamenány žádné schopnosti.')}
                    </p>
                )}
            </div>
        </section>
    );
}
