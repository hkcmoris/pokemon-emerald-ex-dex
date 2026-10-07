import { useState } from 'react';
import type { RuleItem } from '@pokemon-emerald-ex-dex/shared';

import { apiUrl } from './apiUrl.js';
import { itemHref } from './navigation.js';
import { useLanguage } from './language.js';

export function itemIconUrl(file: string | null): string | null {
    return file ? apiUrl(`icons/items/${encodeURIComponent(file)}`) : null;
}

function IconImage({ src, name }: { src: string | null; name: string }) {
    const { t } = useLanguage();
    const [failed, setFailed] = useState(false);
    return (
        <span className="item-icon">
            {src && !failed ? (
                <img
                    src={src}
                    alt={t(`${name} item icon`, `Ikona předmětu ${name}`)}
                    width={24}
                    height={24}
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                />
            ) : (
                <span
                    role="img"
                    aria-label={t(`${name} icon unavailable`, `Ikona ${name} není k dispozici`)}
                >
                    —
                </span>
            )}
        </span>
    );
}

export function ItemIcon({ file, name }: { file: string | null; name: string }) {
    const src = itemIconUrl(file);
    return <IconImage key={src} src={src} name={name} />;
}

export function RuleItems({ items }: { items: readonly RuleItem[] }) {
    const { t } = useLanguage();
    if (items.length === 0) return null;
    return (
        <ul className="rule-items" aria-label={t('Required items', 'Potřebné předměty')}>
            {items.map((item) => (
                <li key={`${item.role}/${item.itemId}`}>
                    <a
                        className="species-link inline-flex items-center gap-2"
                        href={itemHref(item.itemId)}
                        title={item.role.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    >
                        <ItemIcon file={item.iconFile} name={item.name} />
                        <span>{item.name}</span>
                    </a>
                </li>
            ))}
        </ul>
    );
}
