-- Add type icon filenames in the selected shared database. MySQL / MariaDB.
-- Repeatable: existing filenames and other tables are untouched. Run separately from 010.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @emerald_ex_type_icon_schema_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE emerald_ex_types ADD COLUMN icon_file VARCHAR(255) NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'emerald_ex_types'
      AND COLUMN_NAME = 'icon_file'
);
PREPARE emerald_ex_type_icon_schema_stmt FROM @emerald_ex_type_icon_schema_sql;
EXECUTE emerald_ex_type_icon_schema_stmt;
DEALLOCATE PREPARE emerald_ex_type_icon_schema_stmt;
