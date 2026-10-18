import {
    applyConflictChoice,
    emptyCollection,
    mergeCollections,
    readConflictValue,
    recordLearnedWishlistMoves,
    validateCollectionDocument,
    type CollectionConflict,
    type CollectionDocument,
    type JsonValue,
} from '@pokemon-emerald-ex-dex/shared';

export interface CollectionUser {
    id: string;
    name: string;
    email: string;
}
export interface RemoteCollection {
    revision: number;
    document: CollectionDocument;
    userId?: string;
}
export interface CollectionPartition extends RemoteCollection {
    user: CollectionUser | null;
    base: CollectionDocument;
    conflicts: CollectionConflict[];
    /** An untouched automatic empty run is not an independently created guest playthrough. */
    pristine?: boolean;
}
export interface CollectionPersistence {
    version: 1;
    activeOwner: string;
    googleClientId: string | null;
    partitions: Record<string, CollectionPartition>;
}
export interface CollectionStorage {
    read(): Promise<CollectionPersistence | undefined>;
    change(
        update: (state: CollectionPersistence) => CollectionPersistence,
    ): Promise<CollectionPersistence>;
}
export interface CollectionSession {
    user: CollectionUser | null;
    csrfToken?: string;
    nonce?: string;
}
export interface CollectionTransport {
    config(): Promise<{ googleClientId: string | null }>;
    session(): Promise<CollectionSession>;
    login(credential: string, csrfToken: string): Promise<CollectionSession>;
    logout(csrfToken: string): Promise<void>;
    get(): Promise<RemoteCollection>;
    put(value: RemoteCollection, csrfToken: string): Promise<RemoteCollection>;
}
export type CollectionStatus = 'local' | 'syncing' | 'pending' | 'synced' | 'offline' | 'error';
export interface CollectionView {
    document: CollectionDocument;
    user: CollectionUser | null;
    googleClientId: string | null;
    nonce: string | null;
    needsSignIn: boolean;
    conflicts: CollectionConflict[];
    status: CollectionStatus;
    error: string | null;
    ready: boolean;
}

export class CollectionHttpError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly code?: string,
    ) {
        super(message);
    }
}

function partition(user: CollectionUser | null = null): CollectionPartition {
    return {
        user,
        document: emptyCollection(),
        base: emptyCollection(),
        revision: 0,
        conflicts: [],
    };
}

export function initialCollectionPersistence(): CollectionPersistence {
    return {
        version: 1,
        activeOwner: 'guest',
        googleClientId: null,
        partitions: { guest: partition() },
    };
}

function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, entry]) => [key, ordered(entry)]),
        );
    }
    return value;
}

export function sameCollectionValue(a: unknown, b: unknown): boolean {
    return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
}

export function assertCollectionPersistence(value: CollectionPersistence): void {
    if (
        value.version !== 1 ||
        !value.partitions ||
        !Object.hasOwn(value.partitions, value.activeOwner)
    ) {
        throw new Error(
            'Saved collection data could not be read. Your stored data has been preserved.',
        );
    }
    for (const entry of Object.values(value.partitions)) {
        if (
            !validateCollectionDocument(entry.document) ||
            !validateCollectionDocument(entry.base) ||
            !Array.isArray(entry.conflicts)
        ) {
            throw new Error(
                'Saved collection data could not be read. Your stored data has been preserved.',
            );
        }
    }
}

/** UUID collisions are exceptional, but must not erase a separately created guest run. */
export function importGuestCollection(
    target: CollectionDocument,
    guest: CollectionDocument,
    id: () => string,
): CollectionDocument {
    const result = structuredClone(target);
    const runs = new Map<string, string>();
    const pokemon = new Map<string, string>();
    const encounters = new Map<string, string>();
    const opponents = new Map<string, string>();
    for (const entry of Object.values(guest.playthroughs))
        runs.set(entry.id, Object.hasOwn(result.playthroughs, entry.id) ? id() : entry.id);
    for (const entry of Object.values(guest.pokemon))
        pokemon.set(entry.id, Object.hasOwn(result.pokemon, entry.id) ? id() : entry.id);
    for (const entry of Object.values(guest.encounters ?? {}))
        encounters.set(
            entry.id,
            Object.hasOwn(result.encounters ?? {}, entry.id) ? id() : entry.id,
        );
    for (const entry of Object.values(guest.opponents ?? {}))
        opponents.set(entry.id, Object.hasOwn(result.opponents ?? {}, entry.id) ? id() : entry.id);
    for (const entry of Object.values(guest.playthroughs)) {
        const newId = runs.get(entry.id)!;
        result.playthroughs[newId] = {
            ...entry,
            id: newId,
            party: entry.party.map((member) => pokemon.get(member)!),
        };
    }
    for (const entry of Object.values(guest.pokemon)) {
        const newId = pokemon.get(entry.id)!;
        result.pokemon[newId] = {
            ...structuredClone(entry),
            id: newId,
            playthroughId: runs.get(entry.playthroughId)!,
        };
    }
    for (const entry of Object.values(guest.observations)) {
        const newId = Object.hasOwn(result.observations, entry.id) ? id() : entry.id;
        result.observations[newId] = {
            ...structuredClone(entry),
            id: newId,
            pokemonId: pokemon.get(entry.pokemonId)!,
        };
    }
    for (const entry of Object.values(guest.encounters ?? {})) {
        const newId = encounters.get(entry.id)!;
        result.encounters ??= {};
        result.encounters[newId] = {
            ...structuredClone(entry),
            id: newId,
            playthroughId: runs.get(entry.playthroughId)!,
            party: entry.party.map((member) => opponents.get(member)!),
        };
    }
    for (const entry of Object.values(guest.opponents ?? {})) {
        const newId = opponents.get(entry.id)!;
        result.opponents ??= {};
        result.opponents[newId] = {
            ...structuredClone(entry),
            id: newId,
            encounterId: encounters.get(entry.encounterId)!,
        };
    }
    return result;
}

function retainConflicts(
    previous: readonly CollectionConflict[],
    fresh: readonly CollectionConflict[],
    local: CollectionDocument,
    remote: CollectionDocument,
): CollectionConflict[] {
    const conflicts = new Map(fresh.map((conflict) => [conflict.id, conflict]));
    for (const conflict of previous) {
        if (conflicts.has(conflict.id)) continue;
        const localValue = readConflictValue(local, conflict);
        const remoteValue = readConflictValue(remote, conflict);
        const choices = (value: JsonValue): JsonValue =>
            conflict.entity === 'pokemon' &&
            conflict.field === 'moveWishlist' &&
            value !== null &&
            typeof value === 'object' &&
            !Array.isArray(value)
                ? { ...value, learnedMoveIds: [] }
                : value;
        if (!sameCollectionValue(choices(localValue), choices(remoteValue)))
            conflicts.set(conflict.id, { ...conflict, local: localValue, remote: remoteValue });
    }
    return [...conflicts.values()];
}

export function prepareCollectionSync(
    local: CollectionPartition,
    remote: RemoteCollection,
): {
    document: CollectionDocument;
    upload: CollectionDocument;
    conflicts: CollectionConflict[];
} {
    // Match mergeCollections' legacy-map semantics when retaining unresolved alternatives too.
    const remoteDocument = { ...remote.document };
    if (remoteDocument.encounters === undefined && local.base.encounters !== undefined)
        remoteDocument.encounters = local.base.encounters;
    if (remoteDocument.opponents === undefined && local.base.opponents !== undefined)
        remoteDocument.opponents = local.base.opponents;
    const merged = mergeCollections(local.base, local.document, remoteDocument);
    const conflicts = retainConflicts(
        local.conflicts,
        merged.conflicts,
        merged.document,
        remoteDocument,
    );
    let upload = structuredClone(merged.document);
    // Restore referenced records before selecting their party membership.
    const conflictOrder = (conflict: CollectionConflict) =>
        conflict.kind === 'party'
            ? 2
            : conflict.entity === 'playthroughs' || conflict.entity === 'encounters'
              ? 1
              : 0;
    const uploadConflicts = [...conflicts].sort((a, b) => conflictOrder(a) - conflictOrder(b));
    for (const conflict of uploadConflicts)
        upload = applyConflictChoice(upload, conflict, 'remote');
    if (!validateCollectionDocument(upload))
        throw new Error('A collection conflict needs resolution before syncing.');
    return { document: merged.document, upload, conflicts };
}

export class CollectionEngine {
    private state = initialCollectionPersistence();
    private csrfToken = '';
    private nonce: string | null = null;
    private authenticatedOwner: string | null = null;
    private authGeneration = 0;
    private authBusy = false;
    private listeners = new Set<() => void>();
    private initialization: Promise<void> | undefined;
    private flight: Promise<void> | undefined;
    private flightGeneration = 0;
    private status: CollectionStatus = 'local';
    private error: string | null = null;
    private ready = false;
    private snapshot: CollectionView;

    constructor(
        private readonly storage: CollectionStorage,
        private readonly transport: CollectionTransport,
        private readonly online: () => boolean,
        private readonly id: () => string,
        private readonly changed: () => void = () => {},
    ) {
        this.snapshot = this.view();
    }

    private view(): CollectionView {
        const current = this.state.partitions[this.state.activeOwner];
        return {
            document: current.document,
            conflicts: current.conflicts,
            user: current.user,
            googleClientId: this.state.googleClientId,
            nonce: this.nonce,
            needsSignIn: Boolean(
                current.user && this.authenticatedOwner !== this.state.activeOwner,
            ),
            status: this.status,
            error: this.error,
            ready: this.ready,
        };
    }

    getSnapshot = (): CollectionView => this.snapshot;
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    private emit(): void {
        this.snapshot = this.view();
        for (const listener of this.listeners) listener();
    }
    private failure(error: unknown): void {
        this.error = error instanceof Error ? error.message : 'Changes could not be saved.';
        this.status = this.online() ? 'error' : 'offline';
        this.emit();
    }

    initialize(): Promise<void> {
        this.initialization ??= this.start();
        return this.initialization;
    }

    private async start(): Promise<void> {
        try {
            const saved = await this.storage.read();
            if (saved) {
                assertCollectionPersistence(saved);
                this.state = saved;
            } else {
                await this.save((state) => {
                    if (Object.keys(state.partitions.guest.document.playthroughs).length === 0) {
                        const id = this.id();
                        state.partitions.guest.document.playthroughs[id] = {
                            id,
                            name: 'Emerald EX',
                            party: [],
                            deleted: false,
                        };
                        state.partitions.guest.pristine = true;
                    }
                    return state;
                });
            }
            this.ready = true;
            this.status =
                this.state.activeOwner === 'guest'
                    ? 'local'
                    : this.online()
                      ? 'pending'
                      : 'offline';
            this.emit();
            await this.refreshSession();
        } catch (error) {
            this.failure(error);
        }
    }

    async reload(): Promise<void> {
        try {
            const saved = await this.storage.read();
            if (saved) {
                assertCollectionPersistence(saved);
                this.state = saved;
                this.emit();
            }
        } catch (error) {
            this.failure(error);
        }
    }

    private async save(
        change: (state: CollectionPersistence) => CollectionPersistence,
    ): Promise<void> {
        this.state = await this.storage.change((state) => {
            assertCollectionPersistence(state);
            const next = change(structuredClone(state));
            assertCollectionPersistence(next);
            return next;
        });
        this.changed();
        this.emit();
    }

    private async acceptSession(
        session: CollectionSession,
        generation = this.authGeneration,
    ): Promise<void> {
        if (generation !== this.authGeneration) return;
        this.csrfToken = session.csrfToken ?? '';
        this.nonce = session.nonce ?? null;
        const user = session.user;
        this.authenticatedOwner = user ? `account:${user.id}` : null;
        if (user) {
            await this.save((state) => {
                if (generation !== this.authGeneration) return state;
                const key = `account:${user.id}`;
                const current = state.partitions[key] ?? partition(user);
                current.user = user;
                if (!state.partitions.guest.pristine) {
                    current.document = importGuestCollection(
                        current.document,
                        state.partitions.guest.document,
                        this.id,
                    );
                }
                state.partitions.guest = partition();
                state.partitions[key] = current;
                state.activeOwner = key;
                return state;
            });
        }
        this.emit();
    }

    async refreshSession(): Promise<void> {
        if (this.authBusy) return;
        const generation = this.authGeneration;
        if (!this.online()) {
            this.connectionChanged();
            return;
        }
        try {
            const [config, session] = await Promise.all([
                this.transport.config(),
                this.transport.session(),
            ]);
            if (generation !== this.authGeneration) return;
            await this.save((state) => ({ ...state, googleClientId: config.googleClientId }));
            await this.acceptSession(session, generation);
            if (session.user && generation === this.authGeneration) await this.sync();
        } catch (error) {
            // Guest use and account caches remain available if the server is unavailable.
            if (generation === this.authGeneration && this.state.activeOwner !== 'guest')
                this.failure(error);
        }
    }

    update = async (
        update: (document: CollectionDocument) => CollectionDocument,
    ): Promise<void> => {
        const owner = this.state.activeOwner;
        try {
            await this.save((state) => {
                if (state.activeOwner !== owner)
                    throw new Error('The active account changed in another tab. Try again.');
                const current = state.partitions[owner];
                const previous = structuredClone(current.document);
                for (const [id, pokemon] of Object.entries(previous.pokemon))
                    previous.pokemon[id] = recordLearnedWishlistMoves(pokemon);
                const document = update(structuredClone(previous));
                if (!validateCollectionDocument(document))
                    throw new Error(
                        'Check the Pokémon, level, moves, stats, and party before saving.',
                    );
                for (const [id, pokemon] of Object.entries(document.pokemon)) {
                    if (pokemon.moveWishlist) {
                        pokemon.moveWishlist.learnedMoveIds = [
                            ...new Set([
                                ...(previous.pokemon[id]?.moveWishlist?.learnedMoveIds ?? []),
                                ...pokemon.moveWishlist.learnedMoveIds,
                            ]),
                        ];
                    }
                    document.pokemon[id] = recordLearnedWishlistMoves(pokemon);
                }
                current.document = document;
                current.pristine = false;
                current.conflicts = current.conflicts
                    .map((conflict) => ({
                        ...conflict,
                        local: readConflictValue(document, conflict),
                    }))
                    .filter((conflict) => !sameCollectionValue(conflict.local, conflict.remote));
                return state;
            });
            this.error = null;
            this.status = owner === 'guest' ? 'local' : this.online() ? 'pending' : 'offline';
            this.emit();
            if (owner !== 'guest') void this.sync();
        } catch (error) {
            this.failure(error);
            throw error;
        }
    };

    login = async (credential: string): Promise<void> => {
        const generation = ++this.authGeneration;
        this.authBusy = true;
        try {
            // The nonce issued before rendering the Google button belongs to this challenge.
            const session = await this.transport.login(credential, this.csrfToken);
            if (generation !== this.authGeneration) return;
            if (!session.user) throw new Error('Google sign-in did not establish a session.');
            await this.acceptSession(session, generation);
            this.error = null;
            await this.sync();
        } catch (error) {
            let failure = error;
            if (
                generation === this.authGeneration &&
                error instanceof CollectionHttpError &&
                error.status === 403 &&
                error.code === 'invalid_csrf'
            ) {
                try {
                    await this.acceptSession(await this.transport.session(), generation);
                    // A new challenge requires a new Google credential; never replay this one.
                    failure = new CollectionHttpError(
                        403,
                        'Sign-in was refreshed. Please sign in with Google again.',
                        'invalid_csrf',
                    );
                } catch {
                    failure = new CollectionHttpError(
                        403,
                        'Sign-in could not be refreshed. Check your connection and reload this page. Your collection is saved on this device.',
                        'invalid_csrf',
                    );
                }
            }
            if (generation === this.authGeneration) this.failure(failure);
            throw failure;
        } finally {
            if (generation === this.authGeneration) this.authBusy = false;
        }
    };

    logout = async (): Promise<void> => {
        const generation = ++this.authGeneration;
        this.authBusy = true;
        try {
            if (!this.online())
                throw new Error(
                    'Connect to the internet to sign out. Your offline edits are saved.',
                );
            try {
                await this.transport.logout(this.csrfToken);
            } catch (error) {
                // An expired/revoked session is already signed out on the server.
                if (!(error instanceof CollectionHttpError && error.status === 401)) throw error;
            }
            if (generation !== this.authGeneration) return;
            this.authenticatedOwner = null;
            this.csrfToken = '';
            await this.save((state) => ({ ...state, activeOwner: 'guest' }));
            this.status = 'local';
            this.error = null;
            this.emit();
            this.authBusy = false;
            await this.refreshSession();
        } catch (error) {
            if (generation === this.authGeneration) this.failure(error);
            throw error;
        } finally {
            if (generation === this.authGeneration) this.authBusy = false;
        }
    };

    resolve = async (id: string, choice: 'local' | 'remote'): Promise<void> => {
        const owner = this.state.activeOwner;
        try {
            await this.save((state) => {
                if (state.activeOwner !== owner)
                    throw new Error('The active account changed. Try again.');
                const current = state.partitions[owner];
                const conflict = current.conflicts.find((entry) => entry.id === id);
                if (!conflict) return state;
                current.document = applyConflictChoice(
                    current.document,
                    choice === 'local'
                        ? { ...conflict, local: readConflictValue(current.document, conflict) }
                        : conflict,
                    choice,
                );
                current.conflicts = current.conflicts.filter((entry) => entry.id !== id);
                return state;
            });
            this.error = null;
            this.status = 'pending';
            this.emit();
            void this.sync();
        } catch (error) {
            this.failure(error);
            throw error;
        }
    };

    connectionChanged(): void {
        if (!this.online() && this.state.activeOwner !== 'guest') this.status = 'offline';
        this.emit();
        if (this.online()) void this.refreshSession();
    }

    sync = (): Promise<void> => {
        if (this.flight) {
            const generation = this.authGeneration;
            if (this.flightGeneration === generation) return this.flight;
            return this.flight.then(() =>
                generation === this.authGeneration ? this.sync() : undefined,
            );
        }
        this.flightGeneration = this.authGeneration;
        this.flight = this.synchronize().finally(() => {
            this.flight = undefined;
        });
        return this.flight;
    };

    private async synchronize(): Promise<void> {
        const owner = this.state.activeOwner;
        const generation = this.authGeneration;
        const csrfToken = this.csrfToken;
        const isCurrent = () =>
            generation === this.authGeneration && this.state.activeOwner === owner;
        if (!this.ready || owner === 'guest' || this.authenticatedOwner !== owner || !this.online())
            return;
        this.status = 'syncing';
        this.emit();
        try {
            for (let attempt = 0; attempt < 4; attempt++) {
                const saved = (await this.storage.read()) ?? this.state;
                if (saved.activeOwner !== owner || !isCurrent()) return;
                const before = saved.partitions[owner];
                const remote = await this.transport.get();
                if (!isCurrent()) return;
                if (!remote.userId || remote.userId !== before.user?.id) {
                    this.authenticatedOwner = null;
                    throw new Error(
                        'The signed-in account changed in another tab. Sign in again; local changes are preserved.',
                    );
                }
                if (!validateCollectionDocument(remote.document))
                    throw new Error(
                        'The server returned invalid collection data. Local changes were preserved.',
                    );
                const prepared = prepareCollectionSync(before, remote);
                let committed = remote;
                try {
                    if (!sameCollectionValue(prepared.upload, remote.document))
                        committed = await this.transport.put(
                            { revision: remote.revision, document: prepared.upload },
                            csrfToken,
                        );
                } catch (error) {
                    if (!isCurrent()) return;
                    if (error instanceof CollectionHttpError && error.status === 409) continue;
                    throw error;
                }
                if (!isCurrent()) return;
                if (committed.userId !== before.user?.id) {
                    this.authenticatedOwner = null;
                    throw new Error(
                        'The signed-in account changed during sync. Local changes are preserved.',
                    );
                }
                let changedWhileSaving = false;
                await this.save((state) => {
                    if (!isCurrent() || state.activeOwner !== owner) return state;
                    const current = state.partitions[owner];
                    if (current.revision > committed.revision) {
                        changedWhileSaving = true;
                        return state;
                    }
                    changedWhileSaving =
                        !sameCollectionValue(current.document, before.document) ||
                        !sameCollectionValue(current.conflicts, before.conflicts);
                    const rebase = mergeCollections(
                        before.document,
                        current.document,
                        prepared.document,
                    );
                    current.document = rebase.document;
                    current.base = committed.document;
                    current.revision = committed.revision;
                    const resolvedDuringSync = new Set(
                        before.conflicts
                            .filter(
                                (entry) =>
                                    !current.conflicts.some(
                                        (remaining) => remaining.id === entry.id,
                                    ),
                            )
                            .map((entry) => entry.id),
                    );
                    current.conflicts = retainConflicts(
                        prepared.conflicts.filter((entry) => !resolvedDuringSync.has(entry.id)),
                        rebase.conflicts,
                        current.document,
                        committed.document,
                    );
                    return state;
                });
                if (!isCurrent()) return;
                if (changedWhileSaving) continue;
                const current = this.state.partitions[owner];
                this.status =
                    current.conflicts.length || !sameCollectionValue(current.document, current.base)
                        ? 'pending'
                        : 'synced';
                this.error = null;
                this.emit();
                return;
            }
            this.status = 'pending';
            this.error = 'Changes are saved on this device. Sync will retry shortly.';
            this.emit();
        } catch (error) {
            if (!isCurrent()) return;
            if (error instanceof CollectionHttpError && error.status === 401) {
                this.authenticatedOwner = null;
                try {
                    if (!this.authBusy)
                        await this.acceptSession(await this.transport.session(), generation);
                } catch {
                    /* Keep the offline cache available. */
                }
            }
            if (isCurrent()) this.failure(error);
        }
    }
}
