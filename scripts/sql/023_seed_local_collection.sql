-- LOCAL DEVELOPMENT ONLY: production collection snapshot exported 2026-10-13.
-- Run with npm run db:migrate; its connection guard only permits loopback hosts.
-- Requires 022_my_pokemon.sql. Do not import this fixture into production.
-- The original local document is backed up before replacement. Sessions are not imported.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @collection_seed_previous_time_zone = @@SESSION.time_zone;
SET time_zone = '+00:00';

-- DDL must precede the transaction because MySQL commits it implicitly.
-- No foreign key: retain the backup even if the local account is later deleted.
CREATE TABLE IF NOT EXISTS emerald_ex_local_collection_backups (
    migration VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    revision INT UNSIGNED NOT NULL,
    document JSON NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    backed_up_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (migration, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

START TRANSACTION;

-- Sign-in uses google_subject, so retain any existing local account and profile.
-- New local accounts get a fresh ID to avoid collisions with unrelated local users.
INSERT INTO emerald_ex_collection_users
    (user_id, google_subject, display_name, email, created_at)
VALUES
    (UUID(), '104987973817476742817', 'Ondřej Moravec', 'guestmsi1@gmail.com', '2026-10-12 22:32:25')
ON DUPLICATE KEY UPDATE user_id = emerald_ex_collection_users.user_id;

-- Match by Google identity because the local user ID can differ from the export.
-- Preserve the first backup if the migration has to retry after a history-write failure.
INSERT IGNORE INTO emerald_ex_local_collection_backups
    (migration, user_id, revision, document, updated_at)
SELECT '023_seed_local_collection.sql', c.user_id, c.revision, c.document, c.updated_at
FROM emerald_ex_collections AS c
JOIN emerald_ex_collection_users AS u ON u.user_id = c.user_id
WHERE u.google_subject = '104987973817476742817';

INSERT INTO emerald_ex_collections (user_id, revision, document, updated_at)
SELECT u.user_id, 30, '{
    "pokemon": {
        "03bfaf88-41ec-4723-b985-dc357a6b043d": {
            "id": "03bfaf88-41ec-4723-b985-dc357a6b043d",
            "state": {
                "level": 8,
                "moves": [
                    {
                        "name": "Water Gun",
                        "moveId": 55
                    },
                    {
                        "name": "Growl",
                        "moveId": 45
                    },
                    {
                        "name": "Supersonic",
                        "moveId": 48
                    },
                    {
                        "name": "Wing Attack",
                        "moveId": 17
                    }
                ],
                "formEpoch": "942b8220-8ed8-4221-a8ca-e3564e300ba6",
                "speciesId": 278
            },
            "deleted": false,
            "nickname": "Morgans",
            "createdAt": "2026-10-12T22:35:00.306Z",
            "playthroughId": "48e2343a-a4d1-41d0-afa5-984d7a5cea57"
        },
        "0c62f031-bb5d-4297-b901-b5becd764d6d": {
            "id": "0c62f031-bb5d-4297-b901-b5becd764d6d",
            "state": {
                "level": 10,
                "moves": [
                    {
                        "name": "Peck",
                        "moveId": 64
                    },
                    {
                        "name": "Growl",
                        "moveId": 45
                    },
                    {
                        "name": "Leer",
                        "moveId": 43
                    },
                    {
                        "name": "Pursuit",
                        "moveId": 228
                    }
                ],
                "formEpoch": "81c934d5-c855-4dd1-b933-e84394a448ae",
                "speciesId": 21
            },
            "deleted": false,
            "nickname": "Spearmint",
            "createdAt": "2026-10-12T22:35:36.466Z",
            "playthroughId": "48e2343a-a4d1-41d0-afa5-984d7a5cea57"
        },
        "28d7ea85-aed7-44d2-8c83-57e980be0a2e": {
            "id": "28d7ea85-aed7-44d2-8c83-57e980be0a2e",
            "state": {
                "level": 11,
                "moves": [
                    {
                        "name": "Bide",
                        "moveId": 117
                    },
                    {
                        "name": "Harden",
                        "moveId": 106
                    },
                    {
                        "name": "Growth",
                        "moveId": 74
                    }
                ],
                "formEpoch": "6900ff52-59a7-484f-96ee-e1924291a099",
                "speciesId": 273
            },
            "deleted": false,
            "nickname": "Yamato",
            "createdAt": "2026-10-12T22:38:02.526Z",
            "playthroughId": "48e2343a-a4d1-41d0-afa5-984d7a5cea57"
        },
        "857c006e-4c1d-4cf6-b93a-f3a8b728ee7c": {
            "id": "857c006e-4c1d-4cf6-b93a-f3a8b728ee7c",
            "state": {
                "level": 11,
                "moves": [
                    {
                        "name": "Ember",
                        "moveId": 52
                    },
                    {
                        "name": "Growl",
                        "moveId": 45
                    },
                    {
                        "name": "Scratch",
                        "moveId": 10
                    },
                    {
                        "name": "Sand Attack",
                        "moveId": 28
                    }
                ],
                "formEpoch": "7d0e73c1-8490-40e2-aaa8-19f5d3694ca0",
                "speciesId": 255
            },
            "deleted": false,
            "nickname": "Tamago",
            "createdAt": "2026-10-12T22:34:11.974Z",
            "playthroughId": "48e2343a-a4d1-41d0-afa5-984d7a5cea57"
        },
        "ca076593-e044-4df4-a5fa-713abdd38361": {
            "id": "ca076593-e044-4df4-a5fa-713abdd38361",
            "state": {
                "level": 8,
                "moves": [
                    {
                        "name": "Tackle",
                        "moveId": 33
                    },
                    {
                        "name": "Sand Attack",
                        "moveId": 28
                    }
                ],
                "formEpoch": "eaf8729c-89c3-4992-a8cd-7376f547c3be",
                "speciesId": 16
            },
            "deleted": false,
            "nickname": "Pell",
            "createdAt": "2026-10-12T22:36:20.006Z",
            "playthroughId": "48e2343a-a4d1-41d0-afa5-984d7a5cea57"
        },
        "e20a95fc-5b25-45ec-8f70-cfd063bcfddb": {
            "id": "e20a95fc-5b25-45ec-8f70-cfd063bcfddb",
            "state": {
                "level": 9,
                "moves": [
                    {
                        "name": "Peck",
                        "moveId": 64
                    },
                    {
                        "name": "Growl",
                        "moveId": 45
                    },
                    {
                        "name": "Focus Energy",
                        "moveId": 116
                    },
                    {
                        "name": "Quick Attack",
                        "moveId": 98
                    }
                ],
                "formEpoch": "e5c03e4d-be0e-4b26-95ba-25294815f278",
                "speciesId": 276
            },
            "deleted": false,
            "nickname": "Patrik",
            "createdAt": "2026-10-12T22:37:11.074Z",
            "playthroughId": "48e2343a-a4d1-41d0-afa5-984d7a5cea57"
        }
    },
    "version": 1,
    "observations": {
        "32f12cc4-6b6c-48d4-b98c-ed108a02c666": {
            "id": "32f12cc4-6b6c-48d4-b98c-ed108a02c666",
            "level": 7,
            "stats": {
                "hp": 24,
                "speed": 18,
                "attack": 8,
                "defense": 11,
                "spAttack": 13,
                "spDefense": 9
            },
            "deleted": false,
            "formEpoch": "942b8220-8ed8-4221-a8ca-e3564e300ba6",
            "pokemonId": "03bfaf88-41ec-4723-b985-dc357a6b043d",
            "speciesId": 278,
            "recordedAt": "2026-10-13T13:21:00.000Z"
        },
        "44eea8ca-3311-4210-971d-beac34516d6a": {
            "id": "44eea8ca-3311-4210-971d-beac34516d6a",
            "level": 8,
            "stats": {
                "hp": 26,
                "speed": 20,
                "attack": 8,
                "defense": 11,
                "spAttack": 14,
                "spDefense": 11
            },
            "deleted": false,
            "formEpoch": "942b8220-8ed8-4221-a8ca-e3564e300ba6",
            "pokemonId": "03bfaf88-41ec-4723-b985-dc357a6b043d",
            "speciesId": 278,
            "recordedAt": "2026-10-13T15:45:00.000Z"
        },
        "4e7bfa15-dbb0-44d6-89d3-0debd9fdbdf5": {
            "id": "4e7bfa15-dbb0-44d6-89d3-0debd9fdbdf5",
            "level": 11,
            "stats": {
                "hp": 30,
                "speed": 11,
                "attack": 15,
                "defense": 16,
                "spAttack": 14,
                "spDefense": 13
            },
            "deleted": false,
            "formEpoch": "6900ff52-59a7-484f-96ee-e1924291a099",
            "pokemonId": "28d7ea85-aed7-44d2-8c83-57e980be0a2e",
            "speciesId": 273,
            "recordedAt": "2026-10-13T13:23:00.000Z"
        },
        "ad8f7345-80ea-4cc1-b3da-51d5afd73e32": {
            "id": "ad8f7345-80ea-4cc1-b3da-51d5afd73e32",
            "level": 10,
            "stats": {
                "hp": 29,
                "speed": 20,
                "attack": 17,
                "defense": 14,
                "spAttack": 13,
                "spDefense": 15
            },
            "deleted": false,
            "formEpoch": "81c934d5-c855-4dd1-b933-e84394a448ae",
            "pokemonId": "0c62f031-bb5d-4297-b901-b5becd764d6d",
            "speciesId": 21,
            "recordedAt": "2026-10-13T15:48:00.000Z"
        },
        "c5e8be40-e95d-497c-a5d7-37030e62b108": {
            "id": "c5e8be40-e95d-497c-a5d7-37030e62b108",
            "level": 9,
            "stats": {
                "hp": 27,
                "speed": 18,
                "attack": 16,
                "defense": 13,
                "spAttack": 12,
                "spDefense": 14
            },
            "deleted": false,
            "formEpoch": "81c934d5-c855-4dd1-b933-e84394a448ae",
            "pokemonId": "0c62f031-bb5d-4297-b901-b5becd764d6d",
            "speciesId": 21,
            "recordedAt": "2026-10-13T13:22:00.000Z"
        },
        "c9f0746f-2758-4b42-8484-03dc82ce4307": {
            "id": "c9f0746f-2758-4b42-8484-03dc82ce4307",
            "level": 11,
            "stats": {
                "hp": 34,
                "speed": 15,
                "attack": 19,
                "defense": 14,
                "spAttack": 21,
                "spDefense": 18
            },
            "deleted": false,
            "formEpoch": "7d0e73c1-8490-40e2-aaa8-19f5d3694ca0",
            "pokemonId": "857c006e-4c1d-4cf6-b93a-f3a8b728ee7c",
            "speciesId": 255,
            "recordedAt": "2026-10-13T13:20:00.000Z"
        },
        "d2961e3f-acc6-428a-a596-c6de975b4ad2": {
            "id": "d2961e3f-acc6-428a-a596-c6de975b4ad2",
            "level": 8,
            "stats": {
                "hp": 24,
                "speed": 16,
                "attack": 12,
                "defense": 12,
                "spAttack": 10,
                "spDefense": 12
            },
            "deleted": false,
            "formEpoch": "eaf8729c-89c3-4992-a8cd-7376f547c3be",
            "pokemonId": "ca076593-e044-4df4-a5fa-713abdd38361",
            "speciesId": 16,
            "recordedAt": "2026-10-13T13:22:00.000Z"
        },
        "e8fca040-0172-4cd2-8f18-c1f60a64eeeb": {
            "id": "e8fca040-0172-4cd2-8f18-c1f60a64eeeb",
            "level": 9,
            "stats": {
                "hp": 26,
                "speed": 20,
                "attack": 18,
                "defense": 10,
                "spAttack": 9,
                "spDefense": 12
            },
            "deleted": false,
            "formEpoch": "e5c03e4d-be0e-4b26-95ba-25294815f278",
            "pokemonId": "e20a95fc-5b25-45ec-8f70-cfd063bcfddb",
            "speciesId": 276,
            "recordedAt": "2026-10-13T13:23:00.000Z"
        }
    },
    "playthroughs": {
        "48e2343a-a4d1-41d0-afa5-984d7a5cea57": {
            "id": "48e2343a-a4d1-41d0-afa5-984d7a5cea57",
            "name": "Můj průchod Emerald",
            "party": [
                "857c006e-4c1d-4cf6-b93a-f3a8b728ee7c",
                "03bfaf88-41ec-4723-b985-dc357a6b043d",
                "0c62f031-bb5d-4297-b901-b5becd764d6d",
                "ca076593-e044-4df4-a5fa-713abdd38361",
                "e20a95fc-5b25-45ec-8f70-cfd063bcfddb",
                "28d7ea85-aed7-44d2-8c83-57e980be0a2e"
            ],
            "deleted": false
        }
    }
}', '2026-10-13 15:48:29'
FROM emerald_ex_collection_users AS u
WHERE u.google_subject = '104987973817476742817'
ON DUPLICATE KEY UPDATE
    revision = GREATEST(emerald_ex_collections.revision + 1, VALUES(revision)),
    document = VALUES(document),
    updated_at = VALUES(updated_at);

COMMIT;
SET time_zone = @collection_seed_previous_time_zone;
