import { useLanguage } from './language.js';

export type MyPokemonView = 'moves' | 'stats' | 'weaknesses' | 'resistances';

export function MyPokemonViewToggle({
    view,
    onViewChange,
    controlsId,
}: {
    view: MyPokemonView;
    onViewChange: (view: MyPokemonView) => void;
    controlsId: string;
}) {
    const { t } = useLanguage();
    return (
        <div
            className="appearance-toggle my-stat-view-toggle"
            role="group"
            aria-label={t('Card view', 'Zobrazení karty')}
        >
            <button
                type="button"
                aria-pressed={view === 'moves'}
                aria-controls={controlsId}
                aria-label={t('Current moves', 'Aktuální útoky')}
                title={t('Current moves', 'Aktuální útoky')}
                onClick={() => onViewChange('moves')}
            >
                <svg className="my-moves-view-icon" viewBox="0 0 512 512" aria-hidden="true">
                    <path d="M280.762 21.63c-15.912-.117-32 1.523-47.983 5.08-42.948 9.563-58.997 38.668-57.135 66.495 9.325.534 19.01 1.876 28.914 3.988 28.983 6.18 59.948 19.074 89.05 38.418 100.28-25.29 162.228 51.005 184.7 152.18 49.7-147.744-67.984-265.215-197.548-266.16zm-112.535 90.128c-16.8-.114-31.245 2.938-41.717 8.74l-.04-.074c-14.14 7.645-23.816 19.428-29.15 32.687 14.63 4.844 28.782 13.83 41.955 25.466 17.72 15.652 33.85 36.317 47.06 59.662 116.927 2.378 161.504 103.39 150.673 215.26 79.5-106.87 42.174-229.74-43.856-295.404-29.984-21.936-62.82-36.296-92.492-42.623-11.425-2.436-22.354-3.644-32.433-3.712zM75.29 167.963C21.077 166.605-10.09 248.77 47.966 276.21c104.435 49.363 94.912 140.96 34.844 222.71 115.134-47.87 134.337-172.24 81.997-260.066l.152-.01c-11.28-18.202-24.378-34.178-38.056-46.26-14.62-12.914-29.74-21.183-43.76-23.836-2.664-.454-5.287-.72-7.855-.785z" />
                </svg>
            </button>
            <button
                type="button"
                aria-pressed={view === 'stats'}
                aria-controls={controlsId}
                aria-label={t('Stats progression', 'Vývoj statistik')}
                title={t('Stats progression', 'Vývoj statistik')}
                onClick={() => onViewChange('stats')}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 4v16h16M7 15l4-5 4 2 5-7" />
                </svg>
            </button>
            <button
                type="button"
                aria-pressed={view === 'weaknesses'}
                aria-controls={controlsId}
                aria-label={t('Weaknesses', 'Slabiny')}
                title={t('Weaknesses', 'Slabiny')}
                onClick={() => onViewChange('weaknesses')}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" />
                    <path d="m13 6-3 6h4l-3 6" />
                </svg>
            </button>
            <button
                type="button"
                aria-pressed={view === 'resistances'}
                aria-controls={controlsId}
                aria-label={t('Resistances & immunities', 'Odolnosti a imunity')}
                title={t('Resistances & immunities', 'Odolnosti a imunity')}
                onClick={() => onViewChange('resistances')}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" />
                    <path d="m8 12 3 3 5-6" />
                </svg>
            </button>
        </div>
    );
}
