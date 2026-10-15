-- Defensive type matchups; select the existing shared database first.
-- DDL commits independently. Seed the chart separately with 025.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emerald_ex_type_effectiveness (
    dataset_id VARCHAR(64) NOT NULL,
    attacking_type_id SMALLINT UNSIGNED NOT NULL,
    defending_type_id SMALLINT UNSIGNED NOT NULL,
    multiplier DECIMAL(2,1) NOT NULL CHECK (multiplier IN (0, 0.5, 1, 2)),
    PRIMARY KEY (dataset_id, attacking_type_id, defending_type_id),
    KEY emerald_ex_idx_type_effectiveness_defender (dataset_id, defending_type_id, attacking_type_id),
    CONSTRAINT emerald_ex_fk_type_effectiveness_attacker FOREIGN KEY (dataset_id, attacking_type_id)
        REFERENCES emerald_ex_types (dataset_id, type_id) ON DELETE CASCADE,
    CONSTRAINT emerald_ex_fk_type_effectiveness_defender FOREIGN KEY (dataset_id, defending_type_id)
        REFERENCES emerald_ex_types (dataset_id, type_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
