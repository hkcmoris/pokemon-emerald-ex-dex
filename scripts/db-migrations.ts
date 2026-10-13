import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { Connection, ConnectionConfig } from 'mariadb';

const datasetId = 'emerald-ex-1.0.4';
const baselineMarker = '_baseline';

interface DatabaseState {
    columns: Map<string, Set<string>>;
    sources: Set<string>;
}

interface Migration {
    file: string;
    isPresent(state: DatabaseState): boolean;
}

function hasTables(state: DatabaseState, ...tables: string[]): boolean {
    return tables.every((table) => state.columns.has(`emerald_ex_${table}`));
}

function hasIcons(state: DatabaseState, table: string): boolean {
    return state.columns.get(`emerald_ex_${table}`)?.has('icon_file') ?? false;
}

const formsTables = ['form_change_methods', 'form_groups', 'species_forms', 'form_changes'];
const itemsTables = ['item_pockets', 'items', 'evolution_items', 'form_change_items'];
const abilitiesTables = ['abilities', 'species_abilities'];

// 000 creates a database, 001/002 are the initial import, and 003/004 are queries.
// Keep upgrades explicit so adding an example/import cannot silently execute it.
const migrations: readonly Migration[] = [
    {
        file: '005_species_sprites.sql',
        isPresent: (state) => hasTables(state, 'species_sprites'),
    },
    {
        file: '006_import_sprites_1.0.4.sql',
        isPresent: (state) =>
            hasTables(state, 'species_sprites') && state.sources.has('battle_sprites'),
    },
    {
        file: '007_move_category_icons.sql',
        isPresent: (state) => hasIcons(state, 'move_categories'),
    },
    {
        file: '008_seed_move_category_icons.sql',
        // An existing column may contain deliberately hidden (NULL) icons.
        isPresent: (state) => hasIcons(state, 'move_categories'),
    },
    {
        file: '009_type_icons.sql',
        isPresent: (state) => hasIcons(state, 'types'),
    },
    {
        file: '010_seed_type_icons.sql',
        isPresent: (state) => hasIcons(state, 'types'),
    },
    { file: '011_forms.sql', isPresent: (state) => hasTables(state, ...formsTables) },
    {
        file: '012_import_forms_1.0.4.sql',
        isPresent: (state) => hasTables(state, ...formsTables) && state.sources.has('forms'),
    },
    { file: '013_items.sql', isPresent: (state) => hasTables(state, ...itemsTables) },
    {
        file: '014_import_items_1.0.4.sql',
        isPresent: (state) => hasTables(state, ...itemsTables) && state.sources.has('items'),
    },
    { file: '015_abilities.sql', isPresent: (state) => hasTables(state, ...abilitiesTables) },
    {
        file: '016_import_abilities_1.0.4.sql',
        isPresent: (state) =>
            hasTables(state, ...abilitiesTables) && state.sources.has('abilities'),
    },
    { file: '017_move_category_svg_icons.sql', isPresent: () => false },
    {
        file: '018_move_descriptions_cs.sql',
        isPresent: (state) => state.columns.get('emerald_ex_moves')?.has('description_cs') ?? false,
    },
    { file: '019_seed_move_descriptions_cs_1.0.4.sql', isPresent: () => false },
    {
        file: '020_ability_item_descriptions_cs.sql',
        isPresent: (state) =>
            (state.columns.get('emerald_ex_abilities')?.has('description_cs') ?? false) &&
            (state.columns.get('emerald_ex_items')?.has('description_cs') ?? false),
    },
    { file: '021_seed_ability_item_descriptions_cs_1.0.4.sql', isPresent: () => false },
    {
        file: '022_my_pokemon.sql',
        isPresent: (state) =>
            hasTables(state, 'collection_users', 'collection_sessions', 'collections'),
    },
    { file: '023_seed_local_collection.sql', isPresent: () => false },
];

export type MigrationConnection = Pick<
    Connection,
    'query' | 'beginTransaction' | 'commit' | 'rollback'
>;

export interface MigrationOptions {
    readSql?: (file: string) => Promise<string>;
    log?: (message: string) => void;
}

export function localMigrationConfig(config: ConnectionConfig): ConnectionConfig {
    if (!['127.0.0.1', 'localhost', '::1'].includes(config.host ?? '')) {
        throw new Error('db:migrate requires a local DB_HOST (127.0.0.1, localhost, or ::1)');
    }

    return {
        ...config,
        multipleStatements: true,
        // Local MySQL installations may use caching_sha2_password without TLS.
        allowPublicKeyRetrieval: true,
    };
}

async function readDatabaseState(connection: MigrationConnection): Promise<DatabaseState> {
    const rows = await connection.query<{ tableName: string; columnName: string }[]>(
        `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'emerald!_ex!_%' ESCAPE '!'`,
    );
    const columns = new Map<string, Set<string>>();
    for (const row of rows) {
        const names = columns.get(row.tableName) ?? new Set<string>();
        names.add(row.columnName);
        columns.set(row.tableName, names);
    }

    const state: DatabaseState = { columns, sources: new Set() };
    if (!hasTables(state, 'datasets', 'sources', 'species')) {
        throw new Error(
            'Import scripts/sql/001_schema.sql and 002_import_emerald_ex_1.0.4.sql first',
        );
    }
    const datasets = await connection.query<{ datasetId: string }[]>(
        'SELECT dataset_id AS datasetId FROM emerald_ex_datasets WHERE dataset_id = ?',
        [datasetId],
    );
    if (datasets.length === 0) {
        throw new Error(
            `Import dataset ${datasetId} with scripts/sql/002_import_emerald_ex_1.0.4.sql first`,
        );
    }
    const sources = await connection.query<{ sourceKind: string }[]>(
        'SELECT source_kind AS sourceKind FROM emerald_ex_sources WHERE dataset_id = ?',
        [datasetId],
    );
    state.sources = new Set(sources.map((row) => row.sourceKind));
    return state;
}

async function recordMigration(connection: MigrationConnection, file: string): Promise<void> {
    await connection.query<unknown>('INSERT INTO emerald_ex_migrations (migration) VALUES (?)', [
        file,
    ]);
}

export async function migrateDatabase(
    connection: MigrationConnection,
    database: string,
    options: MigrationOptions = {},
): Promise<string[]> {
    const readSql =
        options.readSql ?? ((file) => readFile(new URL(`sql/${file}`, import.meta.url), 'utf8'));
    const log = options.log ?? (() => {});
    const lock = `emerald_ex_migrate_${createHash('sha256').update(database).digest('hex').slice(0, 32)}`;
    const locks = await connection.query<{ acquired: number | null }[]>(
        'SELECT GET_LOCK(?, 0) AS acquired',
        [lock],
    );
    if (locks[0]?.acquired !== 1) {
        throw new Error('Another db:migrate process is running for this database');
    }

    try {
        const state = await readDatabaseState(connection);
        await connection.query<unknown>(
            `CREATE TABLE IF NOT EXISTS emerald_ex_migrations (
                migration VARCHAR(255) NOT NULL PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        );
        const history = await connection.query<{ migration: string }[]>(
            'SELECT migration FROM emerald_ex_migrations',
        );
        const completed = new Set(history.map((row) => row.migration));

        if (!completed.has(baselineMarker)) {
            // Adopt manual upgrades once, atomically, before executing any SQL.
            // A failed seed must remain pending even after its DDL succeeded.
            await connection.beginTransaction();
            try {
                for (const migration of migrations) {
                    if (!completed.has(migration.file) && migration.isPresent(state)) {
                        await recordMigration(connection, migration.file);
                        completed.add(migration.file);
                    }
                }
                await recordMigration(connection, baselineMarker);
                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        }

        const applied: string[] = [];
        for (const migration of migrations) {
            if (completed.has(migration.file)) continue;
            log(`Applying ${migration.file}`);
            try {
                // The server stops a multi-statement batch at its first error.
                // Await each file so a failed transaction cannot reach COMMIT.
                await connection.query<unknown>(await readSql(migration.file));
                await recordMigration(connection, migration.file);
            } catch (error) {
                await connection.rollback();
                throw new Error(`Migration ${migration.file} failed`, { cause: error });
            }
            applied.push(migration.file);
        }
        return applied;
    } finally {
        await connection.query<unknown>('SELECT RELEASE_LOCK(?)', [lock]);
    }
}
