import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export async function startPhpTestServer(
    documentRoot: string,
    env: NodeJS.ProcessEnv = process.env,
): Promise<{ url: string; close: () => Promise<void> }> {
    const socket = createServer();
    socket.listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const address = socket.address();
    if (!address || typeof address === 'string') throw new Error('Cannot allocate PHP test port');
    await new Promise<void>((resolve, reject) =>
        socket.close((error) => (error ? reject(error) : resolve())),
    );
    const child = spawn(
        env.PHP_BINARY || 'php',
        [
            '-S',
            `127.0.0.1:${address.port}`,
            '-t',
            documentRoot,
            fileURLToPath(new URL('../php/dev-router.php', import.meta.url)),
        ],
        { env, windowsHide: true, stdio: 'ignore' },
    );
    let startupError: Error | undefined;
    child.on('error', (error) => {
        startupError = error;
    });
    const close = async (): Promise<void> => {
        if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
        const exited = once(child, 'exit');
        child.kill();
        await exited;
    };
    const url = `http://127.0.0.1:${address.port}/pokemon-emerald-ex-dex/api`;
    try {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (startupError) throw startupError;
            if (child.exitCode !== null) throw new Error('PHP server exited before startup');
            try {
                const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(500) });
                if (!response.ok)
                    throw new Error(
                        `PHP startup returned HTTP ${response.status}; PHP 8.4 is required`,
                    );
                return { url, close };
            } catch (error) {
                if (!(error instanceof TypeError)) throw error;
                await setTimeout(50);
            }
        }
        throw new Error('PHP server did not become ready');
    } catch (error) {
        await close();
        throw error;
    }
}
