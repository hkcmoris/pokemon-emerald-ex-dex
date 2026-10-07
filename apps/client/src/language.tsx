import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'en' | 'cs';
export type Translate = (english: string, czech: string) => string;

const languageStorageKey = 'emerald-ex-language';

export function readLanguage(): Language {
    try {
        const savedLanguage = localStorage.getItem(languageStorageKey);
        if (savedLanguage === 'cs' || savedLanguage === 'en') return savedLanguage;
    } catch {
        // Device preferences remain available when browser storage is blocked.
    }

    const preferredLanguages =
        typeof navigator === 'undefined'
            ? []
            : [...(navigator.languages ?? []), navigator.language];
    for (const preferredLanguage of preferredLanguages) {
        const language = preferredLanguage?.toLowerCase().split('-')[0];
        if (language === 'cs' || language === 'en') return language;
    }
    return 'cs';
}

export function saveLanguage(language: Language): void {
    try {
        localStorage.setItem(languageStorageKey, language);
    } catch {
        // Switching languages also works when browser storage is unavailable.
    }
}

interface LanguageContextValue {
    language: Language;
    locale: 'en-US' | 'cs-CZ';
    t: Translate;
    setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
    language: 'en',
    locale: 'en-US',
    t: (english) => english,
    setLanguage: () => {},
});

export function LanguageProvider({
    children,
    initialLanguage,
}: {
    children?: ReactNode;
    initialLanguage?: Language;
}) {
    const [language, setLanguage] = useState<Language>(() => initialLanguage ?? readLanguage());

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    return (
        <LanguageContext.Provider
            value={{
                language,
                locale: language === 'cs' ? 'cs-CZ' : 'en-US',
                t: (english, czech) => (language === 'cs' ? czech : english),
                setLanguage: (nextLanguage) => {
                    setLanguage(nextLanguage);
                    saveLanguage(nextLanguage);
                },
            }}
        >
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage(): LanguageContextValue {
    return useContext(LanguageContext);
}
