import { deepStrictEqual, strictEqual, rejects } from 'node:assert/strict';
import { test } from 'node:test';
import {
    emptyCollection,
    type CollectionDocument,
    type OwnedPokemon,
} from '@pokemon-emerald-ex-dex/shared';
import {
    CollectionEngine,
    CollectionHttpError,
    importGuestCollection,
    initialCollectionPersistence,
    prepareCollectionSync,
    sameCollectionValue,
    type CollectionPartition,
    type CollectionPersistence,
    type CollectionSession,
    type CollectionStorage,
    type CollectionTransport,
    type RemoteCollection,
} from './collectionSync.js';

const user = { id: 'user-a', name: 'Trainer', email: 'trainer@example.test' };
const now = '2026-10-12T12:00:00.000Z';
function owned(id: string): OwnedPokemon {
    return {
        id,
        playthroughId: 'run',
        nickname: '',
        state: { speciesId: 1, level: 24, moves: null, formEpoch: 'epoch' },
        deleted: false,
        createdAt: now,
    };
}
function fixture(): CollectionDocument {
    return {
        version: 1,
        playthroughs: { run: { id: 'run', name: 'Emerald', party: ['one'], deleted: false } },
        pokemon: { one: owned('one'), two: owned('two') },
        observations: {},
    };
}
function saved(document = fixture()): CollectionPersistence {
    const value = initialCollectionPersistence();
    value.activeOwner = `account:${user.id}`;
    value.partitions[value.activeOwner] = {
        user,
        document: structuredClone(document),
        base: structuredClone(document),
        revision: 1,
        conflicts: [],
    };
    return value;
}
function memory(initial: CollectionPersistence): CollectionStorage {
    let value = structuredClone(initial);
    return {
        read: () => Promise.resolve(structuredClone(value)),
        change: (update) => {
            value = update(structuredClone(value));
            return Promise.resolve(structuredClone(value));
        },
    };
}
function transport(initial = fixture()) {
    let remote: RemoteCollection = {
        userId: user.id,
        revision: 1,
        document: structuredClone(initial),
    };
    let loggedIn = true;
    let writes = 0;
    const api: CollectionTransport = {
        config: () => Promise.resolve({ googleClientId: 'client' }),
        session: () =>
            Promise.resolve({ user: loggedIn ? user : null, csrfToken: 'csrf', nonce: 'nonce' }),
        login: () => {
            loggedIn = true;
            return Promise.resolve({ user, csrfToken: 'csrf' });
        },
        logout: () => {
            loggedIn = false;
            return Promise.resolve();
        },
        get: () => Promise.resolve(structuredClone(remote)),
        put: (next) => {
            if (next.revision !== remote.revision)
                return Promise.reject(new CollectionHttpError(409, 'Conflict'));
            remote = {
                userId: user.id,
                revision: remote.revision + 1,
                document: structuredClone(next.document),
            };
            writes++;
            return Promise.resolve(structuredClone(remote));
        },
    };
    return {
        api,
        remote: () => structuredClone(remote),
        change: (update: (doc: CollectionDocument) => void) => {
            update(remote.document);
            remote.revision++;
        },
        writes: () => writes,
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function accountTransport() {
    const otherUser = { id: 'user-b', name: 'Other trainer', email: 'other@example.test' };
    let currentUser = user;
    const otherDocument = fixture();
    otherDocument.pokemon.one.nickname = 'Account B';
    const documents = new Map<string, RemoteCollection>([
        [user.id, { userId: user.id, revision: 1, document: fixture() }],
        [otherUser.id, { userId: otherUser.id, revision: 1, document: otherDocument }],
    ]);
    const writes: { userId: string; csrf: string; document: CollectionDocument }[] = [];
    const session = (): CollectionSession => ({
        user: currentUser,
        csrfToken: `csrf-${currentUser.id}`,
    });
    const api: CollectionTransport = {
        config: () => Promise.resolve({ googleClientId: 'client' }),
        session: () => Promise.resolve(session()),
        login: () => {
            currentUser = otherUser;
            return Promise.resolve(session());
        },
        logout: () => Promise.resolve(),
        get: () => Promise.resolve(structuredClone(documents.get(currentUser.id)!)),
        put: (next, csrf) => {
            if (csrf !== `csrf-${currentUser.id}`)
                return Promise.reject(new CollectionHttpError(403, 'Wrong account CSRF'));
            const previous = documents.get(currentUser.id)!;
            if (previous.revision !== next.revision)
                return Promise.reject(new CollectionHttpError(409, 'Conflict'));
            const updated = {
                userId: currentUser.id,
                revision: previous.revision + 1,
                document: structuredClone(next.document),
            };
            documents.set(currentUser.id, updated);
            writes.push({ userId: currentUser.id, csrf, document: updated.document });
            return Promise.resolve(structuredClone(updated));
        },
    };
    return { api, documents, writes, otherUser };
}

function switchedTo(engine: CollectionEngine, userId: string): Promise<void> {
    if (engine.getSnapshot().user?.id === userId) return Promise.resolve();
    return new Promise((resolve) => {
        const unsubscribe = engine.subscribe(() => {
            if (engine.getSnapshot().user?.id === userId) {
                unsubscribe();
                resolve();
            }
        });
    });
}

void test('a repeated sync preserves an unresolved local level and only uploads compatible edits', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.one.state.level = 23;
    local.pokemon.two.nickname = 'Leaf';
    remote.pokemon.one.state.level = 26;
    const state: CollectionPartition = { user, document: local, base, revision: 1, conflicts: [] };
    const first = prepareCollectionSync(state, { revision: 2, document: remote });
    strictEqual(first.conflicts.length, 1);
    strictEqual(first.document.pokemon.one.state.level, 23);
    strictEqual(first.upload.pokemon.one.state.level, 26);
    strictEqual(first.upload.pokemon.two.nickname, 'Leaf');
    const again = prepareCollectionSync(
        { ...state, document: first.document, base: first.upload, conflicts: first.conflicts },
        { revision: 3, document: first.upload },
    );
    strictEqual(again.conflicts.length, 1);
    strictEqual(again.upload.pokemon.one.state.level, 26);
    strictEqual(again.document.pokemon.one.state.level, 23);
});

void test('new cloud values update conflict alternatives without replacing local edits', () => {
    const base = fixture();
    const local = structuredClone(base);
    local.pokemon.one.state.level = 23;
    const remote = structuredClone(base);
    remote.pokemon.one.state.level = 26;
    const first = prepareCollectionSync(
        { user, base, document: local, revision: 1, conflicts: [] },
        { revision: 2, document: remote },
    );
    remote.pokemon.one.state.level = 28;
    const next = prepareCollectionSync(
        {
            user,
            base: first.upload,
            document: first.document,
            revision: 2,
            conflicts: first.conflicts,
        },
        { revision: 3, document: remote },
    );
    strictEqual(next.document.pokemon.one.state.level, 23);
    strictEqual(next.upload.pokemon.one.state.level, 28);
});

void test('guest import keeps same-named runs and remaps actual identity collisions', () => {
    const first = fixture();
    const second = fixture();
    second.pokemon.one.nickname = 'Independent';
    let next = 0;
    const imported = importGuestCollection(first, second, () => `new-${++next}`);
    strictEqual(Object.keys(imported.playthroughs).length, 2);
    strictEqual(Object.keys(imported.pokemon).length, 4);
    strictEqual(imported.pokemon.one.nickname, '');
    const guest = Object.values(imported.pokemon).find(
        (entry) => entry.nickname === 'Independent',
    )!;
    strictEqual(imported.playthroughs[guest.playthroughId].party.includes(guest.id), true);
});

void test('an edit made during an upload is rebased and sent without losing either value', async () => {
    const store = memory(saved());
    const server = transport();
    let allowUpload: (() => void) | undefined;
    let uploadStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
        uploadStarted = resolve;
    });
    const original = server.api.put.bind(server.api);
    let blockOnce = true;
    server.api.put = async (value, csrf) => {
        if (blockOnce) {
            blockOnce = false;
            uploadStarted!();
            await new Promise<void>((resolve) => {
                allowUpload = resolve;
            });
        }
        return original(value, csrf);
    };
    const engine = new CollectionEngine(
        store,
        server.api,
        () => true,
        () => 'new',
    );
    await engine.initialize();
    await engine.update((doc) => {
        doc.pokemon.one.nickname = 'Sprout';
        return doc;
    });
    await started;
    await engine.update((doc) => {
        doc.pokemon.two.state.level = 30;
        return doc;
    });
    allowUpload!();
    await engine.sync();
    strictEqual(server.remote().document.pokemon.one.nickname, 'Sprout');
    strictEqual(server.remote().document.pokemon.two.state.level, 30);
    strictEqual(engine.getSnapshot().status, 'synced');
});

void test('stale writes retry against latest server state and merge independent changes', async () => {
    const store = memory(saved());
    const server = transport();
    const original = server.api.put.bind(server.api);
    let raceOnce = true;
    server.api.put = (value, csrf) => {
        if (raceOnce) {
            raceOnce = false;
            server.change((doc) => {
                doc.pokemon.two.nickname = 'Remote';
            });
        }
        return original(value, csrf);
    };
    const engine = new CollectionEngine(
        store,
        server.api,
        () => true,
        () => 'new',
    );
    await engine.initialize();
    await engine.update((doc) => {
        doc.pokemon.one.nickname = 'Local';
        return doc;
    });
    await engine.sync();
    strictEqual(server.remote().document.pokemon.one.nickname, 'Local');
    strictEqual(server.remote().document.pokemon.two.nickname, 'Remote');
});

void test('offline edits survive restart, conflicts survive sync, and explicit choice releases them', async () => {
    const store = memory(saved());
    const server = transport();
    let online = false;
    const engine = new CollectionEngine(
        store,
        server.api,
        () => online,
        () => 'new',
    );
    await engine.initialize();
    await engine.update((doc) => {
        doc.pokemon.one.state.level = 23;
        return doc;
    });
    strictEqual(server.writes(), 0);
    server.change((doc) => {
        doc.pokemon.one.state.level = 26;
    });
    online = true;
    const restarted = new CollectionEngine(
        store,
        server.api,
        () => online,
        () => 'new',
    );
    await restarted.initialize();
    strictEqual(restarted.getSnapshot().conflicts.length, 1);
    await restarted.sync();
    strictEqual(server.remote().document.pokemon.one.state.level, 26);
    await restarted.resolve(restarted.getSnapshot().conflicts[0].id, 'local');
    await restarted.sync();
    strictEqual(server.remote().document.pokemon.one.state.level, 23);
    strictEqual(restarted.getSnapshot().conflicts.length, 0);
});

void test('signing out never turns account data into guest data or reuploads guest runs', async () => {
    const initial = initialCollectionPersistence();
    initial.partitions.guest.document = fixture();
    const store = memory(initial);
    const server = transport(emptyCollection());
    const engine = new CollectionEngine(
        store,
        server.api,
        () => true,
        () => 'new',
    );
    await engine.initialize();
    strictEqual(Object.keys(server.remote().document.playthroughs).length, 1);
    await engine.logout();
    deepStrictEqual(engine.getSnapshot().document, emptyCollection());
    const after = await store.read();
    strictEqual(Object.keys(after!.partitions['account:user-a'].document.playthroughs).length, 1);
    await engine.login('credential');
    strictEqual(Object.keys(server.remote().document.playthroughs).length, 1);
});

void test('failed local persistence is reported and cannot masquerade as a saved edit', async () => {
    const store = memory(saved());
    const server = transport();
    const engine = new CollectionEngine(
        store,
        server.api,
        () => false,
        () => 'new',
    );
    await engine.initialize();
    store.change = () => Promise.reject(new Error('Storage full'));
    await rejects(
        engine.update((doc) => {
            doc.pokemon.one.nickname = 'Unsaved';
            return doc;
        }),
        /Storage full/,
    );
    strictEqual(engine.getSnapshot().document.pokemon.one.nickname, '');
    strictEqual(engine.getSnapshot().error, 'Storage full');
});

void test('document equality ignores object insertion order but respects party order', () => {
    strictEqual(sameCollectionValue({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
    strictEqual(sameCollectionValue(['a', 'b'], ['b', 'a']), false);
});

void test(
    'a stale collection GET cannot upload account A edits with account B credentials',
    { timeout: 3000 },
    async () => {
        const store = memory(saved());
        const server = accountTransport();
        const engine = new CollectionEngine(
            store,
            server.api,
            () => true,
            () => 'new',
        );
        await engine.initialize();
        const receivedGet = deferred<void>();
        const finishGet = deferred<RemoteCollection>();
        const originalGet = server.api.get.bind(server.api);
        let blockOnce = true;
        server.api.get = () => {
            if (!blockOnce) return originalGet();
            blockOnce = false;
            receivedGet.resolve();
            return finishGet.promise;
        };
        await engine.update((document) => {
            document.pokemon.one.nickname = 'Private account A edit';
            return document;
        });
        await receivedGet.promise;
        const changedAccount = switchedTo(engine, server.otherUser.id);
        const login = engine.login('account-b-credential');
        await changedAccount;
        finishGet.resolve(structuredClone(server.documents.get(user.id)!));
        await login;
        await engine.sync();
        deepStrictEqual(
            server.writes,
            [],
            'old sync must not use a newer account cookie and CSRF token',
        );
        strictEqual(
            server.documents.get(server.otherUser.id)!.document.pokemon.one.nickname,
            'Account B',
        );
        strictEqual(
            (await store.read())!.partitions[`account:${user.id}`].document.pokemon.one.nickname,
            'Private account A edit',
        );
        strictEqual(engine.getSnapshot().user?.id, server.otherUser.id);
        strictEqual(engine.getSnapshot().needsSignIn, false);
        strictEqual(engine.getSnapshot().status, 'synced');
    },
);

void test(
    'stale 401 session recovery cannot reselect a previous account after a new login',
    { timeout: 3000 },
    async () => {
        const store = memory(saved());
        const server = accountTransport();
        const engine = new CollectionEngine(
            store,
            server.api,
            () => true,
            () => 'new',
        );
        await engine.initialize();
        const requestedRecovery = deferred<void>();
        const finishRecovery = deferred<CollectionSession>();
        const originalGet = server.api.get.bind(server.api);
        const originalSession = server.api.session.bind(server.api);
        let rejectOnce = true;
        let recoverOnce = true;
        server.api.get = () => {
            if (!rejectOnce) return originalGet();
            rejectOnce = false;
            return Promise.reject(new CollectionHttpError(401, 'Expired'));
        };
        server.api.session = () => {
            if (!recoverOnce) return originalSession();
            recoverOnce = false;
            requestedRecovery.resolve();
            return finishRecovery.promise;
        };
        const oldSync = engine.sync();
        await requestedRecovery.promise;
        const changedAccount = switchedTo(engine, server.otherUser.id);
        const login = engine.login('account-b-credential');
        await changedAccount;
        finishRecovery.resolve({ user, csrfToken: `csrf-${user.id}` });
        await Promise.all([oldSync, login]);
        await engine.sync();
        strictEqual((await store.read())!.activeOwner, `account:${server.otherUser.id}`);
        strictEqual(engine.getSnapshot().user?.id, server.otherUser.id);
        strictEqual(engine.getSnapshot().needsSignIn, false);
        strictEqual(engine.getSnapshot().error, null);
        deepStrictEqual(server.writes, []);
    },
);

void test('signing out an expired session returns to guest use and retains pending account edits', async () => {
    const store = memory(saved());
    const server = transport();
    let online = true;
    const engine = new CollectionEngine(
        store,
        server.api,
        () => online,
        () => 'new',
    );
    await engine.initialize();
    online = false;
    await engine.update((document) => {
        document.pokemon.one.nickname = 'Pending account edit';
        return document;
    });
    online = true;
    server.api.logout = () => Promise.reject(new CollectionHttpError(401, 'Session expired'));
    server.api.session = () =>
        Promise.resolve({ user: null, csrfToken: 'guest-csrf', nonce: 'guest-nonce' });
    await engine.logout();
    const state = (await store.read())!;
    strictEqual(state.activeOwner, 'guest');
    strictEqual(engine.getSnapshot().user, null);
    strictEqual(engine.getSnapshot().status, 'local');
    strictEqual(engine.getSnapshot().error, null);
    strictEqual(
        state.partitions[`account:${user.id}`].document.pokemon.one.nickname,
        'Pending account edit',
    );
    deepStrictEqual(state.partitions.guest.document, emptyCollection());
    strictEqual(server.writes(), 0);
});

void test('unresolved deletion and lineup conflicts preserve the complete remote party during upload', () => {
    const base = fixture();
    base.pokemon.three = owned('three');
    base.playthroughs.run.party = ['one', 'two'];
    const local = structuredClone(base);
    local.pokemon.one.deleted = true;
    local.playthroughs.run.party = ['two'];
    const remote = structuredClone(base);
    remote.pokemon.one.nickname = 'Remote edit';
    remote.playthroughs.run.party = ['one', 'three'];
    const first = prepareCollectionSync(
        { user, document: local, base, revision: 1, conflicts: [] },
        { userId: user.id, revision: 2, document: remote },
    );
    strictEqual(
        first.conflicts.some((conflict) => conflict.kind === 'party'),
        true,
    );
    strictEqual(
        first.conflicts.some((conflict) => conflict.kind === 'delete-edit'),
        true,
    );
    deepStrictEqual(first.upload.playthroughs.run.party, ['one', 'three']);
    strictEqual(first.upload.pokemon.one.deleted, false);
    strictEqual(first.document.pokemon.one.deleted, true);
    const next = prepareCollectionSync(
        {
            user,
            document: first.document,
            base: first.upload,
            revision: 2,
            conflicts: first.conflicts,
        },
        { userId: user.id, revision: 2, document: first.upload },
    );
    deepStrictEqual(next.upload.playthroughs.run.party, ['one', 'three']);
    strictEqual(
        next.conflicts.some((conflict) => conflict.kind === 'party'),
        true,
    );
    strictEqual(
        next.conflicts.some((conflict) => conflict.kind === 'delete-edit'),
        true,
    );
});
