import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
    buildDexImport,
    sourceKinds,
    sourceFileNames,
    sourceFilePath,
    sqlLiteral,
    type SourceFile,
    type SourceKind,
} from './dex-import.js';
import { validateSpriteFiles } from './sprite-files.js';

const sources = {} as Record<SourceKind, SourceFile>;
for (const kind of sourceKinds) {
    const fileName = sourceFileNames[kind];
    sources[kind] = {
        fileName,
        contents: await readFile(new URL(`../${sourceFilePath(kind)}`, import.meta.url), 'utf8'),
    };
}

void test('all exports produce a complete relational import, including move zero and form markers', async () => {
    const { sql, spritesSql, counts, datasetId } = buildDexImport(sources);
    strictEqual(datasetId, 'emerald-ex-1.0.4');
    deepStrictEqual(counts, {
        emerald_ex_datasets: 1,
        emerald_ex_sources: 5,
        emerald_ex_types: 19,
        emerald_ex_move_categories: 3,
        emerald_ex_evolution_methods: 48,
        emerald_ex_species: 1523,
        emerald_ex_species_sprites: 1523,
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
    strictEqual(
        spritesSql,
        await readFile(new URL('sql/006_import_sprites_1.0.4.sql', import.meta.url), 'utf8'),
    );
    const deletes = [...spritesSql.matchAll(/DELETE FROM (\w+)/g)].map((match) => match[1]);
    deepStrictEqual(deletes, ['emerald_ex_species_sprites', 'emerald_ex_sources']);
    strictEqual(spritesSql.includes("AND source_kind = 'battle_sprites'"), true);
    strictEqual(spritesSql.includes('1431, NULL, NULL, NULL, NULL, NULL, NULL, 0'), true);
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
    strictEqual(tables.size, 14);
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
        '005_species_sprites.sql',
        '006_import_sprites_1.0.4.sql',
        '007_move_category_icons.sql',
        '008_seed_move_category_icons.sql',
        '009_type_icons.sql',
        '010_seed_type_icons.sql',
    ]) {
        const sql = await readFile(new URL(`sql/${file}`, import.meta.url), 'utf8');
        strictEqual(/^\s*(?:(?:CREATE|ALTER|DROP) DATABASE|USE\s)/im.test(sql), false, file);
        for (const match of sql.matchAll(
            /\b(?:REFERENCES|FROM|JOIN|INSERT INTO|UPDATE|ALTER TABLE) (\w+(?:\.\w+)?)/g,
        )) {
            if (match[1] === 'information_schema.COLUMNS') continue;
            strictEqual(tables.has(match[1]), true, `${file}: ${match[1]}`);
        }
    }
});

void test('the type icon seed maps all supplied PNGs, including Electric/Lightning and Dark/Darkness', async () => {
    const seed = await readFile(new URL('sql/010_seed_type_icons.sql', import.meta.url), 'utf8');
    const icons = new Map(
        [...seed.matchAll(/WHEN (\d+) THEN '([^']+)'/g)].map((match) => [
            Number(match[1]),
            match[2],
        ]),
    );
    strictEqual(icons.size, 18);
    strictEqual(icons.get(13), '48px-Lightning.png');
    strictEqual(icons.get(17), '48px-Darkness.png');
    strictEqual(icons.has(9), false);
    strictEqual(seed.includes('icon_file IS NULL'), true);
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const file of icons.values()) {
        strictEqual(/[/\\]/.test(file), false);
        const bytes = await readFile(new URL(`../assets/types/${file}`, import.meta.url));
        deepStrictEqual(bytes.subarray(0, 8), pngSignature, file);
    }
});

void test('sprite references point to existing 64x64 PNGs and agree with the migration schema', async () => {
    buildDexImport(sources);
    const manifest = JSON.parse(sources.battle_sprites.contents) as {
        species: { files: Record<string, string> }[];
    };
    await validateSpriteFiles(
        fileURLToPath(
            new URL('../assets/pokemon_emerald_ex_1.0.4_battle_sprites/', import.meta.url),
        ),
        manifest.species.flatMap((entry) => Object.values(entry.files)),
    );
    const schema = await readFile(new URL('sql/001_schema.sql', import.meta.url), 'utf8');
    const migration = await readFile(
        new URL('sql/005_species_sprites.sql', import.meta.url),
        'utf8',
    );
    strictEqual(schema.includes(migration.slice(migration.indexOf('CREATE TABLE')).trim()), true);
});

void test('sprite import rejects mismatched species, missing variants, traversal and wrong counts', () => {
    for (const [before, after, message] of [
        ['"name": "Bulbasaur"', '"name": "Wrong species"', /Species\/name mismatch/],
        ['front/0001_Bulbasaur.png', 'front/0001_../Bulbasaur.png', /Invalid sprite path/],
        ['"shinyFront":', '"unknownVariant":', /Unknown sprite variant/],
        ['"frontFrameCount": 2', '"frontFrameCount": 1', /Missing\/unexpected sprite/],
        ['"speciesWithSprites": 1519', '"speciesWithSprites": 1520', /sprite count mismatch/],
    ] as const) {
        const contents = sources.battle_sprites.contents.replace(before, after);
        throws(
            () =>
                buildDexImport({
                    ...sources,
                    battle_sprites: { ...sources.battle_sprites, contents },
                }),
            message,
        );
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
