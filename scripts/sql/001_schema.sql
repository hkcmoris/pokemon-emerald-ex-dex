-- MySQL 8.0.16+ / MariaDB 10.11+. Select your existing shared database in the client.
-- All dex tables, explicitly named constraints and indexes use the emerald_ex_ prefix.
-- Column-level CHECK clauses also work with phpMyAdmin's static SQL analyser.
-- DDL commits independently. Run this separately from the transactional data import.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS emerald_ex_datasets (
    dataset_id VARCHAR(64) NOT NULL,
    game VARCHAR(100) NOT NULL,
    version VARCHAR(32) NOT NULL,
    PRIMARY KEY (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_sources (
    dataset_id VARCHAR(64) NOT NULL,
    source_kind VARCHAR(32) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_sha256 CHAR(64) NOT NULL,
    metadata JSON NOT NULL,
    PRIMARY KEY (dataset_id, source_kind),
    CONSTRAINT emerald_ex_fk_sources_dataset FOREIGN KEY (dataset_id) REFERENCES emerald_ex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_types (
    dataset_id VARCHAR(64) NOT NULL,
    type_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(32) NOT NULL,
    PRIMARY KEY (dataset_id, type_id),
    UNIQUE KEY emerald_ex_uq_types_name (dataset_id, name),
    CONSTRAINT emerald_ex_fk_types_dataset FOREIGN KEY (dataset_id) REFERENCES emerald_ex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_move_categories (
    dataset_id VARCHAR(64) NOT NULL,
    category_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(32) NOT NULL,
    icon_file VARCHAR(255) NULL,
    PRIMARY KEY (dataset_id, category_id),
    UNIQUE KEY emerald_ex_uq_categories_name (dataset_id, name),
    CONSTRAINT emerald_ex_fk_categories_dataset FOREIGN KEY (dataset_id) REFERENCES emerald_ex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_evolution_methods (
    dataset_id VARCHAR(64) NOT NULL,
    method_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(64) NOT NULL,
    PRIMARY KEY (dataset_id, method_id),
    CONSTRAINT emerald_ex_fk_methods_dataset FOREIGN KEY (dataset_id) REFERENCES emerald_ex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_species (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (dataset_id, species_id),
    KEY emerald_ex_idx_species_name (dataset_id, name),
    CONSTRAINT emerald_ex_fk_species_dataset FOREIGN KEY (dataset_id) REFERENCES emerald_ex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_species_stats (
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
    KEY emerald_ex_idx_species_total (dataset_id, base_stat_total, species_id),
    KEY emerald_ex_idx_species_speed (dataset_id, speed, species_id),
    CONSTRAINT emerald_ex_fk_stats_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_species_types (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    slot TINYINT UNSIGNED NOT NULL CHECK (slot BETWEEN 1 AND 2),
    type_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, species_id, slot),
    UNIQUE KEY emerald_ex_uq_species_type (dataset_id, species_id, type_id),
    KEY emerald_ex_idx_type_species (dataset_id, type_id, species_id),
    CONSTRAINT emerald_ex_fk_species_types_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id),
    CONSTRAINT emerald_ex_fk_species_types_type FOREIGN KEY (dataset_id, type_id)
        REFERENCES emerald_ex_types (dataset_id, type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_moves (
    dataset_id VARCHAR(64) NOT NULL,
    move_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    type_id SMALLINT UNSIGNED NOT NULL,
    category_id SMALLINT UNSIGNED NOT NULL,
    power SMALLINT UNSIGNED NOT NULL,
    accuracy TINYINT UNSIGNED NOT NULL CHECK (accuracy <= 100),
    pp TINYINT UNSIGNED NOT NULL,
    priority TINYINT NOT NULL,
    effect_id SMALLINT UNSIGNED NOT NULL,
    target_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, move_id),
    KEY emerald_ex_idx_moves_name (dataset_id, name),
    KEY emerald_ex_idx_moves_type (dataset_id, type_id, move_id),
    KEY emerald_ex_idx_moves_category (dataset_id, category_id, move_id),
    CONSTRAINT emerald_ex_fk_moves_type FOREIGN KEY (dataset_id, type_id)
        REFERENCES emerald_ex_types (dataset_id, type_id),
    CONSTRAINT emerald_ex_fk_moves_category FOREIGN KEY (dataset_id, category_id)
        REFERENCES emerald_ex_move_categories (dataset_id, category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_learnset_entries (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    entry_order SMALLINT UNSIGNED NOT NULL,
    level TINYINT UNSIGNED NOT NULL CHECK (level <= 100),
    move_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, species_id, entry_order),
    KEY emerald_ex_idx_learnset_move (dataset_id, move_id, species_id),
    CONSTRAINT emerald_ex_fk_learnset_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id),
    CONSTRAINT emerald_ex_fk_learnset_move FOREIGN KEY (dataset_id, move_id)
        REFERENCES emerald_ex_moves (dataset_id, move_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_machines (
    dataset_id VARCHAR(64) NOT NULL,
    machine_code CHAR(4) NOT NULL,
    kind CHAR(2) NOT NULL CHECK (kind IN ('TM', 'HM')),
    number TINYINT UNSIGNED NOT NULL CHECK (number >= 1),
    move_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, machine_code),
    UNIQUE KEY emerald_ex_uq_machine_number (dataset_id, kind, number),
    KEY emerald_ex_idx_machine_move (dataset_id, move_id),
    CONSTRAINT emerald_ex_fk_machine_move FOREIGN KEY (dataset_id, move_id)
        REFERENCES emerald_ex_moves (dataset_id, move_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_species_machines (
    dataset_id VARCHAR(64) NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    machine_code CHAR(4) NOT NULL,
    PRIMARY KEY (dataset_id, species_id, machine_code),
    KEY emerald_ex_idx_machine_species (dataset_id, machine_code, species_id),
    CONSTRAINT emerald_ex_fk_species_machine_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id),
    CONSTRAINT emerald_ex_fk_species_machine_machine FOREIGN KEY (dataset_id, machine_code)
        REFERENCES emerald_ex_machines (dataset_id, machine_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_evolutions (
    dataset_id VARCHAR(64) NOT NULL,
    edge_order SMALLINT UNSIGNED NOT NULL,
    from_species_id SMALLINT UNSIGNED NOT NULL,
    to_species_id SMALLINT UNSIGNED NOT NULL,
    method_id SMALLINT UNSIGNED NOT NULL,
    trigger_name VARCHAR(64) NOT NULL,
    level TINYINT UNSIGNED NULL CHECK (level IS NULL OR level <= 100),
    conditions JSON NOT NULL,
    summary TEXT NOT NULL,
    internal_only BOOLEAN NOT NULL CHECK (internal_only IN (0, 1)),
    raw_param SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, edge_order),
    KEY emerald_ex_idx_evolution_from (dataset_id, from_species_id, internal_only),
    KEY emerald_ex_idx_evolution_to (dataset_id, to_species_id, internal_only),
    CONSTRAINT emerald_ex_fk_evolution_from FOREIGN KEY (dataset_id, from_species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id),
    CONSTRAINT emerald_ex_fk_evolution_to FOREIGN KEY (dataset_id, to_species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id),
    CONSTRAINT emerald_ex_fk_evolution_method FOREIGN KEY (dataset_id, method_id)
        REFERENCES emerald_ex_evolution_methods (dataset_id, method_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
