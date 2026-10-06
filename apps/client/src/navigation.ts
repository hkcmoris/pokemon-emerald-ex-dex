export type DexRoute =
    | { kind: 'dex' }
    | { kind: 'species'; id: number }
    | { kind: 'items' }
    | { kind: 'item'; id: number }
    | { kind: 'not-found' };

export function itemHref(id: number): string {
    return `#/items/${id}`;
}

export function speciesHref(id: number): string {
    return `#/species/${id}`;
}

export function parseRoute(hash: string): DexRoute {
    if (hash === '' || hash === '#' || hash === '#/') return { kind: 'dex' };
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
