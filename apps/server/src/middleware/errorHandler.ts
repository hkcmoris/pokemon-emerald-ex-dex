import type { NextFunction, Request, Response } from 'express';

import { logger } from '../logger.js';
import { HttpError } from '../httpError.js';

export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (error instanceof HttpError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
    }
    logger.error({ error }, 'Unhandled request error');

    res.status(500).json({
        error: { code: 'internal_error', message: 'Internal server error' },
    });
}
