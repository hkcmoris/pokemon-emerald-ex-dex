-- MySQL 8.0.16+ / MariaDB 10.11+. Select the destination database in the client.
-- DDL commits independently. Run this separately from the transactional data import.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS dex_datasets (
    dataset_id VARCHAR(64) NOT NULL,
    game VARCHAR(100) NOT NULL,
    version VARCHAR(32) NOT NULL,
    PRIMARY KEY (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dex_sources (
    dataset_id VARCHAR(64) NOT NULL,
    source_kind VARCHAR(32) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_sha256 CHAR(64) NOT NULL,
    metadata JSON NOT NULL,
    PRIMARY KEY (dataset_id, source_kind),
    CONSTRAINT fk_sources_dataset FOREIGN KEY (dataset_id) REFERENCES dex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pokemon_types (
    dataset_id VARCHAR(64) NOT NULL,
    type_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(32) NOT NULL,
    PRIMARY KEY (dataset_id, type_id),
    UNIQUE KEY uq_types_name (dataset_id, name),
    CONSTRAINT fk_types_dataset FOREIGN KEY (dataset_id) REFERENCES dex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS move_categories (
    dataset_id VARCHAR(64) NOT NULL,
    category_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(32) NOT NULL,
    PRIMARY KEY (dataset_id, category_id),
    UNIQUE KEY uq_categories_name (dataset_id, name),
    CONSTRAINT fk_categories_dataset FOREIGN KEY (dataset_id) REFERENCES dex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evolution_methods (
    dataset_id VARCHAR(64) NOT NULL,
    method_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(64) NOT NULL,
    PRIMARY KEY (dataset_id, method_id),
    CONSTRAINT fk_methods_dataset FOREIGN KEY (dataset_id) REFERENCES dex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS species (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (dataset_id, species_id),
    KEY idx_species_name (dataset_id, name),
    CONSTRAINT fk_species_dataset FOREIGN KEY (dataset_id) REFERENCES dex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS species_stats (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    hp TINYINT UNSIGNED NOT NULL,
    attack TINYINT UNSIGNED NOT NULL,
    defense TINYINT UNSIGNED NOT NULL,
    sp_attack TINYINT UNSIGNED NOT NULL,
    sp_defense TINYINT UNSIGNED NOT NULL,
    speed TINYINT UNSIGNED NOT NULL,
    base_stat_total SMALLINT UNSIGNED GENERATED ALWAYS AS
        (hp + attack + defense + sp_attack + sp_defense + speed) STORED,
    PRIMARY KEY (dataset_id, species_id),
    KEY idx_species_total (dataset_id, base_stat_total, species_id),
    KEY idx_species_speed (dataset_id, speed, species_id),
    CONSTRAINT fk_stats_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES species (dataset_id, species_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS species_types (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    slot TINYINT UNSIGNED NOT NULL,
    type_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, species_id, slot),
    UNIQUE KEY uq_species_type (dataset_id, species_id, type_id),
    KEY idx_type_species (dataset_id, type_id, species_id),
    CONSTRAINT chk_type_slot CHECK (slot BETWEEN 1 AND 2),
    CONSTRAINT fk_species_types_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES species (dataset_id, species_id),
    CONSTRAINT fk_species_types_type FOREIGN KEY (dataset_id, type_id)
        REFERENCES pokemon_types (dataset_id, type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS moves (
    dataset_id VARCHAR(64) NOT NULL,
    move_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    type_id SMALLINT UNSIGNED NOT NULL,
    category_id SMALLINT UNSIGNED NOT NULL,
    power SMALLINT UNSIGNED NOT NULL,
    accuracy TINYINT UNSIGNED NOT NULL,
    pp TINYINT UNSIGNED NOT NULL,
    priority TINYINT NOT NULL,
    effect_id SMALLINT UNSIGNED NOT NULL,
    target_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, move_id),
    KEY idx_moves_name (dataset_id, name),
    KEY idx_moves_type (dataset_id, type_id, move_id),
    KEY idx_moves_category (dataset_id, category_id, move_id),
    CONSTRAINT chk_move_accuracy CHECK (accuracy <= 100),
    CONSTRAINT fk_moves_type FOREIGN KEY (dataset_id, type_id)
        REFERENCES pokemon_types (dataset_id, type_id),
    CONSTRAINT fk_moves_category FOREIGN KEY (dataset_id, category_id)
        REFERENCES move_categories (dataset_id, category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learnset_entries (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    entry_order SMALLINT UNSIGNED NOT NULL,
    level TINYINT UNSIGNED NOT NULL,
    move_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, species_id, entry_order),
    KEY idx_learnset_move (dataset_id, move_id, species_id),
    CONSTRAINT chk_learnset_level CHECK (level <= 100),
    CONSTRAINT fk_learnset_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES species (dataset_id, species_id),
    CONSTRAINT fk_learnset_move FOREIGN KEY (dataset_id, move_id)
        REFERENCES moves (dataset_id, move_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS machines (
    dataset_id VARCHAR(64) NOT NULL,
    machine_code CHAR(4) NOT NULL,
    kind CHAR(2) NOT NULL,
    number TINYINT UNSIGNED NOT NULL,
    move_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, machine_code),
    UNIQUE KEY uq_machine_number (dataset_id, kind, number),
    KEY idx_machine_move (dataset_id, move_id),
    CONSTRAINT chk_machine_kind CHECK (kind IN ('TM', 'HM')),
    CONSTRAINT chk_machine_number CHECK (number >= 1),
    CONSTRAINT fk_machine_move FOREIGN KEY (dataset_id, move_id)
        REFERENCES moves (dataset_id, move_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS species_machines (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    machine_code CHAR(4) NOT NULL,
    PRIMARY KEY (dataset_id, species_id, machine_code),
    KEY idx_machine_species (dataset_id, machine_code, species_id),
    CONSTRAINT fk_species_machine_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES species (dataset_id, species_id),
    CONSTRAINT fk_species_machine_machine FOREIGN KEY (dataset_id, machine_code)
        REFERENCES machines (dataset_id, machine_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evolutions (
    dataset_id VARCHAR(64) NOT NULL,
    edge_order SMALLINT UNSIGNED NOT NULL,
    from_species_id SMALLINT UNSIGNED NOT NULL,
    to_species_id SMALLINT UNSIGNED NOT NULL,
    method_id SMALLINT UNSIGNED NOT NULL,
    trigger_name VARCHAR(64) NOT NULL,
    level TINYINT UNSIGNED NULL,
    conditions JSON NOT NULL,
    summary TEXT NOT NULL,
    internal_only BOOLEAN NOT NULL,
    raw_param SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, edge_order),
    KEY idx_evolution_from (dataset_id, from_species_id, internal_only),
    KEY idx_evolution_to (dataset_id, to_species_id, internal_only),
    CONSTRAINT chk_evolution_level CHECK (level IS NULL OR level <= 100),
    CONSTRAINT chk_evolution_internal CHECK (internal_only IN (0, 1)),
    CONSTRAINT fk_evolution_from FOREIGN KEY (dataset_id, from_species_id)
        REFERENCES species (dataset_id, species_id),
    CONSTRAINT fk_evolution_to FOREIGN KEY (dataset_id, to_species_id)
        REFERENCES species (dataset_id, species_id),
    CONSTRAINT fk_evolution_method FOREIGN KEY (dataset_id, method_id)
        REFERENCES evolution_methods (dataset_id, method_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
