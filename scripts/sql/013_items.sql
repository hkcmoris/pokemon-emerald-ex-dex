-- Relational ROM items; select your existing shared database first.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_item_pockets (
    dataset_id VARCHAR(64) NOT NULL,
    pocket_id TINYINT UNSIGNED NOT NULL,
    name VARCHAR(32) NOT NULL,
    PRIMARY KEY (dataset_id, pocket_id),
    UNIQUE KEY emerald_ex_uq_item_pocket_name (dataset_id, name),
    CONSTRAINT emerald_ex_fk_item_pocket_dataset FOREIGN KEY (dataset_id) REFERENCES emerald_ex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_items (
    dataset_id VARCHAR(64) NOT NULL,
    item_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    plural_name VARCHAR(100) NULL,
    description TEXT NOT NULL,
    price INT UNSIGNED NOT NULL,
    pocket_id TINYINT UNSIGNED NOT NULL,
    secondary_id SMALLINT UNSIGNED NOT NULL,
    hold_effect_id SMALLINT UNSIGNED NOT NULL,
    hold_effect_param TINYINT UNSIGNED NOT NULL,
    importance TINYINT UNSIGNED NOT NULL,
    not_consumed TINYINT UNSIGNED NOT NULL CHECK (not_consumed IN (0, 1)),
    item_use_type_id TINYINT UNSIGNED NOT NULL,
    battle_usage_id TINYINT UNSIGNED NOT NULL,
    fling_power TINYINT UNSIGNED NOT NULL,
    icon_file VARCHAR(255) NULL,
    rom JSON NOT NULL,
    PRIMARY KEY (dataset_id, item_id),
    KEY emerald_ex_idx_item_name (dataset_id, name),
    KEY emerald_ex_idx_item_pocket (dataset_id, pocket_id, item_id),
    CONSTRAINT emerald_ex_fk_item_pocket FOREIGN KEY (dataset_id, pocket_id) REFERENCES emerald_ex_item_pockets (dataset_id, pocket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_evolution_items (
    dataset_id VARCHAR(64) NOT NULL,
    edge_order SMALLINT UNSIGNED NOT NULL,
    role VARCHAR(64) NOT NULL,
    item_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, edge_order, role),
    KEY emerald_ex_idx_evolution_item (dataset_id, item_id, edge_order),
    CONSTRAINT emerald_ex_fk_evolution_item_edge FOREIGN KEY (dataset_id, edge_order) REFERENCES emerald_ex_evolutions (dataset_id, edge_order) ON DELETE CASCADE,
    CONSTRAINT emerald_ex_fk_evolution_item FOREIGN KEY (dataset_id, item_id) REFERENCES emerald_ex_items (dataset_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_form_change_items (
    dataset_id VARCHAR(64) NOT NULL,
    source_species_id SMALLINT UNSIGNED NOT NULL,
    change_order SMALLINT UNSIGNED NOT NULL,
    role VARCHAR(64) NOT NULL,
    item_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, source_species_id, change_order, role),
    KEY emerald_ex_idx_form_change_item (dataset_id, item_id, source_species_id),
    CONSTRAINT emerald_ex_fk_form_change_item_rule FOREIGN KEY (dataset_id, source_species_id, change_order) REFERENCES emerald_ex_form_changes (dataset_id, source_species_id, change_order) ON DELETE CASCADE,
    CONSTRAINT emerald_ex_fk_form_change_item FOREIGN KEY (dataset_id, item_id) REFERENCES emerald_ex_items (dataset_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
