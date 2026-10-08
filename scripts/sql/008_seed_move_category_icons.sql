-- Initial filenames for the supplied icons. Run 007 first for an existing database,
-- or 001 + 002 for a fresh database. Select your database in the SQL client.
-- Repeatable: does not replace an already configured filename or affect other datasets.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
START TRANSACTION;

UPDATE emerald_ex_move_categories SET icon_file = 'physical.svg'
WHERE dataset_id = 'emerald-ex-1.0.4' AND category_id = 0 AND name = 'Physical' AND icon_file IS NULL;
UPDATE emerald_ex_move_categories SET icon_file = 'special.svg'
WHERE dataset_id = 'emerald-ex-1.0.4' AND category_id = 1 AND name = 'Special' AND icon_file IS NULL;
UPDATE emerald_ex_move_categories SET icon_file = 'status.png'
WHERE dataset_id = 'emerald-ex-1.0.4' AND category_id = 2 AND name = 'Status' AND icon_file IS NULL;

COMMIT;

SELECT category_id, name, icon_file FROM emerald_ex_move_categories
WHERE dataset_id = 'emerald-ex-1.0.4' ORDER BY category_id;
