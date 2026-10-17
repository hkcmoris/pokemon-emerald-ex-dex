import type { BaseStats } from '@pokemon-emerald-ex-dex/shared';

import type { BattleStrengthResult } from './battleStrength.js';
import { useLanguage, type Translate } from './language.js';

function statLabel(key: keyof BaseStats, t: Translate): string {
    const labels: Record<keyof BaseStats, string> = {
        hp: t('HP', 'HP'),
        attack: t('Attack', 'Útok'),
        defense: t('Defense', 'Obrana'),
        spAttack: t('Sp. Attack', 'Spec. útok'),
        spDefense: t('Sp. Defense', 'Spec. obrana'),
        speed: t('Speed', 'Rychlost'),
    };
    return labels[key];
}

export function BattleStrengthBadge({
    result,
    loading = false,
    compact = false,
    onRetry,
}: {
    result: BattleStrengthResult;
    loading?: boolean;
    compact?: boolean;
    onRetry?: () => void;
}) {
    const { t, locale } = useLanguage();
    const available = !loading && result.status === 'available' && result.value !== null;
    const estimated = available && result.estimatedStats.length > 0;
    const statusLabel = loading
        ? t('Calculating…', 'Počítání…')
        : result.status === 'conflict'
          ? t('Conflicting records', 'Rozporné záznamy')
          : result.status === 'incomplete'
            ? t('Incomplete', 'Neúplné')
            : t('Unavailable', 'Nedostupné');
    const compactLabel = available
        ? t(
              `Battle strength: ${result.value}/100${estimated ? ', estimated' : ''}`,
              `Bojová síla: ${result.value}/100${estimated ? ', odhad' : ''}`,
          )
        : `${t('Battle strength', 'Bojová síla')}: ${statusLabel}`;
    const formatPart = (value: number | null): string =>
        value === null
            ? t('Unknown', 'Neznámé')
            : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}${t(' pts', ' b.')}`;
    const hasParts = Object.values(result.parts).some((part) => part !== null);
    const reason = loading
        ? t('Loading the data needed to calculate strength.', 'Načítání dat pro výpočet síly.')
        : result.reason === 'unknown-moves'
          ? t(
                'Record the current moves to calculate an overall score. Unknown moves are not treated as an empty moveset.',
                'Pro celkové skóre zadejte současné útoky. Neznámé útoky se nepovažují za prázdnou sadu.',
            )
          : result.reason === 'conflict'
            ? t(
                  'Resolve the conflicting records to calculate a reliable score.',
                  'Pro spolehlivé skóre vyřešte rozporné záznamy.',
              )
            : result.reason === 'missing-reference'
              ? t(
                    'Some species, move, or type data is unavailable. The score will appear when the required data is available.',
                    'Některá data o druhu, útocích nebo typech nejsou dostupná. Skóre se zobrazí, až budou potřebná data dostupná.',
                )
              : null;

    return (
        <details
            className={`my-strength${compact ? ' my-strength-compact' : ''}`}
            data-status={loading ? 'loading' : result.status}
            aria-busy={loading || undefined}
        >
            <summary
                className="my-strength-summary"
                aria-label={compact ? compactLabel : undefined}
                title={compact ? compactLabel : undefined}
            >
                {compact ? (
                    <strong aria-hidden="true">{available ? result.value : '—'}</strong>
                ) : (
                    <span className="my-strength-heading">
                        <span>{t('Battle strength', 'Bojová síla')}</span>
                        <span className="my-strength-rating">
                            {available ? (
                                <>
                                    <strong>{result.value}</strong>
                                    <span className="my-strength-scale">/100</span>
                                    {estimated && (
                                        <span className="my-strength-estimated">
                                            {t('Estimated', 'Odhad')}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="my-strength-state">{statusLabel}</span>
                            )}
                        </span>
                    </span>
                )}
            </summary>
            <div className="my-strength-breakdown">
                {reason && <p>{reason}</p>}
                {!loading && hasParts && (
                    <dl className="my-strength-parts">
                        <div>
                            <dt>{t('Stats', 'Statistiky')}</dt>
                            <dd>{formatPart(result.parts.stats)}</dd>
                        </div>
                        <div>
                            <dt>{t('Moves', 'Útoky')}</dt>
                            <dd>{formatPart(result.parts.moves)}</dd>
                        </div>
                        <div>
                            <dt>{t('Typing', 'Typy')}</dt>
                            <dd>{formatPart(result.parts.typing)}</dd>
                        </div>
                    </dl>
                )}
                <p>
                    {t(
                        'Current level and stats set the foundation; moves and typing adjust it. Scores use a fixed scale and do not depend on your other Pokémon.',
                        'Základem jsou současná úroveň a statistiky; útoky a typy skóre upravují. Stupnice je pevná a nezávisí na vašich ostatních Pokémonech.',
                    )}
                </p>
                {!loading && result.estimatedStats.length > 0 && (
                    <>
                        <p>
                            {t('Estimated stats: ', 'Odhadnuté statistiky: ')}
                            {result.estimatedStats.map((key) => statLabel(key, t)).join(', ')}.
                        </p>
                        <p>
                            {t(
                                'Missing stats use the current species and level with 15 IVs, 0 EVs, and the known nature (otherwise neutral). These are estimates, not recorded values.',
                                'Chybějící statistiky se odhadují pro současný druh a úroveň s 15 IV, 0 EV a známou povahou (jinak neutrální). Jde o odhady, nikoli zaznamenané hodnoty.',
                            )}
                        </p>
                    </>
                )}
                {!loading && result.unsupportedMoves.length > 0 && (
                    <p>
                        {t('Effects not included in the score: ', 'Efekty nezahrnuté do skóre: ')}
                        {result.unsupportedMoves.map((move) => move.name).join(', ')}.
                    </p>
                )}
                <p>
                    {t(
                        'Abilities, held items, and temporary battle effects are excluded.',
                        'Schopnosti, držené předměty a dočasné bojové efekty nejsou zahrnuty.',
                    )}
                </p>
                {!loading && result.reason === 'missing-reference' && onRetry && (
                    <button type="button" className="my-text-button" onClick={onRetry}>
                        {t('Retry calculation', 'Zkusit výpočet znovu')}
                    </button>
                )}
            </div>
        </details>
    );
}
