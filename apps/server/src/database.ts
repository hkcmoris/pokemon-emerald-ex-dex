import { createPool, type Pool, type PoolConfig } from 'mariadb';

import { getOptionalEnv, getRequiredEnv } from './config/env.js';

export type SqlParameter = string | number;

export interface Database {
    query<T>(sql: string, parameters: readonly SqlParameter[]): Promise<T[]>;
}

export function databaseConfig(): PoolConfig {
    const port = Number(getOptionalEnv('DB_PORT', '3306'));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('DB_PORT must be an integer between 1 and 65535');
    }

    return {
        host: getRequiredEnv('DB_HOST'),
        port,
        database: getRequiredEnv('DB_NAME'),
        user: getRequiredEnv('DB_USER'),
        password: getOptionalEnv('DB_PASS', ''),
        connectionLimit: 5,
        connectTimeout: 5000,
        acquireTimeout: 5000,
        queryTimeout: 5000,
        charset: 'utf8mb4',
        bigIntAsNumber: true,
        autoJsonMap: false,
    };
}

export function createDatabasePool(): Pool {
    return createPool(databaseConfig());
}

export function poolDatabase(pool: Pool): Database {
    return {
        query: <T>(sql: string, parameters: readonly SqlParameter[]): Promise<T[]> =>
            pool.execute<T[]>(sql, [...parameters]),
    };
}
