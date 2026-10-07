import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // API_PORT comes from .env (same file the Express server reads). It defaults
  // to 3002 in dev so `npm run dev:all` never collides with the Docker
  // container, which owns 127.0.0.1:3001.
  const env = loadEnv(mode, process.cwd(), '');
  const api = `http://localhost:${env.API_PORT || 3002}`;
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    // occt-import-js is NOT imported from source: it is a UMD bundle with no ESM
    // export and unresolvable node requires. scripts/copy-occt.js copies it into
    // public/occt/ and src/lib/stepParser.js loads it as a classic script.
    server: {
      port: Number(process.env.PORT) || 5173,
      proxy: {
        '/api': {
          target: api,
          changeOrigin: true,
        },
        '/uploads': {
          target: api,
          changeOrigin: true,
        },
      },
    },
  };
});
