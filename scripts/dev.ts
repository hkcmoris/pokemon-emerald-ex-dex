import { spawn } from 'node:child_process';
const npmPath = process.env.npm_execpath;
if (!npmPath) throw new Error('Run development through npm run dev.');
const children = ['dev:server', 'dev:client'].map((script) =>
    spawn(process.execPath, [npmPath, 'run', script], { stdio: 'inherit' }),
);
let stopped = false;
function stop(): void {
    if (stopped) return;
    stopped = true;
    for (const child of children) child.kill();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, stop);
for (const child of children)
    child.on('exit', (code) => {
        stop();
        process.exitCode = code ?? 0;
    });
