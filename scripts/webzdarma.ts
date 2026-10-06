import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';

const phpFiles = [
    'index.php',
    '.htaccess',
    'private/Api.php',
    'private/DexRepository.php',
    'private/.htaccess',
    'private/config.example.php',
] as const;

export async function prepareWebzdarmaUpload(projectRoot: string): Promise<string> {
    const root = resolve(projectRoot);
    const output = resolve(root, 'dist/webzdarma');
    // Only this generated directory is replaced; verify the target before recursive deletion.
    if (dirname(output) !== join(root, 'dist') || basename(output) !== 'webzdarma') {
        throw new Error('Unexpected upload directory');
    }
    const html = await readFile(join(root, 'apps/client/dist/index.html'), 'utf8');
    if (!html.includes('/pokemon-emerald-ex-dex/assets/')) {
        throw new Error('Build the client with --base=/pokemon-emerald-ex-dex/ before packaging');
    }
    await rm(output, { recursive: true, force: true });
    await cp(join(root, 'apps/client/dist'), output, { recursive: true });
    for (const file of phpFiles) {
        const target = join(output, 'api', file);
        await mkdir(dirname(target), { recursive: true });
        await cp(join(root, 'apps/server/php', file), target);
    }
    for (const folder of ['move-categories', 'types', 'pokemon_emerald_ex_1.0.4_battle_sprites']) {
        await cp(join(root, 'assets', folder), join(output, 'assets', folder), {
            recursive: true,
            filter: async (source) =>
                (await stat(source)).isDirectory() || extname(source).toLowerCase() === '.png',
        });
    }
    await cp(join(root, 'scripts/webzdarma.htaccess'), join(output, '.htaccess'));
    await writeFile(
        join(output, 'UPLOAD.txt'),
        'Upload the CONTENTS of this folder to /pokemon-emerald-ex-dex/ using FileZilla.\n' +
            'Include the hidden .htaccess files. Enable PHP 8.4 in the hosting panel.\n' +
            'On the server, copy api/private/config.example.php to config.local.php and fill in the production database credentials.\n' +
            'Keep config.local.php on the server during future uploads. No SQL reimport is required if migrations 001-010 are already applied.\n' +
            'Check /pokemon-emerald-ex-dex/api/health, then /pokemon-emerald-ex-dex/api/v1/dataset.\n',
        'utf8',
    );
    return output;
}
