import type { Ref } from 'react';
import type { SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { formDisplayName } from './forms.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { TypeBadges } from './TypeBadges.js';
import { typeSurfaceStyle } from './theme.js';
import { useLanguage } from './language.js';

type HeaderEntry = Pick<
    SpeciesDetails,
    'speciesId' | 'name' | 'formInfo' | 'forms' | 'sprites' | 'types' | 'typeIconFiles'
>;

export function SpeciesDetailHeader({
    entry,
    datasetId,
    headingRef,
    shiny,
    onShinyChange,
}: {
    entry: HeaderEntry;
    datasetId: string | undefined;
    headingRef?: Ref<HTMLHeadingElement>;
    shiny: boolean;
    onShinyChange: (shiny: boolean) => void;
}) {
    const { t } = useLanguage();
    const name = formDisplayName(entry.name, entry.formInfo);
    const hasShiny = Boolean(entry.sprites?.shinyFront);
    const showShiny = shiny && hasShiny;
    const sprite = (showShiny ? entry.sprites?.shinyFront : entry.sprites?.front) ?? null;
    const forms = entry.forms?.members ?? [];

    return (
        <section
            className="species-detail-header type-surface"
            style={typeSurfaceStyle(entry.types)}
            aria-labelledby="species-title"
        >
            <div className="species-detail-heading">
                <p className="eyebrow">#{String(entry.speciesId).padStart(4, '0')}</p>
                <h1 id="species-title" ref={headingRef} tabIndex={-1}>
                    {name}
                </h1>
                <TypeBadges types={entry.types} iconFiles={entry.typeIconFiles} />
                {forms.length > 1 && (
                    <span className="mt-3 block text-xs text-muted">
                        {forms.length} {t('Forms', forms.length < 5 ? 'Formy' : 'Forem')}
                    </span>
                )}
            </div>
            <div className="species-detail-visual">
                <div className="species-detail-portrait">
                    <SpeciesSprite
                        datasetId={datasetId}
                        file={sprite}
                        name={name}
                        size={128}
                        shiny={showShiny}
                        loading="eager"
                    />
                </div>
                <div
                    className="appearance-toggle"
                    role="group"
                    aria-label={t('Appearance', 'Vzhled')}
                >
                    <button
                        type="button"
                        aria-pressed={!showShiny}
                        disabled={!hasShiny}
                        onClick={() => onShinyChange(!showShiny)}
                    >
                        {t('Standard', 'Běžný')}
                    </button>
                    <button
                        type="button"
                        aria-pressed={showShiny}
                        disabled={!hasShiny}
                        onClick={() => onShinyChange(!showShiny)}
                    >
                        <span aria-hidden="true">✦</span> Shiny
                    </button>
                </div>
            </div>
            {!sprite && (
                <p className="species-sprite-note empty-note">
                    {entry.sprites?.missingReason ??
                        t(
                            'No sprite has been imported for this form.',
                            'Pro tuto formu nebyl importován žádný obrázek.',
                        )}
                </p>
            )}
        </section>
    );
}
