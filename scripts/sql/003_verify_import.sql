-- Expected counts for the supplied Emerald EX 1.0.4 exports.
SET @dataset_id = 'emerald-ex-1.0.4';

SELECT 'species' AS entity, COUNT(*) AS actual, 1523 AS expected FROM species WHERE dataset_id = @dataset_id
UNION ALL SELECT 'stats', COUNT(*), 1523 FROM species_stats WHERE dataset_id = @dataset_id
UNION ALL SELECT 'types', COUNT(*), 19 FROM pokemon_types WHERE dataset_id = @dataset_id
UNION ALL SELECT 'species_types', COUNT(*), 2280 FROM species_types WHERE dataset_id = @dataset_id
UNION ALL SELECT 'moves', COUNT(*), 935 FROM moves WHERE dataset_id = @dataset_id
UNION ALL SELECT 'learnset_entries', COUNT(*), 23729 FROM learnset_entries WHERE dataset_id = @dataset_id
UNION ALL SELECT 'machines', COUNT(*), 58 FROM machines WHERE dataset_id = @dataset_id
UNION ALL SELECT 'species_machines', COUNT(*), 32358 FROM species_machines WHERE dataset_id = @dataset_id
UNION ALL SELECT 'normal_evolutions', COUNT(*), 618 FROM evolutions WHERE dataset_id = @dataset_id AND internal_only = 0
UNION ALL SELECT 'form_markers', COUNT(*), 26 FROM evolutions WHERE dataset_id = @dataset_id AND internal_only = 1
UNION ALL SELECT 'sources', COUNT(*), 4 FROM dex_sources WHERE dataset_id = @dataset_id;

-- Both queries should return no rows.
SELECT s.species_id FROM species AS s
LEFT JOIN species_stats AS st ON st.dataset_id = s.dataset_id AND st.species_id = s.species_id
WHERE s.dataset_id = @dataset_id AND st.species_id IS NULL;

SELECT s.species_id FROM species AS s
LEFT JOIN species_types AS t ON t.dataset_id = s.dataset_id AND t.species_id = s.species_id
WHERE s.dataset_id = @dataset_id AND t.species_id IS NULL;

-- Last exported form and modified ROM stats, not canonical national-dex data.
SELECT s.species_id, s.name, st.hp, st.attack, st.defense,
       st.sp_attack, st.sp_defense, st.speed, st.base_stat_total
FROM species AS s
JOIN species_stats AS st ON st.dataset_id = s.dataset_id AND st.species_id = s.species_id
WHERE s.dataset_id = @dataset_id AND s.species_id IN (1, 6, 907, 908, 1523)
ORDER BY s.species_id;
