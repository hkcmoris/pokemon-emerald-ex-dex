import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { PageResponse, Pokemon } from '@pokemon-emerald-ex-dex/shared';

import {
    orderedBrowseResults,
    useDexBrowseResults,
    type DexBrowseFilters,
} from './dexBrowseResults.js';
import { useLanguage } from './language.js';
import { speciesHref } from './navigation.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { typeSurfaceStyle } from './theme.js';

interface SpriteTooltip {
    speciesId: number;
    name: string;
    left: number;
    top: number;
}

/** Scroll only the rail, leaving the detail page and the document in place. */
function revealSprite(container: HTMLElement, item: HTMLElement): void {
    const outer = container.getBoundingClientRect();
    const inner = item.getBoundingClientRect();
    if (inner.top < outer.top) container.scrollTop -= outer.top - inner.top;
    else if (inner.bottom > outer.bottom) container.scrollTop += inner.bottom - outer.bottom;
    if (inner.left < outer.left) container.scrollLeft -= outer.left - inner.left;
    else if (inner.right > outer.right) container.scrollLeft += inner.right - outer.right;
}

export function PokemonSpriteRail({
    filters,
    datasetId,
    selectedSpeciesId,
    initialPage,
    initialData,
    enabled = true,
}: {
    filters: DexBrowseFilters;
    datasetId?: string;
    selectedSpeciesId: number;
    initialPage: number;
    initialData?: PageResponse<Pokemon>;
    enabled?: boolean;
}) {
    const { t, locale } = useLanguage();
    const query = useDexBrowseResults({ filters, datasetId, initialPage, initialData, enabled });
    const entries = useMemo(() => orderedBrowseResults(query.data?.pages ?? []), [query.data]);
    const total = query.data?.pages[0]?.meta.total ?? 0;
    const containerRef = useRef<HTMLDivElement>(null);
    const previousRef = useRef<HTMLButtonElement>(null);
    const nextRef = useRef<HTMLButtonElement>(null);
    const linksRef = useRef(new Map<number, HTMLAnchorElement>());
    const anchorRef = useRef<{
        width: number;
        height: number;
        left: number;
        top: number;
        page: number | undefined;
    } | null>(null);
    const revealedRef = useRef<number | null>(null);
    const [tooltip, setTooltip] = useState<SpriteTooltip | null>(null);
    const tooltipId = useId();

    useEffect(() => {
        if (!enabled) {
            setTooltip(null);
            return;
        }
        const dismiss = () => setTooltip(null);
        window.addEventListener('scroll', dismiss);
        window.addEventListener('resize', dismiss);
        return () => {
            window.removeEventListener('scroll', dismiss);
            window.removeEventListener('resize', dismiss);
        };
    }, [enabled]);

    useEffect(() => {
        const orientation = window.matchMedia('(max-width: 767px)');
        let frame: number | undefined;
        const revealAfterOrientationChange = () => {
            // Vertical offsets cannot anchor a horizontal strip (or the reverse).
            anchorRef.current = null;
            revealedRef.current = null;
            setTooltip(null);
            if (!enabled) return;
            frame = requestAnimationFrame(() => {
                const container = containerRef.current;
                const selected = linksRef.current.get(selectedSpeciesId);
                if (container && selected) {
                    revealSprite(container, selected);
                    revealedRef.current = selectedSpeciesId;
                }
            });
        };
        orientation.addEventListener('change', revealAfterOrientationChange);
        return () => {
            orientation.removeEventListener('change', revealAfterOrientationChange);
            if (frame !== undefined) cancelAnimationFrame(frame);
        };
    }, [enabled, selectedSpeciesId]);

    const loadPrevious = useCallback(() => {
        if (!enabled || !query.hasPreviousPage || query.isFetching) return;
        const container = containerRef.current;
        if (container) {
            anchorRef.current = {
                width: container.scrollWidth,
                height: container.scrollHeight,
                left: container.scrollLeft,
                top: container.scrollTop,
                page: query.data?.pages[0]?.meta.page,
            };
        }
        void query.fetchPreviousPage();
    }, [enabled, query]);

    const loadNext = useCallback(() => {
        if (!enabled || !query.hasNextPage || query.isFetching) return;
        void query.fetchNextPage();
    }, [enabled, query]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || !enabled) return;
        const anchor = anchorRef.current;
        if (anchor && !query.isFetchingPreviousPage) {
            if (query.data?.pages[0]?.meta.page !== anchor.page) {
                container.scrollTop = anchor.top + container.scrollHeight - anchor.height;
                container.scrollLeft = anchor.left + container.scrollWidth - anchor.width;
            }
            anchorRef.current = null;
        }
        const selected = linksRef.current.get(selectedSpeciesId);
        if (selected && revealedRef.current !== selectedSpeciesId) {
            revealSprite(container, selected);
            revealedRef.current = selectedSpeciesId;
        }
    }, [entries, selectedSpeciesId, query.isFetchingPreviousPage, enabled]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !enabled || query.isFetching || query.isError) return;
        const observer = new IntersectionObserver(
            (observations) => {
                // Fetch one direction at a time, so prepending can preserve its scroll anchor.
                if (
                    observations.some(
                        (entry) => entry.isIntersecting && entry.target === previousRef.current,
                    )
                ) {
                    loadPrevious();
                } else if (
                    observations.some(
                        (entry) => entry.isIntersecting && entry.target === nextRef.current,
                    )
                ) {
                    loadNext();
                }
            },
            { root: container, rootMargin: '80px' },
        );
        if (previousRef.current) observer.observe(previousRef.current);
        if (nextRef.current) observer.observe(nextRef.current);
        return () => observer.disconnect();
    }, [
        enabled,
        query.isFetching,
        query.isError,
        query.hasPreviousPage,
        query.hasNextPage,
        loadPrevious,
        loadNext,
    ]);

    function showTooltip(entry: Pokemon, target: HTMLAnchorElement): void {
        const bounds = target.getBoundingClientRect();
        const horizontal = window.matchMedia('(max-width: 767px)').matches;
        setTooltip({
            speciesId: entry.speciesId,
            name: entry.name,
            left: Math.max(
                8,
                Math.min(horizontal ? bounds.left : bounds.right + 10, window.innerWidth - 248),
            ),
            top: Math.max(
                8,
                Math.min(horizontal ? bounds.bottom + 8 : bounds.top + 10, window.innerHeight - 64),
            ),
        });
    }

    function onArrowKey(event: KeyboardEvent<HTMLAnchorElement>, index: number): void {
        if (event.key === 'Escape') {
            setTooltip(null);
            return;
        }
        let targetIndex: number;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') targetIndex = index + 1;
        else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') targetIndex = index - 1;
        else if (event.key === 'Home') targetIndex = 0;
        else if (event.key === 'End') targetIndex = entries.length - 1;
        else return;
        event.preventDefault();
        const entry = entries[targetIndex];
        const target = entry && linksRef.current.get(entry.speciesId);
        if (target && containerRef.current) {
            target.focus({ preventScroll: true });
            revealSprite(containerRef.current, target);
            showTooltip(entry, target);
        } else if (targetIndex < 0) {
            previousRef.current?.focus({ preventScroll: true });
            if (containerRef.current && previousRef.current)
                revealSprite(containerRef.current, previousRef.current);
        } else {
            nextRef.current?.focus({ preventScroll: true });
            if (containerRef.current && nextRef.current)
                revealSprite(containerRef.current, nextRef.current);
        }
    }

    return (
        <nav
            className="pokemon-sprite-rail"
            aria-label={t('Matching Pokémon', 'Pokémoni ve výsledcích')}
        >
            <p className="pokemon-sprite-count" aria-live="polite">
                {query.isPending ? '…' : total.toLocaleString(locale)}
                <span className="sr-only"> {t('matching Pokémon', 'Pokémonů ve výsledcích')}</span>
            </p>
            <div
                className="pokemon-sprite-scroll"
                ref={containerRef}
                onScroll={() => {
                    const focused = entries.find(
                        (entry) => linksRef.current.get(entry.speciesId) === document.activeElement,
                    );
                    const target = focused && linksRef.current.get(focused.speciesId);
                    const outer = containerRef.current?.getBoundingClientRect();
                    const inner = target?.getBoundingClientRect();
                    if (
                        focused &&
                        target &&
                        outer &&
                        inner &&
                        inner.bottom > outer.top &&
                        inner.top < outer.bottom &&
                        inner.right > outer.left &&
                        inner.left < outer.right
                    )
                        showTooltip(focused, target);
                    else setTooltip(null);
                }}
            >
                {query.isPending && (
                    <p className="pokemon-sprite-message" role="status">
                        {t('Loading…', 'Načítání…')}
                    </p>
                )}
                {query.hasPreviousPage && (
                    <button
                        className="pokemon-sprite-page"
                        ref={previousRef}
                        type="button"
                        onClick={loadPrevious}
                        disabled={query.isFetching}
                        aria-label={t('Load previous Pokémon', 'Načíst předchozí Pokémony')}
                    >
                        <span aria-hidden="true">{query.isFetchingPreviousPage ? '…' : '‹'}</span>
                    </button>
                )}
                {entries.map((entry, index) => (
                    <a
                        key={entry.speciesId}
                        ref={(element) => {
                            if (element) linksRef.current.set(entry.speciesId, element);
                            else linksRef.current.delete(entry.speciesId);
                        }}
                        className="pokemon-sprite-link type-surface"
                        style={typeSurfaceStyle(entry.types)}
                        href={speciesHref(entry.speciesId)}
                        aria-label={`${entry.name} #${String(entry.speciesId).padStart(4, '0')}`}
                        aria-current={entry.speciesId === selectedSpeciesId ? 'page' : undefined}
                        aria-describedby={
                            tooltip?.speciesId === entry.speciesId ? tooltipId : undefined
                        }
                        onMouseEnter={(event) => showTooltip(entry, event.currentTarget)}
                        onMouseLeave={() => setTooltip(null)}
                        onFocus={(event) => showTooltip(entry, event.currentTarget)}
                        onBlur={() => setTooltip(null)}
                        onKeyDown={(event) => onArrowKey(event, index)}
                    >
                        <SpeciesSprite
                            datasetId={datasetId}
                            file={entry.sprites?.front ?? null}
                            name={entry.name}
                        />
                        {!entry.sprites?.front && (
                            <span className="pokemon-sprite-fallback" aria-hidden="true">
                                #{String(entry.speciesId).padStart(4, '0')}
                            </span>
                        )}
                    </a>
                ))}
                {query.hasNextPage && (
                    <button
                        className="pokemon-sprite-page"
                        ref={nextRef}
                        type="button"
                        onClick={loadNext}
                        disabled={query.isFetching}
                        aria-label={t('Load more Pokémon', 'Načíst další Pokémony')}
                    >
                        <span aria-hidden="true">{query.isFetchingNextPage ? '…' : '›'}</span>
                    </button>
                )}
                {query.isError && (
                    <div className="pokemon-sprite-message" role="status">
                        <span>{t('Could not load.', 'Načtení selhalo.')}</span>
                        <button
                            type="button"
                            className="pokemon-sprite-retry"
                            onClick={() => {
                                if (query.isFetchPreviousPageError) loadPrevious();
                                else if (query.isFetchNextPageError) loadNext();
                                else void query.refetch();
                            }}
                        >
                            {t('Retry', 'Zkusit znovu')}
                        </button>
                    </div>
                )}
                {query.isSuccess && total === 0 && (
                    <p className="pokemon-sprite-message">{t('No matches.', 'Bez výsledků.')}</p>
                )}
            </div>
            {enabled &&
                tooltip &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="pokemon-sprite-tooltip"
                        id={tooltipId}
                        role="tooltip"
                        style={{ left: tooltip.left, top: tooltip.top }}
                    >
                        <strong>{tooltip.name}</strong>
                        <span>#{String(tooltip.speciesId).padStart(4, '0')}</span>
                    </div>,
                    document.body,
                )}
        </nav>
    );
}
