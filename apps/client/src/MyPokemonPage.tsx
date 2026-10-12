import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    CollectionDocument,
    OwnedPokemon,
    Pokemon,
    Playthrough,
} from '@pokemon-emerald-ex-dex/shared';

import { useCollection } from './collectionStore.js';
import { useCollectionOffline } from './collectionOffline.js';
import { loadCollectionSpecies } from './collectionSpecies.js';
import { GoogleSignIn } from './GoogleSignIn.js';
import { DexHeader } from './DexHeader.js';
import { DexFooter } from './DexFooter.js';
import { DexNavigation } from './DexNavigation.js';
import { useLanguage } from './language.js';
import { MyPokemonCard } from './MyPokemonCard.js';
import { MyPokemonConflicts } from './MyPokemonConflicts.js';
import { AddPokemonForm, SpeciesPicker } from './MyPokemonForms.js';
import './myPokemon.css';

function PlaythroughForm({
    initialName,
    onSave,
    onCancel,
}: {
    initialName: string;
    onSave: (name: string) => Promise<void>;
    onCancel?: () => void;
}) {
    const { t } = useLanguage();
    const [name, setName] = useState(initialName);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError(false);
        try {
            await onSave(name.trim());
        } catch {
            setError(true);
        } finally {
            setBusy(false);
        }
    }
    return (
        <form
            className="my-inline-form"
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <label className="filter-label">
                {t('Playthrough name', 'Název průchodu')}
                <input
                    className="filter-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    required
                />
            </label>
            <button className="my-primary" type="submit" disabled={busy || !name.trim()}>
                {t('Save playthrough', 'Uložit průchod')}
            </button>
            {onCancel && (
                <button type="button" className="page-button" onClick={onCancel}>
                    {t('Cancel', 'Zrušit')}
                </button>
            )}
            {error && (
                <p role="alert">
                    {t(
                        'Could not save the playthrough. Try again.',
                        'Průchod se nepodařilo uložit. Zkuste to znovu.',
                    )}
                </p>
            )}
        </form>
    );
}

function PokemonLabel({ pokemon }: { pokemon: OwnedPokemon }) {
    const details = useQuery({
        queryKey: ['collection-species', pokemon.state.speciesId],
        queryFn: () => loadCollectionSpecies(pokemon.state.speciesId),
    });
    return (
        <>
            {pokemon.nickname || details.data?.name || `#${pokemon.state.speciesId}`} · Lv.{' '}
            {pokemon.state.level}
        </>
    );
}

export function MyPokemonPage({
    version,
    datasetId,
    addSpeciesId,
}: {
    version: string;
    datasetId?: string;
    addSpeciesId?: number;
}) {
    const { t } = useLanguage();
    const collection = useCollection();
    const offlineStatus = useCollectionOffline();
    const { document, update, ready } = collection;
    const [selectedRunId, setSelectedRunId] = useState('');
    const [view, setView] = useState<'party' | 'collection'>('party');
    const [runEditor, setRunEditor] = useState<'new' | 'rename' | null>(null);
    const [adding, setAdding] = useState(addSpeciesId !== undefined);
    const [selectedSpecies, setSelectedSpecies] = useState<Pokemon | null>(null);
    const [seedDismissed, setSeedDismissed] = useState(false);
    const [replacement, setReplacement] = useState<string | null>(null);
    const replacementPanel = useRef<HTMLElement>(null);
    useEffect(() => {
        if (replacement) {
            replacementPanel.current?.focus();
            replacementPanel.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, [replacement]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const seededSpecies = useQuery({
        queryKey: ['collection-species', addSpeciesId],
        queryFn: () => loadCollectionSpecies(addSpeciesId ?? 0),
        enabled: addSpeciesId !== undefined && !seedDismissed,
    });
    const runs = Object.values(document.playthroughs).filter((run) => !run.deleted);
    const run = runs.find((entry) => entry.id === selectedRunId) ?? runs[0];
    const owned = Object.values(document.pokemon).filter(
        (pokemon) => pokemon.playthroughId === run?.id && !pokemon.deleted,
    );
    const party =
        run?.party
            .map((id) => document.pokemon[id])
            .filter((entry): entry is OwnedPokemon => Boolean(entry && !entry.deleted)) ?? [];
    const shown = view === 'party' ? party : owned;
    const picked = selectedSpecies ?? (!seedDismissed ? seededSpecies.data : null);
    const deletedRuns = Object.values(document.playthroughs).filter((entry) => entry.deleted);
    const deletedPokemon = Object.values(document.pokemon).filter(
        (entry) => entry.deleted && entry.playthroughId === run?.id,
    );
    const syncLabels = {
        local: t('Saved on this device', 'Uloženo v tomto zařízení'),
        syncing: t('Syncing…', 'Synchronizace…'),
        pending: t('Waiting to sync', 'Čeká na synchronizaci'),
        synced: t('Synced', 'Synchronizováno'),
        offline: t('Offline · edits saved here', 'Offline · změny jsou uloženy zde'),
        error: t('Sync needs attention', 'Synchronizace vyžaduje pozornost'),
    };
    async function perform(action: () => Promise<void>) {
        setError(null);
        setBusy(true);
        try {
            await action();
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : t(
                          'Could not save this change. Try again.',
                          'Změnu se nepodařilo uložit. Zkuste to znovu.',
                      ),
            );
        } finally {
            setBusy(false);
        }
    }
    async function saveRun(name: string) {
        const id = runEditor === 'rename' && run ? run.id : crypto.randomUUID();
        await update((current) => ({
            ...current,
            playthroughs: {
                ...current.playthroughs,
                [id]: current.playthroughs[id]
                    ? { ...current.playthroughs[id], name }
                    : { id, name, party: [], deleted: false },
            },
        }));
        setSelectedRunId(id);
        setRunEditor(null);
    }
    async function changeRun(updater: (run: Playthrough) => Playthrough) {
        if (!run) return;
        await update((current) => ({
            ...current,
            playthroughs: {
                ...current.playthroughs,
                [run.id]: updater(current.playthroughs[run.id]),
            },
        }));
    }
    async function addPokemon(level: number, nickname: string) {
        if (!picked || !run) return;
        const id = crypto.randomUUID();
        const pokemon: OwnedPokemon = {
            id,
            playthroughId: run.id,
            nickname,
            state: {
                speciesId: picked.speciesId,
                level,
                moves: null,
                formEpoch: crypto.randomUUID(),
            },
            deleted: false,
            createdAt: new Date().toISOString(),
        };
        await update((current) => {
            const currentRun = current.playthroughs[run.id];
            return {
                ...current,
                pokemon: { ...current.pokemon, [id]: pokemon },
                playthroughs: {
                    ...current.playthroughs,
                    [run.id]: {
                        ...currentRun,
                        party:
                            currentRun.party.length < 6
                                ? [...currentRun.party, id]
                                : currentRun.party,
                    },
                },
            };
        });
        setAdding(false);
        setSelectedSpecies(null);
        setSeedDismissed(true);
    }
    async function toggleParty(pokemon: OwnedPokemon) {
        if (!run) return;
        if (!run.party.includes(pokemon.id) && run.party.length >= 6) {
            setReplacement(pokemon.id);
            return;
        }
        await changeRun((current) => ({
            ...current,
            party: current.party.includes(pokemon.id)
                ? current.party.filter((id) => id !== pokemon.id)
                : current.party.length < 6
                  ? [...current.party, pokemon.id]
                  : current.party,
        }));
    }
    async function updatePokemon(
        pokemonId: string,
        updater: (pokemon: OwnedPokemon) => OwnedPokemon,
    ) {
        await update((current) => ({
            ...current,
            pokemon: { ...current.pokemon, [pokemonId]: updater(current.pokemon[pokemonId]) },
        }));
    }
    async function removePokemon(pokemonId: string) {
        await update((current) => {
            const pokemon = current.pokemon[pokemonId];
            const currentRun = current.playthroughs[pokemon.playthroughId];
            return {
                ...current,
                pokemon: { ...current.pokemon, [pokemonId]: { ...pokemon, deleted: true } },
                playthroughs: {
                    ...current.playthroughs,
                    [currentRun.id]: {
                        ...currentRun,
                        party: currentRun.party.filter((id) => id !== pokemonId),
                    },
                },
            };
        });
    }
    function hasStateConflict(pokemon: OwnedPokemon) {
        return collection.conflicts.some(
            (conflict) =>
                conflict.entity === 'pokemon' &&
                conflict.entityId === pokemon.id &&
                (conflict.field === 'state' || conflict.field === '$entity'),
        );
    }
    return (
        <div className="min-h-screen">
            <DexHeader version={version} />
            <main className="dex-browse-main my-pokemon-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8">
                <div className="my-page-heading">
                    <div>
                        <p className="eyebrow">
                            {t('Your playthrough companion', 'Průvodce vaším průchodem hrou')}
                        </p>
                        <h1>{t('My Pokémon', 'Moji Pokémoni')}</h1>
                        <p className="my-muted">
                            {t(
                                'Keep your party close. Know what comes next.',
                                'Mějte přehled o týmu i o tom, co ho čeká.',
                            )}
                        </p>
                    </div>
                    <span className={`my-sync-status my-sync-${collection.status}`} role="status">
                        {syncLabels[collection.status]}
                    </span>
                </div>
                <details className="my-account my-details">
                    <summary>
                        {collection.user
                            ? `${collection.user.name} · ${t('Sync & account', 'Synchronizace a účet')}`
                            : t('Use on your phone and PC', 'Používat na telefonu i počítači')}
                    </summary>
                    <div className="my-account-content">
                        <div>
                            <p>
                                {t(
                                    'Google signs you in. Your collection is saved in this app’s database and cached on each connected device for offline editing.',
                                    'Google slouží k přihlášení. Sbírka je uložená v databázi této aplikace a v připojených zařízeních pro úpravy offline.',
                                )}
                            </p>
                            <p className="my-muted">
                                {t(
                                    'Sign in once on each device. Guest playthroughs upload automatically as separate runs. Sync runs while the app is open and connected.',
                                    'Na každém zařízení se přihlaste jednou. Místní průchody se automaticky nahrají jako samostatné záznamy. Synchronizace probíhá v otevřené aplikaci s připojením.',
                                )}
                            </p>
                            <p className="my-muted" role="status">
                                {offlineStatus === 'ready'
                                    ? t('Ready for offline use.', 'Připraveno k používání offline.')
                                    : offlineStatus === 'preparing'
                                      ? t(
                                            'Available offline after initial loading.',
                                            'Po úvodním načtení bude aplikace dostupná offline.',
                                        )
                                      : offlineStatus === 'development'
                                        ? t(
                                              'Offline reload is enabled in production builds. Keep this development tab open for offline edits.',
                                              'Otevření offline je dostupné v produkčním sestavení. Pro úpravy offline ponechte tuto vývojovou kartu otevřenou.',
                                          )
                                        : t(
                                              'Keep this tab open for offline edits; offline reload is unavailable in this browser.',
                                              'Pro úpravy offline ponechte tuto kartu otevřenou. Opětovné otevření offline není v tomto prohlížeči dostupné.',
                                          )}
                            </p>
                        </div>
                        <div className="my-stack">
                            {collection.user && (
                                <>
                                    <p>{collection.user.email}</p>
                                    <div className="my-actions">
                                        <button
                                            className="page-button"
                                            disabled={busy || collection.status === 'syncing'}
                                            type="button"
                                            onClick={() => {
                                                void perform(collection.sync);
                                            }}
                                        >
                                            {t('Sync now', 'Synchronizovat')}
                                        </button>
                                        <button
                                            className="page-button"
                                            disabled={busy}
                                            type="button"
                                            onClick={() => {
                                                void perform(collection.logout);
                                            }}
                                        >
                                            {t('Sign out', 'Odhlásit se')}
                                        </button>
                                    </div>
                                    <p className="my-muted">
                                        {t(
                                            'Signing out keeps account data separate from guest playthroughs.',
                                            'Po odhlášení zůstanou data účtu oddělená od místních průchodů.',
                                        )}
                                    </p>
                                </>
                            )}
                            {collection.needsSignIn && (
                                <p role="status">
                                    {t(
                                        'Sign in again to this account to resume syncing. Offline edits are kept.',
                                        'Pro obnovení synchronizace se znovu přihlaste k tomuto účtu. Úpravy offline zůstávají uložené.',
                                    )}
                                </p>
                            )}
                            {(!collection.user || collection.needsSignIn) &&
                                (collection.googleClientId && collection.nonce ? (
                                    <GoogleSignIn
                                        clientId={collection.googleClientId}
                                        nonce={collection.nonce}
                                        onCredential={(credential) => {
                                            void perform(() => collection.login(credential));
                                        }}
                                    />
                                ) : (
                                    <p className="my-muted">
                                        {t(
                                            'Google sign-in is currently unavailable. You can keep using your collection on this device.',
                                            'Přihlášení Google nyní není dostupné. Sbírku můžete dál používat v tomto zařízení.',
                                        )}
                                    </p>
                                ))}
                        </div>
                    </div>
                </details>
                {(error || collection.error) && (
                    <div className="my-error" role="alert">
                        {error || collection.error}
                    </div>
                )}
                {!ready ? (
                    <p className="my-empty" role="status">
                        {t('Loading your collection…', 'Načítání vaší sbírky…')}
                    </p>
                ) : (
                    <>
                        <MyPokemonConflicts
                            conflicts={collection.conflicts}
                            document={document}
                            resolve={collection.resolve}
                        />
                        <section
                            className="my-run-toolbar"
                            aria-label={t('Playthrough', 'Průchod hrou')}
                        >
                            {run && (
                                <label className="filter-label">
                                    {t('Playthrough', 'Průchod hrou')}
                                    <select
                                        className="filter-input"
                                        value={run.id}
                                        onChange={(event) => {
                                            setSelectedRunId(event.target.value);
                                            setView('party');
                                            setReplacement(null);
                                            setRunEditor(null);
                                        }}
                                    >
                                        {runs.map((entry, index) => (
                                            <option value={entry.id} key={entry.id}>
                                                {entry.name}
                                                {runs.filter((other) => other.name === entry.name)
                                                    .length > 1
                                                    ? ` (${index + 1})`
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <div className="my-actions">
                                <button
                                    className="page-button"
                                    type="button"
                                    onClick={() => setRunEditor('new')}
                                >
                                    {t('New playthrough', 'Nový průchod')}
                                </button>
                                {run && (
                                    <button
                                        className="my-text-button"
                                        type="button"
                                        onClick={() =>
                                            setRunEditor(runEditor === 'rename' ? null : 'rename')
                                        }
                                    >
                                        {t('Manage playthrough', 'Spravovat průchod')}
                                    </button>
                                )}
                            </div>
                        </section>
                        {(runEditor || !run) && (
                            <section className="my-panel my-stack">
                                <h2>
                                    {runEditor === 'rename'
                                        ? t('Manage playthrough', 'Spravovat průchod')
                                        : t('A fresh adventure', 'Nové dobrodružství')}
                                </h2>
                                <PlaythroughForm
                                    key={`${runEditor}-${run?.id ?? ''}`}
                                    initialName={
                                        runEditor === 'rename' && run
                                            ? run.name
                                            : t('My Emerald run', 'Můj průchod Emerald')
                                    }
                                    onSave={saveRun}
                                    onCancel={run ? () => setRunEditor(null) : undefined}
                                />
                                {runEditor === 'rename' && run && (
                                    <button
                                        className="my-text-button my-danger"
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                            void perform(async () => {
                                                await changeRun((entry) => ({
                                                    ...entry,
                                                    deleted: true,
                                                }));
                                                setRunEditor(null);
                                            });
                                        }}
                                    >
                                        {t(
                                            'Move playthrough to removed entries',
                                            'Přesunout průchod do odstraněných záznamů',
                                        )}
                                    </button>
                                )}
                            </section>
                        )}
                        {run && (
                            <>
                                <div className="my-view-toolbar">
                                    <div
                                        className="my-view-switch"
                                        aria-label={t('Collection view', 'Zobrazení sbírky')}
                                    >
                                        {(['party', 'collection'] as const).map((tab) => (
                                            <button
                                                key={tab}
                                                aria-pressed={view === tab}
                                                type="button"
                                                onClick={() => setView(tab)}
                                            >
                                                {tab === 'party'
                                                    ? t('Active party', 'Aktivní tým')
                                                    : t('Collection', 'Sbírka')}
                                                <span>
                                                    {tab === 'party'
                                                        ? `${party.length}/6`
                                                        : owned.length}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        className="my-primary"
                                        type="button"
                                        onClick={() => {
                                            setAdding(!adding);
                                            setSelectedSpecies(null);
                                            setSeedDismissed(true);
                                        }}
                                    >
                                        {adding
                                            ? t('Close add form', 'Zavřít přidávání')
                                            : t('+ Add Pokémon', '+ Přidat Pokémona')}
                                    </button>
                                </div>
                                {adding && (
                                    <section
                                        className="my-panel my-stack"
                                        aria-label={t('Add Pokémon', 'Přidat Pokémona')}
                                    >
                                        {picked ? (
                                            <AddPokemonForm
                                                key={picked.speciesId}
                                                selected={picked}
                                                datasetId={datasetId}
                                                onSave={addPokemon}
                                                onCancel={() => {
                                                    setSelectedSpecies(null);
                                                    setSeedDismissed(true);
                                                }}
                                            />
                                        ) : (
                                            <>
                                                <h2>
                                                    {t(
                                                        'Who joined your adventure?',
                                                        'Kdo se přidal k vašemu dobrodružství?',
                                                    )}
                                                </h2>
                                                <SpeciesPicker
                                                    datasetId={datasetId}
                                                    onSelect={setSelectedSpecies}
                                                />
                                            </>
                                        )}
                                    </section>
                                )}
                                {replacement && document.pokemon[replacement] && (
                                    <section
                                        className="my-panel my-stack"
                                        ref={replacementPanel}
                                        tabIndex={-1}
                                    >
                                        <h2>
                                            {t(
                                                'Choose a party member to replace',
                                                'Vyberte člena týmu k nahrazení',
                                            )}
                                        </h2>
                                        <p>
                                            {t('Adding', 'Přidáváte')}{' '}
                                            <PokemonLabel pokemon={document.pokemon[replacement]} />
                                            .{' '}
                                            {t(
                                                'The replaced Pokémon stays in your collection.',
                                                'Nahrazený Pokémon zůstane ve sbírce.',
                                            )}
                                        </p>
                                        <div className="my-actions">
                                            {party.map((member) => (
                                                <button
                                                    className="page-button"
                                                    key={member.id}
                                                    disabled={busy}
                                                    type="button"
                                                    onClick={() => {
                                                        void perform(async () => {
                                                            await changeRun((current) => ({
                                                                ...current,
                                                                party: current.party.map((id) =>
                                                                    id === member.id
                                                                        ? replacement
                                                                        : id,
                                                                ),
                                                            }));
                                                            setReplacement(null);
                                                        });
                                                    }}
                                                >
                                                    <PokemonLabel pokemon={member} />
                                                </button>
                                            ))}
                                            <button
                                                className="my-text-button"
                                                type="button"
                                                onClick={() => setReplacement(null)}
                                            >
                                                {t('Cancel', 'Zrušit')}
                                            </button>
                                        </div>
                                    </section>
                                )}
                                {shown.length === 0 ? (
                                    <section className="my-empty">
                                        <div className="my-empty-mark" aria-hidden="true">
                                            ◇
                                        </div>
                                        <h2>
                                            {view === 'party'
                                                ? t('Your party starts here', 'Tady začíná váš tým')
                                                : t(
                                                      'Your collection is ready',
                                                      'Vaše sbírka je připravená',
                                                  )}
                                        </h2>
                                        <p>
                                            {owned.length > 0
                                                ? t(
                                                      'Choose up to six Pokémon from your collection.',
                                                      'Vyberte ze sbírky až šest Pokémonů.',
                                                  )
                                                : t(
                                                      'Add your first Pokémon with just a species and level. Everything else can wait.',
                                                      'Přidejte prvního Pokémona: stačí druh a úroveň. Vše ostatní můžete doplnit později.',
                                                  )}
                                        </p>
                                        {owned.length > 0 && (
                                            <button
                                                className="page-button"
                                                type="button"
                                                onClick={() => setView('collection')}
                                            >
                                                {t('Open collection', 'Otevřít sbírku')}
                                            </button>
                                        )}
                                    </section>
                                ) : (
                                    <div className="my-party-grid">
                                        {shown.map((pokemon) => (
                                            <MyPokemonCard
                                                key={pokemon.id}
                                                pokemon={pokemon}
                                                datasetId={datasetId}
                                                observations={Object.values(
                                                    document.observations,
                                                ).filter((entry) => entry.pokemonId === pokemon.id)}
                                                partyIndex={run.party.indexOf(pokemon.id)}
                                                partySize={party.length}
                                                partyMembers={
                                                    party.some(hasStateConflict) ||
                                                    collection.conflicts.some(
                                                        (conflict) =>
                                                            conflict.entity === 'playthroughs' &&
                                                            conflict.entityId === run.id &&
                                                            (conflict.field === 'party' ||
                                                                conflict.field === '$entity'),
                                                    )
                                                        ? undefined
                                                        : party
                                                }
                                                stateConflict={hasStateConflict(pokemon)}
                                                onUpdate={(updater) =>
                                                    updatePokemon(pokemon.id, updater)
                                                }
                                                onParty={() => toggleParty(pokemon)}
                                                onMove={async (direction) => {
                                                    await changeRun((current) => {
                                                        const order = [...current.party];
                                                        const index = order.indexOf(pokemon.id);
                                                        const other = index + direction;
                                                        if (
                                                            index >= 0 &&
                                                            other >= 0 &&
                                                            other < order.length
                                                        )
                                                            [order[index], order[other]] = [
                                                                order[other],
                                                                order[index],
                                                            ];
                                                        return { ...current, party: order };
                                                    });
                                                }}
                                                saveObservation={async (observation) => {
                                                    await update((current: CollectionDocument) => ({
                                                        ...current,
                                                        observations: {
                                                            ...current.observations,
                                                            [observation.id]: observation,
                                                        },
                                                    }));
                                                }}
                                                onRemove={() => removePokemon(pokemon.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        {(deletedRuns.length > 0 || deletedPokemon.length > 0) && (
                            <details className="my-panel my-details my-trash">
                                <summary>
                                    {t('Removed entries', 'Odstraněné záznamy')} (
                                    {deletedRuns.length + deletedPokemon.length})
                                </summary>
                                <p className="my-muted">
                                    {t(
                                        'Restore entries here. Restored Pokémon return to the collection; add them to the party when ready.',
                                        'Zde lze záznamy obnovit. Pokémoni se vrátí do sbírky. Do týmu je přidejte podle potřeby.',
                                    )}
                                </p>
                                {deletedRuns.map((entry) => (
                                    <div className="my-list-row" key={entry.id}>
                                        <span>
                                            {t('Playthrough', 'Průchod')} · {entry.name}
                                        </span>
                                        <button
                                            className="page-button"
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                                void perform(async () => {
                                                    await update((current) => ({
                                                        ...current,
                                                        playthroughs: {
                                                            ...current.playthroughs,
                                                            [entry.id]: {
                                                                ...current.playthroughs[entry.id],
                                                                deleted: false,
                                                            },
                                                        },
                                                    }));
                                                    setSelectedRunId(entry.id);
                                                });
                                            }}
                                        >
                                            {t('Restore', 'Obnovit')}
                                        </button>
                                    </div>
                                ))}
                                {deletedPokemon.map((entry) => (
                                    <div className="my-list-row" key={entry.id}>
                                        <span>
                                            <PokemonLabel pokemon={entry} />
                                        </span>
                                        <button
                                            className="page-button"
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                                void perform(() =>
                                                    updatePokemon(entry.id, (current) => ({
                                                        ...current,
                                                        deleted: false,
                                                    })),
                                                );
                                            }}
                                        >
                                            {t('Restore', 'Obnovit')}
                                        </button>
                                    </div>
                                ))}
                            </details>
                        )}
                    </>
                )}
                <DexFooter />
            </main>
            <DexNavigation active="my-pokemon" />
        </div>
    );
}
