import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { createApp } from '../src/app.js';
import { DexRepository } from '../src/dexRepository.js';
import { startTestServer } from './httpTestServer.js';

const types = [
    { typeId: 3, name: 'Poison', iconFile: 'poison.png' },
    { typeId: 12, name: 'Grass', iconFile: 'grass.png' },
];
const rows = [
    { attackingTypeId: 3, defendingTypeId: 3, multiplier: '0.5' },
    { attackingTypeId: 3, defendingTypeId: 12, multiplier: '2.0' },
    { attackingTypeId: 12, defendingTypeId: 3, multiplier: '0.5' },
    { attackingTypeId: 12, defendingTypeId: 12, multiplier: '0.5' },
];

void test('type effectiveness returns the dataset chart with numeric decimal multipliers', async (t) => {
    const repository = new DexRepository(
        {
            query: <T>(sql: string, parameters: readonly (string | number)[]): Promise<T[]> => {
                deepStrictEqual(parameters, ['test-dataset']);
                return Promise.resolve(
                    (sql.includes('emerald_ex_type_effectiveness')
                        ? rows
                        : [...types, { typeId: 9, name: 'Mystery', iconFile: null }]) as T[],
                );
            },
        },
        'test-dataset',
    );
    const server = await startTestServer(createApp(repository));
    t.after(server.close);
    const response = await fetch(`${server.url}/api/v1/type-effectiveness`);
    strictEqual(response.status, 200);
    deepStrictEqual(await response.json(), {
        data: {
            types,
            matchups: rows.map((row) => ({ ...row, multiplier: Number(row.multiplier) })),
        },
    });
});

void test('an absent or incomplete type chart returns an explicit unavailable response', async (t) => {
    for (const matchups of [[], rows.slice(1)]) {
        const repository = new DexRepository(
            {
                query: <T>(sql: string): Promise<T[]> =>
                    Promise.resolve(
                        (sql.includes('emerald_ex_type_effectiveness') ? matchups : types) as T[],
                    ),
            },
            'test-dataset',
        );
        const server = await startTestServer(createApp(repository));
        t.after(server.close);
        const response = await fetch(`${server.url}/api/v1/type-effectiveness`);
        strictEqual(response.status, 503);
        deepStrictEqual(await response.json(), {
            error: {
                code: 'type_effectiveness_unavailable',
                message: 'Type effectiveness data is unavailable',
            },
        });
    }
});
