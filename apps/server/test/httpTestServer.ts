import type { Express } from 'express';
import type { Server } from 'node:http';

export async function startTestServer(
    app: Express,
): Promise<{ url: string; close: () => Promise<void> }> {
    const server = await new Promise<Server>((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
    const address = server.address();
    if (!address || typeof address === 'string')
        throw new Error('Server did not bind to a TCP port');
    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    };
}
