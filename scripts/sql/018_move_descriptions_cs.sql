-- Add Czech move descriptions without changing the original ROM descriptions.
-- Repeatable on MySQL / MariaDB. Run separately before the data seed (019).
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @emerald_ex_move_cs_schema_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE emerald_ex_moves ADD COLUMN description_cs TEXT NULL AFTER description',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'emerald_ex_moves'
      AND COLUMN_NAME = 'description_cs'
);
PREPARE emerald_ex_move_cs_schema_stmt FROM @emerald_ex_move_cs_schema_sql;
EXECUTE emerald_ex_move_cs_schema_stmt;
DEALLOCATE PREPARE emerald_ex_move_cs_schema_stmt;
