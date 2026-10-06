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
    PokemonType,
    SpeciesType,
    SpeciesDetails,
    SpeciesEvolution,
    SpeciesSprites,
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
    ) as { species: Omit<Pokemon, 'sprites' | 'typeIconFiles'>[] };
    const spriteSource = JSON.parse(
        await readFile(
            new URL(
                '../../../docs/pokemon_emerald_ex_1.0.4_battle_sprites/sprite_manifest.json',
                import.meta.url,
            ),
            'utf8',
        ),
    ) as {
        species: {
            speciesId: number;
            frontFrameCount: number;
            reason?: string;
            files: Partial<
                Record<
                    | 'front'
                    | 'shinyFront'
                    | 'frontFrame2'
                    | 'shinyFrontFrame2'
                    | 'back'
                    | 'shinyBack',
                    string
                >
            >;
        }[];
    };
    const typeRows = await pool.execute<PokemonType[]>(
        'SELECT type_id AS typeId, name, icon_file AS iconFile FROM emerald_ex_types WHERE dataset_id = ? ORDER BY name',
        ['emerald-ex-1.0.4'],
    );
    const typeIcons = new Map(typeRows.map((type) => [type.typeId, type.iconFile]));
    const expected = source.species.map((entry): Pokemon => {
        const sprite = spriteSource.species.find((row) => row.speciesId === entry.speciesId);
        if (!sprite) throw new Error(`Missing sprite fixture: ${entry.speciesId}`);
        return {
            ...entry,
            typeIconFiles: entry.typeIds.map((id) => typeIcons.get(id) ?? null),
            sprites: {
                front: sprite.files.front ?? null,
                shinyFront: sprite.files.shinyFront ?? null,
                frontFrame2: sprite.files.frontFrame2 ?? null,
                shinyFrontFrame2: sprite.files.shinyFrontFrame2 ?? null,
                back: sprite.files.back ?? null,
                shinyBack: sprite.files.shinyBack ?? null,
                frontFrameCount: sprite.frontFrameCount,
                missingReason: sprite.reason ?? null,
            },
        };
    });
    const moveSource = JSON.parse(
        await readFile(
            new URL('../../../docs/pokemon_emerald_ex_1.0.4_learnsets.json', import.meta.url),
            'utf8',
        ),
    ) as { moves: Omit<Move, 'categoryIconFile' | 'typeIconFile'>[] };
    const categoryRows = await pool.execute<{ categoryId: number; iconFile: string | null }[]>(
        'SELECT category_id AS categoryId, icon_file AS iconFile FROM emerald_ex_move_categories WHERE dataset_id = ?',
        ['emerald-ex-1.0.4'],
    );
    const categoryIcons = new Map(categoryRows.map((row) => [row.categoryId, row.iconFile]));
    const expectedMoves: Move[] = moveSource.moves.map((move) => ({
        ...move,
        typeIconFile: typeIcons.get(move.typeId) ?? null,
        categoryIconFile: categoryIcons.get(move.categoryId) ?? null,
    }));
    const evolutionSource = JSON.parse(
        await readFile(
            new URL('../../../docs/pokemon_emerald_ex_1.0.4_evolutions.json', import.meta.url),
            'utf8',
        ),
    ) as { edges: Omit<SpeciesEvolution, 'edgeOrder' | 'fromSprite' | 'toSprite'>[] };
    async function get<T>(path: string): Promise<T> {
        const response = await fetch(`${server.url}/api/v1/${path}`);
        strictEqual(response.status, 200, path);
        return response.json() as Promise<T>;
    }
    async function species(path: string): Promise<Pokemon[]> {
        return (await get<PageResponse<Pokemon>>(path)).data;
    }

    try {
        await t.test('type catalog and species slots retain SQL icon filenames', async () => {
            deepStrictEqual(
                (await get<ApiResponse<PokemonType[]>>('types')).data,
                typeRows.map(({ typeId, name, iconFile }) => ({ typeId, name, iconFile })),
            );
            for (const id of [1, 25, 92, 1523]) {
                const types = (await get<ApiResponse<SpeciesType[]>>(`species/${id}/types`)).data;
                deepStrictEqual(
                    types.map((type) => type.iconFile),
                    expected.find((entry) => entry.speciesId === id)?.typeIconFiles,
                );
            }
        });
        await t.test(
            'sprite references match each form and preserve explicit missing sprites',
            async () => {
                for (const id of [1, 29, 716, 958, 1431, 1432, 1433, 1435]) {
                    const result = (
                        await get<ApiResponse<SpeciesSprites | null>>(`species/${id}/sprites`)
                    ).data;
                    deepStrictEqual(
                        result,
                        expected.find((entry) => entry.speciesId === id)?.sprites,
                    );
                }
            },
        );
        await t.test(
            'complete species details preserve incoming/outgoing evolutions, internal routes and full machine moves',
            async () => {
                for (const id of [1, 2, 25, 104, 958]) {
                    const details = (
                        await get<ApiResponse<SpeciesDetails>>(`species/${id}/details`)
                    ).data;
                    const { learnset, machines, evolutionLinks, ...core } = details;
                    deepStrictEqual(
                        core,
                        expected.find((entry) => entry.speciesId === id),
                    );
                    deepStrictEqual(
                        learnset,
                        (await get<ApiResponse<LearnsetEntry[]>>(`species/${id}/learnset`)).data,
                    );
                    const expectedLinks = evolutionSource.edges
                        .map((edge, index) => ({
                            ...edge,
                            edgeOrder: index + 1,
                            fromSprite:
                                expected.find((entry) => entry.speciesId === edge.fromSpeciesId)
                                    ?.sprites?.front ?? null,
                            toSprite:
                                expected.find((entry) => entry.speciesId === edge.toSpeciesId)
                                    ?.sprites?.front ?? null,
                        }))
                        .filter((edge) => edge.fromSpeciesId === id || edge.toSpeciesId === id);
                    deepStrictEqual(evolutionLinks, expectedLinks);
                    const compatible = (await get<ApiResponse<Machine[]>>(`species/${id}/machines`))
                        .data;
                    deepStrictEqual(
                        machines.map(({ machine, kind, number, moveId, name }) => ({
                            machine,
                            kind,
                            number,
                            moveId,
                            name,
                        })),
                        compatible,
                    );
                    for (const {
                        machine: _machine,
                        kind: _kind,
                        number: _number,
                        ...move
                    } of machines) {
                        deepStrictEqual(
                            move,
                            expectedMoves.find((entry) => entry.moveId === move.moveId),
                        );
                    }
                }
            },
        );
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
                deepStrictEqual(all, expected);
                strictEqual((await species('species?page=8&pageSize=250')).length, 0);
            },
        );

        await t.test(
            'name/ID search, duplicate forms and either type slot preserve dex behavior',
            async () => {
                deepStrictEqual(
                    await species('species?q=%20BULBASAUR%20'),
                    expected.filter((entry) => entry.speciesId === 1),
                );
                deepStrictEqual(
                    await species('species?q=%230001'),
                    expected.filter((entry) => entry.speciesId === 1),
                );
                deepStrictEqual(
                    await species('species?q=1523'),
                    expected.filter((entry) => entry.speciesId === 1523),
                );
                deepStrictEqual(
                    await species('species?q=Mimikyu'),
                    expected.filter((entry) => entry.name === 'Mimikyu'),
                );
                strictEqual((await species('species?q=Bulbasaur&type=Poison')).length, 1);
                strictEqual((await species('species?q=Bulbasaur&type=Water')).length, 0);
                const fairy = await species('species?type=Fairy&pageSize=250');
                deepStrictEqual(
                    fairy,
                    expected.filter((entry) => entry.types.includes('Fairy')),
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
                    const sorted = [...expected].sort((a, b) => {
                        const difference =
                            sort === 'total'
                                ? b.baseStatTotal - a.baseStatTotal
                                : b.stats.speed - a.stats.speed;
                        return difference || a.speciesId - b.speciesId;
                    });
                    const first = await species(`species?sort=${sort}&pageSize=40`);
                    const second = await species(`species?sort=${sort}&pageSize=40&page=2`);
                    deepStrictEqual([...first, ...second], sorted.slice(0, 80));
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
                deepStrictEqual(record, expected[0]);
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
                    iconFile: move.categoryIconFile,
                });
                deepStrictEqual((await get<ApiResponse<object>>('moves/33/type')).data, {
                    typeId: move.typeId,
                    name: move.type,
                    iconFile: move.typeIconFile,
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
                deepStrictEqual(all, expectedMoves);
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
                for (const path of [
                    'species/65535',
                    'species/65535/details',
                    'species/65535/learnset',
                    'moves/65535',
                ]) {
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
                strictEqual(await other.getSpeciesDetails(1), undefined);
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
