import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
    buildDexImport,
    sourceKinds,
    sqlLiteral,
    type SourceFile,
    type SourceKind,
} from './dex-import.js';

const sources = {} as Record<SourceKind, SourceFile>;
for (const kind of sourceKinds) {
    const fileName = `pokemon_emerald_ex_1.0.4_${kind}.json`;
    sources[kind] = {
        fileName,
        contents: await readFile(new URL(`../docs/${fileName}`, import.meta.url), 'utf8'),
    };
}

void test('all exports produce a complete relational import, including move zero and form markers', async () => {
    const { sql, counts, datasetId } = buildDexImport(sources);
    strictEqual(datasetId, 'emerald-ex-1.0.4');
    deepStrictEqual(counts, {
        dex_datasets: 1,
        dex_sources: 4,
        pokemon_types: 19,
        move_categories: 3,
        evolution_methods: 48,
        species: 1523,
        species_stats: 1523,
        species_types: 2280,
        moves: 935,
        learnset_entries: 23729,
        machines: 58,
        species_machines: 32358,
        evolutions: 644,
    });
    strictEqual(sql.includes("('emerald-ex-1.0.4', 0, '-', ''"), true);
    strictEqual(sql.includes('65534'), true);
    strictEqual(
        sql,
        await readFile(new URL('sql/002_import_emerald_ex_1.0.4.sql', import.meta.url), 'utf8'),
    );
});

void test('SQL string literals preserve Unicode, quotes and backslashes under NO_BACKSLASH_ESCAPES', () => {
    strictEqual(sqlLiteral("Farfetch'd \\ path\nPokémon"), "'Farfetch''d \\ path\nPokémon'");
    strictEqual(sqlLiteral(null), 'NULL');
    strictEqual(sqlLiteral(false), '0');
    throws(() => sqlLiteral(Number.NaN), /safe integers/);
    throws(() => sqlLiteral('bad\0string'), /NUL/);
});

void test('a stale move description in a learnset is rejected before SQL is written', () => {
    const contents = sources.learnsets.contents.replace(
        'Charges the foe with a full- body tackle.',
        'Changed description',
    );
    throws(
        () => buildDexImport({ ...sources, learnsets: { ...sources.learnsets, contents } }),
        /Conflicting description/,
    );
});

void test('wrong source versions and incorrect base-stat totals are rejected', () => {
    const wrongVersion = sources.evolutions.contents.replace('"1.0.4"', '"9.9.9"');
    throws(
        () =>
            buildDexImport({
                ...sources,
                evolutions: { ...sources.evolutions, contents: wrongVersion },
            }),
        /version mismatch/,
    );
    const wrongStats = sources.stats_types.contents.replace(
        '"baseStatTotal": 318',
        '"baseStatTotal": 999',
    );
    throws(
        () =>
            buildDexImport({
                ...sources,
                stats_types: { ...sources.stats_types, contents: wrongStats },
            }),
        /Stat total mismatch/,
    );
});
