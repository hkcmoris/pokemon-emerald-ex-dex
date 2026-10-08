import type { BaseStats } from '@pokemon-emerald-ex-dex/shared';

import { useLanguage } from './language.js';
import { MoveCategoryIcon } from './MoveCategory.js';

export function OffensiveStatIndicator({
    stats,
}: {
    stats: Pick<BaseStats, 'attack' | 'spAttack'>;
}) {
    const { t } = useLanguage();
    const attackDifference = stats.attack - stats.spAttack;
    const file =
        attackDifference > 0
            ? 'physical.svg'
            : attackDifference < 0
              ? 'special.svg'
              : 'physical-special.svg';
    const label =
        attackDifference > 0
            ? t('Attack is higher than Sp. Attack', 'Útok je vyšší než speciální útok')
            : attackDifference < 0
              ? t('Sp. Attack is higher than Attack', 'Speciální útok je vyšší než útok')
              : t('Attack and Sp. Attack are equal', 'Útok a speciální útok jsou stejné');
    return (
        <span className="stat-offense" role="img" aria-label={label} title={label}>
            <MoveCategoryIcon key={file} file={file} />
        </span>
    );
}
