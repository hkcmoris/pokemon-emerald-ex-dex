import type { Express } from 'express';
import express from 'express';
import { pinoHttp } from 'pino-http';

import { logger } from './logger.js';
import type { DexRepository } from './dexRepository.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/apiRouter.js';
import { createSpriteRouter } from './sprites.js';
import { createCategoryIconRouter, createTypeIconRouter, createItemIconRouter } from './icons.js';
import { createCollectionRouter, type CollectionService } from './routes/collectionRouter.js';

export function createApp(
    repository?: DexRepository,
    collectionService?: CollectionService,
): Express {
    const app = express();

    app.use(
        pinoHttp({
            logger,
        }),
    );

    app.use('/api/v1/collection', createCollectionRouter(collectionService));
    app.use(express.json());

    app.use('/api/sprites/emerald-ex-1.0.4', createSpriteRouter());
    app.use('/api/icons/move-categories', createCategoryIconRouter());
    app.use('/api/icons/types', createTypeIconRouter());
    app.use('/api/icons/items', createItemIconRouter());
    app.use('/api', createApiRouter(repository));

    app.use(errorHandler);

    return app;
}
