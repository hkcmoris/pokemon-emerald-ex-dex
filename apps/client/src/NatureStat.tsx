import type { ReactNode } from 'react';
import { getNatureStatEffect, type BaseStats } from '@pokemon-emerald-ex-dex/shared';

import { useLanguage } from './language.js';

export function NatureStat({
    stat,
    natureId,
    children,
}: {
    stat: keyof BaseStats;
    natureId?: number | null;
    children?: ReactNode;
}) {
    const { t } = useLanguage();
    const effect = getNatureStatEffect(natureId, stat);
    const description =
        effect === 'increased'
            ? t('Nature increases this stat by 10%.', 'Povaha zvyšuje tuto statistiku o 10 %.')
            : effect === 'decreased'
              ? t('Nature decreases this stat by 10%.', 'Povaha snižuje tuto statistiku o 10 %.')
              : undefined;
    if (!effect) return <>{children}</>;
    return (
        <span className="nature-stat" data-nature-effect={effect ?? undefined} title={description}>
            {children}
            {effect && (
                <>
                    <span className="nature-stat-arrow" aria-hidden="true">
                        {effect === 'increased' ? '↑' : '↓'}
                    </span>
                    <span className="sr-only"> {description}</span>
                </>
            )}
        </span>
    );
}
