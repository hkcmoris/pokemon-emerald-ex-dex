-- Initial filenames from assets/types/. Run 009 for an existing database, or 001 + 002 for a fresh setup.
-- Repeatable: fills NULL filenames only, preserving custom filenames and other datasets.
-- Electric uses Lightning; Dark uses Darkness. No Mystery icon was supplied (leave NULL).
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE emerald_ex_types
SET icon_file = CASE type_id
    WHEN 0 THEN '48px-Normal.png'
    WHEN 1 THEN '48px-Fighting.png'
    WHEN 2 THEN 'Flying.png'
    WHEN 3 THEN 'Poison.png'
    WHEN 4 THEN 'Ground.png'
    WHEN 5 THEN 'Rock.png'
    WHEN 6 THEN 'Bug.png'
    WHEN 7 THEN 'Ghost.png'
    WHEN 8 THEN '48px-Steel.png'
    WHEN 10 THEN '48px-Fire.png'
    WHEN 11 THEN '48px-Water.png'
    WHEN 12 THEN '48px-Grass.png'
    WHEN 13 THEN '48px-Lightning.png'
    WHEN 14 THEN '48px-Psychic.png'
    WHEN 15 THEN 'Ice.png'
    WHEN 16 THEN '48px-Dragon.png'
    WHEN 17 THEN '48px-Darkness.png'
    WHEN 18 THEN '48px-Fairy.png'
END
WHERE dataset_id = 'emerald-ex-1.0.4' AND icon_file IS NULL AND type_id <> 9;

COMMIT;

SELECT type_id, name, icon_file FROM emerald_ex_types
WHERE dataset_id = 'emerald-ex-1.0.4' ORDER BY type_id;
