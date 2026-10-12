import { deepStrictEqual, equal, ok, rejects } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const scope = 'https://dex.example/pokemon-emerald-ex-dex/';
const files = ['assets/app-current.js', 'assets/app-current.css'];
const html =
    '<!doctype html><html><script src="/pokemon-emerald-ex-dex/assets/app-current.js"></script><link rel="stylesheet" href="/pokemon-emerald-ex-dex/assets/app-current.css"></html>';
const prefix = 'emerald-ex-shell:/pokemon-emerald-ex-dex/:';
const code = transpileModule(
    readFileSync(new URL('./collectionWorker.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } },
).outputText;

interface WorkerEvent {
    request?: Request;
    waitUntil?: (value: Promise<unknown>) => void;
    respondWith?: (value: Promise<Response> | Response) => void;
}

type CacheKey = Request | string;
const urlOf = (key: CacheKey): string => (typeof key === 'string' ? key : key.url);

/** Run the actual worker module with isolated, in-memory browser boundaries. */
function workerHarness() {
    let offline = false;
    let claimed = false;
    const requests: Request[] = [];
    const precacheRequests: Request[] = [];
    const openedCaches: string[] = [];
    const networkResponses = new Map<string, Response>();
    const listeners = new Map<string, (event: WorkerEvent) => void>();

    function fetchRequest(request: Request): Promise<Response> {
        requests.push(request);
        if (offline) return Promise.reject(new TypeError('Network is offline'));
        const configured = networkResponses.get(request.url);
        if (configured) return Promise.resolve(configured.clone());
        // A stale origin index must never become this build's cached offline shell.
        if (request.url === scope)
            return Promise.resolve(new Response('<script src="assets/app-old.js"></script>'));
        return Promise.resolve(new Response(`current asset: ${request.url}`));
    }

    class MemoryCache {
        private entries = new Map<string, { request: Request; response: Response }>();
        async addAll(entries: Request[]): Promise<void> {
            precacheRequests.push(...entries);
            const responses = await Promise.all(entries.map(fetchRequest));
            if (responses.some((response) => !response.ok)) throw new TypeError('Precache failed');
            for (const [index, request] of entries.entries())
                await this.put(request, responses[index]);
        }
        put(key: CacheKey, response: Response): Promise<void> {
            this.entries.set(urlOf(key), {
                request: typeof key === 'string' ? new Request(key) : key.clone(),
                response: response.clone(),
            });
            return Promise.resolve();
        }
        match(key: CacheKey, options: CacheQueryOptions = {}): Promise<Response | undefined> {
            const stored = this.entries.get(urlOf(key));
            if (!stored) return Promise.resolve(undefined);
            const request = typeof key === 'string' ? new Request(key) : key;
            const vary =
                stored.response.headers
                    .get('vary')
                    ?.split(',')
                    .map((name) => name.trim()) ?? [];
            if (
                !options.ignoreVary &&
                vary.some(
                    (name) =>
                        name === '*' ||
                        stored.request.headers.get(name) !== request.headers.get(name),
                )
            )
                return Promise.resolve(undefined);
            return Promise.resolve(stored.response.clone());
        }
        keys(): Promise<Request[]> {
            return Promise.resolve([...this.entries.keys()].map((url) => new Request(url)));
        }
        delete(key: CacheKey): Promise<boolean> {
            return Promise.resolve(this.entries.delete(urlOf(key)));
        }
    }
    const cacheMap = new Map<string, MemoryCache>();
    function cache(name: string): MemoryCache {
        let value = cacheMap.get(name);
        if (!value) {
            value = new MemoryCache();
            cacheMap.set(name, value);
        }
        return value;
    }
    runInNewContext(
        code,
        {
            __COLLECTION_PRECACHE__: files,
            __COLLECTION_BUILD__: 'current',
            __COLLECTION_HTML__: html,
            exports: {},
            URL,
            Request,
            Response,
            registration: { scope },
            clients: {
                claim: () => {
                    claimed = true;
                    return Promise.resolve();
                },
            },
            addEventListener: (name: string, listener: (event: WorkerEvent) => void) =>
                listeners.set(name, listener),
            fetch: fetchRequest,
            caches: {
                open: (name: string) => {
                    openedCaches.push(name);
                    return Promise.resolve(cache(name));
                },
                keys: () => Promise.resolve([...cacheMap.keys()]),
                delete: (name: string) => Promise.resolve(cacheMap.delete(name)),
            },
        },
        { filename: 'collectionWorker.js' },
    );

    return {
        requests,
        precacheRequests,
        openedCaches,
        cache,
        cacheMap,
        networkResponses,
        claimed: () => claimed,
        setOffline: () => {
            offline = true;
        },
        async dispatchLifecycle(name: 'install' | 'activate'): Promise<void> {
            const work: Promise<unknown>[] = [];
            const listener = listeners.get(name);
            ok(listener, `Worker registered ${name}`);
            listener({
                waitUntil: (promise) => {
                    work.push(promise);
                },
            });
            await Promise.all(work);
        },
        dispatchFetch(request: Request): Promise<Response> | undefined {
            let response: Promise<Response> | undefined;
            const listener = listeners.get('fetch');
            ok(listener, 'Worker registered fetch');
            listener({
                request,
                respondWith: (value) => {
                    response = Promise.resolve(value);
                },
            });
            return response;
        },
    };
}

function navigation(path: string): Request {
    const request = new Request(new URL(path, scope));
    // Node cannot construct mode:navigate; that mode is supplied by the browser.
    Object.defineProperty(request, 'mode', { value: 'navigate' });
    return request;
}

void test('worker installs injected HTML and reloads precisely its matching build assets', async () => {
    const worker = workerHarness();
    await worker.dispatchLifecycle('install');
    deepStrictEqual(
        worker.requests.map((request) => request.url),
        files.map((file) => new URL(file, scope).href),
    );
    ok(worker.precacheRequests.every((request) => request.cache === 'reload'));
    equal(
        worker.requests.some((request) => request.url === scope),
        false,
        'Install must not fetch a possibly stale index',
    );
    const shell = await worker.cache(`${prefix}current`).match(scope);
    ok(shell);
    equal(await shell.text(), html);
    equal(shell.headers.get('content-type'), 'text/html; charset=utf-8');
});

void test('offline navigation and asset requests return one consistent subpath build', async () => {
    const worker = workerHarness();
    for (const file of files) {
        const url = new URL(file, scope).href;
        worker.networkResponses.set(
            url,
            new Response(`current asset: ${url}`, { headers: { Vary: 'Origin' } }),
        );
    }
    await worker.cache(`${prefix}old`).put(scope, new Response('old HTML'));
    await worker
        .cache(`${prefix}images`)
        .put(new URL('api/icons/types/grass.svg', scope).href, new Response('cached icon'));
    await worker
        .cache('emerald-ex-shell:/another-app/:old')
        .put('https://dex.example/another-app/', new Response('another app'));
    await worker.dispatchLifecycle('install');
    await worker.dispatchLifecycle('activate');
    equal(worker.claimed(), true);
    equal(worker.cacheMap.has(`${prefix}old`), false);
    equal(worker.cacheMap.has(`${prefix}images`), true);
    equal(worker.cacheMap.has('emerald-ex-shell:/another-app/:old'), true);
    worker.setOffline();

    const page = await worker.dispatchFetch(navigation('my-pokemon?playthrough=run'));
    ok(page);
    equal(await page.text(), html);
    const count = worker.requests.length;
    for (const file of files) {
        const url = new URL(file, scope).href;
        // Module/stylesheet requests can send Origin even though install-time fetches did not.
        const asset = await worker.dispatchFetch(
            new Request(url, { mode: 'cors', headers: { Origin: 'https://dex.example' } }),
        );
        ok(asset);
        equal(await asset.text(), `current asset: ${url}`);
    }
    equal(worker.requests.length, count, 'Offline build assets must come from the shell cache');
});

void test('account and collection requests are never intercepted, fetched, or cached by the worker', () => {
    const worker = workerHarness();
    for (const path of [
        'api/v1/collection',
        'api/v1/collection/session',
        'api/v1/collection/config',
        'api/v1/collection?revision=2',
    ]) {
        for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
            const request = new Request(new URL(path, scope), {
                method,
                credentials: 'include',
                headers: {
                    Cookie: 'emerald_collection_session=private-session',
                    'X-CSRF-Token': 'private-csrf',
                },
            });
            equal(
                worker.dispatchFetch(request),
                undefined,
                `${method} ${path} must stay outside worker caches`,
            );
        }
    }
    deepStrictEqual(worker.requests, []);
    deepStrictEqual(worker.openedCaches, []);
    equal(worker.cacheMap.size, 0);
});

void test('same-origin sprites and icons are available offline, while out-of-scope requests pass through', async () => {
    const worker = workerHarness();
    const paths = ['api/sprites/emerald-ex-1.0.4/1.png', 'api/icons/types/grass.svg'];
    for (const path of paths) {
        const request = new Request(new URL(path, scope));
        worker.networkResponses.set(
            request.url,
            new Response(`current asset: ${request.url}`, { headers: { Vary: 'Origin' } }),
        );
        const response = await worker.dispatchFetch(request);
        ok(response);
        equal(await response.text(), `current asset: ${request.url}`);
    }
    worker.setOffline();
    const count = worker.requests.length;
    for (const path of paths) {
        const response = await worker.dispatchFetch(
            new Request(new URL(path, scope), {
                mode: 'cors',
                headers: { Origin: 'https://dex.example' },
            }),
        );
        ok(response);
        equal(response.ok, true);
    }
    equal(worker.requests.length, count);
    equal(
        worker.dispatchFetch(new Request('https://dex.example/another-app/assets/app.js')),
        undefined,
    );
    equal(
        worker.dispatchFetch(
            new Request('https://other.example/pokemon-emerald-ex-dex/assets/app.js'),
        ),
        undefined,
    );
});

void test('unsuccessful image responses are not saved as offline images', async () => {
    const worker = workerHarness();
    const request = new Request(new URL('api/sprites/emerald-ex-1.0.4/missing.png', scope));
    worker.networkResponses.set(request.url, new Response('not found', { status: 404 }));
    const response = await worker.dispatchFetch(request);
    ok(response);
    equal(response.status, 404);
    equal(await worker.cache(`${prefix}images`).match(request), undefined);
    worker.setOffline();
    const missing = worker.dispatchFetch(request);
    ok(missing);
    await rejects(missing, /offline/);
});
