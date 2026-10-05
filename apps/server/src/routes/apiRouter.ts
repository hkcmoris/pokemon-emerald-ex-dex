import { Router } from 'express';

import { createHealthRouter } from './healthRouter.js';
import { ApiError, handleDexRequest, type PokedexRepository } from '../db/repository.js';

export function createApiRouter(repository: PokedexRepository): Router {
    const router = Router();

    router.use(createHealthRouter());
    router.use(async (req, res, next) => {
        if (req.method !== 'GET') {
            res.status(405).set('Allow', 'GET').json({ error: 'Method not allowed.' });
            return;
        }
        try {
            const data = await handleDexRequest(
                repository,
                new URL(req.originalUrl, 'http://localhost'),
            );
            res.set('Cache-Control', 'public, max-age=300').json(data);
        } catch (error) {
            if (error instanceof ApiError) res.status(error.status).json({ error: error.message });
            else next(error);
        }
    });

    return router;
}
