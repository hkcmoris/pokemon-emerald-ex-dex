import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

import { HttpError } from './httpError.js';

export interface GoogleIdentity {
    subject: string;
    name: string;
    email: string;
}

export type IdentityVerifier = (credential: string, nonce: string) => Promise<GoogleIdentity>;

interface GoogleKey extends JsonWebKey {
    kid?: string;
    alg?: string;
    use?: string;
}

function invalidToken(): HttpError {
    return new HttpError(401, 'invalid_credential', 'Google sign-in could not be verified');
}

function decodePart(value: string): Record<string, unknown> {
    try {
        const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
            return parsed as Record<string, unknown>;
    } catch {
        /* A malformed token is an authentication failure. */
    }
    throw invalidToken();
}

// Only Google's pinned HTTPS key endpoint is consulted; token URLs are never followed.
export function createGoogleVerifier(
    clientId: string,
    fetchKeys: typeof fetch = fetch,
    now: () => number = Date.now,
): IdentityVerifier {
    let keys: GoogleKey[] = [];
    let expiresAt = 0;
    let lastFetch = 0;
    let pending: Promise<void> | undefined;
    async function refresh(): Promise<void> {
        if (pending) return pending;
        pending = (async () => {
            const response = await fetchKeys('https://www.googleapis.com/oauth2/v3/certs', {
                signal: AbortSignal.timeout(5000),
                redirect: 'error',
            });
            if (!response.ok)
                throw new HttpError(
                    503,
                    'identity_unavailable',
                    'Google sign-in is temporarily unavailable',
                );
            const data = (await response.json()) as { keys?: GoogleKey[] };
            if (!Array.isArray(data.keys) || data.keys.length > 20)
                throw new HttpError(
                    503,
                    'identity_unavailable',
                    'Google sign-in is temporarily unavailable',
                );
            keys = data.keys.filter(
                (key) =>
                    key.kty === 'RSA' &&
                    key.alg === 'RS256' &&
                    key.use === 'sig' &&
                    typeof key.kid === 'string',
            );
            const maxAge = Number(
                /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 300,
            );
            lastFetch = now();
            expiresAt = now() + Math.min(Math.max(maxAge, 60), 86400) * 1000;
        })();
        try {
            await pending;
        } catch {
            throw new HttpError(
                503,
                'identity_unavailable',
                'Google sign-in is temporarily unavailable',
            );
        } finally {
            pending = undefined;
        }
    }
    return async (credential, nonce) => {
        if (
            credential.length > 16000 ||
            !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(credential)
        )
            throw invalidToken();
        const [headerPart, payloadPart, signaturePart] = credential.split('.');
        const header = decodePart(headerPart);
        const claims = decodePart(payloadPart);
        const seconds = Math.floor(now() / 1000);
        if (
            header.alg !== 'RS256' ||
            typeof header.kid !== 'string' ||
            header.kid.length > 256 ||
            claims.aud !== clientId ||
            !['https://accounts.google.com', 'accounts.google.com'].includes(String(claims.iss)) ||
            !Number.isInteger(claims.exp) ||
            (claims.exp as number) <= seconds ||
            !Number.isInteger(claims.iat) ||
            (claims.iat as number) > seconds + 60 ||
            (claims.exp as number) - (claims.iat as number) > 86400 ||
            (claims.nbf !== undefined &&
                (typeof claims.nbf !== 'number' || claims.nbf > seconds)) ||
            claims.nonce !== nonce ||
            typeof claims.sub !== 'string' ||
            !/^[A-Za-z0-9_-]{1,255}$/.test(claims.sub) ||
            (claims.azp !== undefined && claims.azp !== clientId)
        )
            throw invalidToken();
        if (
            expiresAt <= now() ||
            (!keys.some((key) => key.kid === header.kid) && now() - lastFetch > 60000)
        )
            await refresh();
        const key = keys.find((key) => key.kid === header.kid);
        if (!key) throw invalidToken();
        let valid: boolean;
        try {
            valid = verify(
                'RSA-SHA256',
                Buffer.from(`${headerPart}.${payloadPart}`),
                createPublicKey({ key, format: 'jwk' }),
                Buffer.from(signaturePart, 'base64url'),
            );
        } catch {
            throw invalidToken();
        }
        if (!valid) throw invalidToken();
        return {
            subject: claims.sub,
            name: typeof claims.name === 'string' ? claims.name.slice(0, 200) : 'Player',
            email: typeof claims.email === 'string' ? claims.email.slice(0, 320) : '',
        };
    };
}
