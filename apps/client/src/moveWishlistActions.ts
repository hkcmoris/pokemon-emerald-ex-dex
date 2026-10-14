import {
    assessMoveWishlistAddition,
    recordLearnedWishlistMoves,
    type KnownMove,
    type OwnedPokemon,
    type SpeciesDetails,
} from '@pokemon-emerald-ex-dex/shared';

import type { Translate } from './language.js';

/** Apply the same latest-state validation from every wishlist entry point. */
export function setWishlistMove(
    pokemon: OwnedPokemon,
    details: Readonly<Record<number, SpeciesDetails>>,
    move: KnownMove,
    wanted: boolean,
    t: Translate,
): OwnedPokemon {
    const current = recordLearnedWishlistMoves(pokemon);
    if (wanted) {
        const assessment = assessMoveWishlistAddition(current, details, move, { t });
        if (!assessment.allowed)
            throw new Error(
                assessment.reason ?? t('This move cannot be added.', 'Útok nelze přidat.'),
            );
    }
    const previous = current.moveWishlist;
    const moves = (previous?.moves ?? []).filter((entry) => entry.moveId !== move.moveId);
    return recordLearnedWishlistMoves({
        ...current,
        moveWishlist: {
            moves: wanted ? [...moves, { moveId: move.moveId, name: move.name }] : moves,
            learnedMoveIds: previous?.learnedMoveIds ?? [],
            targetSpeciesId: previous?.targetSpeciesId ?? null,
        },
    });
}
