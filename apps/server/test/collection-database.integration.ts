import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { emptyCollection, type CollectionDocument } from '@pokemon-emerald-ex-dex/shared';
import { createPool } from 'mariadb';

import { createApp } from '../src/app.js';
import { CollectionRepository, type CollectionSnapshot } from '../src/collectionRepository.js';
import { databaseConfig } from '../src/database.js';
import { hashSession } from '../src/routes/collectionRouter.js';
import { startTestServer } from './httpTestServer.js';
import { startPhpTestServer } from './phpTestServer.js';

// Explicit integration check. Only synthetic users are written and removed.
// Requires the local database with migration 022 and PHP 8.4; no live Google credentials.
void test('MySQL persists isolated collections and shares atomic revisions/sessions between Node and PHP', async (t) => {
    const config = databaseConfig();
    strictEqual(
        ['localhost', '127.0.0.1', '::1'].includes(String(config.host)),
        true,
        'Collection integration tests require a local DB_HOST',
    );
    const pool = createPool({ ...config, allowPublicKeyRetrieval: true });
    const repository = new CollectionRepository(pool);
    const users: string[] = [];
    t.after(async () => {
        try {
            for (const id of users)
                await pool.execute('DELETE FROM emerald_ex_collection_users WHERE user_id = ?', [
                    id,
                ]);
        } finally {
            await pool.end();
        }
    });
    const origin = 'http://localhost:5173';
    const tokenA = randomBytes(32).toString('hex');
    const tokenB = randomBytes(32).toString('hex');
    const csrfA = randomBytes(32).toString('hex');
    const csrfB = randomBytes(32).toString('hex');
    const identityA = {
        subject: `integration-${randomUUID()}`,
        name: 'Collection test A',
        email: 'test-a@example.invalid',
    };
    const identityB = {
        subject: `integration-${randomUUID()}`,
        name: 'Collection test B',
        email: 'test-b@example.invalid',
    };
    const expires = new Date(Date.now() + 3600000);
    const userA = await repository.signIn(identityA, hashSession(tokenA), csrfA, expires);
    users.push(userA.id);
    const userB = await repository.signIn(identityB, hashSession(tokenB), csrfB, expires);
    users.push(userB.id);
    const node = await startTestServer(
        createApp(undefined, {
            store: repository,
            googleClientId: 'integration-only',
            allowedOrigins: [origin],
            secureCookies: false,
            verifyIdentity: () => Promise.reject(new Error('No live Google calls in this test')),
        }),
    );
    t.after(node.close);
    const directory = await mkdtemp(join(tmpdir(), 'emerald-collection-php-'));
    strictEqual(dirname(directory), resolve(tmpdir()));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await cp(new URL('../php/', import.meta.url), join(directory, 'api'), {
        recursive: true,
        filter: (path) => !path.endsWith('config.local.php'),
    });
    const php = await startPhpTestServer(directory, {
        ...process.env,
        DB_HOST: String(config.host),
        DB_PORT: String(config.port ?? 3306),
        DB_NAME: String(config.database),
        DB_USER: String(config.user),
        DB_PASS: String(config.password ?? ''),
        GOOGLE_CLIENT_ID: 'integration-only',
        COLLECTION_ALLOWED_ORIGINS: origin,
        COLLECTION_COOKIE_SECURE: 'false',
    });
    t.after(php.close);
    const headersA = {
        Cookie: `emerald_collection_session=${tokenA}`,
        Origin: origin,
        'X-CSRF-Token': csrfA,
        'Content-Type': 'application/json',
    };
    const headersB = {
        ...headersA,
        Cookie: `emerald_collection_session=${tokenB}`,
        'X-CSRF-Token': csrfB,
    };
    const nodeUrl = `${node.url}/api/v1/collection`;
    const phpUrl = `${php.url}/v1/collection`;
    for (const base of [nodeUrl, phpUrl]) {
        const response = await fetch(`${base}/session`, { headers: headersA });
        strictEqual(response.status, 200);
        deepStrictEqual(await response.json(), { data: { user: userA, csrfToken: csrfA } });
        const unauthorized = await fetch(base);
        strictEqual(unauthorized.status, 401);
        await unauthorized.text();
    }
    const document: CollectionDocument = {
        ...emptyCollection(),
        playthroughs: { run: { id: 'run', name: 'Synthetic run', party: [], deleted: false } },
    };
    const concurrent = await Promise.all([
        repository.write(userA.id, 0, document),
        repository.write(userA.id, 0, emptyCollection()),
    ]);
    strictEqual(
        concurrent.filter(Boolean).length,
        1,
        'only one update may match the same stored revision',
    );
    const current = await repository.read(userA.id);
    strictEqual(current.revision, 1);
    const phpRead = await fetch(phpUrl, { headers: headersA });
    deepStrictEqual(await phpRead.json(), { data: { ...current, userId: userA.id } });
    const phpWrite = await fetch(phpUrl, {
        method: 'PUT',
        headers: headersA,
        body: JSON.stringify({ revision: 1, document }),
    });
    strictEqual(phpWrite.status, 200);
    deepStrictEqual(await phpWrite.json(), { data: { userId: userA.id, revision: 2, document } });
    deepStrictEqual(await repository.read(userA.id), { revision: 2, document });
    for (const base of [nodeUrl, phpUrl]) {
        const stale = await fetch(base, {
            method: 'PUT',
            headers: headersA,
            body: JSON.stringify({ revision: 1, document: emptyCollection() }),
        });
        strictEqual(stale.status, 409);
        deepStrictEqual(((await stale.json()) as { data: CollectionSnapshot }).data, {
            userId: userA.id,
            revision: 2,
            document,
        });
        const isolated = await fetch(base, { headers: headersB });
        deepStrictEqual(await isolated.json(), {
            data: { userId: userB.id, revision: 0, document: emptyCollection() },
        });
        const invalid = await fetch(base, {
            method: 'PUT',
            headers: headersA,
            body: JSON.stringify({ revision: 2, document, userId: userB.id }),
        });
        strictEqual(invalid.status, 400);
        await invalid.text();
    }
    await pool.execute(
        'UPDATE emerald_ex_collection_sessions SET expires_at = ? WHERE token_hash = ?',
        ['2000-01-01 00:00:00', hashSession(tokenB)],
    );
    strictEqual(await repository.session(hashSession(tokenB)), null);
    const expired = await fetch(phpUrl, { headers: headersB });
    strictEqual(expired.status, 401);
    await expired.text();
    const logout = await fetch(`${phpUrl}/session`, { method: 'DELETE', headers: headersA });
    strictEqual(logout.status, 200);
    await logout.text();
    strictEqual(await repository.session(hashSession(tokenA)), null);
});
