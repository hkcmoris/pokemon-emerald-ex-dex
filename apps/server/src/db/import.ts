import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { normalizeSearch } from '@replace-me/shared';
import type { Evolution, LevelUpMove } from '@replace-me/shared';
import { schema } from './schema.js';

interface LearnsetSource {
    metadata: { game: string; version: string; sourceRomSha256: string };
    moves: { moveId: number; name: string }[];
    species: { speciesId: number; name: string; learnset: LevelUpMove[] }[];
}
interface CompatibilitySource {
    machines: { machine: string; kind: string; number: number; moveId: number }[];
    species: { speciesId: number; tms: { machine: string }[]; hms: { machine: string }[] }[];
}
export interface SeedStatement {
    sql: string;
    rows: (string | number)[][];
}

export function readSeed(docsDirectory: string): SeedStatement[] {
    const read = (suffix: string): unknown =>
        JSON.parse(
            readFileSync(`${docsDirectory}/pokemon_emerald_ex_1.0.4_${suffix}.json`, 'utf8'),
        );
    const learnsets = read('learnsets') as LearnsetSource;
    const compatibility = read('tm_hm_compatibility') as CompatibilitySource;
    const evolutions = read('evolutions') as { edges: Evolution[] };
    const names = new Map<string, number>();
    for (const s of learnsets.species) names.set(s.name, (names.get(s.name) ?? 0) + 1);
    const bySpecies = new Map(compatibility.species.map((s) => [s.speciesId, s]));
    return [
        {
            sql: 'INSERT OR IGNORE INTO species VALUES',
            rows: learnsets.species.map((s) => {
                const m = bySpecies.get(s.speciesId);
                if (!m) throw new Error(`Missing machines for species ${s.speciesId}`);
                return [
                    s.speciesId,
                    s.name,
                    normalizeSearch(s.name),
                    names.get(s.name) ?? 1,
                    s.learnset.length,
                    m.tms.length + m.hms.length,
                ];
            }),
        },
        {
            sql: 'INSERT OR IGNORE INTO moves VALUES',
            rows: learnsets.moves.map((m) => [m.moveId, m.name]),
        },
        {
            sql: 'INSERT OR IGNORE INTO learnsets VALUES',
            rows: learnsets.species.flatMap((s) =>
                s.learnset.map((m, i) => [s.speciesId, i, m.level, m.moveId]),
            ),
        },
        {
            sql: 'INSERT OR IGNORE INTO machines VALUES',
            rows: compatibility.machines.map((m) => [m.machine, m.kind, m.number, m.moveId]),
        },
        {
            sql: 'INSERT OR IGNORE INTO compatibility VALUES',
            rows: compatibility.species.flatMap((s) =>
                [...s.tms, ...s.hms].map((m) => [s.speciesId, m.machine]),
            ),
        },
        {
            sql: 'INSERT OR IGNORE INTO evolutions VALUES',
            rows: evolutions.edges.map((e, i) => [
                i,
                e.fromSpeciesId,
                e.toSpeciesId,
                Number(e.internalOnly),
                JSON.stringify(e),
            ]),
        },
        {
            sql: 'INSERT OR IGNORE INTO metadata VALUES',
            rows: [
                ['game', learnsets.metadata.game],
                ['version', learnsets.metadata.version],
                ['sourceRomSha256', learnsets.metadata.sourceRomSha256],
                ['dataset', 'emerald-ex-1.0.4'],
            ],
        },
    ];
}
export function importDatabase(database: DatabaseSync, docsDirectory: string): void {
    const seed = readSeed(docsDirectory);
    database.exec('PRAGMA foreign_keys = ON; BEGIN IMMEDIATE;');
    try {
        if (!database.prepare("SELECT name FROM sqlite_master WHERE name = 'species'").get())
            database.exec(schema);
        for (const group of seed) {
            const insert = database.prepare(
                `${group.sql} (${group.rows[0].map(() => '?').join(',')})`,
            );
            for (const row of group.rows) insert.run(...row);
        }
        const updateSearch = database.prepare(
            'UPDATE species SET search_name = ? WHERE species_id = ?',
        );
        for (const row of seed[0].rows) updateSearch.run(row[2], row[0]);
        database.exec('COMMIT; PRAGMA optimize;');
    } catch (error) {
        database.exec('ROLLBACK');
        throw error;
    }
}
// Trusted build inputs only. Runtime queries bind all user-supplied values.
export function seedSqlStatements(groups: SeedStatement[]): string[] {
    const statements: string[] = [];
    for (const group of groups) {
        let tuples: string[] = [];
        let size = group.sql.length;
        for (const row of group.rows) {
            const tuple = `(${row.map((v) => (typeof v === 'number' ? String(v) : `'${v.replaceAll("'", "''")}'`)).join(',')})`;
            if (size + Buffer.byteLength(tuple) > 75000 || tuples.length >= 2000) {
                statements.push(`${group.sql} ${tuples.join(',')}`);
                tuples = [];
                size = group.sql.length;
            }
            tuples.push(tuple);
            size += Buffer.byteLength(tuple) + 1;
        }
        if (tuples.length) statements.push(`${group.sql} ${tuples.join(',')}`);
    }
    return statements;
}
