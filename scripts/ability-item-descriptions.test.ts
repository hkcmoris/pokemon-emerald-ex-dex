import { deepStrictEqual, match, strictEqual, throws } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
    buildAbilityItemDescriptionImport,
    buildDescriptionImport,
    type DescriptionImport,
} from './move-descriptions.js';

type CatalogueKind = 'abilities' | 'items';

interface SourceRow {
    abilityId?: number;
    itemId?: number;
    description: string;
}

interface TranslationRow {
    abilityId?: number;
    itemId?: number;
    sourceDescription: string;
    descriptionCs: string;
}

interface DescriptionSource {
    metadata: { game: string; version: string; abilityCount?: number; itemCount?: number };
    abilities: SourceRow[];
    items: SourceRow[];
}

interface DescriptionTranslations {
    datasetId: string;
    language: string;
    abilities: TranslationRow[];
    items: TranslationRow[];
}

const catalogues = {
    abilities: { idKey: 'abilityId', label: 'ability', countKey: 'abilityCount', count: 311 },
    items: { idKey: 'itemId', label: 'item', countKey: 'itemCount', count: 828 },
} as const;

function fixture(): { source: DescriptionSource; translations: DescriptionTranslations } {
    function sourceRows(kind: CatalogueKind): SourceRow[] {
        return ['', 'Strikes twice.', '?????', 'Strikes twice.', '---'].map((description, id) => ({
            [catalogues[kind].idKey]: id,
            description,
        }));
    }
    function translationRows(kind: CatalogueKind): TranslationRow[] {
        const rows: [number, string, string][] = [
            [1, 'Strikes twice.', 'Zasáhne dvakrát.'],
            [2, '?????', '?????'],
            [3, 'Strikes twice.', 'Zasáhne dvakrát.'],
            [4, '---', '---'],
        ];
        return rows.map(([id, sourceDescription, descriptionCs]) => ({
            [catalogues[kind].idKey]: id,
            sourceDescription,
            descriptionCs,
        }));
    }
    return {
        source: {
            metadata: {
                game: 'Pokémon Emerald EX',
                version: '1.0.4',
                abilityCount: 5,
                itemCount: 5,
            },
            abilities: sourceRows('abilities'),
            items: sourceRows('items'),
        },
        translations: {
            datasetId: 'emerald-ex-1.0.4',
            language: 'cs',
            abilities: translationRows('abilities'),
            items: translationRows('items'),
        },
    };
}

void test('complete Czech ability and item catalogues reproduce the committed combined seed', async () => {
    const imports = new Map<CatalogueKind, DescriptionImport>();
    for (const kind of ['abilities', 'items'] as const) {
        const source = JSON.parse(
            await readFile(
                new URL(`../docs/pokemon_emerald_ex_1.0.4_${kind}.json`, import.meta.url),
                'utf8',
            ),
        ) as DescriptionSource;
        const translations = JSON.parse(
            await readFile(
                new URL(`../docs/translations/${kind}.cs.json`, import.meta.url),
                'utf8',
            ),
        ) as DescriptionTranslations;
        const originalSource = structuredClone(source);
        const originalTranslations = structuredClone(translations);
        const result = buildDescriptionImport(source, translations, kind);
        const { count, idKey } = catalogues[kind];

        strictEqual(source[kind].length, count);
        strictEqual(translations[kind].length, count);
        strictEqual(result.descriptions.size, count);
        deepStrictEqual(
            [...result.descriptions.keys()].sort((a, b) => a - b),
            source[kind].map((row) => row[idKey]).sort((a, b) => (a ?? 0) - (b ?? 0)),
        );
        for (const row of source[kind]) {
            if (/^(?:-+|\?+)$/.test(row.description)) {
                strictEqual(result.descriptions.get(row[idKey] ?? -1), row.description);
            }
        }
        deepStrictEqual(source, originalSource);
        deepStrictEqual(translations, originalTranslations);
        imports.set(kind, result);
    }
    const abilities = imports.get('abilities');
    const items = imports.get('items');
    if (!abilities || !items) throw new Error('Expected both description catalogues');
    strictEqual(
        buildAbilityItemDescriptionImport(abilities, items),
        await readFile(
            new URL('sql/021_seed_ability_item_descriptions_cs_1.0.4.sql', import.meta.url),
            'utf8',
        ),
    );
});

void test('combined seed ordering is stable when both source and translation catalogues are reordered', () => {
    const { source, translations } = fixture();
    const generate = () =>
        buildAbilityItemDescriptionImport(
            buildDescriptionImport(source, translations, 'abilities'),
            buildDescriptionImport(source, translations, 'items'),
        );
    const expected = generate();
    for (const kind of ['abilities', 'items'] as const) {
        source[kind].reverse();
        translations[kind].reverse();
    }
    strictEqual(generate(), expected);
});

void test('combined seed updates only Czech descriptions in its dataset within one transaction', () => {
    const { source, translations } = fixture();
    const sql = buildAbilityItemDescriptionImport(
        buildDescriptionImport(source, translations, 'abilities'),
        buildDescriptionImport(source, translations, 'items'),
    );
    const updates = sql.split('\n').filter((line) => line.startsWith('UPDATE '));
    strictEqual(updates.length, 10);
    for (const [index, kind] of (['abilities', 'items'] as const).entries()) {
        const { label } = catalogues[kind];
        const rows = updates.slice(index * 5, index * 5 + 5);
        for (const update of rows) {
            match(
                update,
                new RegExp(
                    `^UPDATE emerald_ex_${kind} SET description_cs = .+ WHERE dataset_id = 'emerald-ex-1\\.0\\.4' AND ${label}_id = \\d+;$`,
                ),
            );
        }
        strictEqual(
            rows[0],
            `UPDATE emerald_ex_${kind} SET description_cs = NULL WHERE dataset_id = 'emerald-ex-1.0.4' AND ${label}_id = 0;`,
        );
        strictEqual(
            rows[1],
            `UPDATE emerald_ex_${kind} SET description_cs = CASE WHEN CAST(description AS BINARY) = CAST('Strikes twice.' AS BINARY) THEN 'Zasáhne dvakrát.' ELSE NULL END WHERE dataset_id = 'emerald-ex-1.0.4' AND ${label}_id = 1;`,
        );
    }
    strictEqual(sql.match(/^START TRANSACTION;$/gm)?.length, 1);
    strictEqual(sql.match(/^COMMIT;$/gm)?.length, 1);
    strictEqual(sql.match(/^SELECT dataset_id .* FOR UPDATE;$/gm)?.length, 1);
    strictEqual(/\b(?:INSERT|DELETE|ALTER|DROP|TRUNCATE)\b/.test(sql), false);
    strictEqual(/\bSET description\s*=/.test(sql), false);
    match(sql, /SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;/);
    match(sql, /COMMIT;\nSET SESSION sql_mode = @dex_previous_sql_mode;\n$/);
});

void test('ability and item catalogues cannot be combined across datasets', () => {
    const { source, translations } = fixture();
    const abilities = buildDescriptionImport(source, translations, 'abilities');
    const items = buildDescriptionImport(source, translations, 'items');
    throws(
        () =>
            buildAbilityItemDescriptionImport(abilities, {
                ...items,
                datasetId: 'emerald-ex-1.0.5',
            }),
        /Translation dataset mismatch/,
    );
});

for (const kind of ['abilities', 'items'] as const) {
    const { label, idKey, countKey } = catalogues[kind];

    void test(`${label} translations reject missing, duplicate and unknown IDs`, () => {
        const missing = fixture();
        missing.translations[kind].pop();
        throws(
            () => buildDescriptionImport(missing.source, missing.translations, kind),
            /Missing Czech description: 4/,
        );
        const duplicate = fixture();
        duplicate.translations[kind].push({ ...duplicate.translations[kind][0] });
        throws(
            () => buildDescriptionImport(duplicate.source, duplicate.translations, kind),
            new RegExp(`Duplicate translated ${label}: 1`),
        );
        const unknown = fixture();
        unknown.translations[kind][0][idKey] = 99;
        throws(
            () => buildDescriptionImport(unknown.source, unknown.translations, kind),
            new RegExp(`Unknown translated ${label}: 99`),
        );
    });

    void test(`${label} translations reject stale source text including capitalization and whitespace`, () => {
        for (const changed of ['Strikes once.', 'strikes twice.', 'Strikes twice. ', '']) {
            const { source, translations } = fixture();
            translations[kind][0].sourceDescription = changed;
            throws(
                () => buildDescriptionImport(source, translations, kind),
                /Stale or empty source description: 1/,
            );
        }
    });

    void test(`${label} Czech descriptions reject empty strings and NUL bytes`, () => {
        for (const empty of ['', ' \t\n']) {
            const { source, translations } = fixture();
            translations[kind][0].descriptionCs = empty;
            throws(
                () => buildDescriptionImport(source, translations, kind),
                /Empty Czech description: 1/,
            );
        }
        const { source, translations } = fixture();
        translations[kind][0].descriptionCs = 'Zasáhne\0dvakrát.';
        throws(() => buildDescriptionImport(source, translations, kind), /without NUL bytes/);
    });

    void test(`${label} translations require a matching dataset, language, game and version`, () => {
        const { source, translations } = fixture();
        for (const document of [
            { ...translations, datasetId: 'emerald-ex-1.0.3' },
            { ...translations, language: 'en' },
        ]) {
            throws(
                () => buildDescriptionImport(source, document, kind),
                /dataset\/language mismatch/,
            );
        }
        for (const metadata of [
            { ...source.metadata, game: 'Pokémon Emerald' },
            { ...source.metadata, version: '1.0.5' },
            { ...source.metadata, version: "1.0.4'; DROP TABLE emerald_ex_items; --" },
        ]) {
            throws(
                () => buildDescriptionImport({ ...source, metadata }, translations, kind),
                /dataset\/language mismatch/,
            );
        }
    });

    void test(`${label} repeated source descriptions require identical Czech wording`, () => {
        const { source, translations } = fixture();
        const result = buildDescriptionImport(source, translations, kind);
        strictEqual(result.descriptions.get(1), result.descriptions.get(3));
        translations[kind][2].descriptionCs = 'Dva zásahy.';
        throws(
            () => buildDescriptionImport(source, translations, kind),
            /Inconsistent translation for identical source: 3/,
        );
    });

    void test(`${label} unknown placeholders are preserved and empty originals remain untranslated`, () => {
        for (const placeholder of ['?', '?????', '-', '---']) {
            const { source, translations } = fixture();
            source[kind][2].description = placeholder;
            translations[kind][1].sourceDescription = placeholder;
            translations[kind][1].descriptionCs = placeholder;
            const result = buildDescriptionImport(source, translations, kind);
            strictEqual(result.descriptions.get(2), placeholder);
            strictEqual(result.descriptions.has(0), false);
            translations[kind][1].descriptionCs = 'Vymyšlený popis.';
            throws(
                () => buildDescriptionImport(source, translations, kind),
                /Source placeholder must be preserved: 2/,
            );
        }
    });

    void test(`${label} source IDs and declared counts must be valid`, () => {
        const duplicate = fixture();
        duplicate.source[kind][3][idKey] = 1;
        throws(
            () => buildDescriptionImport(duplicate.source, duplicate.translations, kind),
            new RegExp(`Duplicate source ${label}: 1`),
        );
        const count = fixture();
        count.source.metadata[countKey] = 6;
        throws(
            () => buildDescriptionImport(count.source, count.translations, kind),
            new RegExp(`Source ${label} count mismatch`),
        );
        for (const invalidId of [-1, 1.5, 65536]) {
            const { source, translations } = fixture();
            translations[kind][0][idKey] = invalidId;
            throws(
                () => buildDescriptionImport(source, translations, kind),
                new RegExp(`Invalid ${label} ID`),
            );
        }
    });
}
