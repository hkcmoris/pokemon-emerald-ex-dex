import type { Server } from 'node:http';

import { createApp } from './app.js';
import { getOptionalEnv } from './config/env.js';
import { logger } from './logger.js';

const port = Number(getOptionalEnv('PORT', '3000'));
const app = createApp();

const server = app.listen(port, () => {
    logger.info({ port }, 'Server listening');
});

let isShuttingDown = false;

async function shutdown(reason: string, server: Server): Promise<void> {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    logger.info({ reason }, 'Server shutting down');

    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });

    logger.info('Server stopped');
}

process.on('SIGINT', () => {
    void shutdown('SIGINT', server).then(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM', server).then(() => {
        process.exit(0);
    });
});

process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
    process.exitCode = 1;
});

process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
});
