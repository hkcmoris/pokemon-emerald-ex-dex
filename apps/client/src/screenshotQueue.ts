import type { OwnedPokemon, StatObservation } from '@pokemon-emerald-ex-dex/shared';
import { changeCollectionRecord, readCollectionRecord } from './collectionDatabase.js';

export interface StatScreenshot {
    id: string;
    observationId: string;
    pokemonId: string;
    name: string;
    image: Blob;
    addedAt: string;
    completed: boolean;
    recordedObservation?: Pick<StatObservation, 'speciesId' | 'level' | 'recordedAt'>;
}

const listeners = new Map<string, Set<() => void>>();
let channel: BroadcastChannel | undefined;

function notifyQueue(playthroughId: string, broadcast = true): void {
    for (const listener of listeners.get(playthroughId) ?? []) listener();
    if (broadcast) channel?.postMessage(playthroughId);
}

export function subscribeScreenshotQueue(playthroughId: string, listener: () => void): () => void {
    const group = listeners.get(playthroughId) ?? new Set<() => void>();
    group.add(listener);
    listeners.set(playthroughId, group);
    if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('emerald-ex-stat-screenshots');
        channel.onmessage = (event: MessageEvent<unknown>) => {
            if (typeof event.data === 'string') notifyQueue(event.data, false);
        };
    }
    return () => {
        group.delete(listener);
        if (!group.size) listeners.delete(playthroughId);
        if (!listeners.size) {
            channel?.close();
            channel = undefined;
        }
    };
}

async function withScreenshotLock<T>(
    playthroughId: string,
    id: string,
    action: (assertCurrent: () => Promise<void>) => Promise<T>,
): Promise<T> {
    const key = `stat-screenshot-lock:${playthroughId}:${id}`;
    if (typeof navigator !== 'undefined' && navigator.locks)
        return navigator.locks.request(key, () => action(async () => {}));
    // The lease also protects browsers without Web Locks; abandoned local writes expire after a minute.
    const token = crypto.randomUUID();
    type Lease = { token: string; expiresAt: number };
    await changeCollectionRecord<Lease | null>(key, (previous) => {
        if (previous && previous.expiresAt > Date.now())
            throw new Error('This screenshot is being updated in another tab.');
        return { token, expiresAt: Date.now() + 60_000 };
    });
    let lost = false;
    const assertCurrent = async () => {
        const lease = await readCollectionRecord<Lease | null>(key);
        if (lost || lease?.token !== token || lease.expiresAt <= Date.now())
            throw new Error(
                'The screenshot changed while saving. Reopen the queue before retrying.',
            );
    };
    const renew = setInterval(() => {
        void changeCollectionRecord<Lease | null>(key, (previous) =>
            previous?.token === token
                ? { token, expiresAt: Date.now() + 60_000 }
                : (previous ?? null),
        )
            .then((lease) => {
                if (lease?.token !== token) lost = true;
            })
            .catch(() => {
                lost = true;
            });
    }, 20_000);
    try {
        return await action(assertCurrent);
    } finally {
        clearInterval(renew);
        await changeCollectionRecord<Lease | null>(key, (previous) =>
            previous?.token === token ? null : (previous ?? null),
        );
    }
}

export function validateScreenshotSubmission(
    queue: readonly StatScreenshot[],
    id: string,
    pokemonId: string,
): StatScreenshot {
    const entry = queue.find((candidate) => candidate.id === id);
    if (!entry || entry.completed || entry.pokemonId !== pokemonId)
        throw new Error('This screenshot changed in another tab. Reopen the queue before saving.');
    return entry;
}

export function screenshotDraftKey(id: string, pokemonId?: string): string {
    return `screenshot:${id}${pokemonId ? `:${pokemonId}` : ''}`;
}

export function createStatScreenshot(
    file: Blob & { name?: string },
    pokemon: OwnedPokemon,
): StatScreenshot {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml')
        throw new Error('Choose a PNG, JPEG, WebP or another supported image.');
    return {
        id: crypto.randomUUID(),
        observationId: crypto.randomUUID(),
        pokemonId: pokemon.id,
        name: file.name ?? 'Screenshot',
        image: file,
        addedAt: new Date().toISOString(),
        completed: false,
    };
}

export function reviseScreenshotQueue(
    queue: readonly StatScreenshot[],
    id: string,
    change:
        Partial<Pick<StatScreenshot, 'pokemonId' | 'completed' | 'recordedObservation'>> | 'remove',
): StatScreenshot[] {
    return change === 'remove'
        ? queue.filter((entry) => entry.id !== id)
        : queue.map((entry) => (entry.id === id ? { ...entry, ...change } : entry));
}

function recordKey(playthroughId: string): string {
    return `stat-screenshots:${playthroughId}`;
}

export async function readScreenshotQueue(playthroughId: string): Promise<StatScreenshot[]> {
    return (await readCollectionRecord<StatScreenshot[]>(recordKey(playthroughId))) ?? [];
}

export async function addScreenshotQueueItems(
    playthroughId: string,
    items: readonly StatScreenshot[],
): Promise<StatScreenshot[]> {
    const result = await changeCollectionRecord<StatScreenshot[]>(
        recordKey(playthroughId),
        (previous) => [
            ...(previous ?? []),
            ...items.filter((item) => !previous?.some((entry) => entry.id === item.id)),
        ],
    );
    notifyQueue(playthroughId);
    return result;
}

export async function changeScreenshotQueueItem(
    playthroughId: string,
    id: string,
    change:
        Partial<Pick<StatScreenshot, 'pokemonId' | 'completed' | 'recordedObservation'>> | 'remove',
): Promise<StatScreenshot[]> {
    const result = await withScreenshotLock(playthroughId, id, async (assertCurrent) => {
        await assertCurrent();
        return changeCollectionRecord<StatScreenshot[]>(recordKey(playthroughId), (previous) => {
            const entry = previous?.find((candidate) => candidate.id === id);
            if (!entry || entry.completed)
                throw new Error(
                    'This screenshot is already recorded or was removed in another tab.',
                );
            return reviseScreenshotQueue(previous ?? [], id, change);
        });
    });
    notifyQueue(playthroughId);
    return result;
}

/** Check and archive under the same cross-tab lock as assignment/discard, before accepting any stale save. */
export async function saveQueuedScreenshot(
    playthroughId: string,
    id: string,
    observation: StatObservation,
    save: (value: StatObservation) => Promise<void>,
): Promise<StatScreenshot[]> {
    const result = await withScreenshotLock(playthroughId, id, async (assertCurrent) => {
        const entry = validateScreenshotSubmission(
            await readScreenshotQueue(playthroughId),
            id,
            observation.pokemonId,
        );
        if (entry.observationId !== observation.id)
            throw new Error('Screenshot observation identity changed.');
        await assertCurrent();
        await save(observation);
        await assertCurrent();
        return changeCollectionRecord<StatScreenshot[]>(recordKey(playthroughId), (previous) =>
            reviseScreenshotQueue(previous ?? [], id, {
                completed: true,
                recordedObservation: {
                    speciesId: observation.speciesId,
                    level: observation.level,
                    recordedAt: observation.recordedAt,
                },
            }),
        );
    });
    notifyQueue(playthroughId);
    return result;
}
