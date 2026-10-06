export type DexRoute = { kind: 'dex' } | { kind: 'species'; id: number } | { kind: 'not-found' };

export function speciesHref(id: number): string {
    return `#/species/${id}`;
}

export function parseRoute(hash: string): DexRoute {
    if (hash === '' || hash === '#' || hash === '#/') return { kind: 'dex' };
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
