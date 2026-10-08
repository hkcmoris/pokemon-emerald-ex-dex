-- Replace the original Physical/Special PNG defaults with the supplied SVGs.
-- Run after 007 for an existing database; do not rerun 008 to preserve hidden icons.
-- Repeatable: preserves NULL, custom filenames, Status, and other datasets.
-- BINARY filename comparisons preserve differently cased custom filenames too.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
START TRANSACTION;

UPDATE emerald_ex_move_categories SET icon_file = 'physical.svg'
WHERE dataset_id = 'emerald-ex-1.0.4' AND category_id = 0 AND BINARY name = 'Physical' AND BINARY icon_file = 'physical.png';
UPDATE emerald_ex_move_categories SET icon_file = 'special.svg'
WHERE dataset_id = 'emerald-ex-1.0.4' AND category_id = 1 AND BINARY name = 'Special' AND BINARY icon_file = 'special.png';

COMMIT;

SELECT category_id, name, icon_file FROM emerald_ex_move_categories
WHERE dataset_id = 'emerald-ex-1.0.4' ORDER BY category_id;
