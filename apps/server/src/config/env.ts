import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

config({
    path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
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
