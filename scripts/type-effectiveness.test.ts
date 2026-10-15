import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const typeIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18];

async function readSeed(): Promise<Map<string, number>> {
    const sql = await readFile(
        new URL('sql/025_seed_type_effectiveness.sql', import.meta.url),
        'utf8',
    );
    const rows = [...sql.matchAll(/\('([^']+)', (\d+), (\d+), ([\d.]+)\)/g)];
    const matchups = new Map<string, number>();
    for (const [, datasetId, attackingId, defendingId, multiplier] of rows) {
        strictEqual(datasetId, 'emerald-ex-1.0.4');
        const key = `${attackingId}:${defendingId}`;
        strictEqual(matchups.has(key), false, `Duplicate matchup ${key}`);
        matchups.set(key, Number(multiplier));
    }
    return matchups;
}

void test('type-effectiveness seed contains every directed pair exactly once, excluding Mystery', async () => {
    const matchups = await readSeed();
    strictEqual(matchups.size, 18 * 18);
    const counts = new Map<number, number>();
    for (const attackingId of typeIds) {
        for (const defendingId of typeIds) {
            const multiplier = matchups.get(`${attackingId}:${defendingId}`);
            ok(multiplier !== undefined, `Missing matchup ${attackingId}:${defendingId}`);
            counts.set(multiplier, (counts.get(multiplier) ?? 0) + 1);
        }
    }
    deepStrictEqual(
        counts,
        new Map([
            [0, 8],
            [0.5, 61],
            [1, 204],
            [2, 51],
        ]),
    );
    ok([...matchups.keys()].every((key) => key.split(':').every((id) => id !== '9')));
});

void test('type-effectiveness seed preserves attack direction and modern Fairy and Steel matchups', async () => {
    const matchups = await readSeed();
    const examples: [number, number, number][] = [
        [10, 11, 0.5], // Fire attacks Water.
        [11, 10, 2], // Water attacks Fire.
        [1, 0, 2], // Fighting attacks Normal.
        [0, 1, 1], // Normal attacks Fighting.
        [18, 16, 2], // Fairy attacks Dragon.
        [16, 18, 0], // Dragon attacks Fairy.
        [3, 18, 2], // Poison attacks Fairy.
        [8, 18, 2], // Steel attacks Fairy.
        [17, 8, 1], // Steel no longer resists Dark.
        [7, 8, 1], // Steel no longer resists Ghost.
    ];
    for (const [attackingId, defendingId, expected] of examples) {
        strictEqual(matchups.get(`${attackingId}:${defendingId}`), expected);
    }
});

void test('type-effectiveness seed contains all eight directed immunities', async () => {
    const matchups = await readSeed();
    deepStrictEqual(
        new Set([...matchups].filter(([, multiplier]) => multiplier === 0).map(([pair]) => pair)),
        new Set(['0:7', '1:7', '3:8', '4:2', '7:0', '13:4', '14:17', '16:18']),
    );
});

void test('seeded factors produce dual-type weaknesses, resistances, cancellations, and immunities', async () => {
    const matchups = await readSeed();
    const cases: [number, number[], number][] = [
        [12, [11, 4], 4], // Grass attacks Water/Ground.
        [12, [6, 3], 0.25], // Grass attacks Bug/Poison.
        [10, [11, 12], 1], // Fire attacks Water/Grass.
        [13, [11, 4], 0], // Electric immunity dominates Water's weakness.
        [0, [0, 7], 0], // A neutral factor does not remove Ghost immunity.
    ];
    for (const [attackingId, defendingIds, expected] of cases) {
        const factors = defendingIds.map((id) => matchups.get(`${attackingId}:${id}`));
        ok(factors.every((factor) => factor !== undefined));
        strictEqual(
            factors.reduce((product, factor) => product * factor, 1),
            expected,
        );
    }
});
