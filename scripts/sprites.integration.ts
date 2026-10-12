import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { sourceFilePath } from './dex-import.js';
import { validateSpriteFiles } from './sprite-files.js';

void test('sprite references point to existing 64x64 PNGs', async () => {
    const manifest = JSON.parse(
        await readFile(new URL(`../${sourceFilePath('battle_sprites')}`, import.meta.url), 'utf8'),
    ) as { species: { files: Record<string, string> }[] };
    await validateSpriteFiles(
        fileURLToPath(
            new URL('../assets/pokemon_emerald_ex_1.0.4_battle_sprites/', import.meta.url),
        ),
        manifest.species.flatMap((entry) => Object.values(entry.files)),
    );
});
