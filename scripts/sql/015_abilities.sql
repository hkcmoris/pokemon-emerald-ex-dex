-- Relational ROM abilities; select your existing shared database first.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS emerald_ex_abilities (
    dataset_id VARCHAR(64) NOT NULL,
    ability_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    ai_rating TINYINT NOT NULL,
    cant_be_copied TINYINT UNSIGNED NOT NULL CHECK (cant_be_copied IN (0, 1)),
    cant_be_swapped TINYINT UNSIGNED NOT NULL CHECK (cant_be_swapped IN (0, 1)),
    cant_be_traced TINYINT UNSIGNED NOT NULL CHECK (cant_be_traced IN (0, 1)),
    cant_be_suppressed TINYINT UNSIGNED NOT NULL CHECK (cant_be_suppressed IN (0, 1)),
    cant_be_overwritten TINYINT UNSIGNED NOT NULL CHECK (cant_be_overwritten IN (0, 1)),
    breakable TINYINT UNSIGNED NOT NULL CHECK (breakable IN (0, 1)),
    fails_on_imposter TINYINT UNSIGNED NOT NULL CHECK (fails_on_imposter IN (0, 1)),
    PRIMARY KEY (dataset_id, ability_id),
    KEY emerald_ex_idx_ability_name (dataset_id, name),
    CONSTRAINT emerald_ex_fk_ability_dataset FOREIGN KEY (dataset_id) REFERENCES emerald_ex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_species_abilities (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    slot TINYINT UNSIGNED NOT NULL CHECK (slot BETWEEN 1 AND 3),
    kind VARCHAR(6) NOT NULL,
    ability_id SMALLINT UNSIGNED NULL CHECK (ability_id IS NULL OR ability_id > 0),
    PRIMARY KEY (dataset_id, species_id, slot),
    KEY emerald_ex_idx_species_ability (dataset_id, ability_id, species_id, slot),
    CONSTRAINT emerald_ex_chk_ability_slot_kind CHECK ((slot IN (1, 2) AND kind = 'normal') OR (slot = 3 AND kind = 'hidden')),
    CONSTRAINT emerald_ex_fk_species_ability_species FOREIGN KEY (dataset_id, species_id) REFERENCES emerald_ex_species (dataset_id, species_id),
    CONSTRAINT emerald_ex_fk_species_ability_definition FOREIGN KEY (dataset_id, ability_id) REFERENCES emerald_ex_abilities (dataset_id, ability_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
