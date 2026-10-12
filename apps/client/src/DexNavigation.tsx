import { useLanguage } from './language.js';

export type DexSection = 'pokemon' | 'items' | 'abilities' | 'my-pokemon';

export function DexSectionIcon({ section }: { section: DexSection }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
        >
            {section === 'pokemon' ? (
                <>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M3.5 12h5m7 0h5" />
                    <circle cx="12" cy="12" r="3.5" />
                </>
            ) : section === 'items' ? (
                <>
                    <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7M5 9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
                    <path d="M5 12h14M10 12v3h4v-3" />
                </>
            ) : section === 'my-pokemon' ? (
                <>
                    <circle cx="8" cy="8" r="3" />
                    <circle cx="17" cy="9" r="2.5" />
                    <path d="M2 21v-3a6 6 0 0 1 12 0v3M15 14a5 5 0 0 1 7 4v3" />
                </>
            ) : (
                <path strokeLinejoin="round" d="m13.5 2-9 12h6l-1 8 10-13h-6Z" />
            )}
        </svg>
    );
}

export function DexNavigation({ active }: { active: DexSection }) {
    const { t } = useLanguage();
    const sections: readonly { id: DexSection; label: string; href: string }[] = [
        { id: 'pokemon', label: 'Pokémon', href: '#/' },
        { id: 'items', label: t('Items', 'Předměty'), href: '#/items' },
        { id: 'abilities', label: t('Abilities', 'Schopnosti'), href: '#/abilities' },
        { id: 'my-pokemon', label: t('My Pokémon', 'Moji Pokémoni'), href: '#/my-pokemon' },
    ];
    return (
        <nav className="dex-navigation" aria-label={t('Dex sections', 'Sekce Pokédexu')}>
            {sections.map(({ id, label, href }) => (
                <a key={id} href={href} aria-current={active === id ? 'page' : undefined}>
                    <DexSectionIcon section={id} />
                    <span>{label}</span>
                </a>
            ))}
        </nav>
    );
}
