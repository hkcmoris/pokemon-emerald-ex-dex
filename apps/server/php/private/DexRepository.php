<?php
declare(strict_types=1);

namespace EmeraldEx;

use PDO;
use RuntimeException;
use stdClass;

final class DexRepository
{
    private const SPECIES_SELECT = 'SELECT s.species_id AS speciesId, s.name,
        st.hp, st.attack, st.defense, st.sp_attack AS spAttack, st.sp_defense AS spDefense,
        st.speed, st.base_stat_total AS baseStatTotal
        FROM emerald_ex_species AS s
        JOIN emerald_ex_species_stats AS st
            ON st.dataset_id = s.dataset_id AND st.species_id = s.species_id';

    private const MOVE_FIELDS = 'm.move_id AS moveId, m.name, m.description,
        m.type_id AS typeId, t.name AS type, t.icon_file AS typeIconFile,
        m.category_id AS categoryId, c.name AS category, c.icon_file AS categoryIconFile,
        m.power, m.accuracy, m.pp, m.priority, m.effect_id AS effectId, m.target_id AS targetId';

    private const MOVE_JOINS = 'JOIN emerald_ex_types AS t
            ON t.dataset_id = m.dataset_id AND t.type_id = m.type_id
        JOIN emerald_ex_move_categories AS c
            ON c.dataset_id = m.dataset_id AND c.category_id = m.category_id';

    private const SORT_SQL = [
        'id' => 's.species_id ASC',
        'name' => 's.name ASC, s.species_id ASC',
        'total' => 'st.base_stat_total DESC, s.species_id ASC',
        'speed' => 'st.speed DESC, s.species_id ASC',
    ];

    private const NUMERIC_FIELDS = [
        'speciesId', 'speciesFormCount', 'total', 'hp', 'attack', 'defense', 'spAttack',
        'spDefense', 'speed', 'baseStatTotal', 'typeId', 'slot', 'frontFrameCount',
        'moveId', 'categoryId', 'power', 'accuracy', 'pp', 'priority', 'effectId', 'targetId',
        'entryOrder', 'level', 'edgeOrder', 'fromSpeciesId', 'toSpeciesId', 'methodId',
        'rawParam', 'internalOnly', 'number',
    ];

    public function __construct(private readonly PDO $database, private readonly string $datasetId) {}

    private function query(string $sql, array $parameters): array
    {
        $statement = $this->database->prepare($sql);
        foreach ($parameters as $index => $value) {
            $statement->bindValue($index + 1, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $statement->execute();
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            foreach (self::NUMERIC_FIELDS as $field) {
                if (isset($row[$field])) {
                    $row[$field] = (int) $row[$field];
                }
            }
        }
        return $rows;
    }

    private static function searchPattern(string $query): string
    {
        $lower = mb_strtolower($query, 'UTF-8');
        return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $lower) . '%';
    }

    private static function pageResponse(array $data, int $total, int $page, int $pageSize): array
    {
        return ['data' => $data, 'meta' => [
            'total' => $total, 'page' => $page, 'pageSize' => $pageSize,
            'totalPages' => (int) ceil($total / $pageSize),
        ]];
    }

    public function getDataset(): ?array
    {
        return $this->query('SELECT d.dataset_id AS datasetId, d.game, d.version,
            (SELECT COUNT(*) FROM emerald_ex_species AS s
             WHERE s.dataset_id = d.dataset_id) AS speciesFormCount
            FROM emerald_ex_datasets AS d WHERE d.dataset_id = ?', [$this->datasetId])[0] ?? null;
    }

    public function getTypes(): array
    {
        return $this->query('SELECT type_id AS typeId, name, icon_file AS iconFile
            FROM emerald_ex_types WHERE dataset_id = ? ORDER BY name', [$this->datasetId]);
    }

    public function listSpecies(array $query): array
    {
        $conditions = ['s.dataset_id = ?'];
        $parameters = [$this->datasetId];
        if ($query['q'] !== '') {
            $id = preg_replace('/^#/', '', $query['q']);
            $numericId = ctype_digit($id) && (float) $id <= 65535 ? (int) $id : -1;
            $conditions[] = "(LOWER(s.name) LIKE ? ESCAPE '!' OR s.species_id = ?)";
            array_push($parameters, self::searchPattern($query['q']), $numericId);
        }
        if ($query['type'] !== '') {
            $conditions[] = 'EXISTS (SELECT 1 FROM emerald_ex_species_types AS stype
                JOIN emerald_ex_types AS t ON t.dataset_id = stype.dataset_id AND t.type_id = stype.type_id
                WHERE stype.dataset_id = s.dataset_id AND stype.species_id = s.species_id AND t.name = ?)';
            $parameters[] = $query['type'];
        }
        $where = ' WHERE ' . implode(' AND ', $conditions);
        $count = $this->query('SELECT COUNT(*) AS total FROM emerald_ex_species AS s' . $where, $parameters)[0]['total'];
        $rows = $this->query(self::SPECIES_SELECT . $where . ' ORDER BY ' . self::SORT_SQL[$query['sort']] . ' LIMIT ? OFFSET ?',
            [...$parameters, $query['pageSize'], ($query['page'] - 1) * $query['pageSize']]);
        return self::pageResponse($this->hydrateSpecies($rows), $count, $query['page'], $query['pageSize']);
    }

    public function getSpecies(int $id): ?array
    {
        $rows = $this->query(self::SPECIES_SELECT . ' WHERE s.dataset_id = ? AND s.species_id = ?', [$this->datasetId, $id]);
        return $this->hydrateSpecies($rows)[0] ?? null;
    }

    public function getSpeciesDetails(int $id): ?array
    {
        $species = $this->getSpecies($id);
        if ($species === null) {
            return null;
        }
        return [...$species, 'learnset' => $this->getLearnset($id),
            'machines' => $this->getMachineMoves($id), 'evolutionLinks' => $this->getEvolutionLinks([$id])];
    }

    public function getSpeciesTypes(int $id): array
    {
        return $this->query('SELECT t.type_id AS typeId, t.name, t.icon_file AS iconFile, st.slot
            FROM emerald_ex_species_types AS st
            JOIN emerald_ex_types AS t ON t.dataset_id = st.dataset_id AND t.type_id = st.type_id
            WHERE st.dataset_id = ? AND st.species_id = ? ORDER BY st.slot', [$this->datasetId, $id]);
    }

    public function getLearnset(int $id): array
    {
        return $this->query('SELECT l.entry_order AS entryOrder, l.level, ' . self::MOVE_FIELDS . '
            FROM emerald_ex_learnset_entries AS l
            JOIN emerald_ex_moves AS m ON m.dataset_id = l.dataset_id AND m.move_id = l.move_id
            ' . self::MOVE_JOINS . ' WHERE l.dataset_id = ? AND l.species_id = ? ORDER BY l.entry_order', [$this->datasetId, $id]);
    }

    private function getMachineMoves(int $id): array
    {
        return $this->query('SELECT ma.machine_code AS machine, ma.kind, ma.number, ' . self::MOVE_FIELDS . '
            FROM emerald_ex_species_machines AS sm
            JOIN emerald_ex_machines AS ma ON ma.dataset_id = sm.dataset_id AND ma.machine_code = sm.machine_code
            JOIN emerald_ex_moves AS m ON m.dataset_id = ma.dataset_id AND m.move_id = ma.move_id
            ' . self::MOVE_JOINS . '
            WHERE sm.dataset_id = ? AND sm.species_id = ? ORDER BY ma.kind DESC, ma.number', [$this->datasetId, $id]);
    }

    public function getMachines(int $id): array
    {
        return $this->query('SELECT ma.machine_code AS machine, ma.kind, ma.number, m.move_id AS moveId, m.name
            FROM emerald_ex_species_machines AS sm
            JOIN emerald_ex_machines AS ma ON ma.dataset_id = sm.dataset_id AND ma.machine_code = sm.machine_code
            JOIN emerald_ex_moves AS m ON m.dataset_id = ma.dataset_id AND m.move_id = ma.move_id
            WHERE sm.dataset_id = ? AND sm.species_id = ? ORDER BY ma.kind DESC, ma.number', [$this->datasetId, $id]);
    }

    private static function parseEvolutions(array $rows): array
    {
        foreach ($rows as &$row) {
            $conditions = json_decode($row['conditions'], false, 512, JSON_THROW_ON_ERROR);
            if (!$conditions instanceof stdClass) {
                throw new RuntimeException('Evolution conditions must be a JSON object');
            }
            $row['conditions'] = $conditions;
            $row['internalOnly'] = (bool) $row['internalOnly'];
        }
        return $rows;
    }

    public function getEvolutions(int $id): array
    {
        $visited = [$id => true];
        $edges = [];
        $frontier = [$id];
        while ($frontier !== []) {
            $next = [];
            foreach ($this->getEvolutionLinks($frontier, false) as $edge) {
                $edges[$edge['edgeOrder']] = $edge;
                foreach ([$edge['fromSpeciesId'], $edge['toSpeciesId']] as $speciesId) {
                    if (!isset($visited[$speciesId])) {
                        $visited[$speciesId] = true;
                        $next[] = $speciesId;
                    }
                }
            }
            $frontier = $next;
        }
        ksort($edges, SORT_NUMERIC);
        return array_values($edges);
    }

    private function getEvolutionLinks(array $ids, bool $includeInternal = true): array
    {
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $rows = $this->query('SELECT e.edge_order AS edgeOrder, e.from_species_id AS fromSpeciesId,
            e.to_species_id AS toSpeciesId, source.name AS fromName, target.name AS toName,
            em.method_id AS methodId, em.name AS method, e.trigger_name AS `trigger`,
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
                AND (e.from_species_id IN (' . $placeholders . ') OR e.to_species_id IN (' . $placeholders . '))
                ' . ($includeInternal ? '' : 'AND e.internal_only = 0') . '
            ORDER BY e.edge_order', [$this->datasetId, ...$ids, ...$ids]);
        return self::parseEvolutions($rows);
    }

    public function getMove(int $id): ?array
    {
        return $this->query('SELECT ' . self::MOVE_FIELDS . ' FROM emerald_ex_moves AS m ' . self::MOVE_JOINS . '
            WHERE m.dataset_id = ? AND m.move_id = ?', [$this->datasetId, $id])[0] ?? null;
    }

    public function listMoves(string $q, int $page, int $pageSize): array
    {
        $where = $q === '' ? '' : " AND LOWER(m.name) LIKE ? ESCAPE '!'";
        $parameters = $q === '' ? [$this->datasetId] : [$this->datasetId, self::searchPattern($q)];
        $total = $this->query('SELECT COUNT(*) AS total FROM emerald_ex_moves AS m WHERE m.dataset_id = ?' . $where, $parameters)[0]['total'];
        $rows = $this->query('SELECT ' . self::MOVE_FIELDS . ' FROM emerald_ex_moves AS m ' . self::MOVE_JOINS . '
            WHERE m.dataset_id = ?' . $where . ' ORDER BY m.move_id LIMIT ? OFFSET ?', [...$parameters, $pageSize, ($page - 1) * $pageSize]);
        return self::pageResponse($rows, $total, $page, $pageSize);
    }

    private function hydrateSpecies(array $rows): array
    {
        if ($rows === []) {
            return [];
        }
        $parameters = [$this->datasetId, ...array_column($rows, 'speciesId')];
        $placeholders = implode(', ', array_fill(0, count($rows), '?'));
        $typeRows = $this->query('SELECT st.species_id AS speciesId, st.slot, t.type_id AS typeId, t.name, t.icon_file AS iconFile
            FROM emerald_ex_species_types AS st
            JOIN emerald_ex_types AS t ON t.dataset_id = st.dataset_id AND t.type_id = st.type_id
            WHERE st.dataset_id = ? AND st.species_id IN (' . $placeholders . ') ORDER BY st.species_id, st.slot', $parameters);
        $spriteRows = $this->query('SELECT species_id AS speciesId, front_file AS front, shiny_front_file AS shinyFront,
            front_frame2_file AS frontFrame2, shiny_front_frame2_file AS shinyFrontFrame2,
            back_file AS back, shiny_back_file AS shinyBack,
            front_frame_count AS frontFrameCount, missing_reason AS missingReason
            FROM emerald_ex_species_sprites WHERE dataset_id = ? AND species_id IN (' . $placeholders . ')', $parameters);
        $types = [];
        foreach ($typeRows as $type) {
            $types[$type['speciesId']][] = $type;
        }
        $sprites = [];
        foreach ($spriteRows as $sprite) {
            $id = $sprite['speciesId'];
            unset($sprite['speciesId']);
            $sprites[$id] = $sprite;
        }
        return array_map(static function (array $row) use ($types, $sprites): array {
            $id = $row['speciesId'];
            $entries = $types[$id] ?? [];
            $stats = array_intersect_key($row, array_flip(['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed']));
            return ['speciesId' => $id, 'name' => $row['name'], 'stats' => $stats,
                'baseStatTotal' => $row['baseStatTotal'], 'types' => array_column($entries, 'name'),
                'typeIds' => array_column($entries, 'typeId'), 'typeIconFiles' => array_column($entries, 'iconFile'),
                'sprites' => $sprites[$id] ?? null];
        }, $rows);
    }
}
