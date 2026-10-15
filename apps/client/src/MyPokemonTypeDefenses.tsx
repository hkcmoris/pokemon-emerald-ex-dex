import { useQuery } from '@tanstack/react-query';
import { getTypeDefenses, type Pokemon } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionTypeEffectiveness } from './collectionTypeEffectiveness.js';
import { useLanguage } from './language.js';
import { TypeBadges } from './TypeBadges.js';

export function MyPokemonTypeDefenses({
    species,
    datasetId,
    mode,
    conflict,
}: {
    species: Pokemon | undefined;
    datasetId?: string;
    mode: 'weaknesses' | 'resistances';
    conflict: boolean;
}) {
    const { t } = useLanguage();
    const chart = useQuery({
        queryKey: ['collection-type-effectiveness', datasetId],
        queryFn: () => {
            if (!datasetId) throw new Error('Dataset unavailable');
            return loadCollectionTypeEffectiveness(datasetId);
        },
        enabled: Boolean(datasetId && species && !conflict),
        staleTime: Infinity,
    });
    const defenses = species && chart.data ? getTypeDefenses(species.typeIds, chart.data) : null;
    const title =
        mode === 'weaknesses'
            ? t('Weaknesses', 'Slabiny')
            : t('Resistances & immunities', 'Odolnosti a imunity');
    const groups =
        mode === 'weaknesses'
            ? [
                  { multiplier: 4, label: '4×' },
                  { multiplier: 2, label: '2×' },
              ]
            : [
                  { multiplier: 0.5, label: '½×' },
                  { multiplier: 0.25, label: '¼×' },
                  { multiplier: 0, label: '0×' },
              ];
    const visibleGroups = groups.map((group) => ({
        ...group,
        types: defenses?.filter((entry) => entry.multiplier === group.multiplier) ?? [],
    }));

    return (
        <section className="my-type-defenses" aria-label={title}>
            <h3>{title}</h3>
            {conflict ? (
                <p className="my-muted" role="status">
                    {t(
                        'Resolve conflicting species updates to view type matchups.',
                        'Pro zobrazení typových vztahů vyřešte konfliktní změny druhu.',
                    )}
                </p>
            ) : chart.isFetching && !chart.data ? (
                <p className="my-muted" role="status">
                    {t('Loading type matchups…', 'Načítání typových vztahů…')}
                </p>
            ) : !defenses ? (
                <p className="my-muted" role="status">
                    {t(
                        'Type matchups are unavailable. Connect to load the reference data.',
                        'Typové vztahy nejsou dostupné. Připojte se k načtení referenčních dat.',
                    )}
                    {datasetId && species && (
                        <button
                            className="my-text-button"
                            type="button"
                            onClick={() => void chart.refetch()}
                        >
                            {t('Retry', 'Zkusit znovu')}
                        </button>
                    )}
                </p>
            ) : (
                <>
                    <p className="my-muted">
                        {t('Damage taken by type', 'Přijaté poškození podle typu')}
                    </p>
                    <dl className="my-type-matchups">
                        {visibleGroups
                            .filter((group) => group.types.length > 0)
                            .map((group) => (
                                <div
                                    className="my-type-matchup-row"
                                    data-multiplier={group.multiplier}
                                    key={group.multiplier}
                                >
                                    <dt>
                                        <strong>{group.label}</strong>
                                        {group.multiplier === 0 && (
                                            <span>{t('Immune', 'Imunita')}</span>
                                        )}
                                    </dt>
                                    <dd>
                                        <TypeBadges
                                            types={group.types.map((entry) => entry.name)}
                                            iconFiles={group.types.map((entry) => entry.iconFile)}
                                        />
                                    </dd>
                                </div>
                            ))}
                    </dl>
                    {visibleGroups.every((group) => group.types.length === 0) && (
                        <p className="my-muted">
                            {mode === 'weaknesses'
                                ? t('No type weaknesses.', 'Žádné typové slabiny.')
                                : t(
                                      'No type resistances or immunities.',
                                      'Žádné typové odolnosti ani imunity.',
                                  )}
                        </p>
                    )}
                    <p className="my-muted my-type-matchup-note">
                        {t(
                            'Both types multiply. Abilities, held items and battle effects are not included.',
                            'Násobitele obou typů se násobí. Schopnosti, držené předměty a bojové efekty nejsou zahrnuty.',
                        )}
                    </p>
                </>
            )}
        </section>
    );
}
