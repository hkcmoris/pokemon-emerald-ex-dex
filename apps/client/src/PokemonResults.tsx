import { statLabels, type DexSort, type Pokemon } from './dex.js';
import { speciesHref } from './navigation.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { TypeBadges } from './TypeBadges.js';
import { typeSurfaceStyle } from './theme.js';
import { useLanguage } from './language.js';

interface PokemonResultsProps {
    entries: readonly Pokemon[];
    datasetId: string | undefined;
    sort: DexSort;
}

export function PokemonResults({ entries, datasetId, sort }: PokemonResultsProps) {
    const { t } = useLanguage();
    return (
        <>
            <ul
                className="pokemon-mobile-list"
                aria-label={t('Pokémon results', 'Nalezení Pokémoni')}
            >
                {entries.map((entry) => (
                    <li key={entry.speciesId}>
                        <a
                            className="pokemon-card type-surface"
                            href={speciesHref(entry.speciesId)}
                            style={typeSurfaceStyle(entry.types)}
                        >
                            <span className="pokemon-card-sprite">
                                <SpeciesSprite
                                    datasetId={datasetId}
                                    file={entry.sprites?.front ?? null}
                                    name={entry.name}
                                />
                            </span>
                            <span className="pokemon-card-info">
                                <span className="pokemon-card-id">
                                    #{String(entry.speciesId).padStart(4, '0')}
                                </span>
                                <span className="pokemon-card-name">{entry.name}</span>
                                <TypeBadges types={entry.types} iconFiles={entry.typeIconFiles} />
                            </span>
                            <span className="pokemon-card-stat">
                                <strong>
                                    {sort === 'speed' ? entry.stats.speed : entry.baseStatTotal}
                                </strong>
                                <span>{sort === 'speed' ? t('Speed', 'Rychlost') : 'BST'}</span>
                            </span>
                            <svg
                                className="pokemon-card-chevron"
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                aria-hidden="true"
                            >
                                <path d="m9 6 6 6-6 6" />
                            </svg>
                        </a>
                    </li>
                ))}
            </ul>
            <div className="pokemon-desktop-table overflow-x-auto">
                <table className="w-full text-sm">
                    <caption className="sr-only">
                        {t(
                            'Pokémon types and base stats. Select a name to view details.',
                            'Typy a základní statistiky Pokémonů. Kliknutím na název zobrazíte podrobnosti.',
                        )}
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">ID</th>
                            <th scope="col">{t('Pokémon / Types', 'Pokémon / Typy')}</th>
                            {statLabels.map(({ key, label, labelCs, short }) => (
                                <th scope="col" className="text-right" key={key}>
                                    <abbr title={t(label, labelCs)}>{short}</abbr>
                                </th>
                            ))}
                            <th scope="col" className="text-right">
                                {t('Total', 'Celkem')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry) => (
                            <tr key={entry.speciesId}>
                                <td className="font-mono text-xs text-stone-500">
                                    {String(entry.speciesId).padStart(4, '0')}
                                </td>
                                <th scope="row" className="text-left">
                                    <div className="flex items-center gap-3">
                                        <SpeciesSprite
                                            datasetId={datasetId}
                                            file={entry.sprites?.front ?? null}
                                            name={entry.name}
                                        />
                                        <div>
                                            <a
                                                className="pokemon-name"
                                                href={speciesHref(entry.speciesId)}
                                            >
                                                {entry.name}
                                            </a>
                                            <TypeBadges
                                                types={entry.types}
                                                iconFiles={entry.typeIconFiles}
                                            />
                                        </div>
                                    </div>
                                </th>
                                {statLabels.map(({ key }) => (
                                    <td className="text-right tabular-nums" key={key}>
                                        {entry.stats[key]}
                                    </td>
                                ))}
                                <td className="text-right font-semibold tabular-nums">
                                    {entry.baseStatTotal}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
