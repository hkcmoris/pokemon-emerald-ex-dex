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
    Normal: '#e2e3e3',
    Fire: '#e32d35',
    Water: '#0293ca',
    Electric: '#ffe000',
    Grass: '#009754',
    Ice: '#22afcc',
    Fighting: '#b56826',
    Poison: '#b04de2',
    Ground: '#8c3312',
    Flying: '#a6cef6',
    Psychic: '#75598f',
    Bug: '#d6f835',
    Rock: '#d1be8a',
    Ghost: '#2c3490',
    Dragon: '#9b9f4b',
    Dark: '#006c85',
    Steel: '#8e8f7e',
    Fairy: '#d7869d',
};

export function typeSurfaceStyle(types: readonly string[]): CSSProperties {
    const primary = typeColors[types[0] ?? ''] ?? '#66d9af';
    return {
        '--type-primary': primary,
        '--type-secondary': typeColors[types[1] ?? ''] ?? primary,
    } as CSSProperties;
}
