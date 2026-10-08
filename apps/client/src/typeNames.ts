import type { Language } from './language.js';

// Translate display labels only; database names remain the keys for filters and styling.
const czechTypeNames: Readonly<Record<string, string>> = {
    Normal: 'Normální',
    Fighting: 'Bojový',
    Flying: 'Létající',
    Poison: 'Jedový',
    Ground: 'Zemní',
    Rock: 'Kamenný',
    Bug: 'Hmyzí',
    Ghost: 'Duchový',
    Steel: 'Ocelový',
    Mystery: 'Neznámý',
    Fire: 'Ohnivý',
    Water: 'Vodní',
    Grass: 'Travní',
    Electric: 'Elektrický',
    Psychic: 'Psychický',
    Ice: 'Ledový',
    Dragon: 'Dračí',
    Dark: 'Temný',
    Fairy: 'Vílí',
};

export function typeDisplayName(name: string, language: Language): string {
    if (language !== 'cs' || !Object.hasOwn(czechTypeNames, name)) return name;
    return czechTypeNames[name] ?? name;
}
