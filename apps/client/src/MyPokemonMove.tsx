import type { MouseEventHandler, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { KnownMove, Move, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionMove } from './collectionSpecies.js';
import { TypeBadges } from './TypeBadges.js';
import { MoveCategory } from './MoveCategory.js';
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
    showStats = false,
    prefix,
    suffix,
    onClick,
}: {
    move: KnownMove;
    reference?: Move;
    as?: 'span' | 'li' | 'button' | 'label';
    className?: string;
    showStats?: boolean;
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
    const heading = (
        <>
            {details && (
                <TypeBadges types={[details.type]} iconFiles={[details.typeIconFile]} iconOnly />
            )}
            <span className="my-move-name">{move.name}</span>
        </>
    );
    return (
        <Element
            className={`my-move ${className}${details ? ' type-surface' : ''}${showStats ? ' my-move-detailed' : ''}`}
            style={details ? typeSurfaceStyle([details.type]) : undefined}
            type={Element === 'button' ? 'button' : undefined}
            aria-label={
                Element === 'button' ? t(`Remove ${move.name}`, `Odebrat ${move.name}`) : undefined
            }
            onClick={onClick}
        >
            {prefix}
            {showStats ? (
                <>
                    <span className="my-move-heading">{heading}</span>
                    <span className="my-move-stats">
                        {details ? (
                            <MoveCategory
                                category={details.category}
                                iconFile={details.categoryIconFile}
                                iconOnly
                            />
                        ) : (
                            <span title={t('Category unavailable', 'Kategorie není dostupná')}>
                                ?
                            </span>
                        )}
                        <span
                            className="my-move-power"
                            title={
                                !details
                                    ? t('Power unavailable', 'Síla není dostupná')
                                    : details.power === 0
                                      ? t('No fixed base power', 'Bez pevné základní síly')
                                      : undefined
                            }
                        >
                            <span>{t('Power', 'Síla')}</span>
                            <strong>{details ? details.power || '—' : '?'}</strong>
                        </span>
                    </span>
                </>
            ) : (
                heading
            )}
            {suffix}
        </Element>
    );
}
