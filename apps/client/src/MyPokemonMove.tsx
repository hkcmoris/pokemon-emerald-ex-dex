import type { MouseEventHandler, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { KnownMove, Move, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionMove } from './collectionSpecies.js';
import { TypeBadges } from './TypeBadges.js';
import { useLanguage } from './language.js';
import { typeSurfaceStyle } from './theme.js';

export function findReferenceMove(
    moveId: number,
    family: readonly SpeciesDetails[],
): Move | undefined {
    for (const species of family) {
        const move =
            species.learnset.find((entry) => entry.moveId === moveId) ??
            species.machines.find((entry) => entry.moveId === moveId);
        if (move) return move;
    }
    return undefined;
}

export function MyPokemonMove({
    move,
    reference,
    as: Element = 'span',
    className = '',
    prefix,
    suffix,
    onClick,
}: {
    move: KnownMove;
    reference?: Move;
    as?: 'span' | 'li' | 'button' | 'label';
    className?: string;
    prefix?: ReactNode;
    suffix?: ReactNode;
    onClick?: MouseEventHandler<HTMLElement>;
}) {
    const { t } = useLanguage();
    const lookup = useQuery({
        queryKey: ['collection-move', move.moveId],
        queryFn: () => loadCollectionMove(move.moveId),
        enabled: !reference,
    });
    const details = reference ?? lookup.data;
    return (
        <Element
            className={`my-move ${className}${details ? ' type-surface' : ''}`}
            style={details ? typeSurfaceStyle([details.type]) : undefined}
            type={Element === 'button' ? 'button' : undefined}
            aria-label={
                Element === 'button' ? t(`Remove ${move.name}`, `Odebrat ${move.name}`) : undefined
            }
            onClick={onClick}
        >
            {prefix}
            {details && (
                <TypeBadges types={[details.type]} iconFiles={[details.typeIconFile]} iconOnly />
            )}
            <span>{move.name}</span>
            {suffix}
        </Element>
    );
}
