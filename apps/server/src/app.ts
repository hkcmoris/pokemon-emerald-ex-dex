import type { Express } from 'express';
import express from 'express';
import { pinoHttp } from 'pino-http';

import { logger } from './logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/apiRouter.js';
import { resolve } from 'node:path';
import { openDatabase, projectRoot, sqliteRepository } from './db/database.js';
import type { PokedexRepository } from './db/repository.js';

export function createApp(
    repository: PokedexRepository = sqliteRepository(openDatabase()),
): Express {
    const app = express();

    app.use(
        pinoHttp({
            logger,
        }),
    );

    app.use(express.json());

    app.use('/api', createApiRouter(repository));
    const clientDirectory = resolve(projectRoot, 'apps/client/dist');
    app.use(express.static(clientDirectory));
    app.get(['/', '/pokemon/:id'], (_req, res) => {
        res.sendFile(resolve(clientDirectory, 'index.html'));
    });

    app.use(errorHandler);

    return app;
}
