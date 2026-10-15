import type { MouseEventHandler, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { KnownMove, Move, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionMove } from './collectionSpecies.js';
import { TypeBadges } from './TypeBadges.js';
import { MoveCategory } from './MoveCategory.js';
import { useLanguage } from './language.js';
import { typeSurfaceStyle } from './theme.js';
import { MoveEffectBadges } from './MoveEffectBadges.js';
import { moveAffinityLabel, useMoveAffinity } from './MoveAffinity.js';

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

export function MyPokemonMoveStats({ move }: { move?: Move }) {
    const { t } = useLanguage();
    return (
        <span className="my-move-stats">
            {move ? (
                <MoveCategory category={move.category} iconFile={move.categoryIconFile} iconOnly />
            ) : (
                <span title={t('Category unavailable', 'Kategorie není dostupná')}>?</span>
            )}
            <span
                className="my-move-power"
                title={
                    !move
                        ? t('Power unavailable', 'Síla není dostupná')
                        : move.power === 0
                          ? t('No fixed base power', 'Bez pevné základní síly')
                          : undefined
                }
            >
                <span>{t('Power', 'Síla')}</span>
                <strong>{move ? move.power || '—' : '?'}</strong>
            </span>
        </span>
    );
}

export function MyPokemonMove({
    move,
    reference,
    as = 'span',
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
    const affinity = useMoveAffinity(details);
    const affinityDescription = moveAffinityLabel(affinity, t);
    const description =
        details && t(details.description, details.descriptionCs || details.description);
    const interactive = as === 'button' || as === 'label';
    const Element = interactive ? 'span' : as;
    const name = (
        <>
            {details && (
                <TypeBadges types={[details.type]} iconFiles={[details.typeIconFile]} iconOnly />
            )}
            <span className="my-move-name">{move.name}</span>
        </>
    );
    return (
        <Element
            className={`my-move ${className}${details ? ' type-surface' : ''}${showStats ? ' my-move-detailed' : ''}${affinity ? ' my-move-affinity' : ''}${interactive ? ' my-move-interactive' : ''}`}
            data-affinity={affinity ?? undefined}
            title={[description, affinityDescription].filter(Boolean).join('\n') || undefined}
            style={details ? typeSurfaceStyle([details.type]) : undefined}
            onClick={interactive ? undefined : onClick}
        >
            {as !== 'label' && prefix}
            <span className="my-move-heading">
                {as === 'button' ? (
                    <button
                        type="button"
                        className="my-move-primary"
                        aria-label={t(`Remove ${move.name}`, `Odebrat ${move.name}`)}
                        onClick={onClick}
                    >
                        {name}
                    </button>
                ) : as === 'label' ? (
                    <label className="my-move-primary" onClick={onClick}>
                        {prefix}
                        {name}
                    </label>
                ) : (
                    name
                )}
                <MoveEffectBadges move={details} />
            </span>
            {showStats && <MyPokemonMoveStats move={details} />}
            {affinityDescription && <span className="sr-only">{affinityDescription}</span>}
            {suffix}
        </Element>
    );
}
