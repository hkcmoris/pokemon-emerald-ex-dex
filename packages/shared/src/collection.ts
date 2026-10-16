import type { BaseStats } from './dex.js';

export interface KnownMove {
    moveId: number;
    name: string;
}

export interface MoveWishlist {
    moves: KnownMove[];
    /** Permanent acquisition history, including wishes later removed from the list. */
    learnedMoveIds: number[];
    targetSpeciesId: number | null;
}

export interface PokemonState {
    speciesId: number;
    level: number;
    moves: KnownMove[] | null;
    /** A new identity at every evolution/form transition, even when changing back. */
    formEpoch: string;
}

export interface Playthrough {
    id: string;
    name: string;
    party: string[];
    deleted: boolean;
}

export interface OwnedPokemonAbility {
    speciesId: number;
    abilityId: number;
}

export interface OwnedPokemon {
    id: string;
    playthroughId: string;
    nickname: string;
    state: PokemonState;
    /** Absent in collections saved before move planning was introduced. */
    moveWishlist?: MoveWishlist;
    /** Absent or null when the nature has not been recorded. */
    natureId?: number | null;
    /** Tied to a species/form so a saved choice cannot silently follow an evolution. */
    ability?: OwnedPokemonAbility | null;
    deleted: boolean;
    createdAt: string;
}

/** Remember recorded acquisitions; replacing a current move never undoes learning it. */
export function recordLearnedWishlistMoves(pokemon: OwnedPokemon): OwnedPokemon {
    const wishlist = pokemon.moveWishlist;
    if (!wishlist) return pokemon;
    const current = new Set(pokemon.state.moves?.map((move) => move.moveId));
    const learnedMoveIds = [
        ...new Set([
            ...wishlist.learnedMoveIds,
            ...wishlist.moves.filter((move) => current.has(move.moveId)).map((move) => move.moveId),
        ]),
    ].sort((a, b) => a - b);
    if (equal(learnedMoveIds, wishlist.learnedMoveIds)) return pokemon;
    return { ...pokemon, moveWishlist: { ...wishlist, learnedMoveIds } };
}

export interface StatObservation {
    id: string;
    pokemonId: string;
    speciesId: number;
    level: number;
    formEpoch: string;
    recordedAt: string;
    stats: Partial<BaseStats>;
    deleted: boolean;
}

export interface CollectionDocument {
    version: 1;
    playthroughs: Record<string, Playthrough>;
    pokemon: Record<string, OwnedPokemon>;
    observations: Record<string, StatObservation>;
}

export type JsonValue =
    null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type CollectionEntity = 'playthroughs' | 'pokemon' | 'observations';

export interface CollectionConflict {
    id: string;
    kind: 'field' | 'delete-edit' | 'party';
    entity: CollectionEntity;
    entityId: string;
    /** $entity means that both alternatives contain the entire record. */
    field: string;
    base: JsonValue;
    local: JsonValue;
    remote: JsonValue;
}

export interface CollectionMerge {
    document: CollectionDocument;
    conflicts: CollectionConflict[];
}

export const statKeys: readonly (keyof BaseStats)[] = [
    'hp',
    'attack',
    'defense',
    'spAttack',
    'spDefense',
    'speed',
];

export function emptyCollection(): CollectionDocument {
    return { version: 1, playthroughs: {}, pokemon: {}, observations: {} };
}

function record(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
    return (
        Object.keys(value).length === expected.length &&
        expected.every((key) => Object.hasOwn(value, key))
    );
}

function id(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        /^[A-Za-z0-9_-]{1,80}$/.test(value) &&
        !['__proto__', 'prototype', 'constructor'].includes(value)
    );
}

function integer(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function text(value: unknown, max: number, empty = true): value is string {
    return typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0);
}

function timestamp(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length <= 40 &&
        /^\d{4}-\d{2}-\d{2}T/.test(value) &&
        Number.isFinite(Date.parse(value))
    );
}

function validState(value: unknown): boolean {
    return (
        record(value) &&
        keys(value, ['speciesId', 'level', 'moves', 'formEpoch']) &&
        integer(value.speciesId, 1, 100000) &&
        integer(value.level, 1, 100) &&
        id(value.formEpoch) &&
        (value.moves === null ||
            (Array.isArray(value.moves) &&
                value.moves.length <= 4 &&
                value.moves.every(
                    (move: unknown) =>
                        record(move) &&
                        keys(move, ['moveId', 'name']) &&
                        integer(move.moveId, 1, 100000) &&
                        text(move.name, 80, false),
                ) &&
                new Set(value.moves.map((move: { moveId: number }) => move.moveId)).size ===
                    value.moves.length))
    );
}

function validWishlist(value: unknown): boolean {
    return (
        record(value) &&
        keys(value, ['moves', 'learnedMoveIds', 'targetSpeciesId']) &&
        (value.targetSpeciesId === null || integer(value.targetSpeciesId, 1, 100000)) &&
        Array.isArray(value.moves) &&
        value.moves.length <= 1000 &&
        value.moves.every(
            (move: unknown) =>
                record(move) &&
                keys(move, ['moveId', 'name']) &&
                integer(move.moveId, 1, 100000) &&
                text(move.name, 80, false),
        ) &&
        new Set(value.moves.map((move: KnownMove) => move.moveId)).size === value.moves.length &&
        Array.isArray(value.learnedMoveIds) &&
        value.learnedMoveIds.length <= 100000 &&
        value.learnedMoveIds.every((moveId: unknown) => integer(moveId, 1, 100000)) &&
        new Set(value.learnedMoveIds).size === value.learnedMoveIds.length
    );
}

/** Validate persisted/untrusted documents without coercion or prototype-sensitive keys. */
export function validateCollectionDocument(value: unknown): value is CollectionDocument {
    if (
        !record(value) ||
        !keys(value, ['version', 'playthroughs', 'pokemon', 'observations']) ||
        value.version !== 1 ||
        !record(value.playthroughs) ||
        !record(value.pokemon) ||
        !record(value.observations)
    )
        return false;
    const { playthroughs, pokemon, observations } = value;
    if (
        Object.keys(playthroughs).length > 50 ||
        Object.keys(pokemon).length > 3000 ||
        Object.keys(observations).length > 10000
    )
        return false;
    for (const [key, run] of Object.entries(playthroughs)) {
        if (
            !id(key) ||
            !record(run) ||
            !keys(run, ['id', 'name', 'party', 'deleted']) ||
            run.id !== key ||
            !text(run.name, 80, false) ||
            typeof run.deleted !== 'boolean' ||
            !Array.isArray(run.party) ||
            run.party.length > 6 ||
            !run.party.every(id) ||
            new Set(run.party).size !== run.party.length
        )
            return false;
    }
    for (const [key, owned] of Object.entries(pokemon)) {
        if (
            !id(key) ||
            !record(owned) ||
            !keys(owned, [
                'id',
                'playthroughId',
                'nickname',
                'state',
                'deleted',
                'createdAt',
                ...(Object.hasOwn(owned, 'moveWishlist') ? ['moveWishlist'] : []),
                ...(Object.hasOwn(owned, 'natureId') ? ['natureId'] : []),
                ...(Object.hasOwn(owned, 'ability') ? ['ability'] : []),
            ]) ||
            owned.id !== key ||
            !id(owned.playthroughId) ||
            !Object.hasOwn(playthroughs, owned.playthroughId) ||
            !text(owned.nickname, 40) ||
            !validState(owned.state) ||
            (Object.hasOwn(owned, 'moveWishlist') && !validWishlist(owned.moveWishlist)) ||
            (Object.hasOwn(owned, 'natureId') &&
                owned.natureId !== null &&
                !integer(owned.natureId, 0, 24)) ||
            (Object.hasOwn(owned, 'ability') &&
                owned.ability !== null &&
                !(
                    record(owned.ability) &&
                    keys(owned.ability, ['speciesId', 'abilityId']) &&
                    integer(owned.ability.speciesId, 1, 100000) &&
                    integer(owned.ability.abilityId, 1, 100000)
                )) ||
            typeof owned.deleted !== 'boolean' ||
            !timestamp(owned.createdAt)
        )
            return false;
    }
    for (const [key, observation] of Object.entries(observations)) {
        if (
            !id(key) ||
            !record(observation) ||
            !keys(observation, [
                'id',
                'pokemonId',
                'speciesId',
                'level',
                'formEpoch',
                'recordedAt',
                'stats',
                'deleted',
            ]) ||
            observation.id !== key ||
            !id(observation.pokemonId) ||
            !Object.hasOwn(pokemon, observation.pokemonId) ||
            !integer(observation.speciesId, 1, 100000) ||
            !integer(observation.level, 1, 100) ||
            !id(observation.formEpoch) ||
            !timestamp(observation.recordedAt) ||
            typeof observation.deleted !== 'boolean' ||
            !record(observation.stats) ||
            Object.keys(observation.stats).length === 0 ||
            !Object.entries(observation.stats).every(
                ([key, stat]) =>
                    statKeys.includes(key as keyof BaseStats) && integer(stat, 1, 65535),
            )
        )
            return false;
    }
    for (const [runId, run] of Object.entries(playthroughs)) {
        const party = (run as Record<string, unknown>).party as string[];
        if (
            !party.every((pokemonId) => {
                const owned = pokemon[pokemonId];
                return record(owned) && owned.playthroughId === runId && owned.deleted === false;
            })
        )
            return false;
    }
    return true;
}

function equal(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b))
        return a.length === b.length && a.every((item: unknown, index) => equal(item, b[index]));
    if (!record(a) || !record(b)) return false;
    return (
        Object.keys(a).length === Object.keys(b).length &&
        Object.keys(a).every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
    );
}

function json(value: unknown): JsonValue {
    return value === undefined ? null : (structuredClone(value) as JsonValue);
}

function conflict(
    entity: CollectionEntity,
    entityId: string,
    field: string,
    base: unknown,
    local: unknown,
    remote: unknown,
    kind: CollectionConflict['kind'] = 'field',
): CollectionConflict {
    return {
        id: `${entity}:${entityId}:${field}`,
        entity,
        entityId,
        field,
        kind,
        base: json(base),
        local: json(local),
        remote: json(remote),
    };
}

function changedChildren(
    entity: CollectionEntity,
    entityId: string,
    base: CollectionDocument,
    other: CollectionDocument,
): boolean {
    const belongs = (owned: OwnedPokemon): boolean =>
        entity === 'pokemon' ? owned.id === entityId : owned.playthroughId === entityId;
    if (entity === 'playthroughs') {
        for (const owned of Object.values(other.pokemon)) {
            if (belongs(owned) && !equal(owned, base.pokemon[owned.id])) return true;
        }
    }
    if (entity === 'pokemon') {
        const owned = other.pokemon[entityId] ?? base.pokemon[entityId];
        const run = owned ? other.playthroughs[owned.playthroughId] : undefined;
        if (run?.party.includes(entityId) && !equal(run.party, base.playthroughs[run.id]?.party))
            return true;
    }
    if (entity === 'observations') return false;
    for (const observation of Object.values(other.observations)) {
        const owned = other.pokemon[observation.pokemonId] ?? base.pokemon[observation.pokemonId];
        if (owned && belongs(owned) && !equal(observation, base.observations[observation.id]))
            return true;
    }
    return false;
}

/** Three-way merge; timestamps never determine whose correction wins. */
export function mergeCollections(
    base: CollectionDocument,
    local: CollectionDocument,
    remote: CollectionDocument,
): CollectionMerge {
    const remember = (input: CollectionDocument): CollectionDocument => ({
        ...input,
        pokemon: Object.fromEntries(
            Object.entries(input.pokemon).map(([id, pokemon]) => [
                id,
                recordLearnedWishlistMoves(pokemon),
            ]),
        ),
    });
    base = remember(base);
    local = remember(local);
    remote = remember(remote);
    const document = emptyCollection();
    const conflicts: CollectionConflict[] = [];
    for (const entity of ['playthroughs', 'pokemon', 'observations'] as const) {
        const destination = document[entity] as unknown as Record<string, Record<string, unknown>>;
        const ids = [
            ...new Set([
                ...Object.keys(base[entity]),
                ...Object.keys(local[entity]),
                ...Object.keys(remote[entity]),
            ]),
        ].sort();
        for (const entityId of ids) {
            const ancestor = structuredClone(base[entity][entityId]) as unknown as
                Record<string, unknown> | undefined;
            const ours = structuredClone(local[entity][entityId]) as unknown as
                Record<string, unknown> | undefined;
            const theirs = structuredClone(remote[entity][entityId]) as unknown as
                Record<string, unknown> | undefined;
            if (entity === 'pokemon') {
                // Acquisition history is monotonic; only wishlist choices need conflict resolution.
                const versions = [ancestor, ours, theirs];
                const learned = [
                    ...new Set(
                        versions.flatMap((version) =>
                            record(version?.moveWishlist)
                                ? (version.moveWishlist.learnedMoveIds as number[])
                                : [],
                        ),
                    ),
                ].sort((a, b) => a - b);
                for (const version of versions) {
                    if (version && record(version.moveWishlist))
                        version.moveWishlist = { ...version.moveWishlist, learnedMoveIds: learned };
                }
            }
            if (!ours && !theirs) continue;
            if (!ours || !theirs) {
                // Entries use tombstones, so absence only normally occurs for a new ID.
                destination[entityId] = structuredClone(ours ?? theirs!);
                if (ancestor)
                    conflicts.push(
                        conflict(
                            entity,
                            entityId,
                            '$entity',
                            ancestor,
                            ours,
                            theirs,
                            'delete-edit',
                        ),
                    );
                continue;
            }
            const localDeletes = ancestor?.deleted === false && ours.deleted === true;
            const remoteDeletes = ancestor?.deleted === false && theirs.deleted === true;
            const localDeleteConflict =
                localDeletes &&
                theirs.deleted === false &&
                (!equal(ancestor, theirs) || changedChildren(entity, entityId, base, remote));
            const remoteDeleteConflict =
                remoteDeletes &&
                ours.deleted === false &&
                (!equal(ancestor, ours) || changedChildren(entity, entityId, base, local));
            if (localDeleteConflict || remoteDeleteConflict) {
                // Preserve compatible edits inside a tombstone, while keeping divergent edits as alternatives.
                const localAlternative: Record<string, unknown> = { ...ours };
                const remoteAlternative: Record<string, unknown> = { ...theirs };
                if (entity === 'observations') {
                    // A measured event cannot be assembled from incompatible correction fields.
                    const deletedSide = localDeleteConflict ? ours : theirs;
                    const editedSide = localDeleteConflict ? theirs : ours;
                    const onlyRemoved = equal({ ...deletedSide, deleted: false }, ancestor);
                    if (onlyRemoved) {
                        Object.assign(localAlternative, editedSide, { deleted: ours.deleted });
                        Object.assign(remoteAlternative, editedSide, { deleted: theirs.deleted });
                    }
                } else {
                    for (const field of [
                        ...new Set([...Object.keys(ours), ...Object.keys(theirs)]),
                    ].filter((field) => field !== 'deleted')) {
                        if (equal(ours[field], ancestor?.[field]))
                            localAlternative[field] = theirs[field];
                        if (equal(theirs[field], ancestor?.[field]))
                            remoteAlternative[field] = ours[field];
                    }
                }
                for (const alternative of [localAlternative, remoteAlternative]) {
                    for (const field of Object.keys(alternative)) {
                        if (alternative[field] === undefined) delete alternative[field];
                    }
                }
                destination[entityId] = structuredClone(localAlternative);
                conflicts.push(
                    conflict(
                        entity,
                        entityId,
                        '$entity',
                        ancestor,
                        localAlternative,
                        remoteAlternative,
                        'delete-edit',
                    ),
                );
                continue;
            }
            if (entity === 'observations') {
                // An observation is one measured event; concurrent corrections must stay coherent.
                if (equal(ours, theirs) || equal(theirs, ancestor))
                    destination[entityId] = structuredClone(ours);
                else if (equal(ours, ancestor)) destination[entityId] = structuredClone(theirs);
                else {
                    destination[entityId] = structuredClone(ours);
                    conflicts.push(conflict(entity, entityId, '$entity', ancestor, ours, theirs));
                }
                continue;
            }
            const merged: Record<string, unknown> = {};
            for (const field of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
                if (equal(ours[field], theirs[field]) || equal(theirs[field], ancestor?.[field]))
                    merged[field] = structuredClone(ours[field]);
                else if (equal(ours[field], ancestor?.[field]))
                    merged[field] = structuredClone(theirs[field]);
                else {
                    merged[field] = structuredClone(ours[field]);
                    conflicts.push(
                        conflict(
                            entity,
                            entityId,
                            field,
                            ancestor?.[field],
                            ours[field],
                            theirs[field],
                            field === 'party' ? 'party' : 'field',
                        ),
                    );
                }
            }
            for (const field of Object.keys(merged)) {
                if (merged[field] === undefined) delete merged[field];
            }
            destination[entityId] = merged;
        }
    }
    for (const [id, pokemon] of Object.entries(document.pokemon))
        document.pokemon[id] = recordLearnedWishlistMoves(pokemon);
    for (const run of Object.values(document.playthroughs)) {
        const validParty = validLineup(document, run.id, run.party);
        if (!equal(validParty, run.party)) {
            const existing = conflicts.find(
                (item) =>
                    item.entity === 'playthroughs' &&
                    item.entityId === run.id &&
                    item.field === 'party',
            );
            if (!existing)
                conflicts.push(
                    conflict(
                        'playthroughs',
                        run.id,
                        'party',
                        base.playthroughs[run.id]?.party,
                        local.playthroughs[run.id]?.party ?? [],
                        remote.playthroughs[run.id]?.party ?? [],
                        'party',
                    ),
                );
            run.party = validParty;
        }
    }
    return { document, conflicts };
}

function validLineup(
    document: CollectionDocument,
    runId: string,
    party: readonly string[],
): string[] {
    return [...new Set(party)]
        .filter((pokemonId) => {
            const owned = document.pokemon[pokemonId];
            return owned && !owned.deleted && owned.playthroughId === runId;
        })
        .slice(0, 6);
}

/** Apply a stored alternative; descendants remain retained even under a deleted parent. */
export function applyConflictChoice(
    document: CollectionDocument,
    item: CollectionConflict,
    choice: 'local' | 'remote',
): CollectionDocument {
    const next = structuredClone(document);
    const entities = next[item.entity] as unknown as Record<string, Record<string, unknown>>;
    const selected = structuredClone(item[choice]);
    if (item.field === '$entity') {
        if (selected === null) {
            // Use a tombstone instead of destroying the recoverable record or its history.
            if (entities[item.entityId]) entities[item.entityId].deleted = true;
        } else entities[item.entityId] = selected as Record<string, unknown>;
    } else if (entities[item.entityId]) {
        if (item.entity === 'pokemon' && item.field === 'moveWishlist' && selected === null)
            delete entities[item.entityId][item.field];
        else entities[item.entityId][item.field] = selected;
    }
    if (item.entity === 'playthroughs' && (item.field === 'party' || item.field === '$entity')) {
        const run = next.playthroughs[item.entityId];
        if (run && !equal(run.party, validLineup(next, run.id, run.party))) {
            throw new Error(
                'Resolve related removed Pokémon first, then choose this party lineup. Your alternatives are still available.',
            );
        }
    }
    for (const [id, pokemon] of Object.entries(next.pokemon)) {
        if (pokemon.moveWishlist) {
            pokemon.moveWishlist.learnedMoveIds = [
                ...new Set([
                    ...(document.pokemon[id]?.moveWishlist?.learnedMoveIds ?? []),
                    ...pokemon.moveWishlist.learnedMoveIds,
                ]),
            ];
        }
        next.pokemon[id] = recordLearnedWishlistMoves(pokemon);
    }
    for (const run of Object.values(next.playthroughs))
        run.party = validLineup(next, run.id, run.party);
    return next;
}

/** Read the current visible value when carrying an unresolved conflict through another sync. */
export function readConflictValue(
    document: CollectionDocument,
    item: CollectionConflict,
): JsonValue {
    const entity = document[item.entity][item.entityId] as unknown as
        Record<string, unknown> | undefined;
    return json(item.field === '$entity' ? entity : entity?.[item.field]);
}

export interface StatEstimate {
    pokemonId: string;
    level: number;
    speciesId: number;
    formEpoch: string;
    stats: Partial<BaseStats>;
    estimated: true;
}

/** Interpolate each stat only between unambiguous observations of the same individual and form epoch. */
export function interpolateStats(observations: readonly StatObservation[]): StatEstimate[] {
    const groups = new Map<string, StatObservation[]>();
    for (const observation of observations.filter((item) => !item.deleted)) {
        const key = `${observation.pokemonId}:${observation.speciesId}:${observation.formEpoch}`;
        groups.set(key, [...(groups.get(key) ?? []), observation]);
    }
    const estimates: StatEstimate[] = [];
    for (const group of groups.values()) {
        const byLevel = new Map<number, StatEstimate>();
        for (const stat of statKeys) {
            const values = new Map<number, number[]>();
            for (const entry of group) {
                const value = entry.stats[stat];
                if (value !== undefined)
                    values.set(entry.level, [...(values.get(entry.level) ?? []), value]);
            }
            const levels = [...values.keys()].sort((a, b) => a - b);
            for (let index = 1; index < levels.length; index++) {
                const from = levels[index - 1];
                const to = levels[index];
                const left = [...new Set(values.get(from))];
                const right = [...new Set(values.get(to))];
                // Multiple measurements at one level can differ due to training. Do not select one silently.
                if (left.length !== 1 || right.length !== 1) continue;
                for (let level = from + 1; level < to; level++) {
                    const estimate = byLevel.get(level) ?? {
                        pokemonId: group[0].pokemonId,
                        level,
                        speciesId: group[0].speciesId,
                        formEpoch: group[0].formEpoch,
                        stats: {},
                        estimated: true,
                    };
                    estimate.stats[stat] = Math.round(
                        left[0] + ((right[0] - left[0]) * (level - from)) / (to - from),
                    );
                    byLevel.set(level, estimate);
                }
            }
        }
        estimates.push(...[...byLevel.values()].sort((a, b) => a.level - b.level));
    }
    return estimates;
}
