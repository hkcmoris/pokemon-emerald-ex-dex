import type { Express } from 'express';
import express from 'express';
import { pinoHttp } from 'pino-http';

import { logger } from './logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/apiRouter.js';

export function createApp(): Express {
    const app = express();

    app.use(
        pinoHttp({
            logger,
        }),
    );

    app.use(express.json());

    app.use('/api', createApiRouter());

    app.use(errorHandler);

    return app;
}
