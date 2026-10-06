import type { Express } from 'express';
import express from 'express';
import { pinoHttp } from 'pino-http';

import { logger } from './logger.js';
import type { DexRepository } from './dexRepository.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/apiRouter.js';
import { createSpriteRouter } from './sprites.js';

export function createApp(repository?: DexRepository): Express {
    const app = express();

    app.use(
        pinoHttp({
            logger,
        }),
    );

    app.use(express.json());

    app.use('/api/sprites/emerald-ex-1.0.4', createSpriteRouter());
    app.use('/api', createApiRouter(repository));

    app.use(errorHandler);

    return app;
}
