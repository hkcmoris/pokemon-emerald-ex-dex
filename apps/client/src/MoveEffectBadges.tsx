import { getMoveEffects, type Move, type MoveEffect } from '@pokemon-emerald-ex-dex/shared';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useLanguage } from './language.js';

type Translate = (english: string, czech: string) => string;

const statLabels = {
    attack: ['Attack', 'Útok'],
    defense: ['Defense', 'Obrana'],
    spAttack: ['Sp. Atk', 'Sp. útok'],
    spDefense: ['Sp. Def', 'Sp. obrana'],
    speed: ['Speed', 'Rychlost'],
    accuracy: ['Accuracy', 'Přesnost'],
    evasion: ['Evasion', 'Úhybnost'],
} as const;

const statusLabels = {
    poison: ['Poison', 'Otrava'],
    'bad-poison': ['Bad poison', 'Silná otrava'],
    burn: ['Burn', 'Popálení'],
    paralysis: ['Paralysis', 'Paralýza'],
    sleep: ['Sleep', 'Spánek'],
    freeze: ['Freeze', 'Zmrazení'],
    confusion: ['Confusion', 'Zmatení'],
    flinch: ['Flinch', 'Cuknutí'],
    frostbite: ['Frostbite', 'Omrzliny'],
    drowsy: ['Drowsy', 'Ospalost'],
} as const;

function effectLabel(effect: MoveEffect, t: Translate): string {
    const translateLabel = (labels: readonly [string, string]): string => t(labels[0], labels[1]);
    const target = {
        self: t('Self', 'Uživatel'),
        target: t('Target', 'Cíl'),
        all: t('Everyone', 'Všichni'),
        allies: t('Team', 'Tým'),
    }[effect.target];
    const chance =
        effect.likelihood === 'possible'
            ? t('May: ', 'Může: ')
            : effect.likelihood === 'conditional'
              ? t('Conditional: ', 'Podmíněně: ')
              : '';
    const outcome =
        effect.kind === 'status'
            ? translateLabel(statusLabels[effect.status])
            : effect.kind === 'stat'
              ? `${translateLabel(statLabels[effect.stat])} ${effect.direction === 'up' ? '↑' : '↓'}`
              : effect.kind === 'heal'
                ? t('Healing', 'Léčení')
                : effect.kind === 'drain'
                  ? t('Drain healing', 'Léčení vysátím HP')
                  : t('Recoil', 'Zpětné zranění');
    return `${chance}${target}: ${outcome}`;
}

/** Small hand-drawn SVGs stay crisp in compact move cards and both color themes. */
export function MoveEffectIcon({ effect }: { effect: MoveEffect }) {
    let drawing: ReactNode;
    if (effect.kind === 'stat') {
        const symbol = {
            attack: <path d="m3 15 9-10 2 2-9 10m-3-4 5 5m-5 1 2-2" />,
            defense: <path d="m8 3 6 3v5c0 4-6 8-6 8s-6-4-6-8V6l6-3Z" />,
            spAttack: <path d="m8 2 2 6 5 1-4 4 1 6-4-3-5 3 1-6-3-4 5-1 2-6Z" />,
            spDefense: (
                <>
                    <path d="m8 3 6 3v5c0 4-6 8-6 8s-6-4-6-8V6l6-3Z" />
                    <path d="m8 7 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
                </>
            ),
            speed: (
                <>
                    <path d="m8 3 5 7-5 1 2 8-7-9 5-1V3Z" />
                    <path d="M2 5h2M1 16h2" />
                </>
            ),
            accuracy: (
                <>
                    <circle cx="8" cy="11" r="5" />
                    <path d="M8 3v5m0 6v5M0 11h5m6 0h5" />
                </>
            ),
            evasion: (
                <>
                    <path d="M1 7c5-8 9 12 14 3M1 14c5-8 9 12 14 3" />
                </>
            ),
        }[effect.stat];
        drawing = (
            <>
                {symbol}
                <path
                    d={
                        effect.direction === 'up'
                            ? 'M20 20V5m-3 3 3-3 3 3'
                            : 'M20 4v15m-3-3 3 3 3-3'
                    }
                />
            </>
        );
    } else if (effect.kind === 'status') {
        switch (effect.status) {
            case 'poison':
            case 'bad-poison':
                drawing = (
                    <>
                        <path d="M5 10a7 7 0 1 1 14 0v4l-3 2v4H8v-4l-3-2v-4Z" />
                        <circle cx="9" cy="10" r="1" />
                        <circle cx="15" cy="10" r="1" />
                        <path d="m11 14 1-1 1 1m-3 3v3m4-3v3" />
                        {effect.status === 'bad-poison' && <path d="M20 2v4m-2-2h4" />}
                    </>
                );
                break;
            case 'burn':
                drawing = (
                    <path d="M13 2c1 6-5 6-3 11 2-1 3-3 3-5 5 4 7 6 6 10-2 5-12 5-14 0-2-5 2-9 4-11 0 3 1 4 2 4 2-3 2-5 2-9Z" />
                );
                break;
            case 'paralysis':
                drawing = <path d="m14 2-10 12h7l-1 8L21 9h-8l1-7Z" />;
                break;
            case 'sleep':
            case 'drowsy':
                drawing = (
                    <>
                        <path d="M11 3a9 9 0 1 0 10 12A8 8 0 0 1 11 3Z" />
                        <path d="M15 3h6l-6 6h6" />
                        {effect.status === 'drowsy' && <path d="M4 11h3" />}
                    </>
                );
                break;
            case 'freeze':
            case 'frostbite':
                drawing = (
                    <>
                        <path d="M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3M3 10l4-1-1-4m12 14-1-4 4-1M6 19l1-4-4-1m18-4-4-1 1-4" />
                        {effect.status === 'frostbite' && <circle cx="12" cy="12" r="3" />}
                    </>
                );
                break;
            case 'confusion':
                drawing = (
                    <>
                        <path d="M9 13c-3-4 1-8 5-6 5 3 2 10-4 10-8-1-8-12-1-15M12 21h.01" />
                        <path d="m20 2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" />
                    </>
                );
                break;
            case 'flinch':
                drawing = <path d="m12 2 2 7 7-4-4 7 5 3-8 1-2 6-3-7-7 2 5-6-5-5 8 2 2-6Z" />;
                break;
        }
    } else if (effect.kind === 'heal') {
        drawing = (
            <>
                <path d="M12 21S2 15 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 7-10 13-10 13Z" />
                <path d="M8 12h8m-4-4v8" />
            </>
        );
    } else if (effect.kind === 'drain') {
        drawing = (
            <>
                <path d="M8 3S2 10 2 14a6 6 0 0 0 12 0c0-4-6-11-6-11Z" />
                <path d="M12 10h10m-3-3 3 3-3 3m-2 6h5m-2.5-2.5v5" />
            </>
        );
    } else {
        drawing = (
            <>
                <path d="M20 4v7a5 5 0 0 1-5 5H4m4-4-4 4 4 4" />
                <path d="m4 2 2 4-4 2m8-6-1 4" />
            </>
        );
    }
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {drawing}
        </svg>
    );
}

function MoveEffectBadge({ effect }: { effect: MoveEffect }) {
    const { t } = useLanguage();
    const label = effectLabel(effect, t);
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const tooltip = useRef<HTMLSpanElement>(null);
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [hint, setHint] = useState<{
        center: number;
        top: number;
        above: boolean;
        pinned: boolean;
    } | null>(null);
    const cancelDismiss = useCallback(() => clearTimeout(dismissTimer.current), []);
    const close = useCallback(() => {
        cancelDismiss();
        setHint(null);
    }, [cancelDismiss]);
    const show = useCallback(
        (pinned: boolean): void => {
            cancelDismiss();
            const bounds = trigger.current?.getBoundingClientRect();
            if (!bounds) return;
            const above = bounds.top >= 80;
            setHint((current) => ({
                center: bounds.left + bounds.width / 2,
                top: above ? bounds.top - 6 : bounds.bottom + 6,
                above,
                pinned: pinned || current?.pinned === true,
            }));
        },
        [cancelDismiss],
    );
    const leave = (): void => {
        if (!hint?.pinned) dismissTimer.current = setTimeout(close, 150);
    };
    const isOpen = hint !== null;
    useEffect(() => cancelDismiss, [cancelDismiss]);
    useEffect(() => {
        if (!isOpen) return;
        const outside = (event: PointerEvent): void => {
            if (
                event.target instanceof Node &&
                !trigger.current?.contains(event.target) &&
                !tooltip.current?.contains(event.target)
            )
                close();
        };
        const escape = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') close();
        };
        const scroll = (event: Event): void => {
            const bounds = trigger.current?.getBoundingClientRect();
            const viewport =
                event.target instanceof Element
                    ? event.target.getBoundingClientRect()
                    : { top: 0, bottom: window.innerHeight };
            if (
                document.activeElement !== trigger.current ||
                !bounds ||
                bounds.bottom <= viewport.top ||
                bounds.top >= viewport.bottom
            ) {
                close();
                return;
            }
            // Keyboard focus can scroll the icon into view after its focus event.
            show(true);
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        window.addEventListener('scroll', scroll, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
            window.removeEventListener('scroll', scroll, true);
            window.removeEventListener('resize', close);
        };
    }, [isOpen, close, show]);
    return (
        <span className="move-effect-item" role="listitem">
            <button
                ref={trigger}
                type="button"
                className="move-effect-badge"
                aria-label={label}
                aria-describedby={hint ? `${id}-hint` : undefined}
                title=""
                data-effect={effect.kind === 'status' ? effect.status : effect.kind}
                data-direction={effect.kind === 'stat' ? effect.direction : undefined}
                onPointerEnter={(event) => {
                    if (event.pointerType !== 'touch') show(false);
                }}
                onPointerLeave={leave}
                onFocus={() => show(true)}
                onBlur={close}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    show(true);
                }}
            >
                <MoveEffectIcon effect={effect} />
            </button>
            {hint &&
                createPortal(
                    <span
                        ref={tooltip}
                        id={`${id}-hint`}
                        role="tooltip"
                        className="move-effect-hint"
                        style={{
                            left: `clamp(8px, calc(${hint.center}px - 8rem), calc(100vw - 16rem - 8px))`,
                            top: hint.top,
                            transform: hint.above ? 'translateY(-100%)' : undefined,
                        }}
                        onPointerEnter={cancelDismiss}
                        onPointerLeave={leave}
                    >
                        {label}
                    </span>,
                    document.body,
                )}
        </span>
    );
}

export function MoveEffectBadges({
    move,
    interactive = true,
}: {
    move?: Move;
    interactive?: boolean;
}) {
    const { t } = useLanguage();
    const effects = move ? getMoveEffects(move) : [];
    if (effects.length === 0) return null;
    return (
        <span className="move-effects" role="list" aria-label={t('Move effects', 'Účinky útoku')}>
            {effects.map((effect, index) =>
                interactive ? (
                    <MoveEffectBadge key={index} effect={effect} />
                ) : (
                    <span key={index} className="move-effect-item" role="listitem">
                        <span
                            className="move-effect-badge"
                            role="img"
                            aria-label={effectLabel(effect, t)}
                            title={effectLabel(effect, t)}
                            data-effect={effect.kind === 'status' ? effect.status : effect.kind}
                            data-direction={effect.kind === 'stat' ? effect.direction : undefined}
                        >
                            <MoveEffectIcon effect={effect} />
                        </span>
                    </span>
                ),
            )}
        </span>
    );
}
