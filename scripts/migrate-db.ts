import { createConnection } from 'mariadb';

import { databaseConfig } from '../apps/server/src/database.js';
import { localMigrationConfig, migrateDatabase } from './db-migrations.js';

try {
    const config = localMigrationConfig(databaseConfig());
    const connection = await createConnection(config);
    try {
        const applied = await migrateDatabase(connection, config.database!, { log: console.log });
        console.log(
            applied.length === 0
                ? 'Local database is up to date.'
                : `Applied ${applied.length} migration(s) to the local database.`,
        );
    } finally {
        await connection.end();
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Database migration failed');
    if (error instanceof Error && error.cause instanceof Error) {
        console.error(error.cause.message);
    }
    process.exitCode = 1;
}
