import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import '../apps/server/src/config/env.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const php = spawn(
    process.env.PHP_BINARY || 'php',
    [
        '-S',
        '127.0.0.1:3001',
        '-t',
        `${root}/dist/webzdarma`,
        `${root}/apps/server/php/dev-router.php`,
    ],
    { cwd: root, stdio: 'inherit', windowsHide: true },
);
php.on('error', (error) => {
    console.error(`Cannot start PHP: ${error.message}. Set PHP_BINARY to your PHP 8.4 executable.`);
    process.exitCode = 1;
});
php.on('exit', (code) => {
    process.exitCode = code ?? 1;
});
process.on('SIGINT', () => php.kill());
process.on('SIGTERM', () => php.kill());
console.log('PHP preview: http://127.0.0.1:3001/pokemon-emerald-ex-dex/');
