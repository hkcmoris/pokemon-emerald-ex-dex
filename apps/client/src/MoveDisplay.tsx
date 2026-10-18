import type { MouseEventHandler, ReactNode } from 'react';
import type { KnownMove, Move } from '@pokemon-emerald-ex-dex/shared';

import { MoveCategory } from './MoveCategory.js';
import { MoveEffectBadges } from './MoveEffectBadges.js';
import { MovePower } from './MovePower.js';
import { moveAffinityLabel, useMoveAffinity, type MoveAffinity } from './MoveAffinity.js';
import { TypeBadges } from './TypeBadges.js';
import { useLanguage } from './language.js';
import { typeSurfaceStyle } from './theme.js';

export type MoveDisplaySize = 'small' | 'medium' | 'large';

export interface MoveDisplayInformation {
    type: boolean;
    category: boolean;
    effects: boolean;
    description: boolean;
    power: boolean;
    accuracy: boolean;
    pp: boolean;
    priority: boolean;
    effectivePower: boolean;
}

export interface MoveDisplayProps {
    move: KnownMove | Move;
    reference?: Move;
    size?: MoveDisplaySize;
    show?: Partial<MoveDisplayInformation>;
    as?: 'span' | 'article' | 'li';
    className?: string;
    leading?: ReactNode;
    metadata?: ReactNode;
    actions?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
    /** A contextual result, e.g. total HP damage. Never substitutes for base power. */
    metric?: { label: ReactNode; value: ReactNode; detail?: ReactNode };
    affinity?: MoveAffinity | null;
    /** Render without nested controls when the parent is a link or button. */
    passive?: boolean;
    interaction?:
        | {
              kind: 'button';
              onClick: MouseEventHandler<HTMLElement>;
              disabled?: boolean;
              label: string;
          }
        | { kind: 'label'; control: ReactNode; onClick?: MouseEventHandler<HTMLElement> };
}

/** One visual vocabulary for move chips, collection cards and battle results.
 * Data fetching and battle calculations belong to the calling feature.
 */
export function MoveDisplay({
    move,
    reference,
    size = 'medium',
    show,
    as: Element = 'span',
    className = '',
    leading,
    metadata,
    actions,
    footer,
    children,
    metric,
    affinity: affinityOverride,
    passive = false,
    interaction,
}: MoveDisplayProps) {
    const { t } = useLanguage();
    const details = reference ?? ('typeId' in move ? move : undefined);
    const contextAffinity = useMoveAffinity(details);
    const affinity = affinityOverride === undefined ? contextAffinity : affinityOverride;
    const affinityDescription = moveAffinityLabel(affinity, t);
    const info: MoveDisplayInformation = {
        type: true,
        category: size !== 'small',
        effects: true,
        description: false,
        power: size !== 'small',
        accuracy: false,
        pp: false,
        priority: false,
        effectivePower: size === 'medium',
        ...show,
    };
    const description =
        details && t(details.description, details.descriptionCs || details.description);
    const identity = (
        <>
            {info.type && details && (
                <TypeBadges types={[details.type]} iconFiles={[details.typeIconFile]} iconOnly />
            )}
            <span className="move-display-name">{move.name}</span>
        </>
    );
    const hasStats = info.power || info.accuracy || info.pp || info.priority;
    const Content = Element === 'span' ? 'span' : 'div';
    return (
        <Element
            className={`move-display move-display--${size}${metric ? ' move-display--result' : ''}${details ? ' type-surface' : ''}${affinity ? ' my-move-affinity' : ''}${interaction && !passive ? ' move-display--interactive' : ''}${className ? ` ${className}` : ''}`}
            data-move-id={move.moveId}
            aria-label={Element === 'article' ? move.name : undefined}
            data-affinity={affinity ?? undefined}
            style={details ? typeSurfaceStyle([details.type]) : undefined}
            title={[description, affinityDescription].filter(Boolean).join('\n') || undefined}
        >
            <span className="move-display-header">
                {leading && <span className="move-display-leading">{leading}</span>}
                <span className="move-display-heading">
                    {!passive && interaction?.kind === 'button' ? (
                        <button
                            type="button"
                            className="move-display-primary"
                            aria-label={interaction.label}
                            disabled={interaction.disabled}
                            onClick={interaction.onClick}
                        >
                            {identity}
                        </button>
                    ) : !passive && interaction?.kind === 'label' ? (
                        <label className="move-display-primary" onClick={interaction.onClick}>
                            {interaction.control}
                            {identity}
                        </label>
                    ) : (
                        identity
                    )}
                    {info.effects && <MoveEffectBadges move={details} interactive={!passive} />}
                    {info.category && details && (
                        <MoveCategory
                            category={details.category}
                            iconFile={details.categoryIconFile}
                            iconOnly
                        />
                    )}
                </span>
                {actions && <span className="move-display-actions">{actions}</span>}
            </span>
            {metadata && <span className="move-display-metadata">{metadata}</span>}
            {info.description && (
                <span className="move-display-description">
                    {description || t('No description recorded.', 'Popis není uveden.')}
                </span>
            )}
            {(metric || hasStats || (info.effectivePower && !passive)) && (
                <span className="move-display-values">
                    {metric ? (
                        <span className="move-display-metric">
                            <span className="move-display-metric-label">{metric.label}</span>
                            <strong className="move-display-metric-value">{metric.value}</strong>
                            {metric.detail && (
                                <span className="move-display-metric-detail">{metric.detail}</span>
                            )}
                        </span>
                    ) : info.effectivePower && !passive ? (
                        <MovePower move={details} showLabel />
                    ) : null}
                    {hasStats && (
                        <span className="move-display-stats">
                            {info.power && (
                                <span
                                    className="move-display-stat"
                                    title={
                                        !details
                                            ? t('Power unavailable', 'Síla není dostupná')
                                            : details.power === 0
                                              ? t('No fixed base power', 'Bez pevné základní síly')
                                              : undefined
                                    }
                                >
                                    <span>
                                        {metric
                                            ? t('Base power', 'Základní síla')
                                            : t('Power', 'Síla')}
                                    </span>
                                    <strong>{details ? details.power || '—' : '?'}</strong>
                                </span>
                            )}
                            {info.accuracy && (
                                <span
                                    className="move-display-stat"
                                    title={
                                        details?.accuracy === 0
                                            ? t(
                                                  'No normal percentage accuracy check',
                                                  'Bez běžné procentní kontroly přesnosti',
                                              )
                                            : undefined
                                    }
                                >
                                    <span>{t('Accuracy', 'Přesnost')}</span>
                                    <strong>
                                        {details
                                            ? details.accuracy
                                                ? `${details.accuracy}%`
                                                : '—'
                                            : '?'}
                                    </strong>
                                </span>
                            )}
                            {info.pp && (
                                <span className="move-display-stat">
                                    <span>PP</span>
                                    <strong>{details?.pp ?? '?'}</strong>
                                </span>
                            )}
                            {info.priority && (
                                <span className="move-display-stat">
                                    <span>{t('Priority', 'Priorita')}</span>
                                    <strong>
                                        {details
                                            ? details.priority > 0
                                                ? `+${details.priority}`
                                                : details.priority
                                            : '?'}
                                    </strong>
                                </span>
                            )}
                        </span>
                    )}
                </span>
            )}
            {children && <Content className="move-display-content">{children}</Content>}
            {footer && <Content className="move-display-footer">{footer}</Content>}
            {affinityDescription && <span className="sr-only">{affinityDescription}</span>}
        </Element>
    );
}
