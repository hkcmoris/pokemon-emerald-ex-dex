import type { MouseEventHandler, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { KnownMove, Move, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionMove } from './collectionSpecies.js';
import { useLanguage } from './language.js';
import { MoveDisplay } from './MoveDisplay.js';

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
    as = 'span',
    className = '',
    showStats = false,
    prefix,
    suffix,
    onClick,
    disabled = false,
    actionLabel,
}: {
    move: KnownMove;
    reference?: Move;
    as?: 'span' | 'li' | 'button' | 'label';
    className?: string;
    showStats?: boolean;
    prefix?: ReactNode;
    suffix?: ReactNode;
    onClick?: MouseEventHandler<HTMLElement>;
    disabled?: boolean;
    actionLabel?: string;
}) {
    const { t } = useLanguage();
    const suppliedReference = reference ?? ('typeId' in move ? (move as Move) : undefined);
    const lookup = useQuery({
        queryKey: ['collection-move', move.moveId],
        queryFn: () => loadCollectionMove(move.moveId),
        enabled: !suppliedReference,
    });
    return (
        <MoveDisplay
            move={move}
            reference={suppliedReference ?? lookup.data}
            as={as === 'li' ? 'li' : 'span'}
            size={showStats ? 'medium' : 'small'}
            className={className}
            leading={as === 'label' ? undefined : prefix}
            actions={suffix}
            interaction={
                as === 'button'
                    ? {
                          kind: 'button',
                          onClick: onClick ?? (() => {}),
                          disabled,
                          label: actionLabel ?? t(`Remove ${move.name}`, `Odebrat ${move.name}`),
                      }
                    : as === 'label'
                      ? { kind: 'label', control: prefix, onClick }
                      : undefined
            }
        />
    );
}
