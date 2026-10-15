import { createContext, useContext, type ReactNode } from 'react';
import type { BaseStats, Move } from '@pokemon-emerald-ex-dex/shared';

import type { Translate } from './language.js';

type OffensiveStats = Pick<BaseStats, 'attack' | 'spAttack'>;
export type MoveAffinity = 'physical' | 'special';

const MoveAffinityContext = createContext<OffensiveStats | undefined>(undefined);

export function MoveAffinityProvider({
    stats,
    children,
}: {
    stats?: OffensiveStats;
    children: ReactNode;
}) {
    return <MoveAffinityContext.Provider value={stats}>{children}</MoveAffinityContext.Provider>;
}

/** Match the base Attack/Sp. Attack comparison shown by OffensiveStatIndicator. */
export function getMoveAffinity(
    stats: OffensiveStats | undefined,
    move: Pick<Move, 'categoryId'> | undefined,
): MoveAffinity | null {
    if (!stats || !move) return null;
    if (move.categoryId === 0 && stats.attack >= stats.spAttack) return 'physical';
    if (move.categoryId === 1 && stats.spAttack >= stats.attack) return 'special';
    return null;
}

export function useMoveAffinity(move?: Pick<Move, 'categoryId'>): MoveAffinity | null {
    return getMoveAffinity(useContext(MoveAffinityContext), move);
}

export function moveAffinityLabel(affinity: MoveAffinity | null, t: Translate): string | undefined {
    if (affinity === 'physical')
        return t(
            "Physical move suits this Pokémon's base offensive stats",
            'Fyzický útok odpovídá základním útočným statistikám tohoto Pokémona',
        );
    if (affinity === 'special')
        return t(
            "Special move suits this Pokémon's base offensive stats",
            'Speciální útok odpovídá základním útočným statistikám tohoto Pokémona',
        );
    return undefined;
}
