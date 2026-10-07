import { createHash } from 'node:crypto';

export const tablePrefix = 'emerald_ex_';

export const sourceKinds = [
    'stats_types',
    'learnsets',
    'evolutions',
    'tm_hm_compatibility',
    'battle_sprites',
    'forms',
    'items',
    'abilities',
] as const;
export type SourceKind = (typeof sourceKinds)[number];
export const sourceFileNames: Record<SourceKind, string> = {
    stats_types: 'pokemon_emerald_ex_1.0.4_stats_types.json',
    learnsets: 'pokemon_emerald_ex_1.0.4_learnsets.json',
    evolutions: 'pokemon_emerald_ex_1.0.4_evolutions.json',
    tm_hm_compatibility: 'pokemon_emerald_ex_1.0.4_tm_hm_compatibility.json',
    battle_sprites: 'pokemon_emerald_ex_1.0.4_battle_sprites/sprite_manifest.json',
    forms: 'pokemon_emerald_ex_1.0.4_forms.json',
    items: 'pokemon_emerald_ex_1.0.4_items.json',
    abilities: 'pokemon_emerald_ex_1.0.4_abilities.json',
};

export function sourceFilePath(kind: SourceKind): string {
    return `${kind === 'battle_sprites' ? 'assets' : 'docs'}/${sourceFileNames[kind]}`;
}
export const spriteFolders = {
    front: 'front',
    shinyFront: 'shiny_front',
    frontFrame2: 'front_frame2',
    shinyFrontFrame2: 'shiny_front_frame2',
    back: 'back',
    shinyBack: 'shiny_back',
} as const;
export interface SourceFile {
    fileName: string;
    contents: string;
}
type JsonRecord = Record<string, unknown>;
type SqlValue = string | number | boolean | null;
interface TableData {
    name: string;
    columns: string[];
    rows: SqlValue[][];
}

function insertStatements(table: TableData): string[] {
    const lines: string[] = [];
    for (let offset = 0; offset < table.rows.length; offset += 250) {
        const rows = table.rows.slice(offset, offset + 250);
        lines.push(
            `\nINSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES`,
            rows.map((row) => `(${row.map(sqlLiteral).join(', ')})`).join(',\n') + ';',
        );
    }
    return lines;
}

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function record(value: unknown): JsonRecord {
    assert(
        typeof value === 'object' && value !== null && !Array.isArray(value),
        'Expected an object',
    );
    return value as JsonRecord;
}

function records(value: unknown): JsonRecord[] {
    assert(Array.isArray(value), 'Expected an array');
    return value.map(record);
}

function text(value: unknown): string {
    assert(
        typeof value === 'string' && !value.includes('\0'),
        'Expected a string without NUL bytes',
    );
    return value;
}

function integer(value: unknown, min = 0, max = 65535): number {
    assert(
        typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max,
        `Expected an integer between ${min} and ${max}: ${String(value)}`,
    );
    return value;
}

function boolean(value: unknown): boolean {
    assert(typeof value === 'boolean', 'Expected a boolean');
    return value;
}

function indexNames(entries: JsonRecord[], idKey: string): Map<number, string> {
    const result = new Map<number, string>();
    for (const entry of entries) {
        const id = integer(entry[idKey]);
        assert(!result.has(id), `Duplicate ${idKey}: ${id}`);
        result.set(id, text(entry.name));
    }
    return result;
}

export function sqlLiteral(value: SqlValue): string {
    if (value === null) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') {
        assert(Number.isSafeInteger(value), 'SQL numbers must be safe integers');
        return String(value);
    }
    return `'${text(value).replaceAll("'", "''")}'`;
}

export function buildDexImport(sources: Record<SourceKind, SourceFile>): {
    sql: string;
    spritesSql: string;
    formsSql: string;
    itemsSql: string;
    abilitiesSql: string;
    counts: Record<string, number>;
    datasetId: string;
} {
    const documents = Object.fromEntries(
        sourceKinds.map((kind) => [kind, record(JSON.parse(sources[kind].contents) as unknown)]),
    ) as Record<SourceKind, JsonRecord>;
    const stats = documents.stats_types;
    const learnsets = documents.learnsets;
    const evolution = documents.evolutions;
    const compatibility = documents.tm_hm_compatibility;
    const metadata = record(stats.metadata);
    const game = text(metadata.game);
    const version = text(metadata.version);
    assert(
        game === 'Pokémon Emerald EX' && /^\d+\.\d+\.\d+$/.test(version),
        'Unexpected game/version',
    );
    const datasetId = `emerald-ex-${version}`;
    const tables: TableData[] = [];
    function add(name: string, columns: string[], rows: SqlValue[][]) {
        const table = {
            name: `${tablePrefix}${name}`,
            columns: ['dataset_id', ...columns],
            rows: rows.map((row) => [datasetId, ...row]),
        };
        tables.push(table);
        return table;
    }

    const romHashes = new Set<string>();
    add('datasets', ['game', 'version'], [[game, version]]);
    const sourceTable = add(
        'sources',
        ['source_kind', 'file_name', 'file_sha256', 'metadata'],
        sourceKinds.map((kind) => {
            const info = record(documents[kind].metadata);
            assert(
                info.game === game && info.version === version,
                `Game/version mismatch in ${kind}`,
            );
            if (info.sourceRomSha256 !== undefined) romHashes.add(text(info.sourceRomSha256));
            return [
                kind,
                sources[kind].fileName,
                createHash('sha256').update(sources[kind].contents).digest('hex'),
                JSON.stringify(info),
            ];
        }),
    );
    assert(romHashes.size <= 1, 'Source exports refer to different ROM hashes');

    const types = new Map(
        Object.entries(record(metadata.typeIdMapping)).map(([id, name]) => [
            integer(Number(id)),
            text(name),
        ]),
    );
    add('types', ['type_id', 'name'], [...types.entries()]);
    const moveEntries = records(learnsets.moves);
    const moveNames = indexNames(moveEntries, 'moveId');
    const moves = new Map(moveEntries.map((entry) => [integer(entry.moveId), entry]));
    const categories = new Map<number, string>();
    for (const entry of moveEntries) {
        const id = integer(entry.categoryId);
        const name = text(entry.category);
        assert(!categories.has(id) || categories.get(id) === name, 'Conflicting move categories');
        categories.set(id, name);
    }
    add(
        'move_categories',
        ['category_id', 'name'],
        [...categories.entries()].sort(([a], [b]) => a - b),
    );
    const methods = new Map(
        Object.entries(record(evolution.methodLegend)).map(([id, name]) => [
            integer(Number(id)),
            text(name),
        ]),
    );
    add('evolution_methods', ['method_id', 'name'], [...methods.entries()]);

    const speciesEntries = records(stats.species);
    const speciesNames = indexNames(speciesEntries, 'speciesId');
    assert(!speciesNames.has(0), 'Species ID 0 is not a species/form');
    assert(speciesEntries.length === metadata.speciesFormCount, 'Species count mismatch');
    for (const kind of [
        'learnsets',
        'evolutions',
        'tm_hm_compatibility',
        'battle_sprites',
        'forms',
        'abilities',
    ] as const) {
        const entries = records(documents[kind].species);
        const names = indexNames(entries, 'speciesId');
        assert(names.size === speciesNames.size, `Species count mismatch in ${kind}`);
        for (const [id, name] of names)
            assert(speciesNames.get(id) === name, `Species/name mismatch in ${kind}: ${id}`);
    }
    add('species', ['species_id', 'name'], [...speciesNames.entries()]);
    const spriteEntries = records(documents.battle_sprites.species);
    const spriteKeys = Object.keys(spriteFolders) as (keyof typeof spriteFolders)[];
    const spriteTable = add(
        'species_sprites',
        [
            'species_id',
            'front_file',
            'shiny_front_file',
            'front_frame2_file',
            'shiny_front_frame2_file',
            'back_file',
            'shiny_back_file',
            'front_frame_count',
            'missing_reason',
        ],
        spriteEntries.map((entry) => {
            const id = integer(entry.speciesId, 1);
            const available = boolean(entry.available);
            const frames = integer(entry.frontFrameCount, 0, 2);
            const files = record(entry.files);
            assert(
                Object.keys(files).every((key) => Object.hasOwn(spriteFolders, key)),
                `Unknown sprite variant: ${id}`,
            );
            assert(
                available ? frames >= 1 : frames === 0 && Object.keys(files).length === 0,
                `Invalid sprite availability: ${id}`,
            );
            const paths = spriteKeys.map((key) => {
                const required = available && (frames === 2 || !key.endsWith('Frame2'));
                assert(
                    required === (files[key] !== undefined),
                    `Missing/unexpected sprite ${key}: ${id}`,
                );
                if (!required) return null;
                const path = text(files[key]);
                const prefix = `${spriteFolders[key]}/${String(id).padStart(4, '0')}_`;
                assert(
                    path.length <= 255 &&
                        path.startsWith(prefix) &&
                        path.endsWith('.png') &&
                        !/[\\/]/.test(path.slice(prefix.length)),
                    `Invalid sprite path: ${path}`,
                );
                return path;
            });
            return [id, ...paths, frames, available ? null : text(entry.reason)];
        }),
    );
    const spriteMetadata = record(documents.battle_sprites.metadata);
    assert(
        spriteEntries.filter((entry) => entry.available).length ===
            spriteMetadata.speciesWithSprites,
        'Available sprite count mismatch',
    );
    assert(
        spriteEntries.filter((entry) => !entry.available).length === spriteMetadata.missingSpecies,
        'Missing sprite count mismatch',
    );
    for (const [key, countKey] of Object.entries({
        front: 'frontPngs',
        shinyFront: 'shinyFrontPngs',
        frontFrame2: 'frontFrame2Pngs',
        shinyFrontFrame2: 'shinyFrontFrame2Pngs',
        back: 'backPngs',
        shinyBack: 'shinyBackPngs',
    })) {
        assert(
            spriteEntries.filter((entry) => record(entry.files)[key] !== undefined).length ===
                spriteMetadata[countKey],
            `Sprite file count mismatch: ${key}`,
        );
    }
    const statKeys = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'];
    add(
        'species_stats',
        ['species_id', 'hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'],
        speciesEntries.map((entry) => {
            const values = statKeys.map((key) => integer(record(entry.stats)[key], 0, 255));
            assert(
                values.reduce((sum, value) => sum + value, 0) === entry.baseStatTotal,
                `Stat total mismatch: ${String(entry.speciesId)}`,
            );
            return [integer(entry.speciesId), ...values];
        }),
    );
    add(
        'species_types',
        ['species_id', 'slot', 'type_id'],
        speciesEntries.flatMap((entry) => {
            assert(
                Array.isArray(entry.typeIds) && Array.isArray(entry.types),
                'Invalid species types',
            );
            const ids = entry.typeIds.map((id) => integer(id));
            const names: unknown[] = entry.types;
            assert(
                ids.length >= 1 &&
                    ids.length <= 2 &&
                    new Set(ids).size === ids.length &&
                    names.length === ids.length,
                'Invalid type slots',
            );
            return ids.map((id, slot) => {
                assert(
                    types.has(id) && types.get(id) === names[slot],
                    `Type mapping mismatch: ${id}`,
                );
                return [integer(entry.speciesId), slot + 1, id];
            });
        }),
    );

    add(
        'moves',
        [
            'move_id',
            'name',
            'description',
            'type_id',
            'category_id',
            'power',
            'accuracy',
            'pp',
            'priority',
            'effect_id',
            'target_id',
        ],
        moveEntries.map((entry) => {
            const typeId = integer(entry.typeId);
            assert(
                types.has(typeId) && types.get(typeId) === entry.type,
                `Move type mismatch: ${String(entry.moveId)}`,
            );
            return [
                integer(entry.moveId),
                text(entry.name),
                text(entry.description),
                typeId,
                integer(entry.categoryId),
                integer(entry.power),
                integer(entry.accuracy, 0, 100),
                integer(entry.pp, 0, 255),
                integer(entry.priority, -128, 127),
                integer(entry.effectId),
                integer(entry.targetId),
            ];
        }),
    );
    assert(moves.size === record(learnsets.metadata).moveCount, 'Move count mismatch');
    add(
        'learnset_entries',
        ['species_id', 'entry_order', 'level', 'move_id'],
        records(learnsets.species).flatMap((entry) =>
            records(entry.learnset).map((learned, order) => {
                const id = integer(learned.moveId);
                const move = moves.get(id);
                assert(
                    move !== undefined && learned.move === move.name,
                    `Unknown/mismatched learnset move: ${id}`,
                );
                for (const key of [
                    'type',
                    'category',
                    'power',
                    'accuracy',
                    'pp',
                    'priority',
                    'description',
                ]) {
                    assert(learned[key] === move[key], `Conflicting ${key} for move ${id}`);
                }
                return [integer(entry.speciesId), order + 1, integer(learned.level, 0, 100), id];
            }),
        ),
    );

    const machineEntries = records(compatibility.machines);
    const machines = new Map<string, number>();
    add(
        'machines',
        ['machine_code', 'kind', 'number', 'move_id'],
        machineEntries.map((entry) => {
            const code = text(entry.machine);
            const kind = text(entry.kind);
            const number = integer(entry.number, 1, 99);
            const id = integer(entry.moveId);
            assert(
                (kind === 'TM' || kind === 'HM') &&
                    code === `${kind}${String(number).padStart(2, '0')}`,
                'Invalid machine code',
            );
            assert(
                !machines.has(code) && moveNames.get(id) === entry.move,
                `Duplicate/invalid machine: ${code}`,
            );
            machines.set(code, id);
            return [code, kind, number, id];
        }),
    );
    const pairs = new Set<string>();
    add(
        'species_machines',
        ['species_id', 'machine_code'],
        records(compatibility.species).flatMap((entry) =>
            ['tms', 'hms'].flatMap((key) =>
                records(entry[key]).map((machine) => {
                    const id = integer(entry.speciesId);
                    const code = text(machine.machine);
                    const moveId = integer(machine.moveId);
                    assert(
                        code.startsWith(key === 'tms' ? 'TM' : 'HM') &&
                            machines.get(code) === moveId &&
                            moveNames.get(moveId) === machine.move,
                        `Machine compatibility mismatch: ${id}/${code}`,
                    );
                    const pair = `${id}/${code}`;
                    assert(!pairs.has(pair), `Duplicate machine compatibility: ${pair}`);
                    pairs.add(pair);
                    return [id, code];
                }),
            ),
        ),
    );
    for (const entry of machineEntries) {
        const code = text(entry.machine);
        const count = [...pairs].filter((pair) => pair.endsWith(`/${code}`)).length;
        assert(count === entry.compatibleSpeciesCount, `Machine count mismatch: ${code}`);
    }

    const edges = records(evolution.edges);
    add(
        'evolutions',
        [
            'edge_order',
            'from_species_id',
            'to_species_id',
            'method_id',
            'trigger_name',
            'level',
            'conditions',
            'summary',
            'internal_only',
            'raw_param',
        ],
        edges.map((entry, order) => {
            const from = integer(entry.fromSpeciesId);
            const to = integer(entry.toSpeciesId);
            const method = integer(entry.methodId);
            assert(
                speciesNames.has(from) &&
                    speciesNames.has(to) &&
                    speciesNames.get(from) === entry.fromName &&
                    speciesNames.get(to) === entry.toName,
                `Unknown/mismatched evolution species: ${from}/${to}`,
            );
            assert(
                methods.has(method) && methods.get(method) === entry.method,
                `Unknown evolution method: ${method}`,
            );
            return [
                order + 1,
                from,
                to,
                method,
                text(entry.trigger),
                entry.level === null ? null : integer(entry.level, 0, 100),
                JSON.stringify(record(entry.conditions)),
                text(entry.summary),
                boolean(entry.internalOnly),
                integer(entry.rawParam),
            ];
        }),
    );
    assert(
        edges.filter((edge) => !boolean(edge.internalOnly)).length ===
            record(evolution.metadata).normalEvolutionRules,
        'Normal evolution count mismatch',
    );
    assert(
        edges.filter((edge) => boolean(edge.internalOnly)).length ===
            record(evolution.metadata).internalFormRoutingMarkers,
        'Internal form marker count mismatch',
    );
    const forms = documents.forms;
    const formMetadata = record(forms.metadata);
    for (const [key, expected] of Object.entries({
        speciesFormCount: 1523,
        formGroupCount: 209,
        speciesInFormGroups: 700,
        speciesWithFormChangeTables: 367,
        formChangeRuleCount: 1600,
    }))
        assert(formMetadata[key] === expected, `Forms metadata count mismatch: ${key}`);
    const formMethods = new Map(
        Object.entries(record(forms.methodLegend)).map(([id, name]) => [
            integer(Number(id), 1),
            text(name),
        ]),
    );
    assert(
        formMethods.size === 20 && new Set(formMethods.values()).size === 20,
        'Form method count/name mismatch',
    );
    const formTables: TableData[] = [
        add('form_change_methods', ['method_id', 'name'], [...formMethods.entries()]),
    ];
    const groups = records(forms.groups);
    const groupIds = new Set<number>();
    const memberships = new Map<
        number,
        { groupId: number; baseId: number; member: JsonRecord; ids: number[] }
    >();
    const memberRows: SqlValue[][] = [];
    formTables.push(
        add(
            'form_groups',
            ['form_group_id', 'base_species_id'],
            groups.map((group) => {
                const groupId = integer(group.formGroupId, 1);
                const baseId = integer(group.baseSpeciesId, 1);
                assert(!groupIds.has(groupId), `Duplicate form group: ${groupId}`);
                groupIds.add(groupId);
                assert(
                    speciesNames.get(baseId) === group.baseName,
                    `Unknown/mismatched form base: ${baseId}`,
                );
                const members = records(group.members);
                assert(
                    members.filter((member) => boolean(member.isBaseForm)).length === 1,
                    `Form group must have exactly one base: ${groupId}`,
                );
                assert(
                    members.some(
                        (member) => member.speciesId === baseId && member.isBaseForm === true,
                    ),
                    `Form group base mismatch: ${groupId}`,
                );
                const ids = members.map((member) => integer(member.speciesId, 1));
                for (const member of members) {
                    const id = integer(member.speciesId, 1);
                    assert(
                        speciesNames.get(id) === member.name && speciesNames.has(id),
                        `Unknown/mismatched form member: ${id}`,
                    );
                    assert(!memberships.has(id), `Duplicate form membership: ${id}`);
                    memberships.set(id, { groupId, baseId, member, ids });
                    memberRows.push([
                        groupId,
                        id,
                        boolean(member.isBaseForm),
                        text(member.formKind),
                        member.formLabel === null ? null : text(member.formLabel),
                    ]);
                }
                return [groupId, baseId];
            }),
        ),
    );
    assert(
        groups.length === 209 && memberships.size === 700,
        'Form group/membership count mismatch',
    );
    formTables.push(
        add(
            'species_forms',
            ['form_group_id', 'species_id', 'is_base_form', 'form_kind', 'form_label'],
            memberRows,
        ),
    );
    for (const entry of records(forms.species)) {
        const id = integer(entry.speciesId, 1);
        const membership = memberships.get(id);
        // The species convenience view can include inferred memberships/kinds
        // absent from the authoritative ROM groups (for example Ogerpon).
        if (!membership) continue;
        assert(
            entry.formGroupId === membership.groupId && entry.baseSpeciesId === membership.baseId,
            `Forms species/group mismatch: ${id}`,
        );
        assert(
            entry.isBaseForm === membership.member.isBaseForm,
            `Forms species metadata mismatch: ${id}`,
        );
        assert(
            JSON.stringify(entry.relatedFormSpeciesIds) === JSON.stringify(membership.ids),
            `Forms species members mismatch: ${id}`,
        );
    }
    const changeKeys = new Set<string>();
    const changeSources = new Set<number>();
    const changes = records(forms.changes);
    formTables.push(
        add(
            'form_changes',
            [
                'source_species_id',
                'change_order',
                'target_species_id',
                'raw_target_species_id',
                'restore_previous_form',
                'method_id',
                'form_kind',
                'battle_only',
                'details',
                'summary',
                'raw_param1',
                'raw_param2',
                'raw_param3',
            ],
            changes.map((change) => {
                const sourceId = integer(change.sourceSpeciesId, 1);
                const targetId = integer(change.targetSpeciesId);
                const order = integer(change.changeOrder);
                const restore = boolean(change.restorePreviousForm);
                const method = integer(change.methodId, 1);
                assert(
                    speciesNames.has(sourceId) && speciesNames.get(sourceId) === change.sourceName,
                    `Unknown/mismatched form change source: ${sourceId}`,
                );
                assert(
                    (targetId === 0 && restore && change.targetName === null) ||
                        (targetId > 0 &&
                            !restore &&
                            speciesNames.has(targetId) &&
                            speciesNames.get(targetId) === change.targetName),
                    `Invalid form change target/restore: ${targetId}`,
                );
                assert(
                    formMethods.has(method) && formMethods.get(method) === change.method,
                    `Unknown form change method: ${method}`,
                );
                const key = `${sourceId}/${order}`;
                assert(!changeKeys.has(key), `Duplicate form change: ${key}`);
                changeKeys.add(key);
                changeSources.add(sourceId);
                const params = record(change.rawParams);
                return [
                    sourceId,
                    order,
                    targetId === 0 ? null : targetId,
                    targetId,
                    restore,
                    method,
                    text(change.formKind),
                    boolean(change.battleOnly),
                    JSON.stringify(record(change.details)),
                    text(change.summary),
                    integer(params.param1),
                    integer(params.param2),
                    integer(params.param3),
                ];
            }),
        ),
    );
    assert(
        changes.length === 1600 && changeSources.size === 367,
        'Form change/source count mismatch',
    );
    const items = records(documents.items.items);
    const itemMetadata = record(documents.items.metadata);
    const itemNames = indexNames(items, 'itemId');
    assert(items.length === 828 && itemMetadata.itemCount === 828, 'Item count mismatch');
    assert(JSON.stringify(itemMetadata.itemIdRange) === '[0,827]', 'Item ID range mismatch');
    assert(
        itemMetadata.nativeIconSize === '24x24' && itemMetadata.iconFormat === 'PNG RGBA',
        'Item icon format mismatch',
    );
    const pockets = new Map<number, string>();
    const itemRows = items.map((entry, order) => {
        const id = integer(entry.itemId, 0, 827);
        assert(id === order, `Unexpected item ID/order: ${id}`);
        const pocketId = integer(entry.pocketId, 1, 5);
        const pocket = text(entry.pocket);
        assert(
            !pockets.has(pocketId) || pockets.get(pocketId) === pocket,
            'Conflicting item pocket',
        );
        pockets.set(pocketId, pocket);
        const icon = text(entry.icon);
        assert(
            new RegExp(`^icons/${String(id).padStart(4, '0')}_[A-Za-z0-9_-]+\\.png$`).test(icon) &&
                icon.length <= 255,
            `Invalid item icon path: ${id}`,
        );
        const rom = record(entry.rom);
        for (const key of [
            'fieldUseFunctionPointer',
            'effectPointer',
            'iconPointer',
            'palettePointer',
        ])
            assert(
                rom[key] === null || /^0x[0-9A-Fa-f]{8}$/.test(text(rom[key])),
                `Invalid item ROM pointer: ${id}/${key}`,
            );
        integer(rom.paletteByteCount);
        return [
            id,
            text(entry.name),
            entry.pluralName === null ? null : text(entry.pluralName),
            text(entry.description),
            integer(entry.price, 0, 4294967295),
            pocketId,
            integer(entry.secondaryId),
            integer(entry.holdEffectId),
            integer(entry.holdEffectParam, 0, 255),
            integer(entry.importance, 0, 255),
            boolean(entry.notConsumed),
            integer(entry.itemUseTypeId, 0, 255),
            integer(entry.battleUsageId, 0, 255),
            integer(entry.flingPower, 0, 255),
            icon.slice('icons/'.length),
            JSON.stringify(rom),
        ];
    });
    assert(pockets.size === 5, 'Item pocket count mismatch');
    const pocketCounts = record(itemMetadata.pocketCounts);
    assert(Object.keys(pocketCounts).length === pockets.size, 'Item pocket metadata mismatch');
    for (const [id, name] of pockets)
        assert(
            items.filter((entry) => entry.pocketId === id).length === pocketCounts[name],
            `Item pocket count mismatch: ${name}`,
        );
    const itemTables = [
        add(
            'item_pockets',
            ['pocket_id', 'name'],
            [...pockets.entries()].sort(([a], [b]) => a - b),
        ),
        add(
            'items',
            [
                'item_id',
                'name',
                'plural_name',
                'description',
                'price',
                'pocket_id',
                'secondary_id',
                'hold_effect_id',
                'hold_effect_param',
                'importance',
                'not_consumed',
                'item_use_type_id',
                'battle_usage_id',
                'fling_power',
                'icon_file',
                'rom',
            ],
            itemRows,
        ),
    ];
    function itemReferences(details: JsonRecord): [string, number][] {
        return Object.entries(details).flatMap(([role, value]) => {
            if (
                typeof value !== 'object' ||
                value === null ||
                Array.isArray(value) ||
                !Object.hasOwn(value, 'itemId')
            )
                return [];
            const id = integer(record(value).itemId, 0, 827);
            assert(itemNames.has(id), `Unknown rule item: ${id}`);
            // Other exports can use expanded names; the numeric ROM ID is authoritative.
            return [[role, id] as [string, number]];
        });
    }
    itemTables.push(
        add(
            'evolution_items',
            ['edge_order', 'role', 'item_id'],
            edges.flatMap((edge, order) =>
                itemReferences(record(edge.conditions)).map(([role, id]) => [order + 1, role, id]),
            ),
        ),
    );
    itemTables.push(
        add(
            'form_change_items',
            ['source_species_id', 'change_order', 'role', 'item_id'],
            changes.flatMap((change) =>
                itemReferences(record(change.details)).map(([role, id]) => [
                    integer(change.sourceSpeciesId, 1),
                    integer(change.changeOrder),
                    role,
                    id,
                ]),
            ),
        ),
    );

    const abilityDocument = documents.abilities;
    const abilityMetadata = record(abilityDocument.metadata);
    const abilityEntries = records(abilityDocument.abilities);
    const abilityNames = indexNames(abilityEntries, 'abilityId');
    assert(
        abilityMetadata.abilityCount === 311 &&
            abilityEntries.length === 311 &&
            [...abilityNames.keys()].every((id) => id <= 310),
        'Ability count/IDs mismatch',
    );
    assert(
        abilityMetadata.speciesFormCount === 1523 && speciesNames.size === 1523,
        'Ability species count mismatch',
    );
    const flagFields = [
        ['cantBeCopied', 'cant_be_copied'],
        ['cantBeSwapped', 'cant_be_swapped'],
        ['cantBeTraced', 'cant_be_traced'],
        ['cantBeSuppressed', 'cant_be_suppressed'],
        ['cantBeOverwritten', 'cant_be_overwritten'],
        ['breakable', 'breakable'],
        ['failsOnImposter', 'fails_on_imposter'],
    ] as const;
    const abilitiesById = new Map(abilityEntries.map((entry) => [integer(entry.abilityId), entry]));
    const abilityRows = abilityEntries.map((entry) => {
        const flags = record(entry.flags);
        assert(Object.keys(flags).length === flagFields.length, 'Ability flags mismatch');
        return [
            integer(entry.abilityId),
            text(entry.name),
            text(entry.description),
            integer(entry.aiRating, -128, 127),
            ...flagFields.map(([key]) => boolean(flags[key])),
        ];
    });
    const usedAbilities = new Set<number>();
    const slotRows = records(abilityDocument.species).flatMap((species) => {
        const id = integer(species.speciesId, 1);
        const slots = records(species.slots);
        assert(
            slots.length === 3 && new Set(slots.map((slot) => slot.slot)).size === 3,
            `Ability slots mismatch: ${id}`,
        );
        return slots.map((slot) => {
            const position = integer(slot.slot, 1, 3);
            assert(
                slot.kind === (position === 3 ? 'hidden' : 'normal'),
                `Ability slot kind mismatch: ${id}`,
            );
            const alias = species[['ability1', 'ability2', 'hiddenAbility'][position - 1]];
            const value = slot.ability;
            assert((alias === null) === (value === null), `Ability slot alias mismatch: ${id}`);
            let abilityId: number | null = null;
            if (value !== null) {
                const ability = record(value);
                const aliasAbility = record(alias);
                abilityId = integer(ability.abilityId, 1, 310);
                const definition = abilitiesById.get(abilityId);
                assert(definition !== undefined, `Unknown species ability: ${abilityId}`);
                for (const key of ['abilityId', 'name', 'description']) {
                    assert(
                        ability[key] === definition[key] && aliasAbility[key] === ability[key],
                        `Ability slot/definition mismatch: ${id}/${position}/${key}`,
                    );
                }
                usedAbilities.add(abilityId);
            }
            return [id, position, text(slot.kind), abilityId];
        });
    });
    assert(
        usedAbilities.size === 310 && abilityMetadata.distinctAbilitiesUsedBySpecies === 310,
        'Distinct species ability count mismatch',
    );
    for (const change of changes) {
        for (const value of Object.values(record(change.details))) {
            if (
                typeof value === 'object' &&
                value !== null &&
                !Array.isArray(value) &&
                Object.hasOwn(value, 'abilityId')
            ) {
                assert(
                    abilityNames.has(integer(record(value).abilityId, 1)),
                    'Unknown form change ability',
                );
            }
        }
    }
    const abilityTables = [
        add(
            'abilities',
            [
                'ability_id',
                'name',
                'description',
                'ai_rating',
                ...flagFields.map(([, column]) => column),
            ],
            abilityRows,
        ),
        add('species_abilities', ['species_id', 'slot', 'kind', 'ability_id'], slotRows),
    ];

    const counts = Object.fromEntries(tables.map((table) => [table.name, table.rows.length]));
    assert(
        counts[`${tablePrefix}learnset_entries`] === record(learnsets.metadata).levelUpEntryCount,
        'Learnset count mismatch',
    );
    assert(
        counts[`${tablePrefix}machines`] === record(compatibility.metadata).machineCount,
        'Machine count mismatch',
    );
    assert(
        counts[`${tablePrefix}species_machines`] ===
            record(compatibility.metadata).compatibleSpeciesMachinePairs,
        'Compatibility count mismatch',
    );

    const lines = [
        '-- Generated by npm run db:generate-import. Do not edit; regenerate from docs/ exports.',
        `-- Shared database: touches only ${tablePrefix} tables in the database selected by the client.`,
        `-- Replaces only dataset ${datasetId}. Use a batch client that stops on the first error.`,
        '-- Run 001_schema.sql first. No DDL, TRUNCATE, or disabled foreign keys in the data transaction.',
        'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;',
        'SET @dex_previous_sql_mode = @@SESSION.sql_mode;',
        "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_BACKSLASH_ESCAPES,NO_ENGINE_SUBSTITUTION';",
        'START TRANSACTION;',
        `SELECT dataset_id FROM ${tablePrefix}datasets WHERE dataset_id = ${sqlLiteral(datasetId)} FOR UPDATE;`,
        ...[...tables]
            .reverse()
            .map(
                (table) => `DELETE FROM ${table.name} WHERE dataset_id = ${sqlLiteral(datasetId)};`,
            ),
    ];
    for (const table of tables) lines.push(...insertStatements(table));
    lines.push('\nCOMMIT;', 'SET SESSION sql_mode = @dex_previous_sql_mode;', '');
    const spritesLines = [
        '-- Generated by npm run db:generate-import. Upgrade an existing imported dex without replacing its other data.',
        '-- Run 005_species_sprites.sql first. Use a batch client that stops on the first error.',
        'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;',
        'SET @dex_previous_sql_mode = @@SESSION.sql_mode;',
        "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_BACKSLASH_ESCAPES,NO_ENGINE_SUBSTITUTION';",
        'START TRANSACTION;',
        `SELECT dataset_id FROM ${tablePrefix}datasets WHERE dataset_id = ${sqlLiteral(datasetId)} FOR UPDATE;`,
        `DELETE FROM ${spriteTable.name} WHERE dataset_id = ${sqlLiteral(datasetId)};`,
        `DELETE FROM ${sourceTable.name} WHERE dataset_id = ${sqlLiteral(datasetId)} AND source_kind = 'battle_sprites';`,
        ...insertStatements({
            ...sourceTable,
            rows: sourceTable.rows.filter((row) => row[1] === 'battle_sprites'),
        }),
        ...insertStatements(spriteTable),
        '\nCOMMIT;',
        'SET SESSION sql_mode = @dex_previous_sql_mode;',
        '',
    ];
    const formsLines = [
        '-- Generated by npm run db:generate-import. Imports only form data and its source metadata.',
        '-- Run 011_forms.sql first in your existing database. Use a batch client that stops on errors.',
        'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;',
        'SET @dex_previous_sql_mode = @@SESSION.sql_mode;',
        "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_BACKSLASH_ESCAPES,NO_ENGINE_SUBSTITUTION';",
        'START TRANSACTION;',
        `SELECT dataset_id FROM ${tablePrefix}datasets WHERE dataset_id = ${sqlLiteral(datasetId)} FOR UPDATE;`,
        ...[...formTables]
            .reverse()
            .map(
                (table) => `DELETE FROM ${table.name} WHERE dataset_id = ${sqlLiteral(datasetId)};`,
            ),
        `DELETE FROM ${sourceTable.name} WHERE dataset_id = ${sqlLiteral(datasetId)} AND source_kind = 'forms';`,
        ...insertStatements({
            ...sourceTable,
            rows: sourceTable.rows.filter((row) => row[1] === 'forms'),
        }),
        ...formTables.flatMap(insertStatements),
        '\nCOMMIT;',
        'SET SESSION sql_mode = @dex_previous_sql_mode;',
        '',
    ];
    const itemsLines = [
        '-- Generated by npm run db:generate-import. Run 013_items.sql first; forms must already be imported.',
        '-- Imports items and item references only. Preserves existing icon filenames on repeat imports.',
        'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;',
        'SET @dex_previous_sql_mode = @@SESSION.sql_mode;',
        "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_BACKSLASH_ESCAPES,NO_ENGINE_SUBSTITUTION';",
        'START TRANSACTION;',
        `SELECT dataset_id FROM ${tablePrefix}datasets WHERE dataset_id = ${sqlLiteral(datasetId)} FOR UPDATE;`,
        ...itemTables
            .slice(2)
            .reverse()
            .map(
                (table) => `DELETE FROM ${table.name} WHERE dataset_id = ${sqlLiteral(datasetId)};`,
            ),
        `DELETE FROM ${sourceTable.name} WHERE dataset_id = ${sqlLiteral(datasetId)} AND source_kind = 'items';`,
        ...insertStatements({
            ...sourceTable,
            rows: sourceTable.rows.filter((row) => row[1] === 'items'),
        }),
        ...itemTables.flatMap((table, index) =>
            insertStatements(table).map((line) => {
                if (index >= 2 || !line.endsWith(';')) return line;
                const columns = table.columns.filter(
                    (column) =>
                        !['dataset_id', 'item_id', 'pocket_id', 'icon_file'].includes(column),
                );
                // pocket_id is mutable on items but is the PK of item_pockets.
                if (index === 1) columns.push('pocket_id');
                return (
                    line.slice(0, -1) +
                    '\nON DUPLICATE KEY UPDATE ' +
                    columns.map((column) => `${column} = VALUES(${column})`).join(', ') +
                    ';'
                );
            }),
        ),
        '\nCOMMIT;',
        'SET SESSION sql_mode = @dex_previous_sql_mode;',
        '',
    ];
    const abilitiesLines = [
        '-- Generated by npm run db:generate-import. Run 015_abilities.sql first in your existing database.',
        '-- Imports ability definitions and all three slots per species. Other dex data is preserved.',
        'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;',
        'SET @dex_previous_sql_mode = @@SESSION.sql_mode;',
        "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_BACKSLASH_ESCAPES,NO_ENGINE_SUBSTITUTION';",
        'START TRANSACTION;',
        `SELECT dataset_id FROM ${tablePrefix}datasets WHERE dataset_id = ${sqlLiteral(datasetId)} FOR UPDATE;`,
        ...[...abilityTables]
            .reverse()
            .map(
                (table) => `DELETE FROM ${table.name} WHERE dataset_id = ${sqlLiteral(datasetId)};`,
            ),
        `DELETE FROM ${sourceTable.name} WHERE dataset_id = ${sqlLiteral(datasetId)} AND source_kind = 'abilities';`,
        ...insertStatements({
            ...sourceTable,
            rows: sourceTable.rows.filter((row) => row[1] === 'abilities'),
        }),
        ...abilityTables.flatMap(insertStatements),
        '\nCOMMIT;',
        'SET SESSION sql_mode = @dex_previous_sql_mode;',
        '',
    ];
    return {
        sql: lines.join('\n'),
        spritesSql: spritesLines.join('\n'),
        formsSql: formsLines.join('\n'),
        itemsSql: itemsLines.join('\n'),
        abilitiesSql: abilitiesLines.join('\n'),
        counts,
        datasetId,
    };
}
