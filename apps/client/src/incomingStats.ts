import { getNatureStatEffect, type BaseStats, type Pokemon } from '@pokemon-emerald-ex-dex/shared';
import { estimateEnemyStats } from './damageSimulation.js';

/** Fill only missing defenses for incoming estimates; measurements already include nature. */
export function getIncomingStats(
    species: Pokemon,
    level: number,
    recorded: Partial<BaseStats>,
    natureId?: number | null,
): { stats: Partial<BaseStats>; estimated: boolean } {
    const fallback = estimateEnemyStats(species, level);
    const stats: Partial<BaseStats> = {};
    let estimated = false;
    for (const key of ['hp', 'defense', 'spDefense'] as const) {
        if (recorded[key] !== undefined) stats[key] = recorded[key];
        else if (fallback) {
            const effect = getNatureStatEffect(natureId, key);
            const modifier = effect === 'increased' ? 110 : effect === 'decreased' ? 90 : 100;
            stats[key] = Math.floor((fallback[key] * modifier) / 100);
            estimated = true;
        }
    }
    return { stats, estimated };
}
