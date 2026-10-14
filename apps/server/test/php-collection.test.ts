import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    emptyCollection,
    validateCollectionDocument,
    type CollectionDocument,
} from '@pokemon-emerald-ex-dex/shared';

const php = process.env.PHP_BINARY || 'php';
const probe = spawnSync(php, ['-r', 'echo PHP_VERSION_ID;'], {
    encoding: 'utf8',
    windowsHide: true,
});

void test(
    'PHP verifies actual RSA credentials and matches shared collection validation',
    { skip: probe.status !== 0 || Number(probe.stdout) < 80400 ? 'Requires PHP 8.4 CLI' : false },
    () => {
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const claims = {
            sub: 'google-subject',
            aud: 'our-client',
            iss: 'https://accounts.google.com',
            iat: 1699999990,
            exp: 1700003600,
            nonce: 'our-nonce',
        };
        function token(change: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
            const data = [
                { alg: 'RS256', kid: 'test-key', ...header },
                { ...claims, ...change },
            ]
                .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
                .join('.');
            return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
        }
        const document: CollectionDocument = {
            version: 1,
            playthroughs: { run: { id: 'run', name: 'Emerald', party: ['owned'], deleted: false } },
            pokemon: {
                owned: {
                    id: 'owned',
                    playthroughId: 'run',
                    nickname: 'Buddy',
                    state: { speciesId: 1, level: 5, formEpoch: 'epoch', moves: null },
                    deleted: false,
                    createdAt: '2026-10-12T12:00:00.000Z',
                },
            },
            observations: {
                obs: {
                    id: 'obs',
                    pokemonId: 'owned',
                    speciesId: 1,
                    level: 5,
                    formEpoch: 'epoch',
                    recordedAt: '2026-10-12T12:00:00.000Z',
                    stats: { hp: 20, spAttack: 15 },
                    deleted: false,
                },
            },
        };
        const documents: unknown[] = [
            emptyCollection(),
            document,
            [],
            { ...emptyCollection(), pokemon: [] },
            { ...document, userId: 'intruder' },
        ];
        function changed(change: (value: CollectionDocument) => void) {
            const value = structuredClone(document);
            change(value);
            documents.push(value);
        }
        changed((value) => {
            value.pokemon.owned.state.level = 101;
        });
        changed((value) => {
            value.pokemon.owned.state.moves = [{ moveId: 10, name: 'Tackle' }];
        });
        changed((value) => {
            value.pokemon.owned.state.moves = [
                { moveId: 10, name: 'Tackle' },
                { moveId: 10, name: 'Tackle' },
            ];
        });
        changed((value) => {
            value.playthroughs.run.party = ['owned', 'owned'];
        });
        changed((value) => {
            value.playthroughs.run.party = ['unknown'];
        });
        changed((value) => {
            value.playthroughs.run.name = '';
        });
        changed((value) => {
            value.pokemon.owned.playthroughId = 'unknown';
        });
        changed((value) => {
            value.pokemon.owned.nickname = '😀'.repeat(21);
        });
        changed((value) => {
            value.pokemon.owned.createdAt = 'tomorrow';
        });
        changed((value) => {
            value.observations.obs.stats = {};
        });
        changed((value) => {
            value.observations.obs.stats.hp = 0;
        });
        changed((value) => {
            value.observations.obs.pokemonId = 'missing';
        });
        changed((value) => {
            value.pokemon.owned.deleted = true;
        });
        changed((value) => {
            value.playthroughs.run.deleted = true;
            value.pokemon.owned.deleted = true;
        });
        documents.push(
            JSON.parse(
                '{"version":1,"playthroughs":{"__proto__":{"id":"__proto__","name":"Bad","party":[],"deleted":false}},"pokemon":{},"observations":{}}',
            ),
        );
        const wishlist = {
            moves: Array.from({ length: 6 }, (_, index) => ({ moveId: index + 1, name: 'Move' })),
            learnedMoveIds: [1, 20],
            targetSpeciesId: null,
        };
        for (const moveWishlist of [
            wishlist,
            { ...wishlist, targetSpeciesId: 2 },
            null,
            {},
            { ...wishlist, extra: true },
            { ...wishlist, targetSpeciesId: 0 },
            { ...wishlist, moves: [...wishlist.moves, wishlist.moves[0]] },
            { ...wishlist, learnedMoveIds: [1, 1] },
            { ...wishlist, learnedMoveIds: [0] },
            { ...wishlist, moves: [{ moveId: 1, name: '' }] },
        ]) {
            documents.push({
                ...document,
                pokemon: {
                    owned: { ...document.pokemon.owned, moveWishlist },
                },
            });
        }
        const validToken = token();
        const parts = validToken.split('.');
        const tampered = `${parts[0]}.${Buffer.from(JSON.stringify({ ...claims, sub: 'intruder' })).toString('base64url')}.${parts[2]}`;
        const result = spawnSync(
            php,
            [fileURLToPath(new URL('./php-collection-validation.php', import.meta.url))],
            {
                encoding: 'utf8',
                windowsHide: true,
                input: JSON.stringify({
                    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
                    validToken,
                    invalidTokens: [
                        token({ iss: 'https://evil.example' }),
                        token({ exp: 1700000000 }),
                        token({ iat: 1700001000 }),
                        token({ sub: '' }),
                        token({ azp: 'other-app' }),
                        token({}, { alg: 'none' }),
                        token({}, { kid: 'missing' }),
                        tampered,
                        'malformed',
                    ],
                    documentJson: JSON.stringify(documents),
                }),
            },
        );
        strictEqual(result.status, 0, result.stdout + result.stderr);
        deepStrictEqual(JSON.parse(result.stdout), documents.map(validateCollectionDocument));
    },
);
