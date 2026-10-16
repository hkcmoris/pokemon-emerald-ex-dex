import type { Ability, OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

export interface AbilityChoice {
    ability: Ability;
    hidden: boolean;
}

export function getAbilityChoices(
    species: Pick<SpeciesDetails, 'abilities'> | undefined,
): AbilityChoice[] {
    const choices = new Map<number, AbilityChoice>();
    for (const slot of species?.abilities ?? []) {
        if (!slot.ability) continue;
        const existing = choices.get(slot.ability.abilityId);
        choices.set(slot.ability.abilityId, {
            ability: slot.ability,
            hidden: (existing?.hidden ?? true) && slot.kind === 'hidden',
        });
    }
    return [...choices.values()];
}

export function getSelectedAbility(
    pokemon: Pick<OwnedPokemon, 'state' | 'ability'>,
    species: Pick<SpeciesDetails, 'speciesId' | 'abilities'> | undefined,
): AbilityChoice | null {
    if (
        !species ||
        species.speciesId !== pokemon.state.speciesId ||
        pokemon.ability?.speciesId !== species.speciesId
    )
        return null;
    return (
        getAbilityChoices(species).find(
            ({ ability }) => ability.abilityId === pokemon.ability?.abilityId,
        ) ?? null
    );
}
