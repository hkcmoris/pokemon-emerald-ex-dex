import type {
    BaseStats,
    DexDataset,
    Evolution,
    LearnsetEntry,
    Machine,
    Move,
    PageResponse,
    Pokemon,
    PokemonType,
    SpeciesQuery,
    SpeciesType,
} from '@pokemon-emerald-ex-dex/shared';

import type { Database, SqlParameter } from './database.js';

interface SpeciesRow extends BaseStats {
    speciesId: number;
    name: string;
    baseStatTotal: number;
}

interface TypeRow extends SpeciesType {
    speciesId: number;
}

const speciesSelect = `SELECT s.species_id AS speciesId, s.name,
    st.hp, st.attack, st.defense, st.sp_attack AS spAttack, st.sp_defense AS spDefense,
    st.speed, st.base_stat_total AS baseStatTotal
    FROM emerald_ex_species AS s
    JOIN emerald_ex_species_stats AS st
        ON st.dataset_id = s.dataset_id AND st.species_id = s.species_id`;

const moveFields = `m.move_id AS moveId, m.name, m.description,
    m.type_id AS typeId, t.name AS type, m.category_id AS categoryId, c.name AS category,
    m.power, m.accuracy, m.pp, m.priority, m.effect_id AS effectId, m.target_id AS targetId`;

const moveJoins = `JOIN emerald_ex_types AS t ON t.dataset_id = m.dataset_id AND t.type_id = m.type_id
    JOIN emerald_ex_move_categories AS c
        ON c.dataset_id = m.dataset_id AND c.category_id = m.category_id`;

const sortSql = {
    id: 's.species_id ASC',
    name: 's.name ASC, s.species_id ASC',
    total: 'st.base_stat_total DESC, s.species_id ASC',
    speed: 'st.speed DESC, s.species_id ASC',
};

function searchPattern(query: string): string {
    return `%${query.toLowerCase().replace(/[!%_]/g, '!$&')}%`;
}

function parseConditions(value: string): Readonly<Record<string, unknown>> {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Evolution conditions must be a JSON object');
    }
    return parsed as Readonly<Record<string, unknown>>;
}

function pageResponse<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
): PageResponse<T> {
    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

export class DexRepository {
    constructor(
        private readonly database: Database,
        private readonly datasetId: string,
    ) {}

    async getDataset(): Promise<DexDataset | undefined> {
        const rows = await this.database.query<DexDataset>(
            `SELECT d.dataset_id AS datasetId, d.game, d.version,
                (SELECT COUNT(*) FROM emerald_ex_species AS s
                 WHERE s.dataset_id = d.dataset_id) AS speciesFormCount
             FROM emerald_ex_datasets AS d WHERE d.dataset_id = ?`,
            [this.datasetId],
        );
        return rows[0];
    }

    getTypes(): Promise<PokemonType[]> {
        return this.database.query<PokemonType>(
            'SELECT type_id AS typeId, name FROM emerald_ex_types WHERE dataset_id = ? ORDER BY name',
            [this.datasetId],
        );
    }

    async listSpecies(query: SpeciesQuery): Promise<PageResponse<Pokemon>> {
        const conditions = ['s.dataset_id = ?'];
        const parameters: SqlParameter[] = [this.datasetId];
        if (query.q) {
            const id = query.q.replace(/^#/, '');
            const numericId = /^\d+$/.test(id) ? Number(id) : -1;
            conditions.push("(LOWER(s.name) LIKE ? ESCAPE '!' OR s.species_id = ?)");
            parameters.push(searchPattern(query.q), numericId <= 65535 ? numericId : -1);
        }
        if (query.type) {
            conditions.push(`EXISTS (SELECT 1 FROM emerald_ex_species_types AS stype
                JOIN emerald_ex_types AS t ON t.dataset_id = stype.dataset_id AND t.type_id = stype.type_id
                WHERE stype.dataset_id = s.dataset_id AND stype.species_id = s.species_id AND t.name = ?)`);
            parameters.push(query.type);
        }
        const where = `WHERE ${conditions.join(' AND ')}`;
        const counts = await this.database.query<{ total: number }>(
            `SELECT COUNT(*) AS total FROM emerald_ex_species AS s ${where}`,
            parameters,
        );
        const rows = await this.database.query<SpeciesRow>(
            `${speciesSelect} ${where} ORDER BY ${sortSql[query.sort]} LIMIT ? OFFSET ?`,
            [...parameters, query.pageSize, (query.page - 1) * query.pageSize],
        );
        return pageResponse(
            await this.hydrateSpecies(rows),
            counts[0].total,
            query.page,
            query.pageSize,
        );
    }

    async getSpecies(id: number): Promise<Pokemon | undefined> {
        const rows = await this.database.query<SpeciesRow>(
            `${speciesSelect} WHERE s.dataset_id = ? AND s.species_id = ?`,
            [this.datasetId, id],
        );
        return (await this.hydrateSpecies(rows))[0];
    }

    getSpeciesTypes(id: number): Promise<SpeciesType[]> {
        return this.database.query<SpeciesType>(
            `SELECT t.type_id AS typeId, t.name, st.slot FROM emerald_ex_species_types AS st
             JOIN emerald_ex_types AS t ON t.dataset_id = st.dataset_id AND t.type_id = st.type_id
             WHERE st.dataset_id = ? AND st.species_id = ? ORDER BY st.slot`,
            [this.datasetId, id],
        );
    }

    getLearnset(id: number): Promise<LearnsetEntry[]> {
        return this.database.query<LearnsetEntry>(
            `SELECT l.entry_order AS entryOrder, l.level, ${moveFields}
             FROM emerald_ex_learnset_entries AS l
             JOIN emerald_ex_moves AS m ON m.dataset_id = l.dataset_id AND m.move_id = l.move_id
             ${moveJoins} WHERE l.dataset_id = ? AND l.species_id = ? ORDER BY l.entry_order`,
            [this.datasetId, id],
        );
    }

    async getEvolutions(id: number): Promise<Evolution[]> {
        const rows = await this.database.query<
            Omit<Evolution, 'conditions'> & { conditions: string }
        >(
            `SELECT e.edge_order AS edgeOrder, e.from_species_id AS fromSpeciesId,
                e.to_species_id AS toSpeciesId, s.name AS toName,
                em.method_id AS methodId, em.name AS method, e.trigger_name AS \`trigger\`,
                e.level, e.conditions, e.summary, e.raw_param AS rawParam
             FROM emerald_ex_evolutions AS e
             JOIN emerald_ex_species AS s ON s.dataset_id = e.dataset_id AND s.species_id = e.to_species_id
             JOIN emerald_ex_evolution_methods AS em ON em.dataset_id = e.dataset_id AND em.method_id = e.method_id
             WHERE e.dataset_id = ? AND e.from_species_id = ? AND e.internal_only = 0
             ORDER BY e.edge_order`,
            [this.datasetId, id],
        );
        return rows.map((row) => ({ ...row, conditions: parseConditions(row.conditions) }));
    }

    getMachines(id: number): Promise<Machine[]> {
        return this.database.query<Machine>(
            `SELECT ma.machine_code AS machine, ma.kind, ma.number, m.move_id AS moveId, m.name
             FROM emerald_ex_species_machines AS sm
             JOIN emerald_ex_machines AS ma ON ma.dataset_id = sm.dataset_id AND ma.machine_code = sm.machine_code
             JOIN emerald_ex_moves AS m ON m.dataset_id = ma.dataset_id AND m.move_id = ma.move_id
             WHERE sm.dataset_id = ? AND sm.species_id = ? ORDER BY ma.kind DESC, ma.number`,
            [this.datasetId, id],
        );
    }

    async getMove(id: number): Promise<Move | undefined> {
        const rows = await this.database.query<Move>(
            `SELECT ${moveFields} FROM emerald_ex_moves AS m ${moveJoins}
             WHERE m.dataset_id = ? AND m.move_id = ?`,
            [this.datasetId, id],
        );
        return rows[0];
    }

    async listMoves(q: string, page: number, pageSize: number): Promise<PageResponse<Move>> {
        const where = q ? "AND LOWER(m.name) LIKE ? ESCAPE '!'" : '';
        const parameters: SqlParameter[] = q
            ? [this.datasetId, searchPattern(q)]
            : [this.datasetId];
        const counts = await this.database.query<{ total: number }>(
            `SELECT COUNT(*) AS total FROM emerald_ex_moves AS m WHERE m.dataset_id = ? ${where}`,
            parameters,
        );
        const rows = await this.database.query<Move>(
            `SELECT ${moveFields} FROM emerald_ex_moves AS m ${moveJoins}
             WHERE m.dataset_id = ? ${where} ORDER BY m.move_id LIMIT ? OFFSET ?`,
            [...parameters, pageSize, (page - 1) * pageSize],
        );
        return pageResponse(rows, counts[0].total, page, pageSize);
    }

    private async hydrateSpecies(rows: SpeciesRow[]): Promise<Pokemon[]> {
        if (rows.length === 0) return [];
        const types = await this.database.query<TypeRow>(
            `SELECT st.species_id AS speciesId, st.slot, t.type_id AS typeId, t.name
             FROM emerald_ex_species_types AS st
             JOIN emerald_ex_types AS t ON t.dataset_id = st.dataset_id AND t.type_id = st.type_id
             WHERE st.dataset_id = ? AND st.species_id IN (${rows.map(() => '?').join(', ')})
             ORDER BY st.species_id, st.slot`,
            [this.datasetId, ...rows.map((row) => row.speciesId)],
        );
        const bySpecies = new Map<number, TypeRow[]>();
        for (const type of types) {
            const entries = bySpecies.get(type.speciesId) ?? [];
            entries.push(type);
            bySpecies.set(type.speciesId, entries);
        }
        return rows.map(({ speciesId, name, baseStatTotal, ...stats }) => ({
            speciesId,
            name,
            stats,
            baseStatTotal,
            types: (bySpecies.get(speciesId) ?? []).map((type) => type.name),
            typeIds: (bySpecies.get(speciesId) ?? []).map((type) => type.typeId),
        }));
    }
}
