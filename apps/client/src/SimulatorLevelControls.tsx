import { useRef, useState } from 'react';
import {
    getCatchUpRecap,
    type OwnedPokemon,
    type SpeciesDetails,
} from '@pokemon-emerald-ex-dex/shared';

import { LevelEditor } from './LevelEditor.js';
import { useLanguage } from './language.js';
import {
    rememberLevelReview,
    useLevelReview,
    useLevelReviewStorageError,
} from './levelingSession.js';
import { ownedPokemonHref } from './navigation.js';

export function SimulatorLevelControls({
    pokemon,
    species,
    onSave,
}: {
    pokemon: OwnedPokemon;
    species: SpeciesDetails;
    onSave: (pokemon: OwnedPokemon, level: number) => Promise<void>;
}) {
    const { t } = useLanguage();
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const saving = useRef(false);
    const [error, setError] = useState(false);
    const [savedLevel, setSavedLevel] = useState<number>();
    const review = useLevelReview(pokemon);
    const storageError = useLevelReviewStorageError();

    async function save(level: number) {
        if (saving.current) return;
        saving.current = true;
        setBusy(true);
        setError(false);
        try {
            await onSave(pokemon, level);
            if (level > pokemon.state.level) {
                const opportunities = getCatchUpRecap(species, pokemon.state.level, level);
                if (opportunities.moves.length || opportunities.evolutions.length) {
                    rememberLevelReview(pokemon.id, {
                        speciesId: pokemon.state.speciesId,
                        formEpoch: pokemon.state.formEpoch,
                        oldLevel: pokemon.state.level,
                        newLevel: level,
                    });
                }
            }
            setSavedLevel(level);
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    return (
        <section
            className="my-panel sim-level-session"
            aria-label={t('Saved Pokémon level', 'Uložená úroveň Pokémona')}
        >
            <div className="sim-level-actions">
                <div>
                    <h2>{pokemon.nickname || species.name}</h2>
                    <p className="my-muted">{t('Saved level', 'Uložená úroveň')}</p>
                </div>
                <LevelEditor
                    key={pokemon.state.level}
                    value={pokemon.state.level}
                    disabled={busy}
                    onSave={save}
                    onEditingChange={setEditing}
                />
                <button
                    type="button"
                    className="my-primary"
                    disabled={busy || editing || pokemon.state.level >= 100}
                    onClick={() => {
                        void save(pokemon.state.level + 1).catch(() => setError(true));
                    }}
                >
                    {busy ? t('Saving…', 'Ukládání…') : t('Level up +1', 'Zvýšit úroveň +1')}
                </button>
                <a className="my-text-button" href={ownedPokemonHref(pokemon.id)}>
                    {review
                        ? t('Review level-up changes →', 'Zkontrolovat změny po zvýšení úrovně →')
                        : t('Stats & history →', 'Statistiky a historie →')}
                </a>
            </div>
            <p className="my-muted">
                {t(
                    'Level changes save to your collection. Record the new stats after leveling; older measurements stay in history.',
                    'Změna úrovně se uloží do sbírky. Po zvýšení úrovně zapište nové statistiky; starší měření zůstanou v historii.',
                )}
            </p>
            {savedLevel !== undefined && (
                <p role="status">
                    {t(`Level ${savedLevel} saved.`, `Úroveň ${savedLevel} uložena.`)}
                </p>
            )}
            {error && (
                <p role="alert">
                    {t(
                        'Could not save the level. Try again.',
                        'Úroveň se nepodařilo uložit. Zkuste to znovu.',
                    )}
                </p>
            )}
            {storageError && (
                <p role="alert">
                    {t(
                        'Level-up decisions could not be saved on this device. Review them before closing the app.',
                        'Rozhodnutí po zvýšení úrovně se nepodařilo uložit na tomto zařízení. Zkontrolujte je před zavřením aplikace.',
                    )}
                </p>
            )}
        </section>
    );
}
