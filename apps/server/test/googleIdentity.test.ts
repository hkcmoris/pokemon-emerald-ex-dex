import { deepStrictEqual, rejects, strictEqual } from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';

import { createGoogleVerifier } from '../src/googleIdentity.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const now = 1700000000;
const claims = {
    sub: 'google-subject',
    name: 'Player',
    email: 'player@example.com',
    aud: 'our-client',
    iss: 'https://accounts.google.com',
    iat: now - 30,
    exp: now + 3600,
    nonce: 'our-nonce',
};
function credential(overrides: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
    const data = [
        { alg: 'RS256', kid: 'test-key', ...header },
        { ...claims, ...overrides },
    ]
        .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
        .join('.');
    return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
}

void test('Google verifier checks RSA signature, issuer, audience, dates, nonce, subject and key identity', async () => {
    let requests = 0;
    const verifier = createGoogleVerifier(
        'our-client',
        (input) => {
            strictEqual(input, 'https://www.googleapis.com/oauth2/v3/certs');
            requests++;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        keys: [
                            {
                                ...publicKey.export({ format: 'jwk' }),
                                alg: 'RS256',
                                use: 'sig',
                                kid: 'test-key',
                            },
                        ],
                    }),
                    { headers: { 'Cache-Control': 'public, max-age=3600' } },
                ),
            );
        },
        () => now * 1000,
    );
    deepStrictEqual(await verifier(credential(), 'our-nonce'), {
        subject: 'google-subject',
        name: 'Player',
        email: 'player@example.com',
    });
    for (const overrides of [
        { aud: 'attacker-client' },
        { iss: 'https://evil.example' },
        { exp: now },
        { iat: now + 61 },
        { nbf: now + 1 },
        { nonce: 'other-browser' },
        { sub: '' },
        { azp: 'another-app' },
        { exp: String(now + 1000) },
    ])
        await rejects(verifier(credential(overrides), 'our-nonce'), /could not be verified/);
    for (const header of [
        { alg: 'none' },
        { alg: 'HS256' },
        { kid: 'unknown', jku: 'https://evil.example/certs' },
    ])
        await rejects(verifier(credential({}, header), 'our-nonce'), /could not be verified/);
    const original = credential().split('.');
    const tampered = `${original[0]}.${Buffer.from(JSON.stringify({ ...claims, sub: 'attacker' })).toString('base64url')}.${original[2]}`;
    await rejects(verifier(tampered, 'our-nonce'), /could not be verified/);
    await rejects(verifier('malformed', 'our-nonce'), /could not be verified/);
    await rejects(verifier('x'.repeat(17000), 'our-nonce'), /could not be verified/);
    strictEqual(
        requests,
        1,
        'verified keys are cached; invalid credentials cannot choose key URLs',
    );
});

void test('Google key service failures fail closed with a retryable error', async () => {
    const verifier = createGoogleVerifier(
        'our-client',
        () => Promise.resolve(new Response('unavailable', { status: 503 })),
        () => now * 1000,
    );
    await rejects(verifier(credential(), 'our-nonce'), /temporarily unavailable/);
});
