import type { Server } from 'node:http';

import { createApp } from './app.js';
import { getOptionalEnv } from './config/env.js';
import { logger } from './logger.js';
import { createDatabasePool, poolDatabase } from './database.js';
import { DexRepository } from './dexRepository.js';

const port = Number(getOptionalEnv('PORT', '3000'));
const pool = createDatabasePool();
const repository = new DexRepository(
    poolDatabase(pool),
    getOptionalEnv('DEX_DATASET_ID', 'emerald-ex-1.0.4'),
);
try {
    if (!(await repository.getDataset())) {
        throw new Error('The configured DEX_DATASET_ID has not been imported into the database');
    }
} catch (error) {
    await pool.end();
    throw error;
}
const app = createApp(repository);

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

    await pool.end();
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
