import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Item } from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError, fetchItem, fetchItemPockets, fetchItems } from './api.js';
import { DexFooter } from './DexFooter.js';
import { DexHeader } from './DexHeader.js';
import { DexNavigation } from './DexNavigation.js';
import { ItemIcon } from './ItemIcon.js';
import { itemHref } from './navigation.js';

export function ItemDetails({ item }: { item: Item }) {
    const fields: readonly [string, string | number][] = [
        ['Item ID', item.itemId],
        ['Pocket', item.pocket],
        ['Price', item.price.toLocaleString('en-US')],
        ['Plural name', item.pluralName ?? 'Not recorded'],
        ['Not consumed', item.notConsumed ? 'Yes' : 'No'],
        ['Fling power', item.flingPower],
        ['Pocket ID', item.pocketId],
        ['Secondary ID', item.secondaryId],
        ['Held effect ID', item.holdEffectId],
        ['Held effect parameter', item.holdEffectParam],
        ['Importance', item.importance],
        ['Item use type ID', item.itemUseTypeId],
        ['Battle usage ID', item.battleUsageId],
    ];
    return (
        <section className="species-section" aria-label="Item details">
            <div className="section-heading">
                <p className="eyebrow">ROM item #{String(item.itemId).padStart(4, '0')}</p>
                <h2 className="flex items-center gap-3">
                    <ItemIcon file={item.iconFile} name={item.name} />
                    {item.name}
                </h2>
            </div>
            <div className="p-5 sm:p-6">
                <p className="text-sm leading-relaxed">
                    {item.description || 'No description recorded.'}
                </p>
                <dl className="rom-fields mt-5">
                    {fields.map(([label, value]) => (
                        <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                        </div>
                    ))}
                </dl>
                <details className="rule-details mt-5">
                    <summary>ROM diagnostics</summary>
                    <pre className="condition-data mt-3">{JSON.stringify(item.rom, null, 2)}</pre>
                </details>
            </div>
        </section>
    );
}

export function ItemsPage({ itemId, version }: { itemId: number | undefined; version: string }) {
    const [q, setQ] = useState('');
    const [pocket, setPocket] = useState('');
    const [page, setPage] = useState(1);
    const pockets = useQuery({
        queryKey: ['item-pockets'],
        queryFn: ({ signal }) => fetchItemPockets(signal),
        enabled: itemId === undefined,
    });
    const items = useQuery({
        queryKey: ['items', q.trim(), pocket, page],
        queryFn: ({ signal }) => fetchItems(q.trim(), pocket, page, signal),
        enabled: itemId === undefined,
    });
    const detail = useQuery({
        queryKey: ['item', itemId],
        queryFn: ({ signal }) => fetchItem(itemId ?? 0, signal),
        enabled: itemId !== undefined,
    });
    const active = itemId === undefined ? items : detail;
    const failed = active.isError || (itemId === undefined && pockets.isError);
    const notFound = detail.error instanceof ApiRequestError && detail.error.status === 404;
    return (
        <div className="min-h-screen">
            <DexHeader
                version={version}
                {...(itemId !== undefined ? { backHref: '#/items', backLabel: 'All items' } : {})}
            />
            <main className="dex-browse-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8">
                <div className="catalog-heading">
                    <div>
                        <p className="eyebrow">Trainer essentials</p>
                        <h1>
                            {detail.data?.name ?? (itemId === undefined ? 'Items' : 'Item details')}
                        </h1>
                    </div>
                </div>
                {itemId === undefined && (
                    <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]">
                        <label className="filter-label">
                            Find an item
                            <input
                                className="filter-input"
                                type="search"
                                maxLength={100}
                                placeholder="Name or item ID"
                                value={q}
                                onChange={(event) => {
                                    setQ(event.target.value);
                                    setPage(1);
                                }}
                            />
                        </label>
                        <label className="filter-label">
                            Pocket
                            <select
                                className="filter-input"
                                value={pocket}
                                onChange={(event) => {
                                    setPocket(event.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">All pockets</option>
                                {pockets.data?.map((entry) => (
                                    <option key={entry.pocketId} value={entry.name}>
                                        {entry.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                )}
                {failed ? (
                    <section className="species-section p-6" role="alert">
                        <h2 className="text-xl font-semibold">
                            {notFound ? 'Item not found' : 'Couldn’t load items'}
                        </h2>
                        {!notFound && (
                            <button
                                className="page-button mt-4"
                                onClick={() => {
                                    void active.refetch();
                                    if (itemId === undefined) void pockets.refetch();
                                }}
                            >
                                Try again
                            </button>
                        )}
                    </section>
                ) : active.isPending ? (
                    <p role="status">Loading items…</p>
                ) : itemId !== undefined && detail.data ? (
                    <ItemDetails item={detail.data} />
                ) : (
                    <>
                        <p className="mb-4 text-sm text-stone-600" role="status">
                            {items.data?.meta.total.toLocaleString('en-US')} matching items
                        </p>
                        <ul className="item-catalog">
                            {items.data?.data.map((item) => (
                                <li key={item.itemId} className="evolution-node">
                                    <a
                                        className="species-link flex items-center gap-3"
                                        href={itemHref(item.itemId)}
                                    >
                                        <ItemIcon file={item.iconFile} name={item.name} />
                                        <span className="font-semibold">{item.name}</span>
                                        <span className="ml-auto font-mono text-xs">
                                            #{String(item.itemId).padStart(4, '0')}
                                        </span>
                                    </a>
                                    <p className="mt-3 text-sm leading-relaxed">
                                        {item.description}
                                    </p>
                                    <p className="mt-3 text-xs text-stone-600">
                                        {item.pocket} · Price {item.price.toLocaleString('en-US')}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        {items.data?.data.length === 0 && (
                            <p className="empty-note">No matching items.</p>
                        )}
                        <div className="mt-5 flex items-center justify-between gap-3">
                            <button
                                className="page-button"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous
                            </button>
                            <p className="text-xs text-stone-600">
                                Page {page} of {Math.max(1, items.data?.meta.totalPages ?? 1)}
                            </p>
                            <button
                                className="page-button"
                                disabled={page >= (items.data?.meta.totalPages ?? 0)}
                                onClick={() => setPage(page + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
                <DexFooter context="items" />
            </main>
            <DexNavigation active="items" />
        </div>
    );
}
