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
        emerald_ex_datasets: 1,
        emerald_ex_sources: 4,
        emerald_ex_types: 19,
        emerald_ex_move_categories: 3,
        emerald_ex_evolution_methods: 48,
        emerald_ex_species: 1523,
        emerald_ex_species_stats: 1523,
        emerald_ex_species_types: 2280,
        emerald_ex_moves: 935,
        emerald_ex_learnset_entries: 23729,
        emerald_ex_machines: 58,
        emerald_ex_species_machines: 32358,
        emerald_ex_evolutions: 644,
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

void test('schema, import and query examples stay within the dex table namespace', async () => {
    const schema = await readFile(new URL('sql/001_schema.sql', import.meta.url), 'utf8');
    const tables = new Set(
        [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((match) => match[1]),
    );
    strictEqual(tables.size, 13);
    strictEqual(
        [...tables].every((name) => name.startsWith('emerald_ex_')),
        true,
    );
    for (const match of schema.matchAll(
        /(?:CONSTRAINT|UNIQUE KEY|KEY) ((?:emerald_ex_)?(?:fk|chk|uq|idx)_\w+)/g,
    )) {
        strictEqual(match[1].startsWith('emerald_ex_'), true, match[1]);
    }
    for (const file of [
        '001_schema.sql',
        '002_import_emerald_ex_1.0.4.sql',
        '003_verify_import.sql',
        '004_api_query_examples.sql',
    ]) {
        const sql = await readFile(new URL(`sql/${file}`, import.meta.url), 'utf8');
        strictEqual(/^\s*(?:(?:CREATE|ALTER|DROP) DATABASE|USE\s)/im.test(sql), false, file);
        for (const match of sql.matchAll(/\b(?:REFERENCES|FROM|JOIN|INSERT INTO) (\w+)/g)) {
            strictEqual(tables.has(match[1]), true, `${file}: ${match[1]}`);
        }
    }
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
