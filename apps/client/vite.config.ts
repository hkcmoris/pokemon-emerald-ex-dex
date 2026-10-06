import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), 'DEV_');
    const proxy = {
        '/api': { target: env.DEV_API_TARGET || 'http://127.0.0.1:3000', changeOrigin: true },
    };
    return {
        plugins: [react(), tailwindcss()],
        server: { proxy },
        preview: { proxy },
    };
});
