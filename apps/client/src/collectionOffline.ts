import { useSyncExternalStore } from 'react';

export type CollectionOfflineStatus = 'preparing' | 'ready' | 'unavailable' | 'development';

let status: CollectionOfflineStatus = 'preparing';
let started = false;
const listeners = new Set<() => void>();

function setStatus(next: CollectionOfflineStatus): void {
    if (next === status) return;
    status = next;
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useCollectionOffline(): CollectionOfflineStatus {
    return useSyncExternalStore(
        subscribe,
        () => status,
        () => 'development',
    );
}

export function registerCollectionOffline(): void {
    if (started) return;
    started = true;
    if (!import.meta.env.PROD) {
        setStatus('development');
        return;
    }
    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
        console.warn(
            'Offline app reload is unavailable:',
            !window.isSecureContext
                ? 'This page is not in a secure context.'
                : 'Service workers are unsupported in this browser.',
        );
        setStatus('unavailable');
        return;
    }
    setStatus('preparing');
    const base = import.meta.env.BASE_URL;
    let registrationRequest: Promise<ServiceWorkerRegistration>;
    try {
        registrationRequest = navigator.serviceWorker.register(`${base}collection-sw.js`, {
            scope: base,
            type: 'module',
        });
    } catch (reason) {
        // Some embedded/private contexts throw before returning a registration promise.
        console.warn('Offline app registration failed:', reason);
        setStatus('unavailable');
        return;
    }
    void registrationRequest
        .then((registration) => {
            const observed = new Set<ServiceWorker>();
            const watch = (worker: ServiceWorker | null): void => {
                if (!worker || observed.has(worker)) return;
                observed.add(worker);
                const check = (): void => {
                    if (worker.state === 'activated') setStatus('ready');
                    else if (
                        worker.state === 'redundant' &&
                        registration.active?.state !== 'activated'
                    ) {
                        console.warn(
                            'Offline app preparation failed:',
                            'The service worker became redundant before activation; installation or precaching failed.',
                            worker.scriptURL,
                        );
                        setStatus('unavailable');
                    }
                };
                worker.addEventListener('statechange', check);
                worker.addEventListener('error', (event) => {
                    console.warn(
                        'Offline app worker failed:',
                        event instanceof ErrorEvent ? event.error || event.message : event,
                    );
                    if (registration.active?.state !== 'activated') setStatus('unavailable');
                });
                check();
            };
            watch(registration.active);
            watch(registration.waiting);
            watch(registration.installing);
            registration.addEventListener('updatefound', () => {
                watch(registration.installing);
            });
            void navigator.serviceWorker.ready
                .then((readyRegistration) => {
                    if (readyRegistration.scope === registration.scope)
                        watch(readyRegistration.active);
                })
                .catch((reason: unknown) => {
                    console.warn('Offline app activation failed:', reason);
                    setStatus('unavailable');
                });
        })
        .catch((reason: unknown) => {
            console.warn('Offline app registration failed:', reason);
            setStatus('unavailable');
        });
}
