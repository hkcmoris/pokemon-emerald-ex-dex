import { deepStrictEqual, match, strictEqual } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { startPhpTestServer } from './phpTestServer.js';

const php = process.env.PHP_BINARY || 'php';
const version = spawnSync(php, ['-r', 'echo PHP_VERSION_ID;'], {
    encoding: 'utf8',
    windowsHide: true,
});
const available = !version.error && version.status === 0;

void test(
    'PHP sources parse and request validation rejects malformed filters and image paths',
    { skip: available ? false : 'PHP CLI is not installed' },
    () => {
        for (const file of [
            'index.php',
            'private/Api.php',
            'private/DexRepository.php',
            'private/config.example.php',
            'dev-router.php',
        ]) {
            const result = spawnSync(
                php,
                ['-l', fileURLToPath(new URL(`../php/${file}`, import.meta.url))],
                { encoding: 'utf8', windowsHide: true },
            );
            strictEqual(result.status, 0, result.stdout + result.stderr);
        }
        const result = spawnSync(
            php,
            [
                fileURLToPath(new URL('./php-validation.php', import.meta.url)),
                fileURLToPath(new URL('../../../assets', import.meta.url)),
            ],
            { encoding: 'utf8', windowsHide: true },
        );
        strictEqual(result.status, 0, result.stdout + result.stderr);
        match(result.stdout, /PHP validation passed/);
    },
);

void test(
    'PHP 8.4 HTTP routes serve images and safe errors without database credentials',
    { skip: available && Number(version.stdout) >= 80400 ? false : 'Requires PHP 8.4 CLI' },
    async (t) => {
        const root = await mkdtemp(join(tmpdir(), 'emerald-php-http-'));
        strictEqual(dirname(root), resolve(tmpdir()));
        t.after(() => rm(root, { recursive: true, force: true }));
        await cp(new URL('../php', import.meta.url), join(root, 'api'), {
            recursive: true,
            filter: (path) => !path.endsWith('config.local.php'),
        });
        await mkdir(join(root, 'assets'));
        await cp(new URL('../../../assets/types', import.meta.url), join(root, 'assets/types'), {
            recursive: true,
        });
        await cp(
            new URL('../../../assets/types/48px-Fire.png', import.meta.url),
            join(root, 'assets/types/custom žluťoučký & v2.png'),
        );
        await cp(
            new URL('../../../assets/move-categories', import.meta.url),
            join(root, 'assets/move-categories'),
            { recursive: true },
        );
        await cp(new URL('../../../assets/items', import.meta.url), join(root, 'assets/items'), {
            recursive: true,
        });
        for (const namespace of ['types', 'items']) {
            await cp(
                new URL('../../../assets/move-categories/physical.svg', import.meta.url),
                join(root, 'assets', namespace, 'physical.svg'),
            );
        }
        const server = await startPhpTestServer(root, {
            ...process.env,
            DB_HOST: '',
            DB_NAME: '',
            DB_USER: '',
            DB_PASS: '',
        });
        t.after(server.close);
        deepStrictEqual(await (await fetch(`${server.url}/health`)).json(), { ok: true });
        for (const [path, status] of [
            ['/v1/species', 503],
            ['/v1/species?pageSize=251', 400],
            ['/v1/species?q=a&q=b', 400],
            ['/v1/species?sort=injected', 400],
            ['/v1/species/65536', 400],
            ['/v1/species/1/unknown', 404],
            ['/unknown', 404],
            ['/private/config.local.php', 403],
            ['/icons/types/.htaccess', 403],
            ['/icons/types/..%5cprivate.png', 403],
            ['/sprites/emerald-ex-1.0.4/unknown/a.png', 404],
            ['/icons/items/0300_Gengarite.png', 200],
            ['/icons/items/README.txt', 404],
            ['/icons/types/physical.svg', 404],
            ['/icons/items/physical.svg', 404],
            ['/icons/move-categories/missing.svg', 404],
            ['/icons/move-categories/physical.svg.php', 404],
            ['/icons/move-categories/physical.svg/extra', 404],
            ['/icons/move-categories/nested%2fphysical.svg', 404],
            ['/icons/move-categories/..%5cphysical.svg', 403],
            ['/icons/move-categories/.hidden.svg', 403],
            ['/icons/move-categories/physical.svg%00', 404],
            ['/icons/move-categories/physical.svg%GG', 400],
            ['/icons/items/nested%2f0300_Gengarite.png', 404],
        ] as const) {
            strictEqual((await fetch(`${server.url}${path}`)).status, status, path);
        }
        const post = await fetch(`${server.url}/health`, { method: 'POST' });
        strictEqual(post.status, 405);
        strictEqual(post.headers.get('allow'), 'GET, HEAD');
        const icon = await fetch(`${server.url}/icons/types/48px-Fire.png`);
        strictEqual(icon.status, 200);
        strictEqual(icon.headers.get('content-type'), 'image/png');
        strictEqual(icon.headers.get('cache-control'), 'public, max-age=86400');
        deepStrictEqual(
            [...new Uint8Array(await icon.arrayBuffer()).slice(0, 8)],
            [137, 80, 78, 71, 13, 10, 26, 10],
        );
        for (const file of ['physical.svg', 'special.svg', 'physical-special.svg']) {
            const path = `${server.url}/icons/move-categories/${file}`;
            const svg = await fetch(path);
            strictEqual(svg.status, 200);
            strictEqual(svg.headers.get('content-type'), 'image/svg+xml');
            strictEqual(svg.headers.get('cache-control'), 'public, max-age=86400');
            deepStrictEqual(
                Buffer.from(await svg.arrayBuffer()),
                await readFile(join(root, 'assets/move-categories', file)),
            );
            const svgHead = await fetch(path, { method: 'HEAD' });
            strictEqual(svgHead.status, 200);
            strictEqual(svgHead.headers.get('content-type'), 'image/svg+xml');
            strictEqual(svgHead.headers.get('cache-control'), 'public, max-age=86400');
            strictEqual((await svgHead.arrayBuffer()).byteLength, 0);
        }
        const head = await fetch(`${server.url}/icons/types/48px-Fire.png`, { method: 'HEAD' });
        strictEqual(head.status, 200);
        strictEqual((await head.arrayBuffer()).byteLength, 0);
        strictEqual(
            (
                await fetch(
                    `${server.url}/icons/types/${encodeURIComponent('custom žluťoučký & v2.png')}`,
                )
            ).status,
            200,
        );
    },
);
