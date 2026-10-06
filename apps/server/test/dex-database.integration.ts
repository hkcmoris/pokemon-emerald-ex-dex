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
    FormChange,
    Item,
    RuleItem,
    SpeciesFormGroup,
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
                '../../../assets/pokemon_emerald_ex_1.0.4_battle_sprites/sprite_manifest.json',
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
    ) as { edges: Omit<SpeciesEvolution, 'edgeOrder' | 'fromSprite' | 'toSprite' | 'items'>[] };
    const itemSource = JSON.parse(
        await readFile(
            new URL('../../../docs/pokemon_emerald_ex_1.0.4_items.json', import.meta.url),
            'utf8',
        ),
    ) as { items: (Omit<Item, 'iconFile'> & { icon: string })[] };
    const itemIcons = new Map(
        (
            await pool.execute<{ itemId: number; iconFile: string | null }[]>(
                'SELECT item_id AS itemId, icon_file AS iconFile FROM emerald_ex_items WHERE dataset_id = ?',
                ['emerald-ex-1.0.4'],
            )
        ).map((row) => [row.itemId, row.iconFile]),
    );
    function ruleItems(conditions: Readonly<Record<string, unknown>>): RuleItem[] {
        return Object.entries(conditions)
            .filter(
                ([, value]) =>
                    typeof value === 'object' && value !== null && Object.hasOwn(value, 'itemId'),
            )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([role, value]) => {
                const id = (value as { itemId: number }).itemId;
                const item = itemSource.items.find((entry) => entry.itemId === id)!;
                return { role, itemId: id, name: item.name, iconFile: itemIcons.get(id) ?? null };
            });
    }
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
            'all item metadata, pockets, filters and rule references match the ROM export',
            async () => {
                const rows: Item[] = [];
                for (let page = 1; page <= 4; page++)
                    rows.push(
                        ...(await get<PageResponse<Item>>(`items?page=${page}&pageSize=250`)).data,
                    );
                deepStrictEqual(
                    rows,
                    itemSource.items.map(({ icon: _icon, ...item }) => ({
                        ...item,
                        iconFile: itemIcons.get(item.itemId) ?? null,
                    })),
                );
                strictEqual((await get<PageResponse<Item>>('items?pocket=Berries')).meta.total, 68);
                strictEqual(
                    (await get<PageResponse<Item>>('items?q=%230300')).data[0].name,
                    'Gengarite',
                );
                strictEqual((await get<ApiResponse<Item>>('items/0')).data.name, '????????');
                const links = (await get<ApiResponse<SpeciesEvolution[]>>('species/25/evolution'))
                    .data;
                deepStrictEqual(links.find((edge) => edge.toSpeciesId === 26)?.items, [
                    {
                        role: 'item',
                        itemId: 213,
                        name: 'Thunder Stone',
                        iconFile: itemIcons.get(213),
                    },
                ]);
                const forms = (await get<ApiResponse<SpeciesFormGroup>>('species/94/forms')).data;
                deepStrictEqual(forms.changes.find((rule) => rule.targetSpeciesId === 914)?.items, [
                    {
                        role: 'megaStone',
                        itemId: 300,
                        name: 'Gengarite',
                        iconFile: itemIcons.get(300),
                    },
                ]);
            },
        );
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
            'complete species details preserve public incoming/outgoing evolutions and full machine moves',
            async () => {
                for (const id of [1, 2, 25, 104, 958]) {
                    const details = (
                        await get<ApiResponse<SpeciesDetails>>(`species/${id}/details`)
                    ).data;
                    const {
                        learnset,
                        machines,
                        evolutionLinks,
                        evolutionFamily: _family,
                        evolutionBaseSpeciesId: _baseId,
                        formInfo: _info,
                        forms: _forms,
                        formChanges: _changes,
                        ...core
                    } = details;
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
                            items: ruleItems(edge.conditions),
                            fromSprite:
                                expected.find((entry) => entry.speciesId === edge.fromSpeciesId)
                                    ?.sprites?.front ?? null,
                            toSprite:
                                expected.find((entry) => entry.speciesId === edge.toSpeciesId)
                                    ?.sprites?.front ?? null,
                        }))
                        .filter(
                            (edge) =>
                                !edge.internalOnly &&
                                (edge.fromSpeciesId === id || edge.toSpeciesId === id),
                        );
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
            'evolution endpoints return the same complete family from every stage and branch',
            async () => {
                for (const ids of [
                    [1, 2, 3],
                    [92, 93, 94],
                    [133, 134, 135, 136, 196, 197, 470, 471, 700],
                    [106, 107, 236, 237],
                    [25, 26, 172],
                ]) {
                    const expectedLinks = evolutionSource.edges
                        .map((edge, index) => ({
                            ...edge,
                            edgeOrder: index + 1,
                            items: ruleItems(edge.conditions),
                            fromSprite:
                                expected.find((entry) => entry.speciesId === edge.fromSpeciesId)
                                    ?.sprites?.front ?? null,
                            toSprite:
                                expected.find((entry) => entry.speciesId === edge.toSpeciesId)
                                    ?.sprites?.front ?? null,
                        }))
                        .filter(
                            (edge) =>
                                !edge.internalOnly &&
                                ids.includes(edge.fromSpeciesId) &&
                                ids.includes(edge.toSpeciesId),
                        );
                    for (const id of ids) {
                        deepStrictEqual(
                            (await get<ApiResponse<SpeciesEvolution[]>>(`species/${id}/evolution`))
                                .data,
                            expectedLinks,
                            `Complete evolution family for species ${id}`,
                        );
                    }
                }
                const gengar = (await get<ApiResponse<SpeciesEvolution[]>>('species/94/evolution'))
                    .data;
                strictEqual(gengar.length, 3);
                deepStrictEqual(
                    gengar.map((edge) => [edge.fromName, edge.toName, edge.method]),
                    [
                        ['Gastly', 'Haunter', 'level'],
                        ['Haunter', 'Gengar', 'trade'],
                        ['Haunter', 'Gengar', 'use_item'],
                    ],
                );
                for (const id of [151, 958]) {
                    deepStrictEqual(
                        (await get<ApiResponse<SpeciesEvolution[]>>(`species/${id}/evolution`))
                            .data,
                        [],
                    );
                }
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
                    await get<ApiResponse<SpeciesEvolution[]>>(
                        `species/${internal[0].speciesId}/evolution`,
                    )
                ).data;
                strictEqual(
                    publicEdges.every((edge) => !edge.internalOnly),
                    true,
                );
            },
        );

        await t.test(
            'relational form groups preserve all mechanics, sentinel targets, sprites and base evolution inheritance',
            async () => {
                const formSource = JSON.parse(
                    await readFile(
                        new URL(
                            '../../../docs/pokemon_emerald_ex_1.0.4_forms.json',
                            import.meta.url,
                        ),
                        'utf8',
                    ),
                ) as {
                    groups: Omit<SpeciesFormGroup, 'changes'>[];
                    changes: Omit<
                        FormChange,
                        'sourceSprite' | 'targetSprite' | 'rawTargetSpeciesId' | 'items'
                    >[];
                };
                const sprite = (id: number | null) =>
                    expected.find((entry) => entry.speciesId === id)?.sprites?.front ?? null;
                const normalizeChange = (
                    change: (typeof formSource.changes)[number],
                ): FormChange => ({
                    ...change,
                    items: ruleItems(change.details),
                    rawTargetSpeciesId: change.targetSpeciesId ?? 0,
                    targetSpeciesId: change.targetSpeciesId === 0 ? null : change.targetSpeciesId,
                    sourceSprite: sprite(change.sourceSpeciesId),
                    targetSprite: sprite(change.targetSpeciesId),
                });
                for (const id of [94, 382, 384, 26, 479, 351, 483, 718, 800]) {
                    const group = formSource.groups.find((group) =>
                        group.members.some((member) => member.speciesId === id),
                    );
                    if (!group) throw new Error(`Missing form fixture ${id}`);
                    const memberIds = group.members.map((member) => member.speciesId);
                    const expectedGroup = {
                        ...group,
                        members: group.members
                            .map((member) => ({ ...member, sprite: sprite(member.speciesId) }))
                            .sort(
                                (a, b) =>
                                    Number(b.isBaseForm) - Number(a.isBaseForm) ||
                                    a.speciesId - b.speciesId,
                            ),
                        changes: formSource.changes
                            .filter(
                                (change) =>
                                    memberIds.includes(change.sourceSpeciesId) ||
                                    (change.targetSpeciesId !== null &&
                                        memberIds.includes(change.targetSpeciesId)),
                            )
                            .sort(
                                (a, b) =>
                                    a.sourceSpeciesId - b.sourceSpeciesId ||
                                    a.changeOrder - b.changeOrder,
                            )
                            .map(normalizeChange),
                    };
                    for (const member of group.members) {
                        deepStrictEqual(
                            (
                                await get<ApiResponse<SpeciesFormGroup>>(
                                    `species/${member.speciesId}/forms`,
                                )
                            ).data,
                            expectedGroup,
                        );
                    }
                }
                const gengar = (await get<ApiResponse<SpeciesFormGroup>>('species/94/forms')).data;
                deepStrictEqual(
                    gengar.members.map((member) => [
                        member.speciesId,
                        member.formKind,
                        member.isBaseForm,
                    ]),
                    [
                        [94, 'base', true],
                        [914, 'mega', false],
                        [1496, 'gigantamax', false],
                    ],
                );
                const mega = gengar.changes.find(
                    (change) => change.sourceSpeciesId === 94 && change.targetSpeciesId === 914,
                );
                strictEqual(mega?.method, 'mega_evolution_item');
                deepStrictEqual(mega?.details.megaStone, {
                    itemId: 300,
                    name: 'Gengarite',
                    constant: 'ITEM_GENGARITE',
                });
                strictEqual(
                    gengar.changes.some(
                        (change) =>
                            change.sourceSpeciesId === 94 &&
                            change.targetSpeciesId === 1496 &&
                            change.method === 'gigantamax',
                    ),
                    true,
                );
                for (const [source, target, method, detailKey, requirement] of [
                    [
                        382,
                        954,
                        'primal_reversion',
                        'heldOrb',
                        { itemId: 291, name: 'Blue Orb', constant: 'ITEM_BLUE_ORB' },
                    ],
                    [
                        384,
                        953,
                        'mega_evolution_move',
                        'requiredMove',
                        { moveId: 620, name: 'DragonAscent' },
                    ],
                    [
                        479,
                        479,
                        'item_use_multichoice',
                        'item',
                        { itemId: 694, name: 'Rotom Catalog', constant: 'ITEM_ROTOM_CATALOG' },
                    ],
                    [
                        351,
                        1051,
                        'battle_weather',
                        'requiredAbility',
                        { abilityId: 59, name: 'Forecast' },
                    ],
                    [483, 483, 'item_hold', 'heldItem', null],
                    [
                        1207,
                        1209,
                        'ultra_burst',
                        'ultraItem',
                        {
                            itemId: 391,
                            name: 'Ultranecrozium Z',
                            constant: 'ITEM_ULTRANECROZIUM_Z',
                        },
                    ],
                ] as const) {
                    const group = (
                        await get<ApiResponse<SpeciesFormGroup>>(`species/${source}/forms`)
                    ).data;
                    const rule = group.changes.find(
                        (change) =>
                            change.sourceSpeciesId === source &&
                            change.targetSpeciesId === target &&
                            change.method === method,
                    );
                    if (!rule) throw new Error(`Missing ${method} rule`);
                    deepStrictEqual(rule.details[detailKey], requirement);
                    if (method === 'item_use_multichoice') strictEqual(rule.details.choiceIndex, 0);
                    if (method === 'battle_weather')
                        strictEqual(rule.details.battleWeatherMask, 448);
                }
                const regional = (await get<ApiResponse<SpeciesFormGroup>>('species/958/forms'))
                    .data;
                strictEqual(regional.baseSpeciesId, 26);
                strictEqual(
                    regional.members.find((member) => member.speciesId === 958)?.formKind,
                    'regional',
                );
                for (const [id, base] of [
                    [94, 94],
                    [914, 94],
                    [1496, 94],
                    [954, 382],
                    [958, 958],
                    [1209, 800],
                    [1, 1],
                    [1420, 1420],
                ]) {
                    const details = (
                        await get<ApiResponse<SpeciesDetails>>(`species/${id}/details`)
                    ).data;
                    strictEqual(details.evolutionBaseSpeciesId, base);
                    deepStrictEqual(
                        details.forms,
                        (await get<ApiResponse<SpeciesFormGroup | null>>(`species/${id}/forms`))
                            .data,
                    );
                    deepStrictEqual(
                        details.evolutionFamily,
                        (await get<ApiResponse<SpeciesEvolution[]>>(`species/${base}/evolution`))
                            .data,
                    );
                    strictEqual(
                        details.evolutionLinks.every((edge) => !edge.internalOnly),
                        true,
                    );
                    deepStrictEqual(
                        details.formChanges,
                        formSource.changes
                            .filter((change) => change.sourceSpeciesId === id)
                            .map(normalizeChange),
                    );
                    if ([94, 914, 1496].includes(id)) {
                        strictEqual(details.name, 'Gengar');
                        deepStrictEqual(
                            details.evolutionFamily.map((edge) => [
                                edge.fromSpeciesId,
                                edge.toSpeciesId,
                            ]),
                            [
                                [92, 93],
                                [93, 94],
                                [93, 94],
                            ],
                        );
                    }
                }
                const noForms = (await get<ApiResponse<SpeciesDetails>>('species/1/details')).data;
                strictEqual(noForms.forms, null);
                strictEqual(noForms.formInfo, null);
                const sentinel = (
                    await get<ApiResponse<SpeciesDetails>>('species/1167/details')
                ).data.formChanges.find((change) => change.restorePreviousForm);
                if (!sentinel) throw new Error('Missing restore-previous fixture');
                strictEqual(sentinel.targetSpeciesId, null);
                strictEqual(sentinel.method, 'faint');
                strictEqual(sentinel.rawTargetSpeciesId, 0);
                strictEqual(sentinel.targetName, null);
                strictEqual(sentinel.targetSprite, null);
                for (const [table, count] of [
                    ['form_change_methods', 20],
                    ['form_groups', 209],
                    ['species_forms', 700],
                    ['form_changes', 1600],
                    ['sources', 7],
                ] as const) {
                    strictEqual(
                        Number(
                            (
                                await pool.query<{ n: number }[]>(
                                    `SELECT COUNT(*) AS n FROM emerald_ex_${table} WHERE dataset_id='emerald-ex-1.0.4'`,
                                )
                            )[0].n,
                        ),
                        count,
                    );
                }
                strictEqual(
                    Number(
                        (
                            await pool.query<{ n: number }[]>(
                                'SELECT COUNT(*) AS n FROM emerald_ex_species WHERE species_id=0',
                            )
                        )[0].n,
                    ),
                    0,
                );
                strictEqual(
                    Number(
                        (
                            await pool.query<{ n: number }[]>(
                                'SELECT COUNT(*) AS n FROM emerald_ex_evolutions WHERE from_species_id IN (914,1496) OR to_species_id IN (914,1496)',
                            )
                        )[0].n,
                    ),
                    0,
                );
            },
        );
        await t.test(
            'a different configured dataset cannot return Emerald EX records',
            async () => {
                const other = new DexRepository(poolDatabase(pool), 'dex-test-missing-dataset');
                strictEqual(await other.getSpecies(1), undefined);
                strictEqual(await other.getSpeciesDetails(1), undefined);
                strictEqual(await other.getSpeciesForms(94), null);
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
