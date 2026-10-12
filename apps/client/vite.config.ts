import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { defineConfig, loadEnv, transformWithOxc, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';

function collectionOfflinePlugin(): Plugin {
    return {
        name: 'collection-offline-shell',
        apply: 'build',
        enforce: 'post',
        async generateBundle(_options, bundle) {
            const files = Object.keys(bundle).filter((file) => /\.(js|css|woff2?|ttf)$/.test(file));
            const index = bundle['index.html'];
            if (!index || index.type !== 'asset')
                throw new Error('Offline shell requires the built index.html.');
            const html =
                typeof index.source === 'string'
                    ? index.source
                    : new TextDecoder().decode(index.source);
            const version = createHash('sha256')
                .update(JSON.stringify(files))
                .update(html)
                .digest('hex')
                .slice(0, 16);
            const source = await readFile(
                new URL('./src/collectionWorker.ts', import.meta.url),
                'utf8',
            );
            const result = await transformWithOxc(source, 'collectionWorker.ts', {
                lang: 'ts',
                target: 'es2022',
                define: {
                    __COLLECTION_PRECACHE__: JSON.stringify(files),
                    __COLLECTION_BUILD__: JSON.stringify(version),
                    __COLLECTION_HTML__: JSON.stringify(html),
                },
            });
            this.emitFile({ type: 'asset', fileName: 'collection-sw.js', source: result.code });
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), 'DEV_');
    const proxy = {
        '/api': { target: env.DEV_API_TARGET || 'http://127.0.0.1:3000', changeOrigin: true },
    };
    return {
        plugins: [react(), tailwindcss(), collectionOfflinePlugin()],
        server: { proxy },
        preview: { proxy },
    };
});
