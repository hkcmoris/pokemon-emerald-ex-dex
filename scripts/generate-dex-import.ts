import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
    buildDexImport,
    sourceKinds,
    sourceFileNames,
    sourceFilePath,
    type SourceFile,
    type SourceKind,
} from './dex-import.js';
import { validateSpriteFiles } from './sprite-files.js';

const root = new URL('../', import.meta.url);
const sources = {} as Record<SourceKind, SourceFile>;
for (const kind of sourceKinds) {
    const fileName = sourceFileNames[kind];
    sources[kind] = {
        fileName,
        contents: await readFile(new URL(sourceFilePath(kind), root), 'utf8'),
    };
}
const { sql, spritesSql, counts, datasetId } = buildDexImport(sources);
const manifest = JSON.parse(sources.battle_sprites.contents) as {
    species: { files: Record<string, string> }[];
};
await validateSpriteFiles(
    fileURLToPath(new URL('assets/pokemon_emerald_ex_1.0.4_battle_sprites/', root)),
    manifest.species.flatMap((entry) => Object.values(entry.files)),
);
const output = new URL('scripts/sql/002_import_emerald_ex_1.0.4.sql', root);
await mkdir(new URL('./', output), { recursive: true });
await writeFile(output, sql, 'utf8');
await writeFile(new URL('scripts/sql/006_import_sprites_1.0.4.sql', root), spritesSql, 'utf8');
console.log(`Prepared ${datasetId}: ${fileURLToPath(output)}`);
console.table(counts);
