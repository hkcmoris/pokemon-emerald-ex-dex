import type { NextFunction, Request, Response } from 'express';

import { logger } from '../logger.js';

export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    logger.error({ error }, 'Unhandled request error');

    res.status(500).json({
        error: 'Internal server error',
    });
}
