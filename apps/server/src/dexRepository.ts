import type {
    Ability,
    AbilityFlags,
    SpeciesAbilitySlot,
    BaseStats,
    DexDataset,
    LearnsetEntry,
    Machine,
    Move,
    PageResponse,
    Pokemon,
    PokemonType,
    SpeciesQuery,
    SpeciesType,
    SpeciesDetails,
    SpeciesEvolution,
    SpeciesMachine,
    SpeciesSprites,
    SpeciesFormInfo,
    SpeciesFormGroup,
    FormGroupMember,
    FormChange,
    Item,
    ItemPocket,
    RuleItem,
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

interface SpriteRow extends SpeciesSprites {
    speciesId: number;
}

const speciesSelect = `SELECT s.species_id AS speciesId, s.name,
    st.hp, st.attack, st.defense, st.sp_attack AS spAttack, st.sp_defense AS spDefense,
    st.speed, st.base_stat_total AS baseStatTotal
    FROM emerald_ex_species AS s
    JOIN emerald_ex_species_stats AS st
        ON st.dataset_id = s.dataset_id AND st.species_id = s.species_id`;

const moveFields = `m.move_id AS moveId, m.name, m.description,
    m.type_id AS typeId, t.name AS type, t.icon_file AS typeIconFile,
    m.category_id AS categoryId, c.name AS category,
    c.icon_file AS categoryIconFile,
    m.power, m.accuracy, m.pp, m.priority, m.effect_id AS effectId, m.target_id AS targetId`;

const moveJoins = `JOIN emerald_ex_types AS t ON t.dataset_id = m.dataset_id AND t.type_id = m.type_id
    JOIN emerald_ex_move_categories AS c
        ON c.dataset_id = m.dataset_id AND c.category_id = m.category_id`;

const itemSelect = `SELECT i.item_id AS itemId, i.name, i.plural_name AS pluralName,
    i.description, i.price, i.pocket_id AS pocketId, p.name AS pocket, i.secondary_id AS secondaryId,
    i.hold_effect_id AS holdEffectId, i.hold_effect_param AS holdEffectParam, i.importance,
    i.not_consumed AS notConsumed, i.item_use_type_id AS itemUseTypeId, i.battle_usage_id AS battleUsageId,
    i.fling_power AS flingPower, i.icon_file AS iconFile, i.rom
    FROM emerald_ex_items AS i JOIN emerald_ex_item_pockets AS p
        ON p.dataset_id = i.dataset_id AND p.pocket_id = i.pocket_id`;

type ItemRow = Omit<Item, 'rom' | 'notConsumed'> & { rom: string; notConsumed: number };
function parseItem(row: ItemRow): Item {
    return { ...row, notConsumed: Boolean(row.notConsumed), rom: parseConditions(row.rom) };
}

const abilityFields = `a.ability_id AS abilityId, a.name, a.description, a.ai_rating AS aiRating,
    a.cant_be_copied AS cantBeCopied, a.cant_be_swapped AS cantBeSwapped,
    a.cant_be_traced AS cantBeTraced, a.cant_be_suppressed AS cantBeSuppressed,
    a.cant_be_overwritten AS cantBeOverwritten, a.breakable, a.fails_on_imposter AS failsOnImposter`;
type AbilityRow = Omit<Ability, 'flags'> & { [K in keyof AbilityFlags]: number };
function parseAbility(row: AbilityRow): Ability {
    const { abilityId, name, description, aiRating, ...flags } = row;
    return {
        abilityId,
        name,
        description,
        aiRating,
        flags: {
            cantBeCopied: Boolean(flags.cantBeCopied),
            cantBeSwapped: Boolean(flags.cantBeSwapped),
            cantBeTraced: Boolean(flags.cantBeTraced),
            cantBeSuppressed: Boolean(flags.cantBeSuppressed),
            cantBeOverwritten: Boolean(flags.cantBeOverwritten),
            breakable: Boolean(flags.breakable),
            failsOnImposter: Boolean(flags.failsOnImposter),
        },
    };
}

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
            'SELECT type_id AS typeId, name, icon_file AS iconFile FROM emerald_ex_types WHERE dataset_id = ? ORDER BY name',
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

    async getSpeciesDetails(id: number): Promise<SpeciesDetails | undefined> {
        const species = await this.getSpecies(id);
        if (!species) return undefined;
        const [formInfo, evolutionBaseSpeciesId] = await Promise.all([
            this.getFormInfo(id),
            this.getEvolutionBaseSpeciesId(id),
        ]);
        const [learnset, machines, evolutionLinks, forms, formChanges, evolutionFamily, abilities] =
            await Promise.all([
                this.getLearnset(id),
                this.getMachineMoves(id),
                this.getEvolutionLinks([id], false),
                this.getFormGroup(formInfo),
                this.getFormChanges([id], false),
                this.getEvolutionFamily(evolutionBaseSpeciesId),
                this.getSpeciesAbilities(id),
            ]);
        return {
            ...species,
            abilities,
            learnset,
            machines,
            evolutionLinks,
            formInfo,
            forms,
            formChanges,
            evolutionFamily,
            evolutionBaseSpeciesId,
        };
    }

    private async getFormInfo(id: number): Promise<SpeciesFormInfo | null> {
        const rows = await this.database.query<
            Omit<SpeciesFormInfo, 'isBaseForm'> & { isBaseForm: number }
        >(
            `SELECT f.form_group_id AS formGroupId, g.base_species_id AS baseSpeciesId,
                f.is_base_form AS isBaseForm, f.form_kind AS formKind, f.form_label AS formLabel
             FROM emerald_ex_species_forms AS f
             JOIN emerald_ex_form_groups AS g ON g.dataset_id = f.dataset_id AND g.form_group_id = f.form_group_id
             WHERE f.dataset_id = ? AND f.species_id = ?`,
            [this.datasetId, id],
        );
        return rows[0] ? { ...rows[0], isBaseForm: Boolean(rows[0].isBaseForm) } : null;
    }

    async getSpeciesForms(id: number): Promise<SpeciesFormGroup | null> {
        return this.getFormGroup(await this.getFormInfo(id));
    }

    private async getFormGroup(info: SpeciesFormInfo | null): Promise<SpeciesFormGroup | null> {
        if (!info) return null;
        const rows = await this.database.query<
            Omit<FormGroupMember, 'isBaseForm'> & { isBaseForm: number }
        >(
            `SELECT s.species_id AS speciesId, s.name, f.form_kind AS formKind,
                f.form_label AS formLabel, f.is_base_form AS isBaseForm, sp.front_file AS sprite
             FROM emerald_ex_species_forms AS f
             JOIN emerald_ex_species AS s ON s.dataset_id = f.dataset_id AND s.species_id = f.species_id
             LEFT JOIN emerald_ex_species_sprites AS sp ON sp.dataset_id = f.dataset_id AND sp.species_id = f.species_id
             WHERE f.dataset_id = ? AND f.form_group_id = ? ORDER BY f.is_base_form DESC, f.species_id`,
            [this.datasetId, info.formGroupId],
        );
        const members = rows.map((row) => ({ ...row, isBaseForm: Boolean(row.isBaseForm) }));
        const base = members.find((member) => member.speciesId === info.baseSpeciesId);
        if (!base) throw new Error('Form group has no base member');
        return {
            formGroupId: info.formGroupId,
            baseSpeciesId: info.baseSpeciesId,
            baseName: base.name,
            members,
            changes: await this.getFormChanges(members.map((member) => member.speciesId)),
        };
    }

    private async getFormChanges(
        ids: readonly number[],
        includeIncoming = true,
    ): Promise<FormChange[]> {
        const placeholders = ids.map(() => '?').join(', ');
        const rows = await this.database.query<
            Omit<FormChange, 'details' | 'restorePreviousForm' | 'battleOnly' | 'rawParams'> & {
                details: string;
                restorePreviousForm: number;
                battleOnly: number;
                param1: number;
                param2: number;
                param3: number;
            }
        >(
            `SELECT c.change_order AS changeOrder, c.source_species_id AS sourceSpeciesId,
                source.name AS sourceName, c.target_species_id AS targetSpeciesId, target.name AS targetName,
                c.raw_target_species_id AS rawTargetSpeciesId, c.restore_previous_form AS restorePreviousForm,
                c.method_id AS methodId, m.name AS method, c.form_kind AS formKind, c.battle_only AS battleOnly,
                c.details, c.summary, c.raw_param1 AS param1, c.raw_param2 AS param2, c.raw_param3 AS param3,
                source_sprite.front_file AS sourceSprite, target_sprite.front_file AS targetSprite
            FROM emerald_ex_form_changes AS c
            JOIN emerald_ex_form_change_methods AS m ON m.dataset_id = c.dataset_id AND m.method_id = c.method_id
            JOIN emerald_ex_species AS source ON source.dataset_id = c.dataset_id AND source.species_id = c.source_species_id
            LEFT JOIN emerald_ex_species AS target ON target.dataset_id = c.dataset_id AND target.species_id = c.target_species_id
            LEFT JOIN emerald_ex_species_sprites AS source_sprite ON source_sprite.dataset_id = c.dataset_id AND source_sprite.species_id = c.source_species_id
            LEFT JOIN emerald_ex_species_sprites AS target_sprite ON target_sprite.dataset_id = c.dataset_id AND target_sprite.species_id = c.target_species_id
            WHERE c.dataset_id = ? AND (c.source_species_id IN (${placeholders})
                ${includeIncoming ? `OR c.target_species_id IN (${placeholders})` : ''})
            ORDER BY c.source_species_id, c.change_order`,
            [this.datasetId, ...ids, ...(includeIncoming ? ids : [])],
        );
        const items = await this.getRuleItems('form_change', [
            ...new Set(rows.map((row) => row.sourceSpeciesId)),
        ]);
        return rows.map(({ param1, param2, param3, ...row }) => ({
            ...row,
            items: items.get(`${row.sourceSpeciesId}/${row.changeOrder}`) ?? [],
            details: parseConditions(row.details),
            restorePreviousForm: Boolean(row.restorePreviousForm),
            battleOnly: Boolean(row.battleOnly),
            rawParams: { param1, param2, param3 },
        }));
    }

    private async getEvolutionBaseSpeciesId(id: number): Promise<number> {
        const rows = await this.database.query<{ baseSpeciesId: number }>(
            `SELECT g.base_species_id AS baseSpeciesId FROM emerald_ex_species_forms AS f
             JOIN emerald_ex_form_groups AS g ON g.dataset_id = f.dataset_id AND g.form_group_id = f.form_group_id
             WHERE f.dataset_id = ? AND f.species_id = ? AND f.is_base_form = 0
                AND (f.form_kind IN ('mega', 'gigantamax', 'primal', 'ultra_burst') OR EXISTS (
                    SELECT 1 FROM emerald_ex_form_changes AS c
                    WHERE c.dataset_id = f.dataset_id AND c.target_species_id = f.species_id
                        AND c.battle_only = 1 AND c.form_kind = 'ultra_burst'))`,
            [this.datasetId, id],
        );
        return rows[0]?.baseSpeciesId ?? id;
    }

    private getMachineMoves(id: number): Promise<SpeciesMachine[]> {
        return this.database.query<SpeciesMachine>(
            `SELECT ma.machine_code AS machine, ma.kind, ma.number, ${moveFields}
             FROM emerald_ex_species_machines AS sm
             JOIN emerald_ex_machines AS ma ON ma.dataset_id = sm.dataset_id AND ma.machine_code = sm.machine_code
             JOIN emerald_ex_moves AS m ON m.dataset_id = ma.dataset_id AND m.move_id = ma.move_id
             ${moveJoins}
             WHERE sm.dataset_id = ? AND sm.species_id = ? ORDER BY ma.kind DESC, ma.number`,
            [this.datasetId, id],
        );
    }

    private async getEvolutionLinks(
        ids: readonly number[],
        includeInternal = true,
    ): Promise<SpeciesEvolution[]> {
        const placeholders = ids.map(() => '?').join(', ');
        const rows = await this.database.query<
            Omit<SpeciesEvolution, 'conditions' | 'internalOnly'> & {
                conditions: string;
                internalOnly: number;
            }
        >(
            `SELECT e.edge_order AS edgeOrder, e.from_species_id AS fromSpeciesId,
                e.to_species_id AS toSpeciesId, source.name AS fromName, target.name AS toName,
                em.method_id AS methodId, em.name AS method, e.trigger_name AS \`trigger\`,
                e.level, e.conditions, e.summary, e.raw_param AS rawParam, e.internal_only AS internalOnly,
                source_sprite.front_file AS fromSprite, target_sprite.front_file AS toSprite
             FROM emerald_ex_evolutions AS e
             JOIN emerald_ex_species AS source ON source.dataset_id = e.dataset_id AND source.species_id = e.from_species_id
             JOIN emerald_ex_species AS target ON target.dataset_id = e.dataset_id AND target.species_id = e.to_species_id
             LEFT JOIN emerald_ex_species_sprites AS source_sprite
                ON source_sprite.dataset_id = e.dataset_id AND source_sprite.species_id = e.from_species_id
             LEFT JOIN emerald_ex_species_sprites AS target_sprite
                ON target_sprite.dataset_id = e.dataset_id AND target_sprite.species_id = e.to_species_id
             JOIN emerald_ex_evolution_methods AS em ON em.dataset_id = e.dataset_id AND em.method_id = e.method_id
             WHERE e.dataset_id = ?
                AND (e.from_species_id IN (${placeholders}) OR e.to_species_id IN (${placeholders}))
                ${includeInternal ? '' : 'AND e.internal_only = 0'}
             ORDER BY e.edge_order`,
            [this.datasetId, ...ids, ...ids],
        );
        const items = await this.getRuleItems(
            'evolution',
            rows.map((row) => row.edgeOrder),
        );
        return rows.map((row) => ({
            ...row,
            items: items.get(String(row.edgeOrder)) ?? [],
            conditions: parseConditions(row.conditions),
            internalOnly: Boolean(row.internalOnly),
        }));
    }

    getSpeciesTypes(id: number): Promise<SpeciesType[]> {
        return this.database.query<SpeciesType>(
            `SELECT t.type_id AS typeId, t.name, t.icon_file AS iconFile, st.slot FROM emerald_ex_species_types AS st
             JOIN emerald_ex_types AS t ON t.dataset_id = st.dataset_id AND t.type_id = st.type_id
             WHERE st.dataset_id = ? AND st.species_id = ? ORDER BY st.slot`,
            [this.datasetId, id],
        );
    }

    private async getRuleItems(
        kind: 'evolution' | 'form_change',
        ids: readonly number[],
    ): Promise<Map<string, RuleItem[]>> {
        const result = new Map<string, RuleItem[]>();
        if (ids.length === 0) return result;
        const key =
            kind === 'evolution'
                ? 'r.edge_order'
                : "CONCAT(r.source_species_id, '/', r.change_order)";
        const lookup = kind === 'evolution' ? 'r.edge_order' : 'r.source_species_id';
        const rows = await this.database.query<RuleItem & { ruleKey: string | number }>(
            `SELECT ${key} AS ruleKey, r.role, i.item_id AS itemId, i.name, i.icon_file AS iconFile
            FROM emerald_ex_${kind}_items AS r JOIN emerald_ex_items AS i
                ON i.dataset_id = r.dataset_id AND i.item_id = r.item_id
            WHERE r.dataset_id = ? AND ${lookup} IN (${ids.map(() => '?').join(', ')}) ORDER BY ${lookup}, r.role`,
            [this.datasetId, ...ids],
        );
        for (const { ruleKey, ...item } of rows) {
            const items = result.get(String(ruleKey)) ?? [];
            items.push(item);
            result.set(String(ruleKey), items);
        }
        return result;
    }

    getItemPockets(): Promise<ItemPocket[]> {
        return this.database.query<ItemPocket>(
            'SELECT pocket_id AS pocketId, name FROM emerald_ex_item_pockets WHERE dataset_id = ? ORDER BY pocket_id',
            [this.datasetId],
        );
    }

    async getItem(id: number): Promise<Item | undefined> {
        const rows = await this.database.query<ItemRow>(
            `${itemSelect} WHERE i.dataset_id = ? AND i.item_id = ?`,
            [this.datasetId, id],
        );
        return rows[0] ? parseItem(rows[0]) : undefined;
    }

    async listItems(
        q: string,
        pocket: string,
        page: number,
        pageSize: number,
    ): Promise<PageResponse<Item>> {
        const conditions = ['i.dataset_id = ?'];
        const parameters: SqlParameter[] = [this.datasetId];
        if (q) {
            const id = /^#?\d+$/.test(q) ? Number(q.replace(/^#/, '')) : -1;
            conditions.push("(LOWER(i.name) LIKE ? ESCAPE '!' OR i.item_id = ?)");
            parameters.push(searchPattern(q), id <= 65535 ? id : -1);
        }
        if (pocket) {
            conditions.push('p.name = ?');
            parameters.push(pocket);
        }
        const where = `WHERE ${conditions.join(' AND ')}`;
        const counts = await this.database.query<{ total: number }>(
            `SELECT COUNT(*) AS total FROM emerald_ex_items AS i JOIN emerald_ex_item_pockets AS p ON p.dataset_id = i.dataset_id AND p.pocket_id = i.pocket_id ${where}`,
            parameters,
        );
        const rows = await this.database.query<ItemRow>(
            `${itemSelect} ${where} ORDER BY i.item_id LIMIT ? OFFSET ?`,
            [...parameters, pageSize, (page - 1) * pageSize],
        );
        return pageResponse(rows.map(parseItem), counts[0].total, page, pageSize);
    }

    async getAbility(id: number): Promise<Ability | undefined> {
        const rows = await this.database.query<AbilityRow>(
            `SELECT ${abilityFields} FROM emerald_ex_abilities AS a WHERE a.dataset_id = ? AND a.ability_id = ?`,
            [this.datasetId, id],
        );
        return rows[0] ? parseAbility(rows[0]) : undefined;
    }

    async listAbilities(q: string, page: number, pageSize: number): Promise<PageResponse<Ability>> {
        const conditions = ['a.dataset_id = ?'];
        const parameters: SqlParameter[] = [this.datasetId];
        if (q) {
            const id = /^#?\d+$/.test(q) ? Number(q.replace(/^#/, '')) : -1;
            conditions.push("(LOWER(a.name) LIKE ? ESCAPE '!' OR a.ability_id = ?)");
            parameters.push(searchPattern(q), id <= 65535 ? id : -1);
        }
        const where = `WHERE ${conditions.join(' AND ')}`;
        const counts = await this.database.query<{ total: number }>(
            `SELECT COUNT(*) AS total FROM emerald_ex_abilities AS a ${where}`,
            parameters,
        );
        const rows = await this.database.query<AbilityRow>(
            `SELECT ${abilityFields} FROM emerald_ex_abilities AS a ${where} ORDER BY a.ability_id LIMIT ? OFFSET ?`,
            [...parameters, pageSize, (page - 1) * pageSize],
        );
        return pageResponse(rows.map(parseAbility), counts[0].total, page, pageSize);
    }

    async getSpeciesAbilities(id: number): Promise<SpeciesAbilitySlot[]> {
        const rows = await this.database.query<
            (AbilityRow | { abilityId: null }) & Pick<SpeciesAbilitySlot, 'slot' | 'kind'>
        >(
            `SELECT sa.slot, sa.kind, ${abilityFields} FROM emerald_ex_species_abilities AS sa
             LEFT JOIN emerald_ex_abilities AS a ON a.dataset_id = sa.dataset_id AND a.ability_id = sa.ability_id
             WHERE sa.dataset_id = ? AND sa.species_id = ? ORDER BY sa.slot`,
            [this.datasetId, id],
        );
        return rows.map(({ slot, kind, ...row }) => ({
            slot,
            kind,
            ability: row.abilityId === null ? null : parseAbility(row),
        }));
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

    async getEvolutions(id: number): Promise<SpeciesEvolution[]> {
        return this.getEvolutionFamily(await this.getEvolutionBaseSpeciesId(id));
    }

    private async getEvolutionFamily(id: number): Promise<SpeciesEvolution[]> {
        const visited = new Set([id]);
        const edges = new Map<number, SpeciesEvolution>();
        let frontier = [id];
        while (frontier.length > 0) {
            const next = new Set<number>();
            for (const edge of await this.getEvolutionLinks(frontier, false)) {
                edges.set(edge.edgeOrder, edge);
                for (const speciesId of [edge.fromSpeciesId, edge.toSpeciesId]) {
                    if (!visited.has(speciesId)) {
                        visited.add(speciesId);
                        next.add(speciesId);
                    }
                }
            }
            frontier = [...next];
        }
        return [...edges.values()].sort((a, b) => a.edgeOrder - b.edgeOrder);
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
            `SELECT st.species_id AS speciesId, st.slot, t.type_id AS typeId, t.name, t.icon_file AS iconFile
             FROM emerald_ex_species_types AS st
             JOIN emerald_ex_types AS t ON t.dataset_id = st.dataset_id AND t.type_id = st.type_id
             WHERE st.dataset_id = ? AND st.species_id IN (${rows.map(() => '?').join(', ')})
             ORDER BY st.species_id, st.slot`,
            [this.datasetId, ...rows.map((row) => row.speciesId)],
        );
        const spriteRows = await this.database.query<SpriteRow>(
            `SELECT species_id AS speciesId, front_file AS front, shiny_front_file AS shinyFront,
                front_frame2_file AS frontFrame2, shiny_front_frame2_file AS shinyFrontFrame2,
                back_file AS back, shiny_back_file AS shinyBack,
                front_frame_count AS frontFrameCount, missing_reason AS missingReason
             FROM emerald_ex_species_sprites
             WHERE dataset_id = ? AND species_id IN (${rows.map(() => '?').join(', ')})`,
            [this.datasetId, ...rows.map((row) => row.speciesId)],
        );
        const sprites = new Map(spriteRows.map(({ speciesId, ...sprite }) => [speciesId, sprite]));
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
            typeIconFiles: (bySpecies.get(speciesId) ?? []).map((type) => type.iconFile),
            sprites: sprites.get(speciesId) ?? null,
        }));
    }
}
