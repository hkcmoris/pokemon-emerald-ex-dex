import { useId, useState } from 'react';
import type { KnownMove, OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { useLanguage } from './language.js';
import { setWishlistMove } from './moveWishlistActions.js';
import { WishIcon } from './WishIcon.js';

export function MyPokemonWishlistAction({
    pokemon,
    family,
    move,
    paused = false,
    onUpdate,
}: {
    pokemon: OwnedPokemon;
    family: readonly SpeciesDetails[];
    move: KnownMove;
    paused?: boolean;
    onUpdate?: (updater: (current: OwnedPokemon) => OwnedPokemon) => Promise<void>;
}) {
    const { t } = useLanguage();
    const feedbackId = useId();
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<{ pokemon: OwnedPokemon; message: string } | null>(null);
    const error = failure?.pokemon === pokemon ? failure.message : null;
    const tracked =
        pokemon.moveWishlist?.moves.some((entry) => entry.moveId === move.moveId) ?? false;
    const label = tracked
        ? t(`Remove ${move.name} from wishlist`, `Odebrat ${move.name} z požadovaných útoků`)
        : t(`Track ${move.name}`, `Sledovat ${move.name}`);
    async function toggle() {
        if (!onUpdate || busy || paused) return;
        setFailure(null);
        setBusy(true);
        try {
            const details = Object.fromEntries(
                family.map((species) => [species.speciesId, species]),
            );
            await onUpdate((current) => setWishlistMove(current, details, move, !tracked, t));
        } catch (reason) {
            setFailure({
                pokemon,
                message:
                    reason instanceof Error
                        ? reason.message
                        : t(
                              'Could not save the wishlist. Try again.',
                              'Seznam se nepodařilo uložit. Zkuste to znovu.',
                          ),
            });
        } finally {
            setBusy(false);
        }
    }
    if (!onUpdate)
        return tracked ? (
            <span
                className="my-wishlist-tracked"
                role="img"
                aria-label={t(
                    `${move.name} is wishlisted`,
                    `${move.name} je v požadovaných útocích`,
                )}
                title={t('Wishlisted', 'Požadovaný útok')}
            >
                <WishIcon tracked />
            </span>
        ) : null;
    return (
        <>
            <button
                type="button"
                className="my-wishlist-toggle my-wishlist-move-toggle"
                aria-label={label}
                title={
                    paused
                        ? t(
                              'Resolve wishlist conflicts before editing.',
                              'Před úpravou vyřešte konflikty požadovaných útoků.',
                          )
                        : label
                }
                aria-pressed={tracked}
                aria-describedby={error ? feedbackId : undefined}
                disabled={busy || paused}
                onClick={() => void toggle()}
            >
                <WishIcon tracked={tracked} />
            </button>
            {error && (
                <span id={feedbackId} className="my-wishlist-feedback" role="alert">
                    {error}
                </span>
            )}
        </>
    );
}
