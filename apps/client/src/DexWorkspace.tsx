import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { PageResponse, Pokemon } from '@pokemon-emerald-ex-dex/shared';

import type { DexSort } from './dex.js';
import { DexHeader } from './DexHeader.js';
import { DexFooter } from './DexFooter.js';
import { PokemonSpriteRail } from './PokemonSpriteRail.js';
import { useLanguage } from './language.js';

interface DexWorkspaceProps {
    version: string;
    datasetId?: string;
    selectedSpeciesId?: number;
    filters: { q: string; type: string; sort: DexSort };
    initialPage: number;
    initialData?: PageResponse<Pokemon>;
    children: ReactNode;
    detail?: ReactNode;
}

/** Keep the browsing context mounted while its list contracts into a sprite navigator. */
export function DexWorkspace({
    version,
    datasetId,
    selectedSpeciesId,
    filters,
    initialPage,
    initialData,
    children,
    detail,
}: DexWorkspaceProps) {
    const { t } = useLanguage();
    const showingDetail = selectedSpeciesId !== undefined;
    const [lastSpeciesId, setLastSpeciesId] = useState(selectedSpeciesId);
    const workspace = useRef<HTMLElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const previousSpeciesId = useRef(selectedSpeciesId);
    useEffect(() => {
        if (selectedSpeciesId !== undefined) setLastSpeciesId(selectedSpeciesId);
    }, [selectedSpeciesId]);
    useLayoutEffect(() => {
        const element = workspace.current;
        if (!element) return;
        // Keep table rows at their full width during the collapse/expansion. Rewrapping
        // them on every animation frame would also shift the restored scroll position.
        let frame: number | undefined;
        const measure = () => {
            const width = `${element.clientWidth}px`;
            if (element.style.getPropertyValue('--dex-list-width') !== width) {
                element.style.setProperty('--dex-list-width', width);
            }
        };
        measure();
        // A width update can also change the observed height. Defer writes out of
        // ResizeObserver delivery so viewport changes cannot trigger a layout loop.
        const observer = new ResizeObserver(() => {
            if (frame !== undefined) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        });
        observer.observe(element);
        return () => {
            observer.disconnect();
            if (frame !== undefined) cancelAnimationFrame(frame);
        };
    }, []);
    useLayoutEffect(() => {
        const previous = previousSpeciesId.current;
        previousSpeciesId.current = selectedSpeciesId;
        if (selectedSpeciesId !== undefined || previous === undefined) return;
        // Returning should restore keyboard position without overriding the saved page scroll.
        const links = list.current?.querySelectorAll<HTMLAnchorElement>(
            `a[href="#/species/${previous}"]`,
        );
        const visible = Array.from(links ?? []).find((link) => link.getClientRects().length > 0);
        const target =
            visible ?? list.current?.querySelector<HTMLInputElement>('input[type="search"]');
        target?.focus({ preventScroll: true });
    }, [selectedSpeciesId]);
    const railSpeciesId = selectedSpeciesId ?? lastSpeciesId;
    const resultKey = JSON.stringify([
        datasetId,
        filters.q,
        filters.type,
        filters.sort,
        initialPage,
    ]);

    return (
        <div className="min-h-screen">
            <DexHeader
                version={version}
                backHref={showingDetail ? '#/' : undefined}
                backLabel={t('Back to list', 'Zpět na seznam')}
            />
            <main
                ref={workspace}
                className={`dex-workspace${showingDetail ? ' dex-workspace-open' : ''}`}
            >
                <div className="dex-workspace-list">
                    <div
                        ref={list}
                        className="dex-workspace-list-content"
                        inert={showingDetail}
                        aria-hidden={showingDetail || undefined}
                    >
                        {children}
                    </div>
                    <div
                        className="dex-workspace-navigator"
                        inert={!showingDetail}
                        aria-hidden={!showingDetail || undefined}
                    >
                        <a
                            href="#/"
                            className="dex-workspace-expand"
                            title={t('Expand Pokémon list', 'Rozbalit seznam Pokémonů')}
                            aria-label={t('Expand Pokémon list', 'Rozbalit seznam Pokémonů')}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="20"
                                height="20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                aria-hidden="true"
                            >
                                <path d="M4 5h16M4 12h16M4 19h16" />
                                <path d="m11 8-4 4 4 4" />
                            </svg>
                        </a>
                        {railSpeciesId !== undefined && (
                            <PokemonSpriteRail
                                key={resultKey}
                                filters={filters}
                                datasetId={datasetId}
                                selectedSpeciesId={railSpeciesId}
                                initialPage={initialPage}
                                initialData={initialData}
                                enabled={showingDetail}
                            />
                        )}
                    </div>
                </div>
                <div className="dex-workspace-detail" aria-hidden={!showingDetail || undefined}>
                    {detail}
                    {showingDetail && <DexFooter />}
                </div>
            </main>
        </div>
    );
}
