import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { readSeed, seedSqlStatements } from '../apps/server/src/db/import.js';

const output = resolve('dist');
if (output !== resolve(process.cwd(), 'dist'))
    throw new Error('Unexpected build output directory.');
rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, 'server'), { recursive: true });
cpSync('apps/client/dist', resolve(output, 'client'), { recursive: true });
const statements = seedSqlStatements(readSeed(resolve('docs')));
if (statements.length > 45)
    throw new Error(`Seed uses ${statements.length} statements; must fit a D1 invocation.`);
await build({
    stdin: {
        contents: `import { createWorker } from './apps/server/src/worker.ts'; export default createWorker(${JSON.stringify(statements)});`,
        resolveDir: process.cwd(),
        loader: 'ts',
    },
    outfile: resolve(output, 'server/index.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
});
mkdirSync(resolve(output, '.openai'), { recursive: true });
writeFileSync(resolve(output, '.openai/hosting.json'), readFileSync('.openai/hosting.json'));
cpSync('drizzle', resolve(output, '.openai/drizzle'), { recursive: true });
console.log(`Hosted build ready: SQL-backed API with ${statements.length} atomic seed statements.`);
