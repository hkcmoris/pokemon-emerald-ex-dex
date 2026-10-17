import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { useLanguage } from './language.js';

export interface ReorderItem {
    id: string;
    label: string;
}

export function sameOrder(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function moveToPosition(ids: readonly string[], id: string, position: number): string[] {
    if (!ids.includes(id)) return [...ids];
    const next = ids.filter((entry) => entry !== id);
    next.splice(Math.max(0, Math.min(position, next.length)), 0, id);
    return next;
}

interface ReorderAttempt {
    before: string[];
    after: string[];
}

interface ReorderGesture {
    id: string;
    before: string[];
    order: string[];
    pointer?: { x: number; y: number };
}

/** Only the handle starts a drag; links and actions inside each item keep their normal behavior. */
export function ReorderList<T extends ReorderItem>({
    items,
    onReorder,
    disabled = false,
    label,
    layout = 'vertical',
    className = '',
    renderItem,
}: {
    items: readonly T[];
    onReorder: (ids: string[]) => Promise<void>;
    disabled?: boolean;
    label: string;
    layout?: 'vertical' | 'horizontal' | 'grid';
    className?: string;
    renderItem: (item: T, controls: ReactNode) => ReactNode;
}) {
    const { t } = useLanguage();
    const instructionsId = useId();
    const listRef = useRef<HTMLUListElement>(null);
    const gestureRef = useRef<ReorderGesture | null>(null);
    const ids = items.map((item) => item.id);
    const currentRef = useRef({ ids, disabled, onReorder });
    currentRef.current = { ids, disabled, onReorder };
    const [gesture, setGesture] = useState<ReorderGesture | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState<ReorderAttempt | null>(null);
    const [undo, setUndo] = useState<ReorderAttempt | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const signature = JSON.stringify(ids);

    function changeGesture(value: ReorderGesture | null) {
        gestureRef.current = value;
        setGesture(value);
    }
    function cancel() {
        changeGesture(null);
        setAnnouncement(t('Reordering cancelled.', 'Změna pořadí zrušena.'));
    }
    useEffect(() => {
        const active = gestureRef.current;
        if (active && (disabled || !sameOrder(active.before, currentRef.current.ids))) {
            gestureRef.current = null;
            setGesture(null);
            setAnnouncement(
                t(
                    'The list changed. Reordering cancelled.',
                    'Seznam se změnil. Změna pořadí zrušena.',
                ),
            );
        }
    }, [signature, disabled, t]);

    async function save(attempt: ReorderAttempt) {
        const current = currentRef.current;
        if (busy || current.disabled || !sameOrder(attempt.before, current.ids)) {
            cancel();
            return;
        }
        changeGesture(null);
        if (sameOrder(attempt.before, attempt.after)) return;
        setBusy(true);
        setFailed(null);
        setUndo(null);
        try {
            await current.onReorder(attempt.after);
            setUndo(attempt);
            setAnnouncement(t('Order saved.', 'Pořadí uloženo.'));
        } catch {
            setFailed(attempt);
            setAnnouncement('');
        } finally {
            setBusy(false);
        }
    }
    function begin(id: string, pointer?: { x: number; y: number }) {
        if (disabled || busy) return;
        changeGesture({ id, before: [...ids], order: [...ids], pointer });
        setAnnouncement(
            t(
                'Use arrow keys to move; Enter saves and Escape cancels.',
                'Šipkami změňte pozici, Enter uloží a Escape zruší změnu.',
            ),
        );
    }
    function movePointer(x: number, y: number) {
        const active = gestureRef.current;
        const list = listRef.current;
        if (!active?.pointer || !list) return;
        const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-reorder-id]');
        if (!target || target.parentElement !== list) {
            gestureRef.current = { ...active, pointer: { x, y } };
            return;
        }
        const index = active.order.indexOf(target.dataset.reorderId ?? '');
        if (index < 0) return;
        const order = moveToPosition(active.order, active.id, index);
        const next = { ...active, pointer: { x, y }, order };
        if (!sameOrder(active.order, order)) changeGesture(next);
        else gestureRef.current = next;
    }
    useEffect(() => {
        if (!gesture?.pointer) return;
        let frame = 0;
        function scrollEdges() {
            const point = gestureRef.current?.pointer;
            if (!point) return;
            let container: HTMLElement | null = listRef.current;
            while (container) {
                const style = getComputedStyle(container);
                const bounds = container.getBoundingClientRect();
                const horizontal =
                    container.scrollWidth > container.clientWidth &&
                    /(auto|scroll)/.test(style.overflowX);
                const vertical =
                    container.scrollHeight > container.clientHeight &&
                    /(auto|scroll)/.test(style.overflowY);
                if (horizontal)
                    container.scrollLeft +=
                        point.x < bounds.left + 36 ? -8 : point.x > bounds.right - 36 ? 8 : 0;
                if (vertical)
                    container.scrollTop +=
                        point.y < bounds.top + 36 ? -8 : point.y > bounds.bottom - 36 ? 8 : 0;
                container = container.parentElement;
            }
            const dy = point.y < 80 ? -8 : point.y > window.innerHeight - 80 ? 8 : 0;
            if (dy) window.scrollBy(0, dy);
            movePointer(point.x, point.y);
            frame = requestAnimationFrame(scrollEdges);
        }
        frame = requestAnimationFrame(scrollEdges);
        return () => cancelAnimationFrame(frame);
    }, [Boolean(gesture?.pointer)]);

    const validGesture = gesture && !disabled && sameOrder(gesture.before, ids) ? gesture : null;
    const orderedItems = (validGesture?.order ?? ids).map((id) =>
        items.find((item) => item.id === id)!,
    );
    const undoAvailable = undo && sameOrder(undo.after, ids);
    const retryAvailable = failed && sameOrder(failed.before, ids);
    return (
        <>
            <p className="sr-only" id={instructionsId}>
                {t(
                    'Drag the handle, or press Space then use arrow keys. Enter saves; Escape cancels. You can also choose a position.',
                    'Přetáhněte úchyt, nebo stiskněte mezerník a použijte šipky. Enter uloží, Escape zruší změnu. Můžete také vybrat pozici.',
                )}
            </p>
            <ul
                ref={listRef}
                className={`reorder-list reorder-list-${layout} ${className}`}
                aria-label={label}
                aria-busy={busy}
            >
                {orderedItems.map((item, index) => (
                    <li
                        key={item.id}
                        data-reorder-id={item.id}
                        data-dragging={validGesture?.id === item.id ? 'true' : undefined}
                    >
                        {renderItem(
                            item,
                            <span className="reorder-controls">
                                <button
                                    type="button"
                                    className="reorder-handle"
                                    disabled={disabled || busy || items.length < 2}
                                    aria-label={t(
                                        `Reorder ${item.label}`,
                                        `Změnit pořadí: ${item.label}`,
                                    )}
                                    aria-describedby={instructionsId}
                                    aria-pressed={validGesture?.id === item.id}
                                    onPointerDown={(event) => {
                                        if (event.button !== 0 || disabled || busy) return;
                                        event.preventDefault();
                                        event.currentTarget.focus();
                                        event.currentTarget.setPointerCapture(event.pointerId);
                                        begin(item.id, { x: event.clientX, y: event.clientY });
                                    }}
                                    onPointerMove={(event) =>
                                        movePointer(event.clientX, event.clientY)
                                    }
                                    onPointerUp={() => {
                                        const active = gestureRef.current;
                                        if (active?.pointer)
                                            void save({
                                                before: active.before,
                                                after: active.order,
                                            });
                                    }}
                                    onPointerCancel={cancel}
                                    onLostPointerCapture={() => {
                                        if (gestureRef.current?.pointer) cancel();
                                    }}
                                    onKeyDown={(event) => {
                                        const active = gestureRef.current;
                                        if (event.key === ' ' || event.key === 'Enter') {
                                            event.preventDefault();
                                            if (active?.id === item.id)
                                                void save({
                                                    before: active.before,
                                                    after: active.order,
                                                });
                                            else begin(item.id);
                                        } else if (
                                            active?.id === item.id &&
                                            event.key === 'Escape'
                                        ) {
                                            event.preventDefault();
                                            cancel();
                                        } else if (
                                            active?.id === item.id &&
                                            [
                                                'ArrowUp',
                                                'ArrowDown',
                                                'ArrowLeft',
                                                'ArrowRight',
                                                'Home',
                                                'End',
                                            ].includes(event.key)
                                        ) {
                                            event.preventDefault();
                                            const position = active.order.indexOf(item.id);
                                            const target =
                                                event.key === 'Home'
                                                    ? 0
                                                    : event.key === 'End'
                                                      ? ids.length - 1
                                                      : position +
                                                        (event.key === 'ArrowUp' ||
                                                        event.key === 'ArrowLeft'
                                                            ? -1
                                                            : 1);
                                            const order = moveToPosition(
                                                active.order,
                                                item.id,
                                                target,
                                            );
                                            changeGesture({ ...active, order });
                                            setAnnouncement(
                                                t(
                                                    `${item.label}, position ${order.indexOf(item.id) + 1} of ${ids.length}.`,
                                                    `${item.label}, pozice ${order.indexOf(item.id) + 1} z ${ids.length}.`,
                                                ),
                                            );
                                        }
                                    }}
                                >
                                    <svg viewBox="0 0 16 24" aria-hidden="true">
                                        <path d="M5 5h1m4 0h1M5 12h1m4 0h1M5 19h1m4 0h1" />
                                    </svg>
                                </button>
                                <select
                                    className="reorder-position"
                                    aria-label={t(
                                        `Position of ${item.label}`,
                                        `Pozice: ${item.label}`,
                                    )}
                                    value={index}
                                    disabled={
                                        disabled ||
                                        busy ||
                                        items.length < 2 ||
                                        Boolean(validGesture)
                                    }
                                    onChange={(event) =>
                                        void save({
                                            before: ids,
                                            after: moveToPosition(
                                                ids,
                                                item.id,
                                                Number(event.target.value),
                                            ),
                                        })
                                    }
                                >
                                    {items.map((_, position) => (
                                        <option value={position} key={position}>
                                            {position + 1}
                                        </option>
                                    ))}
                                </select>
                            </span>,
                        )}
                    </li>
                ))}
            </ul>
            <div className="reorder-feedback">
                <span role="status" aria-live="polite">
                    {busy ? t('Saving order…', 'Ukládání pořadí…') : announcement}
                </span>
                {undoAvailable && !busy && (
                    <button
                        className="my-text-button"
                        type="button"
                        disabled={disabled}
                        onClick={() => void save({ before: undo.after, after: undo.before })}
                    >
                        {t('Undo', 'Vrátit')}
                    </button>
                )}
                {failed && (
                    <span role="alert">
                        {t('Could not save the order.', 'Pořadí se nepodařilo uložit.')}{' '}
                        {retryAvailable && (
                            <button
                                className="my-text-button"
                                type="button"
                                disabled={disabled || busy}
                                onClick={() => void save(failed)}
                            >
                                {t('Retry', 'Zkusit znovu')}
                            </button>
                        )}
                    </span>
                )}
            </div>
        </>
    );
}
