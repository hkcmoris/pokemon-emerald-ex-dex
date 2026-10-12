import pino from 'pino';

import { getOptionalEnv } from './config/env.js';

export const logger = pino({
    level: getOptionalEnv('LOG_LEVEL', 'info'),
    redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["x-csrf-token"]',
        'res.headers["set-cookie"]',
    ],
});
