import type { NextFunction, Request, Response } from 'express';

import { logger } from '../logger.js';
import { HttpError } from '../httpError.js';

export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (error && typeof error === 'object' && 'type' in error) {
        if (error.type === 'entity.too.large' || error.type === 'entity.parse.failed') {
            res.status(error.type === 'entity.too.large' ? 413 : 400).json({
                error: {
                    code: 'invalid_body',
                    message: 'Invalid JSON body or collection exceeds 5 MB',
                },
            });
            return;
        }
    }
    if (error instanceof HttpError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
    }
    logger.error({ error }, 'Unhandled request error');

    res.status(500).json({
        error: { code: 'internal_error', message: 'Internal server error' },
    });
}
