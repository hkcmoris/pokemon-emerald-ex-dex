import { deepStrictEqual, match, strictEqual, throws } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
    buildMoveDescriptionImport,
    type MoveDescriptionTranslations,
} from './move-descriptions.js';

interface DescriptionSource {
    metadata: { game: string; version: string; moveCount: number };
    moves: { moveId: number; description: string }[];
}

function fixture(): { source: DescriptionSource; translations: MoveDescriptionTranslations } {
    return {
        source: {
            metadata: { game: 'Pokémon Emerald EX', version: '1.0.4', moveCount: 4 },
            moves: [
                { moveId: 0, description: '' },
                { moveId: 1, description: 'Strikes twice.' },
                { moveId: 2, description: '---' },
                { moveId: 3, description: 'Strikes twice.' },
            ],
        },
        translations: {
            datasetId: 'emerald-ex-1.0.4',
            language: 'cs',
            moves: [
                {
                    moveId: 1,
                    sourceDescription: 'Strikes twice.',
                    descriptionCs: 'Zasáhne dvakrát.',
                },
                { moveId: 2, sourceDescription: '---', descriptionCs: '---' },
                {
                    moveId: 3,
                    sourceDescription: 'Strikes twice.',
                    descriptionCs: 'Zasáhne dvakrát.',
                },
            ],
        },
    };
}

void test('Czech catalogue covers every nonempty ROM description and reproduces the committed seed', async () => {
    const source = JSON.parse(
        await readFile(
            new URL('../docs/pokemon_emerald_ex_1.0.4_learnsets.json', import.meta.url),
            'utf8',
        ),
    ) as DescriptionSource;
    const translations = JSON.parse(
        await readFile(new URL('../docs/translations/moves.cs.json', import.meta.url), 'utf8'),
    ) as MoveDescriptionTranslations;
    const originalSource = structuredClone(source);
    const originalTranslations = structuredClone(translations);
    const result = buildMoveDescriptionImport(source, translations);
    const nonemptyMoves = source.moves.filter((move) => move.description.trim());

    strictEqual(source.moves.length, 935);
    strictEqual(nonemptyMoves.length, 847);
    strictEqual(result.datasetId, 'emerald-ex-1.0.4');
    deepStrictEqual(
        [...result.descriptions.keys()].sort((a, b) => a - b),
        nonemptyMoves.map((move) => move.moveId).sort((a, b) => a - b),
    );
    for (const move of source.moves) {
        if (!move.description.trim()) strictEqual(result.descriptions.has(move.moveId), false);
        if (move.description === '---') strictEqual(result.descriptions.get(move.moveId), '---');
    }
    strictEqual(
        result.sql,
        await readFile(
            new URL('sql/019_seed_move_descriptions_cs_1.0.4.sql', import.meta.url),
            'utf8',
        ),
    );
    deepStrictEqual(source, originalSource);
    deepStrictEqual(translations, originalTranslations);
});

void test('seed output is stable regardless of source and translation ordering', () => {
    const { source, translations } = fixture();
    const expected = buildMoveDescriptionImport(source, translations).sql;
    source.moves.reverse();
    translations.moves.reverse();
    strictEqual(buildMoveDescriptionImport(source, translations).sql, expected);
});

void test('only Czech descriptions in the selected dataset are updated, with stale-source fallback', () => {
    const { source, translations } = fixture();
    const { sql } = buildMoveDescriptionImport(source, translations);
    const updates = sql.split('\n').filter((line) => line.startsWith('UPDATE '));
    strictEqual(updates.length, source.moves.length);
    for (const update of updates) {
        match(
            update,
            /^UPDATE emerald_ex_moves SET description_cs = .+ WHERE dataset_id = 'emerald-ex-1\.0\.4' AND move_id = \d+;$/,
        );
    }
    strictEqual(
        updates[0],
        "UPDATE emerald_ex_moves SET description_cs = NULL WHERE dataset_id = 'emerald-ex-1.0.4' AND move_id = 0;",
    );
    strictEqual(
        updates[1],
        "UPDATE emerald_ex_moves SET description_cs = CASE WHEN CAST(description AS BINARY) = CAST('Strikes twice.' AS BINARY) THEN 'Zasáhne dvakrát.' ELSE NULL END WHERE dataset_id = 'emerald-ex-1.0.4' AND move_id = 1;",
    );
    strictEqual(/\b(?:INSERT|DELETE|ALTER|DROP|TRUNCATE)\b/.test(sql), false);
    strictEqual(/\bSET description\s*=/.test(sql), false);
    match(sql, /START TRANSACTION;\nSELECT dataset_id FROM emerald_ex_datasets.*FOR UPDATE;/);
    match(sql, /COMMIT;\nSET SESSION sql_mode = @dex_previous_sql_mode;\n$/);
});

void test('SQL preserves Czech Unicode, apostrophes, backslashes and newlines', () => {
    const original = "Farfetch'd \\ attack\nPokémon";
    const translated = "Útočník řekl: 'Žluťoučký' \\ útok\nPokémon";
    const source: DescriptionSource = {
        metadata: { game: 'Pokémon Emerald EX', version: '1.0.4', moveCount: 1 },
        moves: [{ moveId: 1, description: original }],
    };
    const translations: MoveDescriptionTranslations = {
        datasetId: 'emerald-ex-1.0.4',
        language: 'cs',
        moves: [{ moveId: 1, sourceDescription: original, descriptionCs: translated }],
    };
    const { sql, descriptions } = buildMoveDescriptionImport(source, translations);
    strictEqual(descriptions.get(1), translated);
    strictEqual(sql.includes("CAST('Farfetch''d \\ attack\nPokémon' AS BINARY)"), true);
    strictEqual(
        sql.includes("THEN 'Útočník řekl: ''Žluťoučký'' \\ útok\nPokémon' ELSE NULL END"),
        true,
    );
    match(sql, /SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;/);
    match(
        sql,
        /SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_BACKSLASH_ESCAPES,NO_ENGINE_SUBSTITUTION';/,
    );
});

void test('missing, duplicate and unknown translations are rejected', () => {
    const missing = fixture();
    missing.translations.moves.pop();
    throws(
        () => buildMoveDescriptionImport(missing.source, missing.translations),
        /Missing Czech description: 3/,
    );

    const duplicate = fixture();
    duplicate.translations.moves.push({ ...duplicate.translations.moves[0] });
    throws(
        () => buildMoveDescriptionImport(duplicate.source, duplicate.translations),
        /Duplicate translated move: 1/,
    );

    const unknown = fixture();
    unknown.translations.moves[0].moveId = 99;
    throws(
        () => buildMoveDescriptionImport(unknown.source, unknown.translations),
        /Unknown translated move: 99/,
    );
});

void test('source wording must match exactly, including capitalization and spacing', () => {
    for (const changed of ['Strikes once.', 'strikes twice.', 'Strikes twice. ', '']) {
        const { source, translations } = fixture();
        translations.moves[0].sourceDescription = changed;
        throws(
            () => buildMoveDescriptionImport(source, translations),
            /Stale or empty source description: 1/,
        );
    }
});

void test('Czech descriptions cannot be empty or contain NUL bytes', () => {
    for (const empty of ['', ' \t\n']) {
        const { source, translations } = fixture();
        translations.moves[0].descriptionCs = empty;
        throws(
            () => buildMoveDescriptionImport(source, translations),
            /Empty Czech description: 1/,
        );
    }
    const { source, translations } = fixture();
    translations.moves[0].descriptionCs = 'Zasáhne\0dvakrát.';
    throws(() => buildMoveDescriptionImport(source, translations), /without NUL bytes/);
});

void test('dataset, locale, game and version must describe the same supported source', () => {
    const { source, translations } = fixture();
    for (const document of [
        { ...translations, datasetId: 'emerald-ex-1.0.3' },
        { ...translations, language: 'en' },
    ]) {
        throws(() => buildMoveDescriptionImport(source, document), /dataset\/language mismatch/);
    }
    for (const metadata of [
        { ...source.metadata, game: 'Pokémon Emerald' },
        { ...source.metadata, version: '1.0.5' },
        { ...source.metadata, version: "1.0.4'; DROP TABLE emerald_ex_moves; --" },
    ]) {
        throws(
            () => buildMoveDescriptionImport({ ...source, metadata }, translations),
            /dataset\/language mismatch/,
        );
    }
});

void test('identical English descriptions must share the same Czech wording', () => {
    const { source, translations } = fixture();
    const valid = buildMoveDescriptionImport(source, translations);
    strictEqual(valid.descriptions.get(1), valid.descriptions.get(3));
    translations.moves[2].descriptionCs = 'Dva zásahy.';
    throws(
        () => buildMoveDescriptionImport(source, translations),
        /Inconsistent translation for identical source: 3/,
    );
});

void test('empty originals stay untranslated and source placeholders cannot invent mechanics', () => {
    const { source, translations } = fixture();
    source.moves[0].description = ' \t\n';
    const result = buildMoveDescriptionImport(source, translations);
    strictEqual(result.descriptions.has(0), false);
    strictEqual(result.descriptions.get(2), '---');
    translations.moves[1].descriptionCs = 'Způsobí poškození.';
    throws(
        () => buildMoveDescriptionImport(source, translations),
        /Source placeholder must be preserved: 2/,
    );

    const emptyOriginal = fixture();
    emptyOriginal.translations.moves.push({
        moveId: 0,
        sourceDescription: '',
        descriptionCs: 'Vymyšlený popis.',
    });
    throws(
        () => buildMoveDescriptionImport(emptyOriginal.source, emptyOriginal.translations),
        /Stale or empty source description: 0/,
    );
});

void test('source IDs and move counts must be valid before generating database updates', () => {
    const duplicate = fixture();
    duplicate.source.moves[3].moveId = 1;
    throws(
        () => buildMoveDescriptionImport(duplicate.source, duplicate.translations),
        /Duplicate source move: 1/,
    );
    const count = fixture();
    count.source.metadata.moveCount = 5;
    throws(
        () => buildMoveDescriptionImport(count.source, count.translations),
        /move count mismatch/,
    );
    for (const invalidId of [-1, 1.5, 65536]) {
        const { source, translations } = fixture();
        translations.moves[0].moveId = invalidId;
        throws(() => buildMoveDescriptionImport(source, translations), /Invalid move ID/);
    }
});
