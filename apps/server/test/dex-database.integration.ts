import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import type {
    ApiResponse,
    DexDataset,
    Evolution,
    LearnsetEntry,
    Machine,
    Move,
    PageResponse,
    Pokemon,
    SpeciesType,
} from '@pokemon-emerald-ex-dex/shared';
import { createConnection, createPool } from 'mariadb';

import { createApp } from '../src/app.js';
import { databaseConfig, poolDatabase } from '../src/database.js';
import { DexRepository } from '../src/dexRepository.js';
import { startTestServer } from './httpTestServer.js';

// Explicitly invoked with npm run test:db; only SELECT queries are issued.
void test('SQL-backed API against the imported local Emerald EX dataset', async (t) => {
    const config = databaseConfig();
    strictEqual(
        ['127.0.0.1', 'localhost', '::1'].includes(String(config.host)),
        true,
        'Database integration tests require a local DB_HOST',
    );
    const connection = await createConnection(config);
    await connection.end();
    const pool = createPool(config);
    const repository = new DexRepository(poolDatabase(pool), 'emerald-ex-1.0.4');
    const server = await startTestServer(createApp(repository));
    const source = JSON.parse(
        await readFile(
            new URL('../../../docs/pokemon_emerald_ex_1.0.4_stats_types.json', import.meta.url),
            'utf8',
        ),
    ) as { species: Pokemon[] };
    const moveSource = JSON.parse(
        await readFile(
            new URL('../../../docs/pokemon_emerald_ex_1.0.4_learnsets.json', import.meta.url),
            'utf8',
        ),
    ) as { moves: Move[] };
    async function get<T>(path: string): Promise<T> {
        const response = await fetch(`${server.url}/api/v1/${path}`);
        strictEqual(response.status, 200, path);
        return response.json() as Promise<T>;
    }
    async function species(path: string): Promise<Pokemon[]> {
        return (await get<PageResponse<Pokemon>>(path)).data;
    }

    try {
        await t.test(
            'SQL metadata and every paginated species match the original export',
            async () => {
                const metadata = (await get<ApiResponse<DexDataset>>('dataset')).data;
                strictEqual(metadata.version, '1.0.4');
                strictEqual(metadata.speciesFormCount, 1523);
                const all: Pokemon[] = [];
                for (let page = 1; page <= 7; page++) {
                    const result = await get<PageResponse<Pokemon>>(
                        `species?page=${page}&pageSize=250`,
                    );
                    deepStrictEqual(result.meta, {
                        total: 1523,
                        page,
                        pageSize: 250,
                        totalPages: 7,
                    });
                    all.push(...result.data);
                }
                deepStrictEqual(all, source.species);
                strictEqual((await species('species?page=8&pageSize=250')).length, 0);
            },
        );

        await t.test(
            'name/ID search, duplicate forms and either type slot preserve dex behavior',
            async () => {
                deepStrictEqual(
                    await species('species?q=%20BULBASAUR%20'),
                    source.species.filter((entry) => entry.speciesId === 1),
                );
                deepStrictEqual(
                    await species('species?q=%230001'),
                    source.species.filter((entry) => entry.speciesId === 1),
                );
                deepStrictEqual(
                    await species('species?q=1523'),
                    source.species.filter((entry) => entry.speciesId === 1523),
                );
                deepStrictEqual(
                    await species('species?q=Mimikyu'),
                    source.species.filter((entry) => entry.name === 'Mimikyu'),
                );
                strictEqual((await species('species?q=Bulbasaur&type=Poison')).length, 1);
                strictEqual((await species('species?q=Bulbasaur&type=Water')).length, 0);
                const fairy = await species('species?type=Fairy&pageSize=250');
                deepStrictEqual(
                    fairy,
                    source.species.filter((entry) => entry.types.includes('Fairy')),
                );
                for (const q of ['not a pokemon', '%', '_', "' OR 1=1 --"]) {
                    strictEqual((await species(`species?q=${encodeURIComponent(q)}`)).length, 0, q);
                }
            },
        );

        await t.test(
            'stat sorts use descending values and ascending IDs for ties across pages',
            async () => {
                for (const sort of ['total', 'speed'] as const) {
                    const expected = [...source.species].sort((a, b) => {
                        const difference =
                            sort === 'total'
                                ? b.baseStatTotal - a.baseStatTotal
                                : b.stats.speed - a.stats.speed;
                        return difference || a.speciesId - b.speciesId;
                    });
                    const first = await species(`species?sort=${sort}&pageSize=40`);
                    const second = await species(`species?sort=${sort}&pageSize=40&page=2`);
                    deepStrictEqual([...first, ...second], expected.slice(0, 80));
                }
                const byName = await species('species?sort=name&pageSize=250');
                for (let index = 1; index < byName.length; index++) {
                    strictEqual(
                        byName[index - 1].name.localeCompare(byName[index].name, 'en', {
                            sensitivity: 'base',
                        }) <= 0,
                        true,
                    );
                }
            },
        );

        await t.test(
            'species subresources preserve stats, ordered types, level zero, evolution conditions and machines',
            async () => {
                const record = (await get<ApiResponse<Pokemon>>('species/0001')).data;
                deepStrictEqual(record, source.species[0]);
                deepStrictEqual((await get<ApiResponse<{ name: string }>>('species/1/name')).data, {
                    name: 'Bulbasaur',
                });
                deepStrictEqual((await get<ApiResponse<object>>('species/1/stats')).data, {
                    ...record.stats,
                    baseStatTotal: record.baseStatTotal,
                });
                const types = (await get<ApiResponse<SpeciesType[]>>('species/1/types')).data;
                deepStrictEqual(
                    types.map((type) => type.name),
                    record.types,
                );
                deepStrictEqual(
                    types.map((type) => type.slot),
                    [1, 2],
                );
                const learnset = (await get<ApiResponse<LearnsetEntry[]>>('species/1/learnset'))
                    .data;
                strictEqual(learnset.length > 0, true);
                for (const entry of learnset) {
                    const { level: _level, entryOrder: _order, ...move } = entry;
                    deepStrictEqual(
                        move,
                        (await get<ApiResponse<Move>>(`moves/${entry.moveId}`)).data,
                    );
                }
                const levelZero = await pool.execute<{ speciesId: number }[]>(
                    'SELECT species_id AS speciesId FROM emerald_ex_learnset_entries WHERE dataset_id = ? AND level = 0 LIMIT 1',
                    ['emerald-ex-1.0.4'],
                );
                const zeroLearnset = (
                    await get<ApiResponse<LearnsetEntry[]>>(
                        `species/${levelZero[0].speciesId}/learnset`,
                    )
                ).data;
                strictEqual(
                    zeroLearnset.some((entry) => entry.level === 0),
                    true,
                );
                const evolutions = (await get<ApiResponse<Evolution[]>>('species/1/evolution'))
                    .data;
                strictEqual(evolutions[0].toSpeciesId, 2);
                strictEqual(evolutions[0].level, 16);
                deepStrictEqual(evolutions[0].conditions, {});
                strictEqual(
                    (await get<ApiResponse<Machine[]>>('species/1/machines')).data.length > 0,
                    true,
                );
            },
        );

        await t.test(
            'all moves and move subresources retain power, description and sentinel ID zero',
            async () => {
                const zero = (await get<ApiResponse<Move>>('moves/0')).data;
                strictEqual(zero.moveId, 0);
                strictEqual(zero.name, '-');
                const move = (await get<ApiResponse<Move>>('moves/33')).data;
                deepStrictEqual((await get<ApiResponse<object>>('moves/33/name')).data, {
                    name: move.name,
                });
                deepStrictEqual((await get<ApiResponse<object>>('moves/33/category')).data, {
                    categoryId: move.categoryId,
                    name: move.category,
                });
                deepStrictEqual((await get<ApiResponse<object>>('moves/33/type')).data, {
                    typeId: move.typeId,
                    name: move.type,
                });
                deepStrictEqual((await get<ApiResponse<object>>('moves/33/pp')).data, {
                    pp: move.pp,
                });
                for (const field of ['damage', 'power']) {
                    deepStrictEqual((await get<ApiResponse<object>>(`moves/33/${field}`)).data, {
                        power: move.power,
                        effectId: move.effectId,
                    });
                }
                const all: Move[] = [];
                for (let page = 1; page <= 4; page++) {
                    const result = await get<PageResponse<Move>>(`moves?page=${page}&pageSize=250`);
                    strictEqual(result.meta.total, 935);
                    all.push(...result.data);
                }
                strictEqual(all.length, 935);
                deepStrictEqual(all, moveSource.moves);
                strictEqual(new Set(all.map((entry) => entry.moveId)).size, 935);
                const types = (await get<ApiResponse<SpeciesType[]>>('types')).data;
                strictEqual(types.length, 19);
                strictEqual(
                    types.some((type) => type.name === 'Mystery'),
                    true,
                );
            },
        );

        await t.test(
            'valid species with no relationships return arrays; missing IDs return 404',
            async () => {
                for (const [table, field, resource] of [
                    ['emerald_ex_learnset_entries', 'species_id', 'learnset'],
                    ['emerald_ex_evolutions', 'from_species_id', 'evolution'],
                    ['emerald_ex_species_machines', 'species_id', 'machines'],
                ]) {
                    const rows = await pool.execute<{ speciesId: number }[]>(
                        `SELECT s.species_id AS speciesId FROM emerald_ex_species AS s WHERE s.dataset_id = ? AND NOT EXISTS (SELECT 1 FROM ${table} AS r WHERE r.dataset_id = s.dataset_id AND r.${field} = s.species_id) LIMIT 1`,
                        ['emerald-ex-1.0.4'],
                    );
                    strictEqual(rows.length, 1);
                    deepStrictEqual(
                        (
                            await get<ApiResponse<unknown[]>>(
                                `species/${rows[0].speciesId}/${resource}`,
                            )
                        ).data,
                        [],
                    );
                }
                for (const path of ['species/65535', 'species/65535/learnset', 'moves/65535']) {
                    strictEqual((await fetch(`${server.url}/api/v1/${path}`)).status, 404);
                }
                const internal = await pool.execute<{ speciesId: number }[]>(
                    'SELECT from_species_id AS speciesId FROM emerald_ex_evolutions WHERE dataset_id = ? AND internal_only = 1 LIMIT 1',
                    ['emerald-ex-1.0.4'],
                );
                const publicEdges = (
                    await get<ApiResponse<Evolution[]>>(
                        `species/${internal[0].speciesId}/evolution`,
                    )
                ).data;
                const expected = await pool.execute<{ count: number }[]>(
                    'SELECT COUNT(*) AS count FROM emerald_ex_evolutions WHERE dataset_id = ? AND from_species_id = ? AND internal_only = 0',
                    ['emerald-ex-1.0.4', internal[0].speciesId],
                );
                strictEqual(publicEdges.length, expected[0].count);
            },
        );

        await t.test(
            'a different configured dataset cannot return Emerald EX records',
            async () => {
                const other = new DexRepository(poolDatabase(pool), 'dex-test-missing-dataset');
                strictEqual(await other.getSpecies(1), undefined);
                strictEqual(await other.getMove(33), undefined);
                deepStrictEqual(await other.getLearnset(1), []);
                deepStrictEqual(await other.getEvolutions(1), []);
                deepStrictEqual(await other.getMachines(1), []);
                deepStrictEqual(await other.getTypes(), []);
            },
        );
    } finally {
        await server.close();
        await pool.end();
    }
});
