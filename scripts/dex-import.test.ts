import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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
    const { sql, spritesSql, formsSql, itemsSql, abilitiesSql, counts, datasetId } =
        buildDexImport(sources);
    strictEqual(datasetId, 'emerald-ex-1.0.4');
    strictEqual(
        abilitiesSql,
        await readFile(new URL('sql/016_import_abilities_1.0.4.sql', import.meta.url), 'utf8'),
    );
    deepStrictEqual(
        [...abilitiesSql.matchAll(/DELETE FROM (\w+)/g)].map((match) => match[1]),
        ['emerald_ex_species_abilities', 'emerald_ex_abilities', 'emerald_ex_sources'],
    );
    strictEqual(abilitiesSql.includes("('emerald-ex-1.0.4', 914, 3, 'hidden', 23)"), true);
    strictEqual(abilitiesSql.includes("('emerald-ex-1.0.4', 94, 2, 'normal', NULL)"), true);
    strictEqual(
        itemsSql,
        await readFile(new URL('sql/014_import_items_1.0.4.sql', import.meta.url), 'utf8'),
    );
    deepStrictEqual(
        [...itemsSql.matchAll(/DELETE FROM (\w+)/g)].map((match) => match[1]),
        ['emerald_ex_form_change_items', 'emerald_ex_evolution_items', 'emerald_ex_sources'],
    );
    strictEqual(itemsSql.includes('icon_file = VALUES(icon_file)'), false);
    deepStrictEqual(counts, {
        emerald_ex_datasets: 1,
        emerald_ex_sources: 8,
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
        emerald_ex_form_change_methods: 20,
        emerald_ex_form_groups: 209,
        emerald_ex_species_forms: 700,
        emerald_ex_form_changes: 1600,
        emerald_ex_item_pockets: 5,
        emerald_ex_items: 828,
        emerald_ex_evolution_items: 125,
        emerald_ex_form_change_items: 1167,
        emerald_ex_abilities: 311,
        emerald_ex_species_abilities: 4569,
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
    strictEqual(
        formsSql,
        await readFile(new URL('sql/012_import_forms_1.0.4.sql', import.meta.url), 'utf8'),
    );
    deepStrictEqual(
        [...formsSql.matchAll(/DELETE FROM (\w+)/g)].map((match) => match[1]),
        [
            'emerald_ex_form_changes',
            'emerald_ex_species_forms',
            'emerald_ex_form_groups',
            'emerald_ex_form_change_methods',
            'emerald_ex_sources',
        ],
    );
    strictEqual(formsSql.includes("AND source_kind = 'forms'"), true);
    strictEqual(formsSql.includes("('emerald-ex-1.0.4', 1167, 0, NULL, 0, 1,"), true);
});

void test('SQL string literals preserve Unicode, quotes and backslashes under NO_BACKSLASH_ESCAPES', () => {
    strictEqual(sqlLiteral("Farfetch'd \\ path\nPokémon"), "'Farfetch''d \\ path\nPokémon'");
    strictEqual(sqlLiteral(null), 'NULL');
    strictEqual(sqlLiteral(false), '0');
    throws(() => sqlLiteral(Number.NaN), /safe integers/);
    throws(() => sqlLiteral('bad\0string'), /NUL/);
});

void test('SQL sessions select and preserve the schema collation before executing queries', async () => {
    const files = await readdir(new URL('sql/', import.meta.url));
    for (const file of files.filter(
        (name) => /^\d{3}_.*\.sql$/.test(name) && !name.startsWith('000_'),
    )) {
        const sql = await readFile(new URL(`sql/${file}`, import.meta.url), 'utf8');
        const firstStatement = sql
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => line !== '' && !line.startsWith('--'));
        strictEqual(firstStatement, 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;', file);
        for (const match of sql.matchAll(/^\s*SET\s+NAMES\b[^;]*;/gim)) {
            strictEqual(
                /^SET\s+NAMES\s+utf8mb4\s+COLLATE\s+utf8mb4_unicode_ci;$/i.test(match[0].trim()),
                true,
                `${file}: ${match[0].trim()}`,
            );
        }
    }
});

void test('schema, import and query examples stay within the dex table namespace', async () => {
    const schema = await readFile(new URL('sql/001_schema.sql', import.meta.url), 'utf8');
    const tables = new Set(
        [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((match) => match[1]),
    );
    strictEqual(tables.size, 24);
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
        '011_forms.sql',
        '012_import_forms_1.0.4.sql',
        '013_items.sql',
        '014_import_items_1.0.4.sql',
        '015_abilities.sql',
        '016_import_abilities_1.0.4.sql',
    ]) {
        const sql = await readFile(new URL(`sql/${file}`, import.meta.url), 'utf8');
        strictEqual(/^\s*(?:(?:CREATE|ALTER|DROP) DATABASE|USE\s)/im.test(sql), false, file);
        for (const match of sql.matchAll(
            /\b(?:REFERENCES|FROM|JOIN|INSERT INTO|(?<!DUPLICATE KEY )UPDATE|ALTER TABLE) (\w+(?:\.\w+)?)/g,
        )) {
            if (match[1] === 'information_schema.COLUMNS') continue;
            strictEqual(tables.has(match[1]), true, `${file}: ${match[1]}`);
        }
    }
});

interface FormsFixture {
    metadata: Record<string, unknown>;
    methodLegend: Record<string, string>;
    groups: {
        formGroupId: number;
        baseSpeciesId: number;
        baseName: string;
        members: {
            speciesId: number;
            name: string;
            isBaseForm: boolean;
            formKind: string;
            formLabel: string | null;
        }[];
    }[];
    changes: {
        sourceSpeciesId: number;
        sourceName: string;
        targetSpeciesId: number;
        targetName: string | null;
        restorePreviousForm: boolean;
        methodId: number;
        changeOrder: number;
        details: Record<string, unknown>;
        rawParams: Record<string, number>;
    }[];
    species: { speciesId: number; name: string }[];
}

void test('form imports reject malformed counts, memberships, species, methods and restore sentinels', () => {
    const cases: ((data: FormsFixture) => void)[] = [
        (data) => {
            data.metadata.game = 'Other game';
        },
        (data) => {
            data.metadata.version = '9.9.9';
        },
        (data) => {
            data.metadata.formGroupCount = 210;
        },
        (data) => {
            data.species.pop();
        },
        (data) => {
            data.species[0].name = 'Wrong name';
        },
        (data) => {
            data.groups[1].formGroupId = data.groups[0].formGroupId;
        },
        (data) => {
            data.groups[0].members[0].isBaseForm = false;
        },
        (data) => {
            data.groups[0].members[1].isBaseForm = true;
        },
        (data) => {
            data.groups[0].members[1].speciesId = 65535;
        },
        (data) => {
            data.groups[0].members.push(data.groups[0].members[1]);
        },
        (data) => {
            data.groups[0].baseSpeciesId = 65535;
        },
        (data) => {
            data.changes.pop();
        },
        (data) => {
            data.changes[0].methodId = 65535;
        },
        (data) => {
            delete data.methodLegend['20'];
        },
        (data) => {
            data.changes[0].sourceSpeciesId = 65535;
        },
        (data) => {
            data.changes[0].targetSpeciesId = 65535;
        },
        (data) => {
            data.changes[0].targetSpeciesId = 0;
            data.changes[0].targetName = null;
        },
        (data) => {
            data.changes.find((change) => change.targetSpeciesId === 0)!.restorePreviousForm =
                false;
        },
        (data) => {
            data.changes[1].changeOrder = data.changes[0].changeOrder;
        },
        (data) => {
            data.changes[0].rawParams.param1 = 65536;
        },
    ];
    for (const mutate of cases) {
        const data = JSON.parse(sources.forms.contents) as FormsFixture;
        mutate(data);
        throws(() =>
            buildDexImport({
                ...sources,
                forms: { ...sources.forms, contents: JSON.stringify(data) },
            }),
        );
    }
});

void test('the forms migration matches the fresh schema and preserves opaque mechanic details', async () => {
    const schema = await readFile(new URL('sql/001_schema.sql', import.meta.url), 'utf8');
    const migration = await readFile(new URL('sql/011_forms.sql', import.meta.url), 'utf8');
    strictEqual(
        schema
            .replaceAll('\r\n', '\n')
            .includes(
                migration.slice(migration.indexOf('CREATE TABLE')).trim().replaceAll('\r\n', '\n'),
            ),
        true,
    );
    const { formsSql } = buildDexImport(sources);
    for (const name of [
        'Gengarite',
        'Blue Orb',
        'Rotom Catalog',
        'Forecast',
        'DragonAscent',
        'Ultranecrozium Z',
    ])
        strictEqual(formsSql.includes(name), true, name);
    strictEqual(formsSql.includes('"heldItem":null,"requiredAbility":null'), true);
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
    strictEqual(
        schema
            .replaceAll('\r\n', '\n')
            .includes(
                migration.slice(migration.indexOf('CREATE TABLE')).trim().replaceAll('\r\n', '\n'),
            ),
        true,
    );
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

void test('items reject missing IDs, invalid counts, pockets, paths, booleans and rule references', () => {
    const original = JSON.parse(sources.items.contents) as {
        metadata: Record<string, unknown>;
        items: Record<string, unknown>[];
    };
    const cases = [
        (data: typeof original) => {
            data.metadata.version = '9.9.9';
        },
        (data: typeof original) => {
            data.metadata.itemCount = 829;
        },
        (data: typeof original) => {
            data.items.pop();
        },
        (data: typeof original) => {
            data.items[1].itemId = 0;
        },
        (data: typeof original) => {
            data.items[1].pocket = 'Wrong';
        },
        (data: typeof original) => {
            data.items[1].icon = 'icons/../secret.png';
        },
        (data: typeof original) => {
            data.items[1].notConsumed = 1;
        },
        (data: typeof original) => {
            data.items[1].price = -1;
        },
    ];
    for (const change of cases) {
        const data = structuredClone(original);
        change(data);
        throws(() =>
            buildDexImport({
                ...sources,
                items: { ...sources.items, contents: JSON.stringify(data) },
            }),
        );
    }
    const evolution = JSON.parse(sources.evolutions.contents) as {
        edges: { conditions: Record<string, unknown> }[];
    };
    evolution.edges[0].conditions.item = { itemId: 828, name: 'Unknown' };
    throws(
        () =>
            buildDexImport({
                ...sources,
                evolutions: { ...sources.evolutions, contents: JSON.stringify(evolution) },
            }),
        /integer/,
    );
});

void test('all 828 item icon files exist and have native 24x24 PNG headers', async () => {
    const data = JSON.parse(sources.items.contents) as { items: { icon: string }[] };
    await validateSpriteFiles(
        fileURLToPath(new URL('../assets/items/', import.meta.url)),
        data.items.map((item) => item.icon.slice('icons/'.length)),
        24,
    );
});

void test('ability imports reject malformed definitions, slots, aliases and metadata', () => {
    const original = JSON.parse(sources.abilities.contents) as {
        metadata: {
            abilityCount: number;
            speciesFormCount: number;
            distinctAbilitiesUsedBySpecies: number;
        };
        abilities: { abilityId: number; aiRating: number; flags: Record<string, unknown> }[];
        species: {
            speciesId: number;
            name: string;
            ability1: { abilityId: number; name: string };
            slots: {
                slot: number;
                kind: string;
                ability: { abilityId: number; name: string } | null;
            }[];
        }[];
    };
    const mutations: ((source: typeof original) => void)[] = [
        (source) => {
            source.metadata.abilityCount = 310;
        },
        (source) => {
            source.metadata.speciesFormCount = 1522;
        },
        (source) => {
            source.metadata.distinctAbilitiesUsedBySpecies = 309;
        },
        (source) => {
            source.abilities.pop();
        },
        (source) => {
            source.abilities[1].abilityId = 0;
        },
        (source) => {
            source.abilities[1].aiRating = -129;
        },
        (source) => {
            source.abilities[1].flags.breakable = 1;
        },
        (source) => {
            source.species[0].name = 'Wrong name';
        },
        (source) => {
            source.species[0].slots.pop();
        },
        (source) => {
            source.species[0].slots[1].slot = 1;
        },
        (source) => {
            source.species[0].slots[2].kind = 'normal';
        },
        (source) => {
            source.species[0].slots[0].ability!.abilityId = 0;
        },
        (source) => {
            source.species[0].slots[0].ability!.abilityId = 311;
        },
        (source) => {
            source.species[0].slots[0].ability!.name = 'Wrong ability';
        },
        (source) => {
            source.species[0].ability1.abilityId = 1;
        },
        (source) => {
            source.species[0].slots[1].ability = source.species[0].ability1;
        },
    ];
    for (const mutate of mutations) {
        const altered = structuredClone(original);
        mutate(altered);
        throws(() =>
            buildDexImport({
                ...sources,
                abilities: { ...sources.abilities, contents: JSON.stringify(altered) },
            }),
        );
    }
});

void test('ability upgrade schema matches the fresh schema', async () => {
    const schema = (
        await readFile(new URL('sql/001_schema.sql', import.meta.url), 'utf8')
    ).replaceAll('\r\n', '\n');
    const upgrade = (
        await readFile(new URL('sql/015_abilities.sql', import.meta.url), 'utf8')
    ).replaceAll('\r\n', '\n');
    strictEqual(schema.includes(upgrade.slice(upgrade.indexOf('CREATE TABLE'))), true);
});
