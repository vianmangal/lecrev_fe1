import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.LECREV_API_TARGET || 'http://localhost:8080';
  const authTarget = env.AUTH_TARGET || `http://localhost:${env.AUTH_PORT || '3001'}`;
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/health/auth': {
          target: authTarget,
          changeOrigin: true,
        },
        '/api/auth': {
          target: authTarget,
          changeOrigin: true,
        },
        '/api/github': {
          target: authTarget,
          changeOrigin: true,
        },
        '/v1': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
