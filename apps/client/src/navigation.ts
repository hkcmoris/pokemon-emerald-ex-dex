export type DexRoute =
    | { kind: 'dex' }
    | { kind: 'my-pokemon'; addSpeciesId?: number }
    | { kind: 'owned-pokemon'; id: string }
    | { kind: 'damage-simulator'; id: string }
    | { kind: 'species'; id: number }
    | { kind: 'abilities' }
    | { kind: 'ability'; id: number }
    | { kind: 'items' }
    | { kind: 'item'; id: number }
    | { kind: 'not-found' };

export function abilityHref(id: number): string {
    return `#/abilities/${id}`;
}

export function itemHref(id: number): string {
    return `#/items/${id}`;
}

export function speciesHref(id: number): string {
    return `#/species/${id}`;
}

export function ownedPokemonHref(id: string): string {
    return `#/my-pokemon/${encodeURIComponent(id)}`;
}

export function damageSimulatorHref(id: string): string {
    return `${ownedPokemonHref(id)}/simulator`;
}

export function parseRoute(hash: string): DexRoute {
    if (hash === '' || hash === '#' || hash === '#/') return { kind: 'dex' };
    if (hash === '#/my-pokemon') return { kind: 'my-pokemon' };
    const collection = /^#\/my-pokemon\?add=(\d+)$/.exec(hash);
    if (collection) {
        const id = Number(collection[1]);
        return Number.isInteger(id) && id >= 1 && id <= 65535
            ? { kind: 'my-pokemon', addSpeciesId: id }
            : { kind: 'not-found' };
    }
    const ownedPokemon = /^#\/my-pokemon\/([^/?#]+)(\/simulator)?$/.exec(hash);
    if (ownedPokemon) {
        try {
            const id = decodeURIComponent(ownedPokemon[1]);
            return /^[A-Za-z0-9_-]{1,80}$/.test(id) &&
                !['__proto__', 'prototype', 'constructor'].includes(id)
                ? { kind: ownedPokemon[2] ? 'damage-simulator' : 'owned-pokemon', id }
                : { kind: 'not-found' };
        } catch {
            return { kind: 'not-found' };
        }
    }
    if (hash === '#/abilities') return { kind: 'abilities' };
    const ability = /^#\/abilities\/(\d+)$/.exec(hash);
    if (ability) {
        const id = Number(ability[1]);
        return Number.isInteger(id) && id >= 0 && id <= 65535
            ? { kind: 'ability', id }
            : { kind: 'not-found' };
    }
    if (hash === '#/items') return { kind: 'items' };
    const item = /^#\/items\/(\d+)$/.exec(hash);
    if (item) {
        const id = Number(item[1]);
        return Number.isInteger(id) && id >= 0 && id <= 65535
            ? { kind: 'item', id }
            : { kind: 'not-found' };
    }
    const match = /^#\/species\/(\d+)$/.exec(hash);
    if (!match) return { kind: 'not-found' };
    const id = Number(match[1]);
    return Number.isInteger(id) && id >= 1 && id <= 65535
        ? { kind: 'species', id }
        : { kind: 'not-found' };
}

export function subscribeToNavigation(onChange: () => void): () => void {
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
}

export function navigationSnapshot(): string {
    return window.location.hash;
}
