import { deepStrictEqual, strictEqual, ok } from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { Evolution, PokemonDetail, PokemonList } from '@replace-me/shared';
import { createApp } from '../src/app.js';
import { projectRoot, sqliteRepository } from '../src/db/database.js';
import { importDatabase, readSeed, seedSqlStatements } from '../src/db/import.js';
import { schema } from '../src/db/schema.js';
import { createWorker, type D1Statement, type WorkerEnvironment } from '../src/worker.js';

const docs = resolve(projectRoot, 'docs');
const read = (suffix: string): unknown =>
    JSON.parse(readFileSync(resolve(docs, `pokemon_emerald_ex_1.0.4_${suffix}.json`), 'utf8'));

void test('SQL import preserves every ordered learnset, machine pair and evolution rule', async () => {
    const database = new DatabaseSync(':memory:');
    try {
        importDatabase(database, docs);
        const repository = sqliteRepository(database);
        const learnsets = read('learnsets') as {
            species: { speciesId: number; learnset: PokemonDetail['learnset'] }[];
        };
        const compatibility = read('tm_hm_compatibility') as {
            species: {
                speciesId: number;
                tms: { machine: string }[];
                hms: { machine: string }[];
            }[];
        };
        const evolutions = read('evolutions') as { edges: Evolution[] };
        strictEqual(database.prepare('SELECT COUNT(*) AS n FROM species').get()?.n, 1523);
        strictEqual(database.prepare('SELECT COUNT(*) AS n FROM learnsets').get()?.n, 23729);
        strictEqual(database.prepare('SELECT COUNT(*) AS n FROM compatibility').get()?.n, 32358);
        strictEqual(database.prepare('SELECT COUNT(*) AS n FROM evolutions').get()?.n, 644);
        for (const s of learnsets.species) {
            const stored = database
                .prepare(
                    'SELECT l.level, m.move_id AS moveId, m.name AS move FROM learnsets l JOIN moves m ON m.move_id = l.move_id WHERE species_id = ? ORDER BY position',
                )
                .all(s.speciesId);
            deepStrictEqual(
                JSON.parse(JSON.stringify(stored)),
                s.learnset,
                `Learnset ${s.speciesId}`,
            );
        }
        for (const s of compatibility.species) {
            const stored = database
                .prepare('SELECT machine FROM compatibility WHERE species_id = ? ORDER BY machine')
                .all(s.speciesId)
                .map((m) => m.machine);
            deepStrictEqual(
                stored,
                [...s.tms, ...s.hms].map((m) => m.machine).sort(),
                `Machines ${s.speciesId}`,
            );
        }
        deepStrictEqual(
            database
                .prepare('SELECT data FROM evolutions ORDER BY edge_id')
                .all()
                .map((row) => JSON.parse(row.data as string) as Evolution),
            evolutions.edges,
        );
        deepStrictEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
        importDatabase(database, docs);
        strictEqual(database.prepare('SELECT COUNT(*) AS n FROM learnsets').get()?.n, 23729);
        strictEqual((await repository.detail(151))?.machines.length, 58);
        ok(
            !(await repository.detail(771))?.machines.some((m) =>
                ['TM10', 'TM21', 'TM27'].includes(m.machine),
            ),
        );
        strictEqual((await repository.detail(1435))?.learnset.length, 0);
        ok((await repository.detail(1523))?.name);
        const chain = (await repository.detail(60))?.evolutionChain ?? [];
        strictEqual(
            chain.filter((e) => e.fromName === 'Poliwhirl' && e.toName === 'Politoed').length,
            2,
        );
        ok((await repository.detail(25))?.evolutionChain.every((e) => !e.internalOnly));
    } finally {
        database.close();
    }
});

void test('SQL-backed API searches, paginates, distinguishes forms and validates requests', async () => {
    const database = new DatabaseSync(':memory:');
    importDatabase(database, docs);
    const server = await new Promise<Server>((resolveServer) => {
        const started = createApp(sqliteRepository(database)).listen(0, '127.0.0.1', () =>
            resolveServer(started),
        );
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server address');
    const request = (path: string) => fetch(`http://127.0.0.1:${address.port}${path}`);
    try {
        const first = (await (await request('/api/pokemon')).json()) as PokemonList;
        strictEqual(first.total, 1523);
        strictEqual(first.pokemon.length, 36);
        strictEqual(first.pokemon[0].speciesId, 1);
        const second = (await (await request('/api/pokemon?page=2')).json()) as PokemonList;
        strictEqual(second.pokemon[0].speciesId, 37);
        const pikachu = (await (
            await request('/api/pokemon?search=pikachu')
        ).json()) as PokemonList;
        strictEqual(pikachu.total, 17);
        ok(pikachu.pokemon.every((p) => p.sameNameCount === 17));
        const accents = (await (
            await request('/api/pokemon?search=flabebe')
        ).json()) as PokemonList;
        ok(accents.total > 0);
        const byId = (await (await request('/api/pokemon?search=%230025')).json()) as PokemonList;
        strictEqual(byId.pokemon[0].speciesId, 25);
        strictEqual(
            ((await (await request('/api/pokemon?search=0025')).json()) as PokemonList).pokemon[0]
                .speciesId,
            25,
        );
        ok(
            ((await (await request('/api/pokemon?search=farfetch%27d')).json()) as PokemonList)
                .total > 0,
        );
        strictEqual(
            ((await (await request('/api/pokemon?search=%25')).json()) as PokemonList).total,
            0,
        );
        strictEqual(
            (
                (await (
                    await request('/api/pokemon?search=%27%20OR%201%3D1--')
                ).json()) as PokemonList
            ).total,
            0,
        );
        for (const path of [
            '/api/pokemon?page=0',
            '/api/pokemon?pageSize=101',
            '/api/pokemon?sort=random',
            '/api/pokemon?page=1.5',
        ])
            strictEqual((await request(path)).status, 400);
        strictEqual((await request('/api/pokemon/99999')).status, 404);
        strictEqual((await request('/api/unknown')).status, 404);
        strictEqual(
            (await fetch(`http://127.0.0.1:${address.port}/api/pokemon`, { method: 'POST' }))
                .status,
            405,
        );
        const detail = (await (await request('/api/pokemon/1')).json()) as PokemonDetail;
        strictEqual(detail.name, 'Bulbasaur');
        strictEqual(detail.learnset.length, 14);
    } finally {
        await new Promise<void>((resolveClose, reject) =>
            server.close((error) => (error ? reject(error) : resolveClose())),
        );
        database.close();
    }
});

void test('generated hosted schema and atomic SQL seed match native SQLite data', async () => {
    const database = new DatabaseSync(':memory:');
    try {
        database.exec('PRAGMA foreign_keys = ON');
        const migration = readdirSync(resolve(projectRoot, 'drizzle')).find((name) =>
            name.endsWith('.sql'),
        );
        ok(migration);
        database.exec(readFileSync(resolve(projectRoot, 'drizzle', migration), 'utf8'));
        const statements = seedSqlStatements(readSeed(docs));
        ok(statements.length <= 45);
        ok(statements.every((sql) => Buffer.byteLength(sql) < 80000));
        let batches = 0;
        const preparedSql = new WeakMap<D1Statement, string>();
        function prepare(sql: string): D1Statement {
            let parameters: (string | number)[] = [];
            const statement: D1Statement = {
                bind(...values) {
                    parameters = values;
                    return this;
                },
                all<T>() {
                    return Promise.resolve({
                        results: database.prepare(sql).all(...parameters) as T[],
                    });
                },
            };
            preparedSql.set(statement, sql);
            return statement;
        }
        const env: WorkerEnvironment = {
            DB: {
                prepare,
                batch(items) {
                    batches++;
                    database.exec('BEGIN');
                    try {
                        for (const statement of items) {
                            const sql = preparedSql.get(statement);
                            if (!sql) throw new Error('Unknown prepared statement');
                            database.exec(sql);
                        }
                        database.exec('COMMIT');
                    } catch (error) {
                        database.exec('ROLLBACK');
                        throw error;
                    }
                    strictEqual(items.length, statements.length);
                    return Promise.resolve([]);
                },
            },
            ASSETS: {
                fetch(request) {
                    return Promise.resolve(new Response(new URL(request.url).pathname));
                },
            },
        };
        const worker = createWorker(statements);
        const response = await worker.fetch(new Request('https://example.com/api/pokemon/1'), env);
        strictEqual(response.status, 200);
        const detail = (await response.json()) as PokemonDetail;
        strictEqual(detail.name, 'Bulbasaur');
        strictEqual(detail.learnset.length, 14);
        const meta = await worker.fetch(new Request('https://example.com/api/metadata'), env);
        strictEqual(((await meta.json()) as { speciesCount: number }).speciesCount, 1523);
        strictEqual(batches, 1);
        strictEqual(database.prepare('SELECT COUNT(*) AS n FROM compatibility').get()?.n, 32358);
        strictEqual(
            await (await worker.fetch(new Request('https://example.com/pokemon/1'), env)).text(),
            '/index.html',
        );
        strictEqual(
            (
                await worker.fetch(
                    new Request('https://example.com/api/pokemon', { method: 'POST' }),
                    env,
                )
            ).status,
            405,
        );
        deepStrictEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
        database.close();
    }
});

void test('failed hosted import is retried on the next request', async () => {
    const database = new DatabaseSync(':memory:');
    database.exec(schema);
    let attempts = 0;
    const worker = createWorker([]);
    const env: WorkerEnvironment = {
        DB: {
            prepare() {
                return {
                    bind() {
                        return this;
                    },
                    all<T>() {
                        return Promise.resolve({ results: [] as T[] });
                    },
                };
            },
            batch() {
                attempts++;
                return Promise.reject(new Error('Temporary unavailable database'));
            },
        },
        ASSETS: {
            fetch() {
                return Promise.resolve(new Response());
            },
        },
    };
    const originalError = console.error;
    console.error = () => {};
    try {
        strictEqual(
            (await worker.fetch(new Request('https://example.com/api/metadata'), env)).status,
            503,
        );
        strictEqual(
            (await worker.fetch(new Request('https://example.com/api/metadata'), env)).status,
            503,
        );
        strictEqual(attempts, 2);
    } finally {
        console.error = originalError;
        database.close();
    }
});
