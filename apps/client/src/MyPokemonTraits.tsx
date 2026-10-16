import { useId, useState } from 'react';
import {
    pokemonNatures,
    type OwnedPokemon,
    type SpeciesDetails,
} from '@pokemon-emerald-ex-dex/shared';

import { useLanguage } from './language.js';
import { statName } from './MyPokemonHistory.js';
import { NatureStat } from './NatureStat.js';
import { getAbilityChoices, getSelectedAbility } from './pokemonTraits.js';

export function MyPokemonTraits({
    pokemon,
    species,
    stateConflict = false,
    natureConflict = false,
    abilityConflict = false,
    onUpdate,
}: {
    pokemon: OwnedPokemon;
    species?: SpeciesDetails;
    stateConflict?: boolean;
    natureConflict?: boolean;
    abilityConflict?: boolean;
    onUpdate: (updater: (current: OwnedPokemon) => OwnedPokemon) => Promise<void>;
}) {
    const { t, language } = useLanguage();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const natureNoteId = useId();
    const abilityNoteId = useId();
    const nature = pokemonNatures.find((entry) => entry.id === pokemon.natureId);
    const choices = getAbilityChoices(species);
    const selectedAbility = getSelectedAbility(pokemon, species);
    const naturePaused = stateConflict || natureConflict;
    const abilityPaused = stateConflict || abilityConflict;
    const abilityLabel = (choice: (typeof choices)[number]) =>
        `${choice.ability.name}${choice.hidden ? ` · ${t('Hidden', 'Skrytá')}` : ''}`;
    async function save(updater: (current: OwnedPokemon) => OwnedPokemon) {
        setBusy(true);
        setError(null);
        try {
            await onUpdate((current) => {
                if (current.deleted) throw new Error('Pokémon is deleted.');
                return updater(current);
            });
        } catch {
            setError(
                t(
                    'Could not save this selection. Try again.',
                    'Výběr se nepodařilo uložit. Zkuste to znovu.',
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <section
            className="my-pokemon-traits"
            aria-label={t('Nature and ability', 'Povaha a schopnost')}
        >
            <div className="my-pokemon-trait">
                <label className="filter-label">
                    {t('Nature', 'Povaha')}
                    <select
                        className="filter-input"
                        value={nature?.id ?? ''}
                        disabled={busy || naturePaused}
                        aria-describedby={natureNoteId}
                        onChange={(event) => {
                            const natureId =
                                event.target.value === '' ? null : Number(event.target.value);
                            void save((current) => ({ ...current, natureId }));
                        }}
                    >
                        <option value="">{t('Unknown', 'Neznámá')}</option>
                        {pokemonNatures.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                                {entry.name}
                                {entry.increasedStat && entry.decreasedStat
                                    ? ` (+${statName(entry.increasedStat, t)}, −${statName(entry.decreasedStat, t)})`
                                    : ` · ${t('Neutral', 'Neutrální')}`}
                            </option>
                        ))}
                    </select>
                </label>
                <p id={natureNoteId} className="my-trait-note">
                    {naturePaused ? (
                        t(
                            'Resolve the conflicting update to use this nature.',
                            'Pro použití povahy vyřešte konfliktní úpravu.',
                        )
                    ) : nature?.increasedStat && nature.decreasedStat ? (
                        <>
                            <NatureStat stat={nature.increasedStat} natureId={nature.id}>
                                {statName(nature.increasedStat, t)} +10 %
                            </NatureStat>
                            {' · '}
                            <NatureStat stat={nature.decreasedStat} natureId={nature.id}>
                                {statName(nature.decreasedStat, t)} −10 %
                            </NatureStat>
                        </>
                    ) : nature ? (
                        t('No stat changes.', 'Bez změny statistik.')
                    ) : (
                        t('Select the nature shown in game.', 'Vyberte povahu uvedenou ve hře.')
                    )}
                </p>
            </div>
            <div className="my-pokemon-trait">
                {choices.length > 1 ? (
                    <label className="filter-label">
                        {t('Ability', 'Schopnost')}
                        <select
                            className="filter-input"
                            value={selectedAbility?.ability.abilityId ?? ''}
                            disabled={busy || abilityPaused}
                            aria-describedby={abilityNoteId}
                            onChange={(event) => {
                                const abilityId =
                                    event.target.value === '' ? null : Number(event.target.value);
                                const speciesId = pokemon.state.speciesId;
                                void save((current) => {
                                    if (current.state.speciesId !== speciesId)
                                        throw new Error('Pokémon form changed.');
                                    return {
                                        ...current,
                                        ability:
                                            abilityId === null ? null : { speciesId, abilityId },
                                    };
                                });
                            }}
                        >
                            <option value="">{t('Unknown', 'Neznámá')}</option>
                            {choices.map((choice) => (
                                <option
                                    key={choice.ability.abilityId}
                                    value={choice.ability.abilityId}
                                >
                                    {abilityLabel(choice)}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : (
                    <div className="filter-label">
                        <span>{t('Ability', 'Schopnost')}</span>
                        <strong className="my-trait-single-ability">
                            {choices[0] ? abilityLabel(choices[0]) : t('Unavailable', 'Nedostupná')}
                        </strong>
                    </div>
                )}
                <p id={abilityNoteId} className="my-trait-note">
                    {abilityPaused
                        ? t(
                              'Resolve the conflicting update to use this ability.',
                              'Pro použití schopnosti vyřešte konfliktní úpravu.',
                          )
                        : selectedAbility
                          ? (language === 'cs' && selectedAbility.ability.descriptionCs) ||
                            selectedAbility.ability.description
                          : choices.length === 1
                            ? t(
                                  'Only ability available for this form.',
                                  'Jediná schopnost dostupná pro tuto formu.',
                              )
                            : choices.length > 1
                              ? pokemon.ability
                                  ? t(
                                        'Select the ability for this form again.',
                                        'Znovu vyberte schopnost pro tuto formu.',
                                    )
                                  : t(
                                        'Select the ability shown in game.',
                                        'Vyberte schopnost uvedenou ve hře.',
                                    )
                              : t(
                                    'Ability data is unavailable.',
                                    'Údaje o schopnostech nejsou dostupné.',
                                )}
                </p>
            </div>
            <p className="my-trait-note my-trait-recorded-note">
                {t(
                    'Recorded stats already include nature; their values stay unchanged.',
                    'Zapsané statistiky již zahrnují povahu. Jejich hodnoty se nemění.',
                )}
            </p>
            {error && (
                <p className="my-trait-error" role="alert">
                    {error}
                </p>
            )}
        </section>
    );
}
