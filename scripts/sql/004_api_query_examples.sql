-- Illustrative SELECTs for the SQL-backed /api/v1 endpoints.
-- In the API, bind parameters with a database driver; never concatenate request values.
-- Each route resolves a configured dataset as well as the URL's internal ROM ID.
SET @dataset_id = 'emerald-ex-1.0.4';
SET @species_id = 1;
SET @move_id = 33;

-- GET /api/v1/species/:id (core record; attach related data using the queries below)
SELECT s.species_id AS speciesId, s.name, st.hp, st.attack, st.defense,
       st.sp_attack AS spAttack, st.sp_defense AS spDefense, st.speed,
       st.base_stat_total AS baseStatTotal
FROM emerald_ex_species AS s
JOIN emerald_ex_species_stats AS st ON st.dataset_id = s.dataset_id AND st.species_id = s.species_id
WHERE s.dataset_id = @dataset_id AND s.species_id = @species_id;

-- GET /api/v1/species/:id/name
SELECT name FROM emerald_ex_species WHERE dataset_id = @dataset_id AND species_id = @species_id;

-- GET /api/v1/species/:id/stats
SELECT hp, attack, defense, sp_attack AS spAttack, sp_defense AS spDefense,
       speed, base_stat_total AS baseStatTotal
FROM emerald_ex_species_stats WHERE dataset_id = @dataset_id AND species_id = @species_id;

-- GET /api/v1/species/:id/types
SELECT t.type_id AS typeId, t.name, t.icon_file AS iconFile, st.slot
FROM emerald_ex_species_types AS st
JOIN emerald_ex_types AS t ON t.dataset_id = st.dataset_id AND t.type_id = st.type_id
WHERE st.dataset_id = @dataset_id AND st.species_id = @species_id
ORDER BY st.slot;

-- GET /api/v1/species/:id/learnset (level-up moves, including level 0)
SELECT l.entry_order AS entryOrder, l.level, m.move_id AS moveId, m.name,
       t.name AS type, t.icon_file AS typeIconFile, c.name AS category, c.icon_file AS categoryIconFile,
       m.power, m.accuracy, m.pp, m.priority, m.description
FROM emerald_ex_learnset_entries AS l
JOIN emerald_ex_moves AS m ON m.dataset_id = l.dataset_id AND m.move_id = l.move_id
JOIN emerald_ex_types AS t ON t.dataset_id = m.dataset_id AND t.type_id = m.type_id
JOIN emerald_ex_move_categories AS c ON c.dataset_id = m.dataset_id AND c.category_id = m.category_id
WHERE l.dataset_id = @dataset_id AND l.species_id = @species_id
ORDER BY l.entry_order;

-- GET /api/v1/species/:id/evolution: outgoing rules; use to_species_id for pre-evolutions.
-- Internal routing markers are stored but excluded from player-triggered evolutions.
SELECT e.edge_order AS edgeOrder, e.from_species_id AS fromSpeciesId,
       e.to_species_id AS toSpeciesId, s.name AS toName, em.name AS method,
       e.trigger_name AS `trigger`, e.level, e.conditions, e.summary, e.raw_param AS rawParam
FROM emerald_ex_evolutions AS e
JOIN emerald_ex_species AS s ON s.dataset_id = e.dataset_id AND s.species_id = e.to_species_id
JOIN emerald_ex_evolution_methods AS em ON em.dataset_id = e.dataset_id AND em.method_id = e.method_id
WHERE e.dataset_id = @dataset_id AND e.from_species_id = @species_id AND e.internal_only = 0
ORDER BY e.edge_order;

-- Optional /api/v1/species/:id/machines for TM/HM compatibility.
SELECT ma.machine_code AS machine, ma.kind, ma.number, m.move_id AS moveId, m.name
FROM emerald_ex_species_machines AS sm
JOIN emerald_ex_machines AS ma ON ma.dataset_id = sm.dataset_id AND ma.machine_code = sm.machine_code
JOIN emerald_ex_moves AS m ON m.dataset_id = ma.dataset_id AND m.move_id = ma.move_id
WHERE sm.dataset_id = @dataset_id AND sm.species_id = @species_id
ORDER BY ma.kind DESC, ma.number;

-- GET /api/v1/moves/:id
SELECT m.move_id AS moveId, m.name, m.description, m.type_id AS typeId, t.name AS type,
       t.icon_file AS typeIconFile,
       m.category_id AS categoryId, c.name AS category, c.icon_file AS categoryIconFile,
       m.power, m.accuracy, m.pp,
       m.priority, m.effect_id AS effectId, m.target_id AS targetId
FROM emerald_ex_moves AS m
JOIN emerald_ex_types AS t ON t.dataset_id = m.dataset_id AND t.type_id = m.type_id
JOIN emerald_ex_move_categories AS c ON c.dataset_id = m.dataset_id AND c.category_id = m.category_id
WHERE m.dataset_id = @dataset_id AND m.move_id = @move_id;

-- GET /api/v1/moves/:id/name
SELECT name FROM emerald_ex_moves WHERE dataset_id = @dataset_id AND move_id = @move_id;

-- GET /api/v1/moves/:id/category
SELECT c.category_id AS categoryId, c.name, c.icon_file AS iconFile
FROM emerald_ex_moves AS m
JOIN emerald_ex_move_categories AS c ON c.dataset_id = m.dataset_id AND c.category_id = m.category_id
WHERE m.dataset_id = @dataset_id AND m.move_id = @move_id;

-- GET /api/v1/moves/:id/pp
SELECT pp FROM emerald_ex_moves WHERE dataset_id = @dataset_id AND move_id = @move_id;

-- GET /api/v1/moves/:id/damage: exported base power, not calculated battle damage.
-- Prefer /power, or return { power: n } from /damage. Preserve zero and engine IDs.
SELECT power, effect_id AS effectId FROM emerald_ex_moves WHERE dataset_id = @dataset_id AND move_id = @move_id;

-- GET /api/v1/moves/:id/type
SELECT t.type_id AS typeId, t.name, t.icon_file AS iconFile
FROM emerald_ex_moves AS m
JOIN emerald_ex_types AS t ON t.dataset_id = m.dataset_id AND t.type_id = m.type_id
WHERE m.dataset_id = @dataset_id AND m.move_id = @move_id;
