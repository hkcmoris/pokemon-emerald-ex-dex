-- Add sprite references to an existing dex in the selected shared database.
-- Repeatable; does not replace species or change other projects' tables.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_species_sprites (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    front_file VARCHAR(255) NULL,
    shiny_front_file VARCHAR(255) NULL,
    front_frame2_file VARCHAR(255) NULL,
    shiny_front_frame2_file VARCHAR(255) NULL,
    back_file VARCHAR(255) NULL,
    shiny_back_file VARCHAR(255) NULL,
    front_frame_count TINYINT UNSIGNED NOT NULL CHECK (front_frame_count BETWEEN 0 AND 2),
    missing_reason TEXT NULL,
    PRIMARY KEY (dataset_id, species_id),
    CONSTRAINT emerald_ex_fk_sprites_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
