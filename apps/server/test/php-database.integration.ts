import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createPool } from 'mariadb';

import { createApp } from '../src/app.js';
import { databaseConfig, poolDatabase } from '../src/database.js';
import { DexRepository } from '../src/dexRepository.js';
import { startTestServer } from './httpTestServer.js';
import { startPhpTestServer } from './phpTestServer.js';

// Explicit local integration check. Both backends issue only SELECT queries.
void test('PHP 8.4 API matches the Node API against the imported local database', async (t) => {
    const version = spawnSync(process.env.PHP_BINARY || 'php', ['-r', 'echo PHP_VERSION_ID;'], {
        encoding: 'utf8',
        windowsHide: true,
    });
    strictEqual(version.status, 0, 'Set PHP_BINARY to a PHP 8.4 executable');
    strictEqual(Number(version.stdout) >= 80400, true, 'PHP 8.4 or newer is required');
    const config = databaseConfig();
    strictEqual(
        ['localhost', '127.0.0.1', '::1'].includes(String(config.host)),
        true,
        'PHP integration tests require a local DB_HOST',
    );
    const pool = createPool(config);
    t.after(() => pool.end());
    const node = await startTestServer(
        createApp(new DexRepository(poolDatabase(pool), 'emerald-ex-1.0.4')),
    );
    t.after(node.close);
    const php = await startPhpTestServer(
        fileURLToPath(new URL('../../../dist/webzdarma', import.meta.url)),
        {
            ...process.env,
            DB_HOST: String(config.host),
            DB_PORT: String(config.port ?? 3306),
            DB_NAME: String(config.database),
            DB_USER: String(config.user),
            DB_PASS: String(config.password ?? ''),
            DEX_DATASET_ID: 'emerald-ex-1.0.4',
        },
    );
    t.after(php.close);
    async function compare(path: string, status = 200): Promise<void> {
        const [a, b] = await Promise.all([
            fetch(`${node.url}/api/v1/${path}`),
            fetch(`${php.url}/v1/${path}`),
        ]);
        strictEqual(a.status, status, `Node: ${path}`);
        strictEqual(b.status, status, `PHP: ${path}`);
        deepStrictEqual(await b.json(), await a.json(), path);
    }
    await t.test('dataset, type icons, and every paginated species and move match', async () => {
        await compare('dataset');
        await compare('types');
        for (let page = 1; page <= 7; page++) await compare(`species?page=${page}&pageSize=250`);
        for (let page = 1; page <= 5; page++) await compare(`moves?page=${page}&pageSize=250`);
    });
    await t.test(
        'search, filtering, sorting, Unicode, literal wildcards, and empty pages match',
        async () => {
            for (const query of [
                'q=%230001',
                'q=nidoran',
                'q=Pok%C3%A9mon',
                'type=Poison&sort=speed',
                'sort=name&page=2',
                'sort=total',
                'q=%25',
                'q=%21',
                'q=_',
                'page=65535',
                'q=' + '9'.repeat(100),
            ]) {
                await compare(`species?${query}`);
            }
            for (const query of ['q=thunder', 'q=%25', 'q=_', 'page=65535'])
                await compare(`moves?${query}`);
        },
    );
    await t.test(
        'complete species details include forms, missing sprites, incoming evolutions, conditions, learnsets, and machines',
        async () => {
            for (const id of [1, 25, 29, 92, 716, 958, 1431, 1432, 1433, 1435, 1523]) {
                await compare(`species/${id}/details`);
            }
            for (const resource of [
                '',
                '/name',
                '/stats',
                '/types',
                '/learnset',
                '/evolution',
                '/machines',
                '/sprites',
            ]) {
                await compare(`species/1${resource}`);
            }
            await compare('species/65535', 404);
        },
    );
    await t.test(
        'all move subresources, zero ID, damage aliases, and missing moves match',
        async () => {
            for (const resource of ['', '/name', '/category', '/pp', '/damage', '/power', '/type'])
                await compare(`moves/85${resource}`);
            await compare('moves/0');
            await compare('moves/65535', 404);
        },
    );
    await t.test('invalid parameters preserve the existing error contract', async () => {
        for (const path of [
            'species/0',
            'species/65536',
            'species?pageSize=251',
            'species?page=0',
            'species?sort=bad',
            'species?q=a&q=b',
            'species?unexpected=1',
            'moves/-1',
            'moves?q=' + 'a'.repeat(101),
        ]) {
            await compare(path, 400);
        }
        await compare('species/1/no-such-resource', 404);
    });
    await t.test(
        'deployed PNGs are byte-identical through PHP, including shiny and form sprites',
        async () => {
            for (const path of [
                'icons/types/48px-Lightning.png',
                'icons/types/Ghost.png',
                'icons/move-categories/physical.png',
                'sprites/emerald-ex-1.0.4/front/0001_Bulbasaur.png',
                'sprites/emerald-ex-1.0.4/shiny_front/0001_Bulbasaur.png',
                'sprites/emerald-ex-1.0.4/front/0029_Nidoran_F.png',
            ]) {
                const [a, b] = await Promise.all([
                    fetch(`${node.url}/api/${path}`),
                    fetch(`${php.url}/${path}`),
                ]);
                strictEqual(b.status, 200, path);
                strictEqual(b.headers.get('content-type'), 'image/png');
                deepStrictEqual(
                    new Uint8Array(await b.arrayBuffer()),
                    new Uint8Array(await a.arrayBuffer()),
                    path,
                );
            }
        },
    );
});
