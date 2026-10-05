import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { getOptionalEnv } from '../config/env.js';
import { importDatabase } from './import.js';
import { PokedexRepository } from './repository.js';
export const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
export function openDatabase(): DatabaseSync {
    const path = resolve(projectRoot, getOptionalEnv('DATABASE_PATH', 'data/pokedex.sqlite'));
    mkdirSync(dirname(path), { recursive: true });
    const database = new DatabaseSync(path);
    database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    if (!database.prepare("SELECT name FROM sqlite_master WHERE name = 'metadata'").get())
        importDatabase(database, resolve(projectRoot, 'docs'));
    return database;
}
export function sqliteRepository(database: DatabaseSync): PokedexRepository {
    return new PokedexRepository({
        all<T>(sql: string, parameters = []): Promise<T[]> {
            return Promise.resolve(database.prepare(sql).all(...parameters) as T[]);
        },
    });
}
