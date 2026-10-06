import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';

export async function validateSpriteFiles(
    root: string,
    paths: readonly string[],
    size = 64,
): Promise<void> {
    for (let offset = 0; offset < paths.length; offset += 64) {
        await Promise.all(
            paths.slice(offset, offset + 64).map(async (file) => {
                const target = resolve(root, file);
                const fromRoot = relative(root, target);
                if (isAbsolute(fromRoot) || fromRoot.startsWith('..'))
                    throw new Error(`Invalid sprite path: ${file}`);
                const png = await readFile(target);
                if (
                    png.length < 24 ||
                    !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
                    png.toString('ascii', 12, 16) !== 'IHDR' ||
                    png.readUInt32BE(16) !== size ||
                    png.readUInt32BE(20) !== size
                ) {
                    throw new Error(`Expected a ${size}x${size} PNG sprite: ${file}`);
                }
            }),
        );
    }
}
