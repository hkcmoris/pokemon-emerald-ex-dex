import { useEffect, useState } from 'react';
import type { OwnedPokemon, SpeciesDetails, StatObservation } from '@pokemon-emerald-ex-dex/shared';
import { useQuery } from '@tanstack/react-query';
import { loadCollectionFamily } from './collectionSpecies.js';
import { useLanguage } from './language.js';
import { ObservationForm } from './MyPokemonHistory.js';
import {
    clearObservationDraft,
    getObservationDraft,
    reassignObservationDraft,
    setObservationDraft,
    useObservationDraftSaving,
    type ObservationDraft,
} from './observationDrafts.js';
import {
    addScreenshotQueueItems,
    changeScreenshotQueueItem,
    createStatScreenshot,
    readScreenshotQueue,
    saveQueuedScreenshot,
    subscribeScreenshotQueue,
    screenshotDraftKey,
    type StatScreenshot,
} from './screenshotQueue.js';

function ScreenshotImage({ screenshot }: { screenshot: StatScreenshot }) {
    const { t } = useLanguage();
    const [url, setUrl] = useState<string>();
    const [expanded, setExpanded] = useState(false);
    useEffect(() => {
        const nextUrl = URL.createObjectURL(screenshot.image);
        setUrl(nextUrl);
        return () => URL.revokeObjectURL(nextUrl);
    }, [screenshot.image]);
    return (
        <figure className={`my-screenshot-reference${expanded ? ' my-screenshot-expanded' : ''}`}>
            <button
                className="my-screenshot-image-button"
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
                aria-label={
                    expanded
                        ? t('Fit screenshot', 'Přizpůsobit snímek')
                        : t('Enlarge screenshot', 'Zvětšit snímek')
                }
            >
                {url && <img src={url} alt={screenshot.name} />}
            </button>
            <figcaption>
                {screenshot.name} · {t('Click image to enlarge', 'Kliknutím snímek zvětšíte')}
            </figcaption>
        </figure>
    );
}

function QueuedObservation({
    screenshot,
    pokemon,
    observations,
    family,
    onSave,
    onSaved,
    onSkip,
    predictionsEnabled,
}: {
    screenshot: StatScreenshot;
    pokemon: OwnedPokemon;
    observations: readonly StatObservation[];
    family: readonly SpeciesDetails[];
    onSave: (observation: StatObservation) => Promise<void>;
    onSaved: () => void;
    onSkip: () => void;
    predictionsEnabled: boolean;
}) {
    const { t } = useLanguage();
    const relatives = useQuery({
        queryKey: ['collection-family', pokemon.state.speciesId],
        queryFn: () => loadCollectionFamily(pokemon.state.speciesId),
    });
    return (
        <ObservationForm
            pokemon={pokemon}
            observations={observations.filter((entry) => entry.pokemonId === pokemon.id)}
            predictionsEnabled={predictionsEnabled}
            family={
                relatives.data ??
                (family.some((entry) => entry.speciesId === pokemon.state.speciesId) ? family : [])
            }
            draftKey={screenshotDraftKey(screenshot.id, pokemon.id)}
            newObservationId={screenshot.observationId}
            onSave={onSave}
            onSaved={onSaved}
            cancelLabel={t('Keep for later', 'Nechat na později')}
            preserveDraftOnCancel
            onCancel={onSkip}
        />
    );
}

/** Imported screenshots and transcription drafts stay on this device; saved images remain in the archive. */
export function ScreenshotObservationQueue({
    pokemon,
    members = [pokemon],
    observations,
    family = [],
    blockedPokemonIds = [],
    predictionDisabledPokemonIds = [],
    onSave,
    onClose,
}: {
    pokemon: OwnedPokemon;
    members?: readonly OwnedPokemon[];
    observations: readonly StatObservation[];
    family?: readonly SpeciesDetails[];
    blockedPokemonIds?: readonly string[];
    predictionDisabledPokemonIds?: readonly string[];
    onSave: (observation: StatObservation) => Promise<void>;
    onClose: () => void;
}) {
    const { t, locale } = useLanguage();
    const [queue, setQueue] = useState<StatScreenshot[]>([]);
    const [activeId, setActiveId] = useState<string>();
    const [archiveId, setArchiveId] = useState<string>();
    const [discarded, setDiscarded] = useState<{
        screenshot: StatScreenshot;
        draft?: ObservationDraft;
    }>();
    const [error, setError] = useState(false);
    const [working, setWorking] = useState(false);
    const [loading, setLoading] = useState(true);
    const candidates = members.filter(
        (entry) => !entry.deleted && entry.playthroughId === pokemon.playthroughId,
    );
    if (!candidates.some((entry) => entry.id === pokemon.id)) candidates.unshift(pokemon);
    const pending = queue.filter((entry) => !entry.completed);
    const completed = queue.filter((entry) => entry.completed);
    const active = pending.find((entry) => entry.id === activeId) ?? pending[0];
    const activePokemon = candidates.find((entry) => entry.id === active?.pokemonId);
    const saving = useObservationDraftSaving(
        active ? screenshotDraftKey(active.id, active.pokemonId) : '',
    );
    const busy = working || saving;
    const blocked = activePokemon ? blockedPokemonIds.includes(activePokemon.id) : false;
    const archived = completed.find((entry) => entry.id === archiveId);
    useEffect(() => {
        let current = true;
        setLoading(true);
        const load = () => {
            void readScreenshotQueue(pokemon.playthroughId)
                .then((value) => {
                    if (current) {
                        setQueue(value);
                        setLoading(false);
                    }
                })
                .catch(() => {
                    if (current) {
                        setError(true);
                        setLoading(false);
                    }
                });
        };
        load();
        const unsubscribe = subscribeScreenshotQueue(pokemon.playthroughId, load);
        return () => {
            current = false;
            unsubscribe();
        };
    }, [pokemon.playthroughId]);

    async function perform(action: () => Promise<void>) {
        setWorking(true);
        setError(false);
        try {
            await action();
        } catch {
            setError(true);
        } finally {
            setWorking(false);
        }
    }
    async function importFiles(files: readonly File[]) {
        if (!files.length || busy || loading) return;
        await perform(async () => {
            const items = files.map((file) => createStatScreenshot(file, pokemon));
            const prepared: { key: string; draft: ObservationDraft }[] = [];
            for (const item of items) {
                const now = new Date(item.addedAt);
                const draft: ObservationDraft = {
                    speciesId: pokemon.state.speciesId,
                    formEpoch: pokemon.state.formEpoch,
                    level: String(pokemon.state.level),
                    recordedAt: new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 19),
                    stats: {},
                };
                const key = screenshotDraftKey(item.id, pokemon.id);
                setObservationDraft(key, pokemon.id, draft);
                prepared.push({ key, draft });
            }
            try {
                setQueue(await addScreenshotQueueItems(pokemon.playthroughId, items));
                setActiveId(items[0].id);
            } catch (error) {
                for (const entry of prepared) {
                    if (getObservationDraft(entry.key) === entry.draft)
                        clearObservationDraft(entry.key);
                }
                throw error;
            }
        });
    }
    async function assignMember(member: OwnedPokemon) {
        if (!active || member.id === active.pokemonId || busy) return;
        await perform(async () => {
            setQueue(
                await reassignObservationDraft(
                    screenshotDraftKey(active.id, active.pokemonId),
                    screenshotDraftKey(active.id, member.id),
                    member,
                    () =>
                        changeScreenshotQueueItem(pokemon.playthroughId, active.id, {
                            pokemonId: member.id,
                        }),
                ),
            );
        });
    }
    return (
        <section
            className="my-inset my-stack my-screenshot-queue"
            tabIndex={0}
            aria-label={t('Screenshot queue', 'Fronta snímků')}
            onPaste={(event) => {
                const images = Array.from(event.clipboardData.files).filter((file) =>
                    file.type.startsWith('image/'),
                );
                if (images.length) {
                    event.preventDefault();
                    void importFiles(images);
                }
            }}
        >
            <div className="my-section-heading">
                <h3>
                    {t('Screenshot queue', 'Fronta snímků')} · {pending.length}
                </h3>
                <button className="page-button" type="button" onClick={onClose}>
                    {t('Close', 'Zavřít')}
                </button>
            </div>
            <p className="my-muted">
                {t(
                    'Add or paste screenshots, then transcribe them in any order. Images and drafts stay on this device after reloading. Saving keeps the screenshot in the archive. No levels are advanced automatically between entries.',
                    'Přidejte nebo vložte snímky ze schránky a přepište je v libovolném pořadí. Snímky i rozepsané údaje zůstanou v tomto zařízení po obnovení stránky. Uložené snímky zůstanou v archivu. Mezi záznamy se úroveň automaticky nezvyšuje.',
                )}
            </p>
            <label className="filter-label">
                {t('Add screenshots', 'Přidat snímky')}
                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                    multiple
                    disabled={busy || loading}
                    onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        event.target.value = '';
                        void importFiles(files);
                    }}
                />
            </label>
            {loading && <p role="status">{t('Loading screenshots…', 'Načítání snímků…')}</p>}
            {error && (
                <p role="alert">
                    {t(
                        'Could not save or load the screenshot queue. Check available device storage and try again; your unfinished entries have not been removed.',
                        'Frontu snímků se nepodařilo uložit nebo načíst. Zkontrolujte volné místo v zařízení a zkuste to znovu. Nedokončené záznamy nebyly odstraněny.',
                    )}{' '}
                    <button
                        className="page-button"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            void perform(async () =>
                                setQueue(await readScreenshotQueue(pokemon.playthroughId)),
                            );
                        }}
                    >
                        {t('Retry', 'Zkusit znovu')}
                    </button>
                </p>
            )}
            {pending.length > 0 && (
                <ol className="my-screenshot-list">
                    {pending.map((entry, index) => (
                        <li key={entry.id}>
                            <button
                                className="page-button"
                                type="button"
                                aria-current={entry.id === active?.id ? 'step' : undefined}
                                disabled={busy}
                                onClick={() => setActiveId(entry.id)}
                            >
                                {index + 1}. {entry.name}
                            </button>
                        </li>
                    ))}
                </ol>
            )}
            {discarded && (
                <p role="status">
                    {t('Screenshot discarded.', 'Snímek byl zahozen.')}{' '}
                    <button
                        className="my-text-button"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            void perform(async () => {
                                if (discarded.draft)
                                    setObservationDraft(
                                        screenshotDraftKey(
                                            discarded.screenshot.id,
                                            discarded.screenshot.pokemonId,
                                        ),
                                        discarded.screenshot.pokemonId,
                                        discarded.draft,
                                    );
                                setQueue(
                                    await addScreenshotQueueItems(pokemon.playthroughId, [
                                        discarded.screenshot,
                                    ]),
                                );
                                setActiveId(discarded.screenshot.id);
                                setDiscarded(undefined);
                            });
                        }}
                    >
                        {t('Undo', 'Vrátit zpět')}
                    </button>
                </p>
            )}
            {active && (
                <>
                    <div className="my-actions">
                        <label className="filter-label">
                            {t('Pokémon in this screenshot', 'Pokémon na snímku')}
                            <select
                                className="filter-input"
                                value={activePokemon?.id ?? ''}
                                disabled={busy}
                                onChange={(event) => {
                                    const member = candidates.find(
                                        (entry) => entry.id === event.target.value,
                                    );
                                    if (member) void assignMember(member);
                                }}
                            >
                                {!activePokemon && (
                                    <option value="">
                                        {t('Select a Pokémon', 'Vyberte Pokémona')}
                                    </option>
                                )}
                                {candidates.map((member) => (
                                    <option
                                        key={member.id}
                                        value={member.id}
                                        disabled={blockedPokemonIds.includes(member.id)}
                                    >
                                        {member.nickname ||
                                            family.find(
                                                (entry) =>
                                                    entry.speciesId === member.state.speciesId,
                                            )?.name ||
                                            `#${member.state.speciesId}`}{' '}
                                        · Lv. {member.state.level}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            className="my-text-button"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                void perform(async () => {
                                    const draft = getObservationDraft(
                                        screenshotDraftKey(active.id, active.pokemonId),
                                    );
                                    setQueue(
                                        await changeScreenshotQueueItem(
                                            pokemon.playthroughId,
                                            active.id,
                                            'remove',
                                        ),
                                    );
                                    clearObservationDraft(
                                        screenshotDraftKey(active.id, active.pokemonId),
                                    );
                                    setDiscarded({ screenshot: active, draft });
                                });
                            }}
                        >
                            {t('Discard screenshot', 'Zahodit snímek')}
                        </button>
                    </div>
                    <div className="my-screenshot-workspace">
                        <ScreenshotImage key={active.id} screenshot={active} />
                        {blocked && (
                            <p role="status">
                                {t(
                                    'Resolve this Pokémon’s conflicting updates before recording the screenshot.',
                                    'Než zapíšete snímek, vyřešte konfliktní změny tohoto Pokémona.',
                                )}
                            </p>
                        )}
                        {activePokemon && !blocked && (
                            <fieldset
                                className="my-screenshot-editor"
                                disabled={working}
                                aria-busy={working}
                            >
                                <QueuedObservation
                                    key={`${active.id}:${activePokemon.id}`}
                                    screenshot={active}
                                    pokemon={activePokemon}
                                    observations={observations}
                                    predictionsEnabled={
                                        !predictionDisabledPokemonIds.includes(activePokemon.id)
                                    }
                                    family={family}
                                    onSave={async (observation) => {
                                        setQueue(
                                            await saveQueuedScreenshot(
                                                pokemon.playthroughId,
                                                active.id,
                                                observation,
                                                onSave,
                                            ),
                                        );
                                    }}
                                    onSaved={() =>
                                        setActiveId((current) =>
                                            current === active.id ? undefined : current,
                                        )
                                    }
                                    onSkip={() =>
                                        setActiveId(
                                            pending[
                                                (pending.findIndex(
                                                    (entry) => entry.id === active.id,
                                                ) +
                                                    1) %
                                                    pending.length
                                            ]?.id,
                                        )
                                    }
                                />
                            </fieldset>
                        )}
                    </div>
                </>
            )}
            {!loading && !pending.length && (
                <p role="status">
                    {t(
                        'All queued screenshots are recorded. Add more whenever you are ready.',
                        'Všechny snímky ve frontě jsou zapsané. Můžete přidat další.',
                    )}
                </p>
            )}
            {completed.length > 0 && (
                <details className="my-details">
                    <summary>
                        {t('Recorded screenshots', 'Zapsané snímky')} · {completed.length}
                    </summary>
                    <div className="my-screenshot-list">
                        {completed.map((entry) => {
                            const member = candidates.find(
                                (candidate) => candidate.id === entry.pokemonId,
                            );
                            const observed =
                                observations.find(
                                    (observation) => observation.id === entry.observationId,
                                ) ?? entry.recordedObservation;
                            return (
                                <button
                                    className="page-button"
                                    type="button"
                                    key={entry.id}
                                    onClick={() => setArchiveId(entry.id)}
                                >
                                    {member?.nickname ||
                                        (observed
                                            ? (family.find(
                                                  (species) =>
                                                      species.speciesId === observed.speciesId,
                                              )?.name ?? `#${observed.speciesId}`)
                                            : entry.name)}
                                    {observed
                                        ? ` · Lv. ${observed.level} · ${new Date(observed.recordedAt).toLocaleString(locale)}`
                                        : ''}
                                </button>
                            );
                        })}
                    </div>
                    {archived && <ScreenshotImage key={archived.id} screenshot={archived} />}
                </details>
            )}
        </section>
    );
}
