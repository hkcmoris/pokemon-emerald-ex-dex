import type { CollectionDocument, OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';

/** Save a level against the currently stored member without replacing newer unrelated edits. */
export function setOwnedPokemonLevel(
    document: CollectionDocument,
    expectedPokemon: OwnedPokemon,
    level: number,
): CollectionDocument {
    if (!Number.isInteger(level) || level < 1 || level > 100)
        throw new Error('The level must be a whole number from 1 to 100.');
    const current = document.pokemon[expectedPokemon.id];
    const run = document.playthroughs[expectedPokemon.playthroughId];
    if (
        expectedPokemon.deleted ||
        !current ||
        current.deleted ||
        current.id !== expectedPokemon.id ||
        current.playthroughId !== expectedPokemon.playthroughId ||
        !run ||
        run.deleted ||
        current.state.speciesId !== expectedPokemon.state.speciesId ||
        current.state.formEpoch !== expectedPokemon.state.formEpoch ||
        current.state.level !== expectedPokemon.state.level
    )
        throw new Error(
            'This Pokémon or its playthrough changed. Check its current level and try again.',
        );
    if (level === current.state.level) return document;
    return {
        ...document,
        pokemon: {
            ...document.pokemon,
            [current.id]: {
                ...current,
                state: { ...current.state, level },
            },
        },
    };
}
