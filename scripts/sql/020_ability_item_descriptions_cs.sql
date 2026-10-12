-- Add Czech ability and item descriptions without changing the English ROM text.
-- Repeatable on MySQL / MariaDB. Run separately before the data seed (021).
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @emerald_ex_ability_cs_schema_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE emerald_ex_abilities ADD COLUMN description_cs TEXT NULL AFTER description',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'emerald_ex_abilities'
      AND COLUMN_NAME = 'description_cs'
);
PREPARE emerald_ex_ability_cs_schema_stmt FROM @emerald_ex_ability_cs_schema_sql;
EXECUTE emerald_ex_ability_cs_schema_stmt;
DEALLOCATE PREPARE emerald_ex_ability_cs_schema_stmt;

SET @emerald_ex_item_cs_schema_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE emerald_ex_items ADD COLUMN description_cs TEXT NULL AFTER description',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'emerald_ex_items'
      AND COLUMN_NAME = 'description_cs'
);
PREPARE emerald_ex_item_cs_schema_stmt FROM @emerald_ex_item_cs_schema_sql;
EXECUTE emerald_ex_item_cs_schema_stmt;
DEALLOCATE PREPARE emerald_ex_item_cs_schema_stmt;
