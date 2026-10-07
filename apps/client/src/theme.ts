import type { CSSProperties } from 'react';

export type DexTheme = 'dark' | 'light';

const themeStorageKey = 'emerald-ex-theme';

export function readTheme(): DexTheme {
    if (typeof document !== 'undefined') {
        const activeTheme = document.documentElement.dataset.theme;
        if (activeTheme === 'light' || activeTheme === 'dark') return activeTheme;
    }
    try {
        return localStorage.getItem(themeStorageKey) === 'light' ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
}

export function applyTheme(theme: DexTheme): void {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
}

export function saveTheme(theme: DexTheme): void {
    applyTheme(theme);
    try {
        localStorage.setItem(themeStorageKey, theme);
    } catch {
        // The appearance remains usable when browser storage is unavailable.
    }
}

const typeColors: Readonly<Record<string, string>> = {
    Normal: '#b6bca6',
    Fire: '#f48b53',
    Water: '#55b6e8',
    Electric: '#ead25e',
    Grass: '#80c56a',
    Ice: '#86d8d2',
    Fighting: '#dc8772',
    Poison: '#bb83d8',
    Ground: '#cfa479',
    Flying: '#9bbbed',
    Psychic: '#ef94b2',
    Bug: '#afbd5f',
    Rock: '#c6b883',
    Ghost: '#a593d6',
    Dragon: '#8e9bec',
    Dark: '#a7a3b4',
    Steel: '#a6bfc7',
    Fairy: '#e6a3cf',
};

export function typeSurfaceStyle(types: readonly string[]): CSSProperties {
    const primary = typeColors[types[0] ?? ''] ?? '#66d9af';
    return {
        '--type-primary': primary,
        '--type-secondary': typeColors[types[1] ?? ''] ?? primary,
    } as CSSProperties;
}
