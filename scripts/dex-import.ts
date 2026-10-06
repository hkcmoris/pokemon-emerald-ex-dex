import { createHash } from 'node:crypto';

export const sourceKinds = [
    'stats_types',
    'learnsets',
    'evolutions',
    'tm_hm_compatibility',
] as const;
export type SourceKind = (typeof sourceKinds)[number];
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
        tables.push({
            name,
            columns: ['dataset_id', ...columns],
            rows: rows.map((row) => [datasetId, ...row]),
        });
    }

    const romHashes = new Set<string>();
    add('dex_datasets', ['game', 'version'], [[game, version]]);
    add(
        'dex_sources',
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
    add('pokemon_types', ['type_id', 'name'], [...types.entries()]);
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
    for (const kind of ['learnsets', 'evolutions', 'tm_hm_compatibility'] as const) {
        const entries = records(documents[kind].species);
        const names = indexNames(entries, 'speciesId');
        assert(names.size === speciesNames.size, `Species count mismatch in ${kind}`);
        for (const [id, name] of names)
            assert(speciesNames.get(id) === name, `Species/name mismatch in ${kind}: ${id}`);
    }
    add('species', ['species_id', 'name'], [...speciesNames.entries()]);
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
    const counts = Object.fromEntries(tables.map((table) => [table.name, table.rows.length]));
    assert(
        counts.learnset_entries === record(learnsets.metadata).levelUpEntryCount,
        'Learnset count mismatch',
    );
    assert(
        counts.machines === record(compatibility.metadata).machineCount,
        'Machine count mismatch',
    );
    assert(
        counts.species_machines === record(compatibility.metadata).compatibleSpeciesMachinePairs,
        'Compatibility count mismatch',
    );

    const lines = [
        '-- Generated by npm run db:generate-import. Do not edit; regenerate from docs/ exports.',
        `-- Replaces only dataset ${datasetId}. Use a batch client that stops on the first error.`,
        '-- Run 001_schema.sql first. No DDL, TRUNCATE, or disabled foreign keys in the data transaction.',
        'SET NAMES utf8mb4;',
        'SET @dex_previous_sql_mode = @@SESSION.sql_mode;',
        "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_BACKSLASH_ESCAPES,NO_ENGINE_SUBSTITUTION';",
        'START TRANSACTION;',
        `SELECT dataset_id FROM dex_datasets WHERE dataset_id = ${sqlLiteral(datasetId)} FOR UPDATE;`,
        ...[...tables]
            .reverse()
            .map(
                (table) => `DELETE FROM ${table.name} WHERE dataset_id = ${sqlLiteral(datasetId)};`,
            ),
    ];
    for (const table of tables) {
        for (let offset = 0; offset < table.rows.length; offset += 250) {
            const rows = table.rows.slice(offset, offset + 250);
            lines.push(
                `\nINSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES`,
                rows.map((row) => `(${row.map(sqlLiteral).join(', ')})`).join(',\n') + ';',
            );
        }
    }
    lines.push('\nCOMMIT;', 'SET SESSION sql_mode = @dex_previous_sql_mode;', '');
    return { sql: lines.join('\n'), counts, datasetId };
}
