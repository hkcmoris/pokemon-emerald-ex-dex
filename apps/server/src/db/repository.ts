import { normalizeSearch } from '@replace-me/shared';
import type {
    DexMetadata,
    Evolution,
    LevelUpMove,
    MachineMove,
    PokemonDetail,
    PokemonList,
    PokemonSummary,
} from '@replace-me/shared';
export interface SqlReader {
    all<T>(sql: string, parameters?: (string | number)[]): Promise<T[]>;
}
const summaryColumns = `species_id AS speciesId, name, same_name_count AS sameNameCount, move_count AS moveCount, machine_count AS machineCount`;
export class PokedexRepository {
    constructor(private readonly database: SqlReader) {}
    async list(
        search: string,
        page: number,
        pageSize: number,
        sort: 'id' | 'name',
    ): Promise<PokemonList> {
        const term = normalizeSearch(search.trim())
            .replaceAll('\\', '\\\\')
            .replaceAll('%', '\\%')
            .replaceAll('_', '\\_');
        const where = term
            ? `WHERE search_name LIKE ? ESCAPE '\\' OR CAST(species_id AS TEXT) = ?`
            : '';
        const parameters = term ? [`%${term}%`, search.trim().replace(/^#?0*/, '')] : [];
        const [count, pokemon] = await Promise.all([
            this.database.all<{ total: number }>(
                `SELECT COUNT(*) AS total FROM species ${where}`,
                parameters,
            ),
            this.database.all<PokemonSummary>(
                `SELECT ${summaryColumns} FROM species ${where} ORDER BY ${sort === 'name' ? 'search_name, species_id' : 'species_id'} LIMIT ? OFFSET ?`,
                [...parameters, pageSize, (page - 1) * pageSize],
            ),
        ]);
        return { pokemon, total: count[0].total, page, pageSize };
    }
    async detail(speciesId: number): Promise<PokemonDetail | null> {
        const species = await this.database.all<PokemonSummary>(
            `SELECT ${summaryColumns} FROM species WHERE species_id = ?`,
            [speciesId],
        );
        if (!species[0]) return null;
        const [learnset, machines, edgeRows] = await Promise.all([
            this.database.all<LevelUpMove>(
                `SELECT l.level, m.move_id AS moveId, m.name AS move FROM learnsets l JOIN moves m ON m.move_id = l.move_id WHERE l.species_id = ? ORDER BY l.position`,
                [speciesId],
            ),
            this.database.all<MachineMove>(
                `SELECT m.machine, m.kind, m.number, v.move_id AS moveId, v.name AS move FROM compatibility c JOIN machines m ON m.machine = c.machine JOIN moves v ON v.move_id = m.move_id WHERE c.species_id = ? ORDER BY CASE m.kind WHEN 'TM' THEN 0 ELSE 1 END, m.number`,
                [speciesId],
            ),
            this.database.all<{ data: string }>(
                `WITH RECURSIVE family(id) AS (SELECT ? UNION SELECT CASE WHEN e.from_species_id = f.id THEN e.to_species_id ELSE e.from_species_id END FROM evolutions e JOIN family f ON e.from_species_id = f.id OR e.to_species_id = f.id WHERE e.internal_only = 0) SELECT data FROM evolutions WHERE internal_only = 0 AND from_species_id IN (SELECT id FROM family) ORDER BY edge_id`,
                [speciesId],
            ),
        ]);
        return {
            ...species[0],
            learnset,
            machines,
            evolutionChain: edgeRows.map((e) => JSON.parse(e.data) as Evolution),
        };
    }
    async metadata(): Promise<DexMetadata> {
        const values = await this.database.all<{ key: string; value: string }>(
            'SELECT key, value FROM metadata',
        );
        const meta = Object.fromEntries(values.map((v) => [v.key, v.value]));
        const counts = await this.database.all<{
            speciesCount: number;
            moveCount: number;
            machineCount: number;
            evolutionCount: number;
        }>(
            `SELECT (SELECT COUNT(*) FROM species) AS speciesCount, (SELECT COUNT(*) FROM moves) AS moveCount, (SELECT COUNT(*) FROM machines) AS machineCount, (SELECT COUNT(*) FROM evolutions WHERE internal_only = 0) AS evolutionCount`,
        );
        return { game: meta.game, version: meta.version, ...counts[0] };
    }
}
export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
export async function handleDexRequest(repository: PokedexRepository, url: URL): Promise<unknown> {
    if (url.pathname === '/api/metadata') return repository.metadata();
    if (url.pathname === '/api/pokemon') {
        const page = Number(url.searchParams.get('page') ?? '1');
        const pageSize = Number(url.searchParams.get('pageSize') ?? '36');
        const sort = url.searchParams.get('sort') ?? 'id';
        const search = url.searchParams.get('search') ?? '';
        if (
            !Number.isInteger(page) ||
            page < 1 ||
            page > 100000 ||
            !Number.isInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > 100 ||
            !['id', 'name'].includes(sort) ||
            search.length > 100
        )
            throw new ApiError(400, 'Invalid search, page, pageSize, or sort.');
        return repository.list(search, page, pageSize, sort as 'id' | 'name');
    }
    const match = /^\/api\/pokemon\/(\d+)$/.exec(url.pathname);
    if (match) {
        const id = Number(match[1]);
        if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, 'Invalid species ID.');
        const pokemon = await repository.detail(id);
        if (!pokemon) throw new ApiError(404, 'Pokémon not found.');
        return pokemon;
    }
    throw new ApiError(404, 'API endpoint not found.');
}
