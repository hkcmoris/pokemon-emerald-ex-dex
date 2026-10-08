import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Item } from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError, fetchItem, fetchItemPockets, fetchItems } from './api.js';
import { DexFooter } from './DexFooter.js';
import { DexHeader } from './DexHeader.js';
import { DexNavigation } from './DexNavigation.js';
import { ItemIcon } from './ItemIcon.js';
import { useLanguage } from './language.js';
import { itemHref } from './navigation.js';

export function ItemDetails({ item }: { item: Item }) {
    const { t, locale } = useLanguage();
    const fields: readonly [string, string | number][] = [
        [t('Item ID', 'ID předmětu'), item.itemId],
        [t('Pocket', 'Kapsa'), item.pocket],
        [t('Price', 'Cena'), item.price.toLocaleString(locale)],
        [
            t('Plural name', 'Název v množném čísle'),
            item.pluralName ?? t('Not recorded', 'Neuvedeno'),
        ],
        [t('Not consumed', 'Nespotřebuje se'), item.notConsumed ? t('Yes', 'Ano') : t('No', 'Ne')],
        [t('Fling power', 'Síla Fling'), item.flingPower],
        [t('Pocket ID', 'ID kapsy'), item.pocketId],
        [t('Secondary ID', 'Sekundární ID'), item.secondaryId],
        [t('Held effect ID', 'ID účinku při držení'), item.holdEffectId],
        [t('Held effect parameter', 'Parametr účinku při držení'), item.holdEffectParam],
        [t('Importance', 'Důležitost'), item.importance],
        [t('Item use type ID', 'ID typu použití předmětu'), item.itemUseTypeId],
        [t('Battle usage ID', 'ID použití v souboji'), item.battleUsageId],
    ];
    return (
        <section className="species-section" aria-label={t('Item details', 'Podrobnosti předmětu')}>
            <div className="section-heading">
                <p className="eyebrow">
                    {t('ROM item', 'Předmět v ROM')} #{String(item.itemId).padStart(4, '0')}
                </p>
                <h2 className="flex items-center gap-3">
                    <ItemIcon file={item.iconFile} name={item.name} />
                    {item.name}
                </h2>
            </div>
            <div className="p-5 sm:p-6">
                <p className="text-sm leading-relaxed">
                    {item.description || t('No description recorded.', 'Popis není uveden.')}
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
                    <summary>{t('ROM diagnostics', 'Diagnostika ROM')}</summary>
                    <pre className="condition-data mt-3">{JSON.stringify(item.rom, null, 2)}</pre>
                </details>
            </div>
        </section>
    );
}

export function ItemsPage({ itemId, version }: { itemId: number | undefined; version: string }) {
    const { t, locale } = useLanguage();
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
                {...(itemId !== undefined
                    ? { backHref: '#/items', backLabel: t('All items', 'Všechny předměty') }
                    : {})}
            />
            <main className="dex-browse-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8">
                <div className="catalog-heading">
                    <div>
                        <p className="eyebrow">{t('Trainer essentials', 'Výbava trenéra')}</p>
                        <h1>
                            {detail.data?.name ??
                                (itemId === undefined
                                    ? t('Items', 'Předměty')
                                    : t('Item details', 'Podrobnosti předmětu'))}
                        </h1>
                    </div>
                </div>
                {itemId === undefined && (
                    <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]">
                        <label className="filter-label">
                            {t('Find an item', 'Najít předmět')}
                            <input
                                className="filter-input"
                                type="search"
                                maxLength={100}
                                placeholder={t('Name or item ID', 'Název nebo ID předmětu')}
                                value={q}
                                onChange={(event) => {
                                    setQ(event.target.value);
                                    setPage(1);
                                }}
                            />
                        </label>
                        <label className="filter-label">
                            {t('Pocket', 'Kapsa')}
                            <select
                                className="filter-input"
                                value={pocket}
                                onChange={(event) => {
                                    setPocket(event.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">{t('All pockets', 'Všechny kapsy')}</option>
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
                            {notFound
                                ? t('Item not found', 'Předmět nebyl nalezen')
                                : t('Couldn’t load items', 'Předměty se nepodařilo načíst')}
                        </h2>
                        {!notFound && (
                            <button
                                className="page-button mt-4"
                                onClick={() => {
                                    void active.refetch();
                                    if (itemId === undefined) void pockets.refetch();
                                }}
                            >
                                {t('Try again', 'Zkusit znovu')}
                            </button>
                        )}
                    </section>
                ) : active.isPending ? (
                    <p role="status">{t('Loading items…', 'Načítání předmětů…')}</p>
                ) : itemId !== undefined && detail.data ? (
                    <ItemDetails item={detail.data} />
                ) : (
                    <>
                        <p className="mb-4 text-sm text-stone-600" role="status">
                            {t(
                                `${items.data?.meta.total.toLocaleString(locale)} matching items`,
                                `Nalezené předměty: ${items.data?.meta.total.toLocaleString(locale)}`,
                            )}
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
                                        {item.pocket} · {t('Price', 'Cena')}{' '}
                                        {item.price.toLocaleString(locale)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        {items.data?.data.length === 0 && (
                            <p className="empty-note">
                                {t('No matching items.', 'Žádné odpovídající předměty.')}
                            </p>
                        )}
                        <div className="dex-pagination mt-5 flex flex-wrap items-center justify-between gap-3 border-t p-4">
                            <button
                                className="page-button"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                {t('Previous', 'Předchozí')}
                            </button>
                            <p className="text-xs text-stone-600">
                                {t('Page', 'Strana')} {page} {t('of', 'z')}{' '}
                                {Math.max(1, items.data?.meta.totalPages ?? 1)}
                            </p>
                            <button
                                className="page-button"
                                disabled={page >= (items.data?.meta.totalPages ?? 0)}
                                onClick={() => setPage(page + 1)}
                            >
                                {t('Next', 'Další')}
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
