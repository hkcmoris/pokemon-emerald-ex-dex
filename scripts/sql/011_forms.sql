-- Add relational forms in the currently selected shared database.
-- Repeatable; existing dex tables and other projects are not replaced.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_form_change_methods (
    dataset_id VARCHAR(64) NOT NULL,
    method_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(64) NOT NULL,
    PRIMARY KEY (dataset_id, method_id),
    UNIQUE KEY emerald_ex_uq_form_method_name (dataset_id, name),
    CONSTRAINT emerald_ex_fk_form_methods_dataset FOREIGN KEY (dataset_id)
        REFERENCES emerald_ex_datasets (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_form_groups (
    dataset_id VARCHAR(64) NOT NULL,
    form_group_id SMALLINT UNSIGNED NOT NULL,
    base_species_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, form_group_id),
    KEY emerald_ex_idx_form_group_base (dataset_id, base_species_id),
    CONSTRAINT emerald_ex_fk_form_group_base FOREIGN KEY (dataset_id, base_species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_species_forms (
    dataset_id VARCHAR(64) NOT NULL,
    form_group_id SMALLINT UNSIGNED NOT NULL,
    species_id SMALLINT UNSIGNED NOT NULL,
    is_base_form TINYINT UNSIGNED NOT NULL CHECK (is_base_form IN (0, 1)),
    form_kind VARCHAR(64) NOT NULL,
    form_label VARCHAR(100) NULL,
    base_form_group_id SMALLINT UNSIGNED GENERATED ALWAYS AS
        (CASE WHEN is_base_form = 1 THEN form_group_id ELSE NULL END) STORED,
    PRIMARY KEY (dataset_id, species_id),
    UNIQUE KEY emerald_ex_uq_group_base_form (dataset_id, base_form_group_id),
    KEY emerald_ex_idx_form_group_members (dataset_id, form_group_id, is_base_form, species_id),
    CONSTRAINT emerald_ex_fk_species_form_group FOREIGN KEY (dataset_id, form_group_id)
        REFERENCES emerald_ex_form_groups (dataset_id, form_group_id),
    CONSTRAINT emerald_ex_fk_species_form_species FOREIGN KEY (dataset_id, species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_form_changes (
    dataset_id VARCHAR(64) NOT NULL,
    source_species_id SMALLINT UNSIGNED NOT NULL,
    change_order SMALLINT UNSIGNED NOT NULL,
    target_species_id SMALLINT UNSIGNED NULL,
    raw_target_species_id SMALLINT UNSIGNED NOT NULL,
    restore_previous_form TINYINT UNSIGNED NOT NULL CHECK (restore_previous_form IN (0, 1)),
    method_id SMALLINT UNSIGNED NOT NULL,
    form_kind VARCHAR(64) NOT NULL,
    battle_only TINYINT UNSIGNED NOT NULL CHECK (battle_only IN (0, 1)),
    details JSON NOT NULL,
    summary TEXT NOT NULL,
    raw_param1 SMALLINT UNSIGNED NOT NULL,
    raw_param2 SMALLINT UNSIGNED NOT NULL,
    raw_param3 SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (dataset_id, source_species_id, change_order),
    KEY emerald_ex_idx_form_change_target (dataset_id, target_species_id, source_species_id),
    KEY emerald_ex_idx_form_change_method (dataset_id, method_id, source_species_id),
    CONSTRAINT emerald_ex_chk_form_target CHECK (
        (raw_target_species_id = 0 AND target_species_id IS NULL AND restore_previous_form = 1)
        OR (raw_target_species_id > 0 AND target_species_id IS NOT NULL
            AND target_species_id = raw_target_species_id AND restore_previous_form = 0)
    ),
    CONSTRAINT emerald_ex_fk_form_change_source FOREIGN KEY (dataset_id, source_species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id),
    CONSTRAINT emerald_ex_fk_form_change_target FOREIGN KEY (dataset_id, target_species_id)
        REFERENCES emerald_ex_species (dataset_id, species_id),
    CONSTRAINT emerald_ex_fk_form_change_method FOREIGN KEY (dataset_id, method_id)
        REFERENCES emerald_ex_form_change_methods (dataset_id, method_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
