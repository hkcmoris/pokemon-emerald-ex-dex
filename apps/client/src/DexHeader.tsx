import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';

import { readTheme, saveTheme } from './theme.js';
import { useLanguage } from './language.js';
import { DexNavigation, type DexSection } from './DexNavigation.js';

export function ThemeToggle() {
    const { t } = useLanguage();
    const [theme, setTheme] = useState(readTheme);
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    return (
        <Button
            isIconOnly
            variant="tertiary"
            className="theme-toggle"
            aria-label={
                nextTheme === 'light'
                    ? t('Use light theme', 'Použít světlý motiv')
                    : t('Use dark theme', 'Použít tmavý motiv')
            }
            onPress={() => {
                saveTheme(nextTheme);
                setTheme(nextTheme);
            }}
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
            >
                {theme === 'dark' ? (
                    <>
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                    </>
                ) : (
                    <path d="M20.5 14.3A8.8 8.8 0 0 1 9.7 3.5a8.8 8.8 0 1 0 10.8 10.8Z" />
                )}
            </svg>
        </Button>
    );
}

export function DexHeader({
    version,
    active = 'pokemon',
    backHref,
    backLabel,
}: {
    version: string;
    active?: DexSection;
    backHref?: string;
    backLabel?: string;
}) {
    const { language, setLanguage, t } = useLanguage();
    const headerRef = useRef<HTMLElement>(null);
    useLayoutEffect(() => {
        const header = headerRef.current;
        if (!header) return;
        const measure = () => {
            document.documentElement.style.setProperty(
                '--dex-header-height',
                `${header.getBoundingClientRect().height}px`,
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(header);
        return () => observer.disconnect();
    }, []);
    return (
        <header className="dex-header" ref={headerRef}>
            <div className="dex-header-inner">
                <a className="dex-brand" href="#/" aria-label="Emerald EX Pokédex">
                    <span className="dex-brand-mark" aria-hidden="true">
                        <svg viewBox="0 0 32 32" fill="none">
                            <path
                                d="m16 3 10 7-3 14-7 5-7-5-3-14Z"
                                fill="currentColor"
                                fillOpacity=".16"
                                stroke="currentColor"
                                strokeWidth="1.5"
                            />
                            <path
                                d="m16 3 4 8-4 18-4-18Zm-10 7 6 1h8l6-1M9 24l7-8 7 8"
                                stroke="currentColor"
                                strokeWidth="1"
                            />
                        </svg>
                    </span>
                    <span>
                        Emerald <strong>EX</strong>
                    </span>
                </a>
                <div className="dex-header-actions">
                    <span className="version-tag">v{version}</span>
                    <label className="language-control">
                        <span className="sr-only">{t('Interface language', 'Jazyk rozhraní')}</span>
                        <select
                            className="language-select"
                            value={language}
                            onChange={(event) =>
                                setLanguage(event.target.value === 'cs' ? 'cs' : 'en')
                            }
                        >
                            <option value="en" lang="en">
                                English
                            </option>
                            <option value="cs" lang="cs">
                                Čeština
                            </option>
                        </select>
                    </label>
                    <ThemeToggle />
                </div>
            </div>
            <DexNavigation active={active} />
            {backHref && (
                <div className="dex-back-row">
                    <a className="back-link" href={backHref}>
                        ← {backLabel ?? t('Back to Pokédex', 'Zpět na Pokédex')}
                    </a>
                </div>
            )}
        </header>
    );
}
