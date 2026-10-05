import { ApiError, handleDexRequest, PokedexRepository } from './db/repository.js';

export interface D1Statement {
    bind(...values: (string | number)[]): D1Statement;
    all<T>(): Promise<{ results: T[] }>;
}
export interface WorkerEnvironment {
    DB: { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown> };
    ASSETS: { fetch(request: Request): Promise<Response> };
}

export function createWorker(seedStatements: string[]): {
    fetch(request: Request, env: WorkerEnvironment): Promise<Response>;
} {
    const imports = new WeakMap<WorkerEnvironment['DB'], Promise<void>>();
    async function ensureImported(database: WorkerEnvironment['DB']): Promise<void> {
        let pending = imports.get(database);
        if (!pending) {
            pending = (async () => {
                const marker = await database
                    .prepare("SELECT value FROM metadata WHERE key = 'dataset'")
                    .all<{ value: string }>();
                if (marker.results[0]?.value !== 'emerald-ex-1.0.4') {
                    // D1 batch is atomic; concurrent cold starts are safe with deterministic keys.
                    await database.batch(seedStatements.map((sql) => database.prepare(sql)));
                }
            })();
            imports.set(database, pending);
        }
        try {
            await pending;
        } catch (error) {
            imports.delete(database);
            throw error;
        }
    }
    return {
        async fetch(request, env) {
            const url = new URL(request.url);
            if (url.pathname.startsWith('/api/')) {
                if (request.method !== 'GET')
                    return Response.json(
                        { error: 'Method not allowed.' },
                        { status: 405, headers: { Allow: 'GET' } },
                    );
                if (url.pathname === '/api/health') return Response.json({ ok: true });
                try {
                    await ensureImported(env.DB);
                    const repository = new PokedexRepository({
                        async all<T>(sql: string, parameters = []): Promise<T[]> {
                            return (
                                await env.DB.prepare(sql)
                                    .bind(...parameters)
                                    .all<T>()
                            ).results;
                        },
                    });
                    return Response.json(await handleDexRequest(repository, url), {
                        headers: { 'Cache-Control': 'public, max-age=300' },
                    });
                } catch (error) {
                    if (error instanceof ApiError)
                        return Response.json({ error: error.message }, { status: error.status });
                    console.error('Pokédex database request failed', error);
                    return Response.json(
                        { error: 'The Pokédex is temporarily unavailable. Please try again.' },
                        { status: 503 },
                    );
                }
            }
            if (url.pathname === '/' || /^\/pokemon\/\d+$/.test(url.pathname)) {
                return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
            }
            return env.ASSETS.fetch(request);
        },
    };
}
