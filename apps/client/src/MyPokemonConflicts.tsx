import { useState } from 'react';
import type {
    CollectionConflict,
    CollectionDocument,
    JsonValue,
} from '@pokemon-emerald-ex-dex/shared';

import { useLanguage, type Translate } from './language.js';

export function conflictValueLabel(
    value: JsonValue,
    field: string,
    document: CollectionDocument,
    t: Translate,
): string {
    if (value === null)
        return field === 'moves'
            ? t('Moves not recorded', 'Útoky nejsou zaznamenány')
            : t('No entry', 'Bez záznamu');
    if (typeof value === 'boolean')
        return value ? t('Removed', 'Odstraněno') : t('Kept', 'Zachováno');
    if (typeof value === 'string') return value || t('No nickname', 'Bez přezdívky');
    if (typeof value === 'number') return field === 'speciesId' ? `#${value}` : String(value);
    if (Array.isArray(value))
        return value.length === 0
            ? t('Empty', 'Prázdné')
            : value
                  .map((entry) =>
                      field === 'party' && typeof entry === 'string'
                          ? document.pokemon[entry]?.nickname ||
                            `#${document.pokemon[entry]?.state.speciesId ?? '?'}`
                          : conflictValueLabel(entry, field, document, t),
                  )
                  .join(' → ');
    if ('moveId' in value && typeof value.name === 'string') return value.name;
    if (field === 'moveWishlist') {
        const wanted = Array.isArray(value.moves) ? value.moves : [];
        const learned = Array.isArray(value.learnedMoveIds) ? value.learnedMoveIds : [];
        return [
            `${t('Wanted moves', 'Požadované útoky')}: ${conflictValueLabel(wanted, 'moves', document, t)}`,
            `${t('Learned', 'Naučeno')}: ${learned.length}`,
            `${t('Target evolution', 'Cílový vývoj')}: ${typeof value.targetSpeciesId === 'number' ? `#${value.targetSpeciesId}` : t('Automatic / choose branch', 'Automaticky / vybrat větev')}`,
        ].join(' · ');
    }
    if ('state' in value)
        return [
            value.deleted === true
                ? t('Removed Pokémon', 'Odstraněný Pokémon')
                : t('Kept Pokémon', 'Zachovaný Pokémon'),
            typeof value.nickname === 'string' ? value.nickname : '',
            conflictValueLabel(value.state, 'state', document, t),
            value.moveWishlist
                ? conflictValueLabel(value.moveWishlist, 'moveWishlist', document, t)
                : '',
        ]
            .filter(Boolean)
            .join(' · ');
    if ('party' in value)
        return [
            value.deleted === true
                ? t('Removed playthrough', 'Odstraněný průchod')
                : t('Kept playthrough', 'Zachovaný průchod'),
            typeof value.name === 'string' ? value.name : '',
            conflictValueLabel(value.party, 'party', document, t),
        ].join(' · ');
    const labels: Record<string, string> = {
        speciesId: t('Species', 'Druh'),
        level: t('Level', 'Úroveň'),
        moves: t('Moves', 'Útoky'),
        recordedAt: t('Observed at', 'Datum měření'),
        stats: t('Stats', 'Statistiky'),
        hp: 'HP',
        attack: t('Attack', 'Útok'),
        defense: t('Defense', 'Obrana'),
        spAttack: t('Sp. Attack', 'Spec. útok'),
        spDefense: t('Sp. Defense', 'Spec. obrana'),
        speed: t('Speed', 'Rychlost'),
        deleted: t('Entry', 'Záznam'),
    };
    return Object.entries(value)
        .filter(([key]) => key in labels)
        .map(([key, entry]) => `${labels[key]}: ${conflictValueLabel(entry, key, document, t)}`)
        .join(' · ');
}

export function MyPokemonConflicts({
    conflicts,
    document,
    resolve,
}: {
    conflicts: readonly CollectionConflict[];
    document: CollectionDocument;
    resolve: (id: string, choice: 'local' | 'remote') => Promise<void>;
}) {
    const { t } = useLanguage();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    if (conflicts.length === 0) return null;
    async function choose(id: string, choice: 'local' | 'remote') {
        setBusy(id);
        setError(null);
        try {
            await resolve(id, choice);
        } catch (reason) {
            setError(
                reason instanceof Error &&
                    reason.message ===
                        'Resolve related removed Pokémon first, then choose this party lineup. Your alternatives are still available.'
                    ? t(
                          reason.message,
                          'Nejprve vyřešte související odstraněné Pokémony a pak zvolte tuto sestavu týmu. Obě možnosti jsou stále dostupné.',
                      )
                    : reason instanceof Error && reason.message
                      ? reason.message
                      : t(
                            'Could not save the conflict choice. Your alternatives are still available.',
                            'Volbu se nepodařilo uložit. Obě možnosti jsou stále dostupné.',
                        ),
            );
        } finally {
            setBusy(null);
        }
    }
    return (
        <section className="my-conflicts my-stack" aria-labelledby="my-conflicts-title">
            <h2 id="my-conflicts-title">
                {t('Offline changes need a choice', 'Úpravy offline vyžadují volbu')} (
                {conflicts.length})
            </h2>
            <p>
                {t(
                    'Compatible changes are already merged. Choose which version to keep for each conflict, then make any further corrections normally. Neither device automatically wins.',
                    'Slučitelné změny jsou již spojeny. U každého konfliktu zvolte zachovanou verzi. Další opravy pak proveďte běžným způsobem. Žádné zařízení nemá automatickou přednost.',
                )}
            </p>
            {conflicts.map((conflict) => {
                const pokemon = document.pokemon[conflict.entityId];
                const observation = document.observations[conflict.entityId];
                const owner = observation ? document.pokemon[observation.pokemonId] : undefined;
                const title =
                    conflict.entity === 'playthroughs'
                        ? document.playthroughs[conflict.entityId]?.name
                        : pokemon
                          ? pokemon.nickname || `#${pokemon.state.speciesId}`
                          : owner
                            ? `${owner.nickname || `#${owner.state.speciesId}`} · ${t('Stat observation', 'Měření statistik')}`
                            : t('Saved entry', 'Uložený záznam');
                return (
                    <div className="my-conflict" key={conflict.id}>
                        <h3>
                            {title} ·{' '}
                            {conflict.kind === 'delete-edit'
                                ? t('Removal or updated entry', 'Odstranění nebo upravený záznam')
                                : conflict.kind === 'party'
                                  ? t('Party lineup', 'Sestava týmu')
                                  : conflict.field === 'state'
                                    ? t('Species, level and moves', 'Druh, úroveň a útoky')
                                    : conflict.field === 'moveWishlist'
                                      ? t('Move wishlist', 'Seznam požadovaných útoků')
                                      : conflict.field === 'nickname'
                                        ? t('Nickname', 'Přezdívka')
                                        : conflict.field === 'name'
                                          ? t('Name', 'Název')
                                          : t('Recorded values', 'Zaznamenané hodnoty')}
                        </h3>
                        <div className="my-conflict-options">
                            {(['local', 'remote'] as const).map((choice) => (
                                <div key={choice}>
                                    <h4>
                                        {choice === 'local'
                                            ? t('This device', 'Toto zařízení')
                                            : t('Synced version', 'Synchronizovaná verze')}
                                    </h4>
                                    <p>
                                        {conflictValueLabel(
                                            conflict[choice],
                                            conflict.field,
                                            document,
                                            t,
                                        )}
                                    </p>
                                    <button
                                        className="page-button"
                                        disabled={busy !== null}
                                        type="button"
                                        onClick={() => {
                                            void choose(conflict.id, choice);
                                        }}
                                    >
                                        {choice === 'local'
                                            ? t(
                                                  'Keep this device’s version',
                                                  'Zachovat verzi z tohoto zařízení',
                                              )
                                            : t(
                                                  'Keep synced version',
                                                  'Zachovat synchronizovanou verzi',
                                              )}
                                    </button>
                                </div>
                            ))}
                        </div>
                        <details className="my-details">
                            <summary>
                                {t('Previously shared value', 'Původní společná hodnota')}
                            </summary>
                            <p>{conflictValueLabel(conflict.base, conflict.field, document, t)}</p>
                        </details>
                    </div>
                );
            })}
            {error && <p role="alert">{error}</p>}
        </section>
    );
}
