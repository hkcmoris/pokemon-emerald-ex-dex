import { useState, type SubmitEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { KnownMove, Pokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { searchCollectionMoves, searchCollectionSpecies } from './collectionSpecies.js';
import { useLanguage } from './language.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { MyPokemonMove, findReferenceMove } from './MyPokemonMove.js';
import { TypeBadges } from './TypeBadges.js';
import { typeSurfaceStyle } from './theme.js';

export function SpeciesPicker({
    onSelect,
    datasetId,
}: {
    onSelect: (entry: Pokemon) => void;
    datasetId?: string;
}) {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const search = useQuery({
        queryKey: ['collection-search', query.trim()],
        queryFn: () => searchCollectionSpecies(query.trim()),
    });
    return (
        <div className="my-picker">
            <label className="filter-label">
                {t('Find species or form', 'Najít druh nebo formu')}
                <input
                    className="filter-input"
                    type="search"
                    value={query}
                    maxLength={100}
                    placeholder={t('Name or species ID', 'Název nebo ID druhu')}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </label>
            {search.isPending && (
                <p className="my-muted" role="status">
                    {t('Searching…', 'Vyhledávání…')}
                </p>
            )}
            {search.isError && (
                <p role="alert">
                    {t(
                        'Species search is unavailable. Reconnect to find Pokémon that have not been cached.',
                        'Vyhledávání není dostupné. Pro dosud nenačtené Pokémony se připojte k internetu.',
                    )}
                </p>
            )}
            {search.data && (
                <ul className="my-search-results">
                    {search.data.map((entry) => (
                        <li key={entry.speciesId}>
                            <button
                                className="type-surface"
                                style={typeSurfaceStyle(entry.types)}
                                type="button"
                                onClick={() => onSelect(entry)}
                            >
                                <SpeciesSprite
                                    datasetId={datasetId}
                                    file={entry.sprites?.front ?? null}
                                    name={entry.name}
                                />
                                <span>
                                    <strong>{entry.name}</strong>
                                    <small>#{entry.speciesId}</small>
                                    <TypeBadges
                                        types={entry.types}
                                        iconFiles={entry.typeIconFiles}
                                        iconOnly
                                    />
                                </span>
                                <span aria-hidden="true">＋</span>
                            </button>
                        </li>
                    ))}
                    {search.data.length === 0 && (
                        <li className="my-muted">
                            {t(
                                'No matching species in the available data.',
                                'V dostupných datech není odpovídající druh.',
                            )}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

export function AddPokemonForm({
    selected,
    onSave,
    onCancel,
    datasetId,
}: {
    selected: Pokemon;
    onSave: (level: number, nickname: string) => Promise<void>;
    onCancel: () => void;
    datasetId?: string;
}) {
    const { t } = useLanguage();
    const [level, setLevel] = useState('5');
    const [nickname, setNickname] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (!Number.isInteger(Number(level)) || Number(level) < 1 || Number(level) > 100) return;
        setBusy(true);
        setError(null);
        try {
            await onSave(Number(level), nickname.trim());
        } catch {
            setError(
                t(
                    'Could not save this Pokémon. Try again.',
                    'Pokémona se nepodařilo uložit. Zkuste to znovu.',
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <form
            className="my-stack"
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <div
                className="my-pokemon-title my-selected-species type-surface"
                style={typeSurfaceStyle(selected.types)}
            >
                <SpeciesSprite
                    datasetId={datasetId}
                    file={selected.sprites?.front ?? null}
                    name={selected.name}
                />
                <div>
                    <p className="eyebrow">{t('Add to collection', 'Přidat do sbírky')}</p>
                    <h3>{selected.name}</h3>
                    <TypeBadges
                        types={selected.types}
                        iconFiles={selected.typeIconFiles}
                        iconOnly
                    />
                </div>
            </div>
            <div className="my-fields">
                <label className="filter-label">
                    {t('Level', 'Úroveň')}
                    <input
                        className="filter-input"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        required
                        value={level}
                        onChange={(event) => setLevel(event.target.value)}
                    />
                </label>
                <label className="filter-label">
                    {t('Nickname (optional)', 'Přezdívka (volitelná)')}
                    <input
                        className="filter-input"
                        maxLength={40}
                        value={nickname}
                        onChange={(event) => setNickname(event.target.value)}
                    />
                </label>
            </div>
            <p className="my-muted">
                {t(
                    'Moves and battle stats can be recorded later. The Pokémon is added to your party if a slot is free.',
                    'Útoky a bojové statistiky lze doplnit později. Pokud je v týmu místo, Pokémon se do něj přidá.',
                )}
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="my-actions">
                <button className="my-primary" disabled={busy} type="submit">
                    {t('Add Pokémon', 'Přidat Pokémona')}
                </button>
                <button className="page-button" type="button" onClick={onCancel}>
                    {t('Choose another', 'Vybrat jiného')}
                </button>
            </div>
        </form>
    );
}

export function MovesEditor({
    moves,
    family,
    onSave,
    onCancel,
}: {
    moves: KnownMove[] | null;
    family: readonly SpeciesDetails[];
    onSave: (moves: KnownMove[] | null) => Promise<void>;
    onCancel: () => void;
}) {
    const { t } = useLanguage();
    const [selected, setSelected] = useState<KnownMove[]>(moves ?? []);
    const [unknown, setUnknown] = useState(moves === null);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const search = useQuery({
        queryKey: ['collection-move-search', query.trim()],
        queryFn: () => searchCollectionMoves(query.trim()),
        enabled: !unknown,
    });
    const reference = (moveId: number) =>
        findReferenceMove(moveId, family) ?? search.data?.find((move) => move.moveId === moveId);
    const candidates = new Map<number, KnownMove>();
    for (const details of family)
        for (const move of [...details.learnset, ...details.machines])
            candidates.set(move.moveId, { moveId: move.moveId, name: move.name });
    for (const move of moves ?? []) candidates.set(move.moveId, move);
    for (const move of search.data ?? [])
        candidates.set(move.moveId, { moveId: move.moveId, name: move.name });
    const matches = [...candidates.values()]
        .filter((move) => move.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));
    async function save() {
        setBusy(true);
        setError(null);
        try {
            await onSave(unknown ? null : selected);
        } catch {
            setError(
                t(
                    'Could not save moves. Try again.',
                    'Útoky se nepodařilo uložit. Zkuste to znovu.',
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <section
            className="my-inset my-stack"
            aria-label={t('Edit current moves', 'Upravit aktuální útoky')}
        >
            <h3>{t('Current moves', 'Aktuální útoky')}</h3>
            <label className="my-check">
                <input
                    type="checkbox"
                    checked={unknown}
                    onChange={(event) => setUnknown(event.target.checked)}
                />
                {t('Moves not recorded', 'Útoky nejsou zaznamenány')}
            </label>
            {!unknown && (
                <>
                    <p className="my-muted">
                        {t(
                            'Select up to four moves. Deselect a move before replacing it.',
                            'Vyberte až čtyři útoky. Před nahrazením útoku zrušte jeho výběr.',
                        )}
                    </p>
                    <div className="my-move-chips">
                        {selected.map((move) => (
                            <MyPokemonMove
                                as="button"
                                key={move.moveId}
                                move={move}
                                reference={reference(move.moveId)}
                                suffix={<span aria-hidden="true">×</span>}
                                onClick={() =>
                                    setSelected(
                                        selected.filter((entry) => entry.moveId !== move.moveId),
                                    )
                                }
                            />
                        ))}
                    </div>
                    <label className="filter-label">
                        {t('Find a move', 'Najít útok')}
                        <input
                            className="filter-input"
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>
                    {search.isError && (
                        <p className="my-muted" role="status">
                            {t(
                                'Showing cached moves. Reconnect to search the full move list.',
                                'Zobrazeny jsou uložené útoky. Pro úplné vyhledávání se připojte k internetu.',
                            )}
                        </p>
                    )}
                    <div className="my-move-options">
                        {matches.map((move) => (
                            <MyPokemonMove
                                as="label"
                                className="my-check"
                                key={move.moveId}
                                move={move}
                                reference={reference(move.moveId)}
                                prefix={
                                    <input
                                        type="checkbox"
                                        checked={selected.some(
                                            (entry) => entry.moveId === move.moveId,
                                        )}
                                        disabled={
                                            selected.length >= 4 &&
                                            !selected.some((entry) => entry.moveId === move.moveId)
                                        }
                                        onChange={(event) =>
                                            setSelected(
                                                event.target.checked
                                                    ? [...selected, move]
                                                    : selected.filter(
                                                          (entry) => entry.moveId !== move.moveId,
                                                      ),
                                            )
                                        }
                                    />
                                }
                            />
                        ))}
                    </div>
                </>
            )}
            {error && <p role="alert">{error}</p>}
            <div className="my-actions">
                <button
                    type="button"
                    className="my-primary"
                    disabled={busy}
                    onClick={() => {
                        void save();
                    }}
                >
                    {t('Save moves', 'Uložit útoky')}
                </button>
                <button type="button" className="page-button" onClick={onCancel}>
                    {t('Cancel', 'Zrušit')}
                </button>
            </div>
        </section>
    );
}
