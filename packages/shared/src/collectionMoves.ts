import type { KnownMove } from './collection.js';
import type { LearnsetEntry } from './dex.js';

/** Initial moves from this species' most recent ordinary level-up entries. */
export function getDefaultMoves(learnset: readonly LearnsetEntry[], level: number): KnownMove[] {
    const eligible = learnset
        .filter((move) => move.level > 0 && move.level <= level)
        .sort((a, b) => b.level - a.level || b.entryOrder - a.entryOrder);
    const selected: KnownMove[] = [];
    const seen = new Set<number>();
    for (const move of eligible) {
        if (seen.has(move.moveId)) continue;
        selected.push({ moveId: move.moveId, name: move.name });
        seen.add(move.moveId);
        if (selected.length === 4) break;
    }
    return selected.reverse();
}
