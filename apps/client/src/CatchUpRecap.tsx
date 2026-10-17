import { useId, useState } from 'react';
import {
    getCatchUpRecap,
    type KnownMove,
    type OwnedPokemon,
    type SpeciesDetails,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';
import { useLanguage } from './language.js';
import { MyPokemonMove } from './MyPokemonMove.js';
import { ObservationForm } from './MyPokemonHistory.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { evolutionSummary } from './evolutionText.js';
import type { CatchUpChanges } from './catchUpChanges.js';
import { chooseReviewEvolution, useLevelReview } from './levelingSession.js';
import { requestMoveLearning } from './moveChoices.js';

export function CatchUpRecap({
    pokemon,
    datasetId,
    natureId = pokemon.natureId,
    observations = [],
    predictionsEnabled = true,
    details,
    oldLevel,
    newLevel,
    moves,
    onSave,
    saveObservation,
    onClose,
    onRecord,
}: {
    pokemon: OwnedPokemon;
    datasetId?: string;
    natureId?: number | null;
    observations?: readonly StatObservation[];
    predictionsEnabled?: boolean;
    details: SpeciesDetails;
    oldLevel: number;
    newLevel: number;
    moves: KnownMove[] | null;
    onSave: (changes: CatchUpChanges) => Promise<void>;
    saveObservation: (observation: StatObservation) => Promise<void>;
    onClose: () => void;
    onRecord?: () => void;
}) {
    const { t, language } = useLanguage();
    const recap = getCatchUpRecap(details, oldLevel, newLevel);
    const [recording, setRecording] = useState(false);
    const selectedEvolution = useLevelReview(pokemon)?.evolutionSpeciesId;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const formId = useId();
    async function confirmEvolution() {
        if (busy || selectedEvolution === undefined) return;
        setBusy(true);
        setError(false);
        try {
            await onSave({ evolutionSpeciesId: selectedEvolution });
            onClose();
        } catch {
            setError(true);
        } finally {
            setBusy(false);
        }
    }
    if (recap.moves.length === 0 && recap.evolutions.length === 0) return null;
    return (
        <section
            className="my-recap my-stack"
            aria-label={t('Pending level-up decisions', 'Nevyřízené změny po zvýšení úrovně')}
        >
            <div className="my-section-heading flex-wrap">
                <h3>
                    {t('Level saved', 'Úroveň uložena')} · {oldLevel} → {newLevel}
                </h3>
                <div className="my-actions">
                    <button
                        type="button"
                        className="page-button"
                        disabled={busy}
                        aria-controls={onRecord ? undefined : formId}
                        onClick={() => (onRecord ? onRecord() : setRecording(!recording))}
                    >
                        {t('Record stats', 'Zapsat statistiky')}
                    </button>
                    <button
                        type="button"
                        className="my-text-button"
                        disabled={busy}
                        onClick={onClose}
                    >
                        {t('Done reviewing', 'Kontrola dokončena')}
                    </button>
                </div>
            </div>
            <p className="my-muted">
                {t(
                    'Review now or return later; these decisions stay with this Pokémon. If you evolved during it, check the timing. Nothing is learned or evolved automatically.',
                    'Zkontrolujte nyní nebo se vraťte později; rozhodnutí zůstanou u tohoto Pokémona. Pokud během období došlo k vývoji, ověřte načasování. Útok ani vývoj se nezapíše automaticky.',
                )}
            </p>
            {recording && (
                <div id={formId}>
                    <ObservationForm
                        pokemon={pokemon}
                        natureId={natureId}
                        observations={observations}
                        predictionsEnabled={predictionsEnabled}
                        family={[details]}
                        onSave={async (entry) => {
                            await saveObservation(entry);
                            setRecording(false);
                        }}
                        onCancel={() => setRecording(false)}
                    />
                </div>
            )}
            {recap.moves.length > 0 && (
                <>
                    <h4>{t('Did you learn any of these?', 'Naučil se některý z těchto útoků?')}</h4>
                    <div className="my-move-chips">
                        {recap.moves.map((move) => {
                            const known = moves?.some((entry) => entry.moveId === move.moveId);
                            return (
                                <MyPokemonMove
                                    as="button"
                                    key={`${move.moveId}-${move.level}`}
                                    move={move}
                                    reference={move}
                                    disabled={busy || known}
                                    actionLabel={
                                        known
                                            ? t(
                                                  `${move.name} already recorded`,
                                                  `Útok ${move.name} už je zaznamenán`,
                                              )
                                            : t(
                                                  `Learn or replace ${move.name}`,
                                                  `Naučit nebo nahradit ${move.name}`,
                                              )
                                    }
                                    onClick={() => requestMoveLearning(pokemon, move)}
                                    suffix={
                                        <span className="my-level-badge">
                                            {known
                                                ? t('Recorded', 'Zapsáno')
                                                : t('Learn / replace', 'Naučit / nahradit')}{' '}
                                            · Lv. {move.level}
                                        </span>
                                    }
                                />
                            );
                        })}
                    </div>
                </>
            )}
            {recap.evolutions.map(({ evolution, condition, note }) => (
                <div
                    className="my-recap-evolution"
                    key={`${evolution.toSpeciesId}:${evolution.edgeOrder}`}
                >
                    <SpeciesSprite
                        datasetId={datasetId}
                        file={evolution.toSprite}
                        name={evolution.toName}
                    />
                    <div className="my-recap-evolution-copy">
                        <strong>{evolution.toName}</strong>
                        <span>{evolutionSummary(evolution.summary, language)}</span>
                        <small>
                            {t(
                                note,
                                condition === 'level-met'
                                    ? 'Požadované úrovně dosaženo; potvrďte, zda vývoj skutečně proběhl.'
                                    : `Ostatní podmínky je nutné ověřit: ${evolutionSummary(evolution.summary, 'cs')}`,
                            )}
                        </small>
                        <button
                            type="button"
                            className="page-button"
                            disabled={busy}
                            aria-pressed={selectedEvolution === evolution.toSpeciesId}
                            onClick={() => chooseReviewEvolution(pokemon.id, evolution.toSpeciesId)}
                        >
                            {t(
                                `Record evolution to ${evolution.toName}`,
                                `Zapsat vývoj na ${evolution.toName}`,
                            )}
                        </button>
                    </div>
                </div>
            ))}
            {selectedEvolution !== undefined && (
                <div className="my-inset my-stack">
                    <p>
                        {t(
                            'Confirm that this evolution happened in your game. Earlier stats keep their original form; current moves stay unchanged.',
                            'Potvrďte, že tento vývoj proběhl ve hře. Starší statistiky zůstanou u původní formy; aktuální útoky zůstanou zachované.',
                        )}
                    </p>
                    <div className="my-actions">
                        <button
                            type="button"
                            className="my-primary"
                            disabled={busy}
                            onClick={() => void confirmEvolution()}
                        >
                            {t('Confirm evolution', 'Potvrdit vývoj')}
                        </button>
                        <button
                            type="button"
                            className="page-button"
                            disabled={busy}
                            onClick={() => chooseReviewEvolution(pokemon.id)}
                        >
                            {t('Cancel', 'Zrušit')}
                        </button>
                    </div>
                </div>
            )}
            {error && (
                <p role="alert">
                    {t(
                        'Could not save the evolution. Try again.',
                        'Vývoj se nepodařilo uložit. Zkuste to znovu.',
                    )}
                </p>
            )}
        </section>
    );
}
