import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { buildDexImport, sourceKinds, type SourceFile, type SourceKind } from './dex-import.js';

const root = new URL('../', import.meta.url);
const sources = {} as Record<SourceKind, SourceFile>;
for (const kind of sourceKinds) {
    const fileName = `pokemon_emerald_ex_1.0.4_${kind}.json`;
    sources[kind] = {
        fileName,
        contents: await readFile(new URL(`docs/${fileName}`, root), 'utf8'),
    };
}
const { sql, counts, datasetId } = buildDexImport(sources);
const output = new URL('scripts/sql/002_import_emerald_ex_1.0.4.sql', root);
await mkdir(new URL('./', output), { recursive: true });
await writeFile(output, sql, 'utf8');
console.log(`Prepared ${datasetId}: ${fileURLToPath(output)}`);
console.table(counts);
