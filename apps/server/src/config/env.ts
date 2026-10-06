import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

config({
    path: (process.env.NODE_ENV === 'production' ? ['.env'] : ['.env.local', '.env']).map((name) =>
        fileURLToPath(new URL(`../../../../${name}`, import.meta.url)),
    ),
    quiet: true,
});

export function getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

export function getOptionalEnv(name: string, fallback: string): string {
    return process.env[name] ?? fallback;
}
