-- Add icon filenames to the existing category catalog in the selected database.
-- Repeatable on MySQL / MariaDB; existing filenames and other tables are untouched.
-- Run this schema upgrade separately from the data seed (008).
SET NAMES utf8mb4;

SET @emerald_ex_icon_schema_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE emerald_ex_move_categories ADD COLUMN icon_file VARCHAR(255) NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'emerald_ex_move_categories'
      AND COLUMN_NAME = 'icon_file'
);
PREPARE emerald_ex_icon_schema_stmt FROM @emerald_ex_icon_schema_sql;
EXECUTE emerald_ex_icon_schema_stmt;
DEALLOCATE PREPARE emerald_ex_icon_schema_stmt;
