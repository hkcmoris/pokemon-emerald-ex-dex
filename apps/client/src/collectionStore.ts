import { useEffect, useSyncExternalStore } from 'react';

import { apiUrl } from './apiUrl.js';
import { changeCollectionRecord, readCollectionRecord } from './collectionDatabase.js';
import {
    CollectionEngine,
    CollectionHttpError,
    initialCollectionPersistence,
    type CollectionPersistence,
    type CollectionSession,
    type RemoteCollection,
} from './collectionSync.js';

async function request<T>(
    path: string,
    method = 'GET',
    csrfToken?: string,
    body?: unknown,
): Promise<T> {
    const response = await fetch(apiUrl(`v1/collection${path}`), {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 204) return undefined as T;
    const value = (await response.json()) as {
        data: T;
        error?: { code?: string; message?: string };
    };
    if (!response.ok)
        throw new CollectionHttpError(
            response.status,
            value.error?.message ??
                'Collection sync is unavailable. Changes remain saved on this device.',
            value.error?.code,
        );
    return value.data;
}

let engine: CollectionEngine | undefined;
function collectionEngine(): CollectionEngine {
    if (engine) return engine;
    const channel =
        typeof BroadcastChannel === 'undefined'
            ? undefined
            : new BroadcastChannel('emerald-ex-my-pokemon');
    engine = new CollectionEngine(
        {
            read: () => readCollectionRecord<CollectionPersistence>('collections'),
            change: (update) =>
                changeCollectionRecord<CollectionPersistence>('collections', (previous) =>
                    update(previous ?? initialCollectionPersistence()),
                ),
        },
        {
            config: () => request<{ googleClientId: string | null }>('/config'),
            session: () => request<CollectionSession>('/session'),
            login: (credential, csrf) =>
                request<CollectionSession>('/session', 'POST', csrf, { credential }),
            logout: (csrf) => request<void>('/session', 'DELETE', csrf),
            get: () => request<RemoteCollection>(''),
            put: (value, csrf) => request<RemoteCollection>('', 'PUT', csrf, value),
        },
        () => typeof navigator === 'undefined' || navigator.onLine,
        () => crypto.randomUUID(),
        () => channel?.postMessage('updated'),
    );
    const current = engine;
    if (channel)
        channel.onmessage = () => {
            void current.reload();
        };
    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => current.connectionChanged());
        window.addEventListener('offline', () => current.connectionChanged());
        window.addEventListener('focus', () => {
            void current.sync();
        });
        window.setInterval(() => {
            if (document.visibilityState === 'visible') void current.sync();
        }, 30_000);
    }
    return current;
}

export function useCollection() {
    const current = collectionEngine();
    const view = useSyncExternalStore(current.subscribe, current.getSnapshot, current.getSnapshot);
    useEffect(() => {
        void current.initialize();
    }, [current]);
    return {
        ...view,
        update: current.update,
        login: current.login,
        logout: current.logout,
        sync: current.sync,
        resolve: current.resolve,
    };
}
