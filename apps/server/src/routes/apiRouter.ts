import { Router } from 'express';

import type { DexRepository } from '../dexRepository.js';
import { createDexRouter } from './dexRouter.js';
import { createHealthRouter } from './healthRouter.js';

export function createApiRouter(repository?: DexRepository): Router {
    const router = Router();

    router.use(createHealthRouter());

    if (repository) {
        router.use('/v1', createDexRouter(repository));
    } else {
        router.use('/v1', (_req, res) => {
            res.status(503).json({
                error: {
                    code: 'database_unavailable',
                    message: 'The dex database is not configured',
                },
            });
        });
    }

    router.use((_req, res) => {
        res.status(404).json({ error: { code: 'not_found', message: 'Endpoint not found' } });
    });

    return router;
}
