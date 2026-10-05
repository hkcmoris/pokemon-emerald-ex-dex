import pino from 'pino';

import { getOptionalEnv } from './config/env.js';

export const logger = pino({
    level: getOptionalEnv('LOG_LEVEL', 'info'),
});
