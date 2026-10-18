import { useQueries } from '@tanstack/react-query';
import type { KnownMove, Move, TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionMove } from './collectionSpecies.js';
import { useLanguage } from './language.js';
import { getRecordedMoveMatchups } from './recordedMoveMatchups.js';
import { TypeBadges } from './TypeBadges.js';
import { typeDisplayName } from './typeNames.js';

interface BattleMoveMatchup {
    typeId: number;
    name: string;
    iconFile: string | null;
    multiplier: number;
    moveNames: string[];
}

/** Verified recorded damaging moves only, grouped without implying unrecorded coverage. */
export function getBattleTypeMatchups(
    defendingTypeIds: readonly number[],
    attackingMoves: readonly KnownMove[] | null,
    moveDetails: ReadonlyMap<number, Move>,
    chart: TypeEffectivenessChart | undefined,
): BattleMoveMatchup[] {
    const matchups = getRecordedMoveMatchups(attackingMoves, moveDetails, defendingTypeIds, chart);
    if (matchups.status !== 'available') return [];
    const grouped = new Map<string, BattleMoveMatchup>();
    for (const { move, multiplier } of matchups.moves) {
        if (multiplier === 1) continue;
        const key = `${move.typeId}:${multiplier}`;
        const existing = grouped.get(key);
        if (existing) existing.moveNames.push(move.name);
        else
            grouped.set(key, {
                typeId: move.typeId,
                name: move.type,
                iconFile: move.typeIconFile,
                multiplier,
                moveNames: [move.name],
            });
    }
    return [...grouped.values()];
}

export function BattleTypeMatchups({
    defendingTypeIds,
    attackingMoves,
    chart,
    defenderName,
}: {
    defendingTypeIds: readonly number[];
    attackingMoves: readonly KnownMove[] | null;
    chart?: TypeEffectivenessChart;
    defenderName: string;
}) {
    const { t, language } = useLanguage();
    const ids = [...new Set((attackingMoves ?? []).map((move) => move.moveId))];
    const lookups = useQueries({
        queries: ids.map((moveId) => ({
            queryKey: ['collection-move', moveId],
            queryFn: () => loadCollectionMove(moveId),
        })),
    });
    const moveDetails = new Map<number, Move>();
    for (const lookup of lookups) {
        if (lookup.data) moveDetails.set(lookup.data.moveId, lookup.data);
    }
    const matchups = getBattleTypeMatchups(defendingTypeIds, attackingMoves, moveDetails, chart);
    if (!matchups?.length) return null;
    return (
        <aside
            className="sim-battle-matchups"
            aria-label={t(
                `${defenderName}: recorded move matchups`,
                `${defenderName}: účinnost zaznamenaných útoků`,
            )}
        >
            <ul>
                {matchups.map((type) => {
                    const kind =
                        type.multiplier === 0
                            ? 'immune'
                            : type.multiplier > 1
                              ? 'weak'
                              : 'resistant';
                    const label =
                        type.multiplier === 0
                            ? t('Immune', 'Imunita')
                            : type.multiplier > 1
                              ? t('Weakness', 'Slabina')
                              : t('Resistance', 'Odolnost');
                    const multiplier =
                        type.multiplier === 0.5
                            ? '½×'
                            : type.multiplier === 0.25
                              ? '¼×'
                              : `${type.multiplier}×`;
                    return (
                        <li
                            key={`${type.typeId}:${type.multiplier}`}
                            data-matchup={kind}
                            data-multiplier={type.multiplier}
                            title={t(
                                `${type.moveNames.join(', ')} (${typeDisplayName(type.name, language)}): ${multiplier} damage taken`,
                                `${type.moveNames.join(', ')} (${typeDisplayName(type.name, language)}): přijaté poškození ${multiplier}`,
                            )}
                        >
                            <span className="sim-matchup-label">{label}</span>
                            <span className="sim-matchup-value">
                                <TypeBadges
                                    types={[type.name]}
                                    iconFiles={[type.iconFile]}
                                    iconOnly
                                />
                                <strong>{multiplier}</strong>
                            </span>
                        </li>
                    );
                })}
            </ul>
            <span className="sr-only">
                {t(
                    'Based on recorded damaging moves. Unrecorded moves, abilities and battle effects are excluded.',
                    'Podle zaznamenaných útoků s poškozením. Nezaznamenané útoky, schopnosti a bojové efekty nejsou zahrnuty.',
                )}
            </span>
        </aside>
    );
}
