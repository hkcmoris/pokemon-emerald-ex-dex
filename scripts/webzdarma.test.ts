import { deepStrictEqual, rejects, strictEqual } from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { prepareWebzdarmaUpload } from './webzdarma.js';

void test('Webzdarma upload includes protected PHP config templates and images, excluding source data and secrets', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'emerald-upload-'));
    strictEqual(dirname(root), resolve(tmpdir()));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(join(root, 'apps/client/dist/assets'), { recursive: true });
    await writeFile(
        join(root, 'apps/client/dist/index.html'),
        '<script src="/pokemon-emerald-ex-dex/assets/test.js"></script>',
    );
    await writeFile(join(root, 'apps/client/dist/assets/test.js'), 'client');
    await cp(new URL('../apps/server/php', import.meta.url), join(root, 'apps/server/php'), {
        recursive: true,
    });
    await writeFile(
        join(root, 'apps/server/php/private/config.local.php'),
        'do not copy production credentials',
    );
    await writeFile(join(root, '.env.local'), 'do not copy local credentials');
    for (const folder of [
        'types',
        'move-categories',
        'pokemon_emerald_ex_1.0.4_battle_sprites/front',
    ]) {
        await mkdir(join(root, 'assets', folder), { recursive: true });
        await writeFile(join(root, 'assets', folder, 'sprite.png'), 'png');
        await writeFile(join(root, 'assets', folder, 'sprite_manifest.json'), '{}');
        await writeFile(join(root, 'assets', folder, 'secret'), 'excluded');
    }
    await mkdir(join(root, 'scripts'));
    await cp(
        fileURLToPath(new URL('./webzdarma.htaccess', import.meta.url)),
        join(root, 'scripts/webzdarma.htaccess'),
    );
    const output = await prepareWebzdarmaUpload(root);
    deepStrictEqual((await readdir(output)).sort(), [
        '.htaccess',
        'UPLOAD.txt',
        'api',
        'assets',
        'index.html',
    ]);
    deepStrictEqual((await readdir(join(output, 'api/private'))).sort(), [
        '.htaccess',
        'Api.php',
        'DexRepository.php',
        'config.example.php',
    ]);
    deepStrictEqual(
        await readdir(join(output, 'assets/pokemon_emerald_ex_1.0.4_battle_sprites/front')),
        ['sprite.png'],
    );
    strictEqual(
        (await readFile(join(output, 'api/private/.htaccess'), 'utf8')).includes(
            'RewriteRule ^ - [F,L]',
        ),
        true,
    );
    await writeFile(
        join(root, 'apps/client/dist/index.html'),
        '<script src="/assets/wrong-base.js"></script>',
    );
    await rejects(prepareWebzdarmaUpload(root), /--base=/);
    strictEqual(
        (await readFile(join(output, 'index.html'), 'utf8')).includes(
            '/pokemon-emerald-ex-dex/assets/',
        ),
        true,
    );
});
