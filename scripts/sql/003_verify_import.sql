-- Expected counts for the supplied Emerald EX 1.0.4 exports.
SET @dataset_id = 'emerald-ex-1.0.4';

-- Icon filenames are editable; NULL deliberately displays a category label only.
SELECT category_id, name, icon_file FROM emerald_ex_move_categories
WHERE dataset_id = @dataset_id ORDER BY category_id;

SELECT type_id, name, icon_file FROM emerald_ex_types
WHERE dataset_id = @dataset_id ORDER BY type_id;

SELECT 'species' AS entity, COUNT(*) AS actual, 1523 AS expected FROM emerald_ex_species WHERE dataset_id = @dataset_id
UNION ALL SELECT 'stats', COUNT(*), 1523 FROM emerald_ex_species_stats WHERE dataset_id = @dataset_id
UNION ALL SELECT 'types', COUNT(*), 19 FROM emerald_ex_types WHERE dataset_id = @dataset_id
UNION ALL SELECT 'species_types', COUNT(*), 2280 FROM emerald_ex_species_types WHERE dataset_id = @dataset_id
UNION ALL SELECT 'moves', COUNT(*), 935 FROM emerald_ex_moves WHERE dataset_id = @dataset_id
UNION ALL SELECT 'learnset_entries', COUNT(*), 23729 FROM emerald_ex_learnset_entries WHERE dataset_id = @dataset_id
UNION ALL SELECT 'machines', COUNT(*), 58 FROM emerald_ex_machines WHERE dataset_id = @dataset_id
UNION ALL SELECT 'species_machines', COUNT(*), 32358 FROM emerald_ex_species_machines WHERE dataset_id = @dataset_id
UNION ALL SELECT 'normal_evolutions', COUNT(*), 618 FROM emerald_ex_evolutions WHERE dataset_id = @dataset_id AND internal_only = 0
UNION ALL SELECT 'form_markers', COUNT(*), 26 FROM emerald_ex_evolutions WHERE dataset_id = @dataset_id AND internal_only = 1
UNION ALL SELECT 'sources', COUNT(*), 7 FROM emerald_ex_sources WHERE dataset_id = @dataset_id
UNION ALL SELECT 'items', COUNT(*), 828 FROM emerald_ex_items WHERE dataset_id = @dataset_id
UNION ALL SELECT 'item_pockets', COUNT(*), 5 FROM emerald_ex_item_pockets WHERE dataset_id = @dataset_id
UNION ALL SELECT 'evolution_items', COUNT(*), 125 FROM emerald_ex_evolution_items WHERE dataset_id = @dataset_id
UNION ALL SELECT 'form_change_items', COUNT(*), 1167 FROM emerald_ex_form_change_items WHERE dataset_id = @dataset_id
UNION ALL SELECT 'form_methods', COUNT(*), 20 FROM emerald_ex_form_change_methods WHERE dataset_id = @dataset_id
UNION ALL SELECT 'form_groups', COUNT(*), 209 FROM emerald_ex_form_groups WHERE dataset_id = @dataset_id
UNION ALL SELECT 'form_memberships', COUNT(*), 700 FROM emerald_ex_species_forms WHERE dataset_id = @dataset_id
UNION ALL SELECT 'form_changes', COUNT(*), 1600 FROM emerald_ex_form_changes WHERE dataset_id = @dataset_id
UNION ALL SELECT 'sprite_records', COUNT(*), 1523 FROM emerald_ex_species_sprites WHERE dataset_id = @dataset_id
UNION ALL SELECT 'front_sprites', COUNT(front_file), 1519 FROM emerald_ex_species_sprites WHERE dataset_id = @dataset_id
UNION ALL SELECT 'shiny_front_sprites', COUNT(shiny_front_file), 1519 FROM emerald_ex_species_sprites WHERE dataset_id = @dataset_id;

-- Both queries should return no rows.
SELECT s.species_id FROM emerald_ex_species AS s
LEFT JOIN emerald_ex_species_stats AS st ON st.dataset_id = s.dataset_id AND st.species_id = s.species_id
WHERE s.dataset_id = @dataset_id AND st.species_id IS NULL;

SELECT s.species_id FROM emerald_ex_species AS s
LEFT JOIN emerald_ex_species_types AS t ON t.dataset_id = s.dataset_id AND t.species_id = s.species_id
WHERE s.dataset_id = @dataset_id AND t.species_id IS NULL;

-- Last exported form and modified ROM stats, not canonical national-dex data.
SELECT s.species_id, s.name, st.hp, st.attack, st.defense,
       st.sp_attack, st.sp_defense, st.speed, st.base_stat_total
FROM emerald_ex_species AS s
JOIN emerald_ex_species_stats AS st ON st.dataset_id = s.dataset_id AND st.species_id = s.species_id
WHERE s.dataset_id = @dataset_id AND s.species_id IN (1, 6, 907, 908, 1523)
ORDER BY s.species_id;

-- No fake species zero exists. Restore rules have a nullable target FK.
SELECT source_species_id, change_order, target_species_id, raw_target_species_id, restore_previous_form
FROM emerald_ex_form_changes WHERE dataset_id = @dataset_id AND raw_target_species_id = 0;

SELECT g.form_group_id, g.base_species_id, f.species_id, s.name, f.form_kind, f.form_label
FROM emerald_ex_form_groups AS g
JOIN emerald_ex_species_forms AS f ON f.dataset_id = g.dataset_id AND f.form_group_id = g.form_group_id
JOIN emerald_ex_species AS s ON s.dataset_id = f.dataset_id AND s.species_id = f.species_id
WHERE g.dataset_id = @dataset_id AND g.base_species_id = 94 ORDER BY f.species_id;

-- Database-driven evolution item images.
SELECT r.edge_order, r.role, i.item_id, i.name, i.icon_file
FROM emerald_ex_evolution_items r JOIN emerald_ex_items i ON i.dataset_id = r.dataset_id AND i.item_id = r.item_id
WHERE r.dataset_id = @dataset_id AND i.item_id IN (213, 465, 796);
