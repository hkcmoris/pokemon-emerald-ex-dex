import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { validateCollectionDocument } from '@pokemon-emerald-ex-dex/shared';
import { Router, json, type CookieOptions, type Request } from 'express';

import type { CollectionSession, CollectionStore } from '../collectionRepository.js';
import type { IdentityVerifier } from '../googleIdentity.js';
import { HttpError } from '../httpError.js';

export interface CollectionService {
    store: CollectionStore;
    verifyIdentity: IdentityVerifier;
    googleClientId: string;
    allowedOrigins: readonly string[];
    secureCookies: boolean;
}

const sessionCookie = 'emerald_collection_session';
const challengeCookie = 'emerald_collection_challenge';
const lifetime = 60 * 60 * 24 * 90;
export const hashSession = (token: string): string =>
    createHash('sha256').update(token).digest('hex');
const randomToken = (): string => randomBytes(32).toString('hex');

function cookie(request: Request, name: string): string {
    const candidates = (request.headers.cookie ?? '')
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part.startsWith(`${name}=`));
    if (candidates.length !== 1) return '';
    const value = candidates[0].slice(name.length + 1);
    return /^[a-f0-9]{64}$/.test(value) ? value : '';
}

function verifyCsrf(request: Request, token: string, allowedOrigins: readonly string[]): void {
    const provided = request.get('X-CSRF-Token') ?? '';
    if (
        !allowedOrigins.includes(request.get('Origin') ?? '') ||
        !token ||
        !/^[a-f0-9]{64}$/.test(provided) ||
        provided.length !== token.length ||
        !timingSafeEqual(Buffer.from(provided), Buffer.from(token))
    )
        throw new HttpError(403, 'invalid_csrf', 'Refresh sign-in and try again');
}

function objectBody(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new HttpError(400, 'invalid_body', 'A JSON object is required');
    return value as Record<string, unknown>;
}

export function createCollectionRouter(service?: CollectionService): Router {
    const router = Router();
    router.use((_request, response, next) => {
        response.set('Cache-Control', 'no-store');
        next();
    });
    router.use(json({ limit: '5mb' }));
    router.get('/config', (_request, response) => {
        response.json({ data: { googleClientId: service?.googleClientId || null } });
    });
    const options: CookieOptions = {
        httpOnly: true,
        sameSite: 'lax',
        secure: service?.secureCookies ?? true,
        path: '/',
    };
    async function session(request: Request): Promise<CollectionSession | null> {
        const token = cookie(request, sessionCookie);
        return token && service ? service.store.session(hashSession(token)) : null;
    }
    async function requireSession(request: Request): Promise<CollectionSession> {
        const current = await session(request);
        if (!current)
            throw new HttpError(401, 'sign_in_required', 'Sign in to synchronize your collection');
        return current;
    }
    router.get('/session', async (request, response) => {
        const current = await session(request);
        if (current) {
            response.json({ data: current });
            return;
        }
        const nonce = cookie(request, challengeCookie) || randomToken();
        response.cookie(challengeCookie, nonce, { ...options, maxAge: 600000 });
        response.json({ data: { user: null, csrfToken: nonce, nonce } });
    });
    router.post('/session', async (request, response) => {
        if (!service?.googleClientId || !service.allowedOrigins.length)
            throw new HttpError(503, 'sync_unavailable', 'Google sign-in is not configured');
        const nonce = cookie(request, challengeCookie);
        verifyCsrf(request, nonce, service.allowedOrigins);
        const body = objectBody(request.body as unknown);
        if (
            Object.keys(body).some((key) => !['credential', 'nonce'].includes(key)) ||
            typeof body.credential !== 'string' ||
            body.credential.length > 16000
        )
            throw new HttpError(400, 'invalid_body', 'A Google credential is required');
        const identity = await service.verifyIdentity(body.credential, nonce);
        const token = randomToken();
        const csrfToken = randomToken();
        const user = await service.store.signIn(
            identity,
            hashSession(token),
            csrfToken,
            new Date(Date.now() + lifetime * 1000),
        );
        const previousToken = cookie(request, sessionCookie);
        if (previousToken) await service.store.signOut(hashSession(previousToken));
        response.clearCookie(challengeCookie, options);
        response.cookie(sessionCookie, token, { ...options, maxAge: lifetime * 1000 });
        response.json({ data: { user, csrfToken } });
    });
    router.delete('/session', async (request, response) => {
        const current = await requireSession(request);
        verifyCsrf(request, current.csrfToken, service!.allowedOrigins);
        await service!.store.signOut(hashSession(cookie(request, sessionCookie)));
        response.clearCookie(sessionCookie, options);
        response.json({ data: { user: null } });
    });
    router.get('/', async (request, response) => {
        const current = await requireSession(request);
        response.json({
            data: { ...(await service!.store.read(current.user.id)), userId: current.user.id },
        });
    });
    router.put('/', async (request, response) => {
        const current = await requireSession(request);
        verifyCsrf(request, current.csrfToken, service!.allowedOrigins);
        const body = objectBody(request.body as unknown);
        if (
            Object.keys(body).some((key) => !['revision', 'document'].includes(key)) ||
            !Number.isInteger(body.revision) ||
            (body.revision as number) < 0 ||
            (body.revision as number) >= 4294967295 ||
            !validateCollectionDocument(body.document)
        )
            throw new HttpError(
                400,
                'invalid_collection',
                'Invalid collection document or revision',
            );
        const updated = await service!.store.write(
            current.user.id,
            body.revision as number,
            body.document,
        );
        if (!updated) {
            response.status(409).json({
                error: {
                    code: 'revision_conflict',
                    message: 'Another device updated this collection',
                },
                data: { ...(await service!.store.read(current.user.id)), userId: current.user.id },
            });
            return;
        }
        response.json({
            data: {
                userId: current.user.id,
                revision: (body.revision as number) + 1,
                document: body.document,
            },
        });
    });
    router.use((_request, _response) => {
        throw new HttpError(405, 'method_not_allowed', 'Unsupported collection request');
    });
    return router;
}
