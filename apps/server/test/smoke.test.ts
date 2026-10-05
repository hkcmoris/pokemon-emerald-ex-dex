import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import type { Server } from 'node:http';
import { test } from 'node:test';

import { createApp } from '../src/app.js';

void test('GET /api/health returns ok', async () => {
    const app = createApp();

    const server = await new Promise<Server>((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => {
            resolve(server);
        });
    });

    try {
        const address = server.address();

        if (!address || typeof address === 'string') {
            throw new Error('Server did not bind to a TCP port');
        }

        const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);

        strictEqual(response.status, 200);
        deepStrictEqual(await response.json(), {
            ok: true,
        });
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }
});
