import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert/strict';
import { test } from 'node:test';

import type { QueryOptions } from 'mariadb';

import {
    localMigrationConfig,
    migrateDatabase,
    type MigrationConnection,
} from './db-migrations.js';

const migrationFiles = [
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
    '017_move_category_svg_icons.sql',
];

function fakeDatabase(upgraded = false) {
    const columns = new Map<string, Set<string>>();
    const addTables = (...tables: string[]) => {
        for (const table of tables) columns.set(`emerald_ex_${table}`, new Set(['id']));
    };
    addTables('datasets', 'sources', 'species', 'move_categories', 'types');
    const sources = new Set<string>();
    if (upgraded) {
        addTables(
            'species_sprites',
            'form_change_methods',
            'form_groups',
            'species_forms',
            'form_changes',
            'item_pockets',
            'items',
            'evolution_items',
            'form_change_items',
            'abilities',
            'species_abilities',
        );
        columns.get('emerald_ex_move_categories')?.add('icon_file');
        columns.get('emerald_ex_types')?.add('icon_file');
        for (const source of ['battle_sprites', 'forms', 'items', 'abilities']) sources.add(source);
    }

    const state = {
        columns,
        sources,
        hasDataset: true,
        history: new Set<string>(),
        lockResult: 1 as number | null,
        failMigration: '',
        failHistory: '',
        readFiles: [] as string[],
        executedFiles: [] as string[],
        events: [] as string[],
        acquiredLocks: [] as unknown[],
        releasedLocks: [] as unknown[],
    };
    let transaction: Set<string> | undefined;

    function query(sql: string, values?: unknown): unknown {
        if (sql.startsWith('SELECT GET_LOCK')) {
            state.acquiredLocks.push(values);
            return [{ acquired: state.lockResult }];
        }
        if (sql.startsWith('SELECT RELEASE_LOCK')) {
            state.releasedLocks.push(values);
            return [];
        }
        if (sql.includes('FROM information_schema.COLUMNS')) {
            return [...columns].flatMap(([tableName, names]) =>
                [...names].map((columnName) => ({ tableName, columnName })),
            );
        }
        if (sql.includes('FROM emerald_ex_datasets')) {
            return state.hasDataset ? [{ datasetId: 'emerald-ex-1.0.4' }] : [];
        }
        if (sql.includes('FROM emerald_ex_sources')) {
            return [...sources].map((sourceKind) => ({ sourceKind }));
        }
        if (sql.startsWith('CREATE TABLE IF NOT EXISTS emerald_ex_migrations')) return [];
        if (sql === 'SELECT migration FROM emerald_ex_migrations') {
            return [...state.history].map((migration) => ({ migration }));
        }
        if (sql.startsWith('INSERT INTO emerald_ex_migrations')) {
            if (!Array.isArray(values) || typeof values[0] !== 'string') {
                throw new Error('Expected a migration filename');
            }
            const file = values[0];
            if (state.failHistory === file) throw new Error('History write failed');
            const history = transaction ?? state.history;
            if (history.has(file)) throw new Error(`Duplicate migration: ${file}`);
            history.add(file);
            state.events.push(`record:${file}`);
            return [];
        }
        if (sql.startsWith('migration:')) {
            const file = sql.slice('migration:'.length);
            state.executedFiles.push(file);
            state.events.push(`apply:${file}`);
            if (state.failMigration === file) throw new Error('SQL failed');
            // MySQL keeps this DDL even if the following seed is rolled back.
            if (file === '007_move_category_icons.sql') {
                columns.get('emerald_ex_move_categories')?.add('icon_file');
            }
            return [];
        }
        throw new Error(`Unexpected query: ${sql}`);
    }

    const connection: MigrationConnection = {
        query<T>(sql: string | QueryOptions, values?: unknown): Promise<T> {
            if (typeof sql !== 'string') throw new Error('Expected SQL text');
            return Promise.resolve(query(sql, values) as T);
        },
        beginTransaction() {
            state.events.push('begin');
            transaction = new Set(state.history);
            return Promise.resolve();
        },
        commit() {
            state.events.push('commit');
            if (transaction) state.history = transaction;
            transaction = undefined;
            return Promise.resolve();
        },
        rollback() {
            state.events.push('rollback');
            transaction = undefined;
            return Promise.resolve();
        },
    };
    function run() {
        return migrateDatabase(connection, 'local_dex', {
            readSql(file) {
                state.readFiles.push(file);
                return Promise.resolve(`migration:${file}`);
            },
        });
    }
    return { state, run };
}

void test('adopts manually imported upgrades and applies the SVG migration only once', async () => {
    const database = fakeDatabase(true);

    deepStrictEqual(await database.run(), ['017_move_category_svg_icons.sql']);
    deepStrictEqual(database.state.readFiles, ['017_move_category_svg_icons.sql']);
    deepStrictEqual(database.state.history, new Set([...migrationFiles, '_baseline']));
    strictEqual(
        database.state.events.indexOf('commit') <
            database.state.events.indexOf('apply:017_move_category_svg_icons.sql'),
        true,
    );

    deepStrictEqual(await database.run(), []);
    deepStrictEqual(database.state.executedFiles, ['017_move_category_svg_icons.sql']);
    deepStrictEqual(database.state.releasedLocks, database.state.acquiredLocks);
});

void test('applies every missing upgrade in order and the next run reads no SQL files', async () => {
    const database = fakeDatabase();

    deepStrictEqual(await database.run(), migrationFiles);
    deepStrictEqual(database.state.readFiles, migrationFiles);
    deepStrictEqual(database.state.executedFiles, migrationFiles);
    deepStrictEqual(database.state.history, new Set(['_baseline', ...migrationFiles]));
    deepStrictEqual(
        database.state.events.filter(
            (event) => event.startsWith('apply:') || event.startsWith('record:'),
        ),
        [
            'record:_baseline',
            ...migrationFiles.flatMap((file) => [`apply:${file}`, `record:${file}`]),
        ],
    );

    deepStrictEqual(await database.run(), []);
    deepStrictEqual(database.state.readFiles, migrationFiles);
});

void test('a failed seed remains pending on retry after its column migration succeeded', async () => {
    const database = fakeDatabase();
    database.state.failMigration = '008_seed_move_category_icons.sql';

    await rejects(database.run(), /Migration 008_seed_move_category_icons.sql failed/);
    deepStrictEqual(database.state.history, new Set(['_baseline', ...migrationFiles.slice(0, 3)]));
    strictEqual(database.state.columns.get('emerald_ex_move_categories')?.has('icon_file'), true);
    strictEqual(database.state.events.at(-1), 'rollback');
    deepStrictEqual(database.state.releasedLocks, database.state.acquiredLocks);

    database.state.failMigration = '';
    deepStrictEqual(await database.run(), migrationFiles.slice(3));
    deepStrictEqual(database.state.readFiles, [
        ...migrationFiles.slice(0, 4),
        ...migrationFiles.slice(3),
    ]);
    strictEqual(database.state.history.has('008_seed_move_category_icons.sql'), true);
});

void test('existing tables without source markers still receive their data imports', async () => {
    const database = fakeDatabase(true);
    database.state.sources.clear();
    const missingImports = [
        '006_import_sprites_1.0.4.sql',
        '012_import_forms_1.0.4.sql',
        '014_import_items_1.0.4.sql',
        '016_import_abilities_1.0.4.sql',
        '017_move_category_svg_icons.sql',
    ];

    deepStrictEqual(await database.run(), missingImports);
    deepStrictEqual(database.state.readFiles, missingImports);
    deepStrictEqual(database.state.history, new Set([...migrationFiles, '_baseline']));
});

void test('refuses a missing base schema or dataset before recording or running migrations', async () => {
    for (const missing of ['schema', 'dataset']) {
        const database = fakeDatabase();
        if (missing === 'schema') database.state.columns.delete('emerald_ex_species');
        else database.state.hasDataset = false;

        await rejects(database.run(), /Import .* first/);
        deepStrictEqual(database.state.readFiles, []);
        strictEqual(database.state.history.size, 0);
        deepStrictEqual(database.state.events, []);
        deepStrictEqual(database.state.releasedLocks, database.state.acquiredLocks);
    }
});

void test('local migration config enables SQL batches and rejects nonlocal hosts', () => {
    for (const host of ['127.0.0.1', 'localhost', '::1']) {
        const config = { host, database: 'local_dex', port: 3307, multipleStatements: false };
        deepStrictEqual(localMigrationConfig(config), {
            ...config,
            multipleStatements: true,
            allowPublicKeyRetrieval: true,
        });
        strictEqual(config.multipleStatements, false);
    }
    for (const host of ['db.example.com', '192.168.1.20', undefined]) {
        throws(() => localMigrationConfig({ host }), /requires a local DB_HOST/);
    }
});

void test('a busy or failed lock does not run migrations or release another process lock', async () => {
    for (const lockResult of [0, null]) {
        const database = fakeDatabase();
        database.state.lockResult = lockResult;

        await rejects(database.run(), /Another db:migrate process is running/);
        deepStrictEqual(database.state.readFiles, []);
        deepStrictEqual(database.state.events, []);
        strictEqual(database.state.history.size, 0);
        strictEqual(database.state.acquiredLocks.length, 1);
        deepStrictEqual(database.state.releasedLocks, []);
    }
});

void test('baseline history is rolled back atomically and can be adopted on retry', async () => {
    const database = fakeDatabase(true);
    database.state.failHistory = '010_seed_type_icons.sql';

    await rejects(database.run(), /History write failed/);
    strictEqual(database.state.history.size, 0);
    deepStrictEqual(database.state.readFiles, []);
    strictEqual(database.state.events.at(-1), 'rollback');
    deepStrictEqual(database.state.releasedLocks, database.state.acquiredLocks);

    database.state.failHistory = '';
    deepStrictEqual(await database.run(), ['017_move_category_svg_icons.sql']);
    deepStrictEqual(database.state.history, new Set([...migrationFiles, '_baseline']));
});
