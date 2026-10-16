import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { App } from './App.js';
import { LanguageProvider } from './language.js';
import { applyTheme, readTheme } from './theme.js';
import { registerCollectionOffline } from './collectionOffline.js';
import './style.css';
import './MoveEffectBadges.css';
import './MoveAffinity.css';
import './damageSimulator.css';
import './pokemonTraits.css';

applyTheme(readTheme());
registerCollectionOffline();

const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <LanguageProvider>
                <App />
            </LanguageProvider>
        </QueryClientProvider>
    </StrictMode>,
);
