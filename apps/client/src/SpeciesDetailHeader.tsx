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
    onFormChange,
}: {
    entry: HeaderEntry;
    datasetId: string | undefined;
    headingRef?: Ref<HTMLHeadingElement>;
    shiny: boolean;
    onShinyChange: (shiny: boolean) => void;
    onFormChange: (speciesId: number) => void;
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
                <p className="eyebrow">
                    {t('Species / form', 'Druh / forma')} #
                    {String(entry.speciesId).padStart(4, '0')}
                </p>
                <h1 id="species-title" ref={headingRef} tabIndex={-1}>
                    {name}
                </h1>
                <TypeBadges types={entry.types} iconFiles={entry.typeIconFiles} />
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
            {forms.length > 1 && (
                <div className="species-detail-controls">
                    <label className="filter-label">
                        {t('Form', 'Forma')}
                        <select
                            className="filter-input form-selector"
                            value={entry.speciesId}
                            onChange={(event) => onFormChange(Number(event.target.value))}
                        >
                            {forms.map((form) => (
                                <option key={form.speciesId} value={form.speciesId}>
                                    {formDisplayName(form.name, form)} · #
                                    {String(form.speciesId).padStart(4, '0')}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            )}
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
