import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { emptyCollection, type CollectionDocument } from '@pokemon-emerald-ex-dex/shared';

import { createApp } from '../src/app.js';
import type {
    CollectionSession,
    CollectionSnapshot,
    CollectionStore,
} from '../src/collectionRepository.js';
import { HttpError } from '../src/httpError.js';
import { hashSession } from '../src/routes/collectionRouter.js';
import { startTestServer } from './httpTestServer.js';

function memoryStore(): CollectionStore {
    const sessions = new Map<string, CollectionSession>();
    const collections = new Map<string, CollectionSnapshot>();
    return {
        signIn(identity, tokenHash, csrfToken) {
            const user = { id: identity.subject, name: identity.name, email: identity.email };
            sessions.set(tokenHash, { user, csrfToken });
            if (!collections.has(user.id))
                collections.set(user.id, { revision: 0, document: emptyCollection() });
            return Promise.resolve(user);
        },
        session: (tokenHash) => Promise.resolve(sessions.get(tokenHash) ?? null),
        signOut(tokenHash) {
            sessions.delete(tokenHash);
            return Promise.resolve();
        },
        read(userId) {
            return Promise.resolve(structuredClone(collections.get(userId)!));
        },
        write(userId, revision, document) {
            if (collections.get(userId)?.revision !== revision) return Promise.resolve(false);
            collections.set(userId, {
                revision: revision + 1,
                document: structuredClone(document),
            });
            return Promise.resolve(true);
        },
    };
}

interface SessionResponse {
    data: {
        user: { id: string; name: string; email: string } | null;
        csrfToken: string;
        nonce?: string;
    };
}

void test('collection auth, CSRF, account isolation, strict validation and concurrent revision rejection', async (t) => {
    const origin = 'http://localhost:5173';
    let verifications = 0;
    const store = memoryStore();
    const server = await startTestServer(
        createApp(undefined, {
            store,
            googleClientId: 'example-client',
            allowedOrigins: [origin],
            secureCookies: true,
            verifyIdentity(credential, nonce) {
                verifications++;
                strictEqual(nonce.length, 64);
                if (!['alice', 'bob'].includes(credential))
                    return Promise.reject(new HttpError(401, 'invalid_credential', 'Rejected'));
                return Promise.resolve({
                    subject: credential,
                    name: credential,
                    email: `${credential}@example.com`,
                });
            },
        }),
    );
    t.after(server.close);
    const url = `${server.url}/api/v1/collection`;
    const request = (path = '', options: RequestInit = {}) => fetch(url + path, options);
    strictEqual((await request()).status, 401);
    const config = await request('/config');
    strictEqual(config.headers.get('cache-control'), 'no-store');
    deepStrictEqual(await config.json(), { data: { googleClientId: 'example-client' } });
    async function signIn(name: string) {
        const challenge = await request('/session');
        const challengeCookie = challenge.headers.getSetCookie()[0].split(';')[0];
        const challengeBody = (await challenge.json()) as SessionResponse;
        strictEqual(challengeBody.data.nonce, challengeBody.data.csrfToken);
        const headers = {
            Origin: origin,
            'Content-Type': 'application/json',
            Cookie: challengeCookie,
            'X-CSRF-Token': challengeBody.data.csrfToken,
        };
        if (name === 'alice') {
            const badOrigin = await request('/session', {
                method: 'POST',
                headers: { ...headers, Origin: 'https://evil.example' },
                body: JSON.stringify({ credential: name }),
            });
            strictEqual(badOrigin.status, 403);
            strictEqual(verifications, 0);
            const noCsrf = await request('/session', {
                method: 'POST',
                headers: { ...headers, 'X-CSRF-Token': '' },
                body: JSON.stringify({ credential: name }),
            });
            strictEqual(noCsrf.status, 403);
            strictEqual(verifications, 0);
            const invalid = await request('/session', {
                method: 'POST',
                headers,
                body: JSON.stringify({ credential: 'invalid' }),
            });
            strictEqual(invalid.status, 401);
        }
        const login = await request('/session', {
            method: 'POST',
            headers,
            body: JSON.stringify({ credential: name }),
        });
        strictEqual(login.status, 200);
        const body = (await login.json()) as SessionResponse;
        const sessionHeader = login.headers
            .getSetCookie()
            .find((value) => value.startsWith('emerald_collection_session='))!;
        strictEqual(sessionHeader.includes('HttpOnly'), true);
        strictEqual(sessionHeader.includes('Secure'), true);
        strictEqual(sessionHeader.includes('SameSite=Lax'), true);
        const cookie = sessionHeader.split(';')[0];
        const token = cookie.split('=')[1];
        strictEqual(
            await store.session(token),
            null,
            'database stores a hash, not the cookie secret',
        );
        strictEqual((await store.session(hashSession(token)))?.user.id, name);
        return {
            Origin: origin,
            'Content-Type': 'application/json',
            Cookie: cookie,
            'X-CSRF-Token': body.data.csrfToken,
        };
    }
    const alice = await signIn('alice');
    const bob = await signIn('bob');
    const document: CollectionDocument = {
        ...emptyCollection(),
        playthroughs: { run: { id: 'run', name: 'Emerald', party: [], deleted: false } },
    };
    const write = (headers: Record<string, string>, body: unknown) =>
        request('', { method: 'PUT', headers, body: JSON.stringify(body) });
    strictEqual(
        (await write({ ...alice, 'X-CSRF-Token': '' }, { revision: 0, document })).status,
        403,
    );
    strictEqual((await write(alice, { revision: 0, document, userId: 'bob' })).status, 400);
    strictEqual(
        (await write(alice, { revision: 0, document: { ...document, pokemon: [] } })).status,
        400,
    );
    strictEqual((await write(alice, { revision: -1, document })).status, 400);
    strictEqual((await write(alice, { revision: 0, document })).status, 200);
    const stale = await write(alice, { revision: 0, document: emptyCollection() });
    strictEqual(stale.status, 409);
    const conflict = (await stale.json()) as { data: CollectionSnapshot };
    deepStrictEqual(conflict.data, { userId: 'alice', revision: 1, document });
    deepStrictEqual(await (await request('', { headers: bob })).json(), {
        data: { userId: 'bob', revision: 0, document: emptyCollection() },
    });
    deepStrictEqual(await (await request('', { headers: alice })).json(), {
        data: { userId: 'alice', revision: 1, document },
    });
    strictEqual((await request('', { method: 'PUT', headers: alice, body: '{' })).status, 400);
    strictEqual(
        (
            await request('', {
                method: 'PUT',
                headers: alice,
                body: JSON.stringify({ padding: 'x'.repeat(5 * 1024 * 1024) }),
            })
        ).status,
        413,
    );
    strictEqual(
        (
            await request('/session', {
                method: 'DELETE',
                headers: { ...alice, Origin: 'https://evil.example' },
            })
        ).status,
        403,
    );
    strictEqual((await request('/session', { method: 'DELETE', headers: alice })).status, 200);
    strictEqual((await request('', { headers: alice })).status, 401);
    strictEqual((await request('', { headers: bob })).status, 200);
});
