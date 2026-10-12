/// <reference lib="webworker" />

// Vite emits this worker at the app root so its scope also works on subpath hosting.
declare const __COLLECTION_PRECACHE__: string[];
declare const __COLLECTION_BUILD__: string;
declare const __COLLECTION_HTML__: string;
const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const scope = worker.registration.scope;
const prefix = `emerald-ex-shell:${new URL(scope).pathname}:`;
const shellCache = `${prefix}${__COLLECTION_BUILD__}`;
const imagesCache = `${prefix}images`;

worker.addEventListener('install', (event: ExtendableEvent) => {
    event.waitUntil(
        caches.open(shellCache).then(async (cache) => {
            await cache.addAll(
                __COLLECTION_PRECACHE__.map(
                    (path) => new Request(new URL(path, scope), { cache: 'reload' }),
                ),
            );
            // The HTML and assets must belong to the same build. Fetching '/' can
            // pick up an older cached index during a worker update.
            await cache.put(
                new URL('./', scope).href,
                new Response(__COLLECTION_HTML__, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                }),
            );
        }),
    );
});

worker.addEventListener('activate', (event: ExtendableEvent) => {
    event.waitUntil(
        (async () => {
            for (const name of await caches.keys()) {
                if (name.startsWith(prefix) && name !== shellCache && name !== imagesCache)
                    await caches.delete(name);
            }
            await worker.clients.claim();
        })(),
    );
});

worker.addEventListener('fetch', (event: FetchEvent) => {
    const request = event.request;
    const url = new URL(request.url);
    if (
        request.method !== 'GET' ||
        url.origin !== new URL(scope).origin ||
        !url.href.startsWith(scope)
    )
        return;
    // Account/session/collection requests are deliberately never cached by this worker.
    if (url.pathname.includes('/api/')) {
        if (!url.pathname.includes('/api/sprites/') && !url.pathname.includes('/api/icons/'))
            return;
        event.respondWith(
            (async () => {
                const cache = await caches.open(imagesCache);
                const cached = await cache.match(request, { ignoreVary: true });
                if (cached) return cached;
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response.clone());
                    const keys = await cache.keys();
                    for (const key of keys.slice(0, Math.max(0, keys.length - 240)))
                        await cache.delete(key);
                }
                return response;
            })(),
        );
        return;
    }
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(async () => {
                const fallback = await (
                    await caches.open(shellCache)
                ).match(new URL('./', scope).href);
                return fallback ?? Response.error();
            }),
        );
        return;
    }
    event.respondWith(
        (async () => {
            // Public build assets are invariant across Origin headers; module and
            // stylesheet requests can differ from precache requests on Vary: Origin.
            const cached = await (
                await caches.open(shellCache)
            ).match(request, { ignoreVary: true });
            return cached ?? fetch(request);
        })(),
    );
});

export {};
