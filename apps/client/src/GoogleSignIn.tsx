import { useEffect, useRef, useState } from 'react';
import { useLanguage } from './language.js';

interface GoogleIdentity {
    initialize(options: {
        client_id: string;
        nonce: string;
        callback: (response: { credential: string }) => void;
    }): void;
    renderButton(
        element: HTMLElement,
        options: { type: string; theme: string; size: string; text: string; locale: string },
    ): void;
}
declare global {
    interface Window {
        google?: { accounts: { id: GoogleIdentity } };
    }
}
let script: Promise<GoogleIdentity> | undefined;

function googleIdentity(): Promise<GoogleIdentity> {
    if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
    script ??= new Promise<GoogleIdentity>((resolve, reject) => {
        const element = document.createElement('script');
        element.src = 'https://accounts.google.com/gsi/client';
        element.async = true;
        const timeout = window.setTimeout(() => {
            element.remove();
            reject(new Error('Google sign-in timed out.'));
        }, 15_000);
        element.onload = () => {
            window.clearTimeout(timeout);
            if (window.google?.accounts.id) resolve(window.google.accounts.id);
            else reject(new Error('Google sign-in is unavailable.'));
        };
        element.onerror = () => {
            window.clearTimeout(timeout);
            element.remove();
            reject(new Error('Google sign-in could not load.'));
        };
        document.head.append(element);
    }).catch((error: unknown) => {
        script = undefined;
        throw error;
    });
    return script;
}

export function GoogleSignIn({
    clientId,
    nonce,
    onCredential,
}: {
    clientId: string;
    nonce: string | null;
    onCredential: (credential: string) => void;
}) {
    const { t, language } = useLanguage();
    const container = useRef<HTMLDivElement>(null);
    const callback = useRef(onCredential);
    callback.current = onCredential;
    const [enabled, setEnabled] = useState(false);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (!enabled || !nonce) return;
        let disposed = false;
        void googleIdentity()
            .then((identity) => {
                if (disposed || !container.current) return;
                identity.initialize({
                    client_id: clientId,
                    nonce,
                    callback: (response) => callback.current(response.credential),
                });
                identity.renderButton(container.current, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    text: 'signin_with',
                    locale: language,
                });
            })
            .catch(() => {
                if (!disposed) setFailed(true);
            });
        return () => {
            disposed = true;
            container.current?.replaceChildren();
        };
    }, [clientId, nonce, language, enabled]);

    return (
        <div>
            {!enabled && (
                <button
                    className="page-button"
                    disabled={!nonce}
                    onClick={() => {
                        setFailed(false);
                        setEnabled(true);
                    }}
                >
                    {t('Enable sync with Google', 'Zapnout synchronizaci přes Google')}
                </button>
            )}
            <div ref={container} />
            {failed && (
                <p role="alert">
                    {t(
                        'Google sign-in could not load. Check your connection and try again.',
                        'Přihlášení Google se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.',
                    )}{' '}
                    <button
                        className="page-button"
                        onClick={() => {
                            setEnabled(false);
                            setFailed(false);
                        }}
                    >
                        {t('Try again', 'Zkusit znovu')}
                    </button>
                </p>
            )}
        </div>
    );
}
