import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const IDENTITY_TARGET = env.VITE_IDENTITY_SERVICE_URL || 'http://localhost:4003';
  const EQUIPMENT_TARGET = env.VITE_EQUIPMENT_SERVICE_URL || 'http://localhost:4001';
  const BOOKING_TARGET = env.VITE_BOOKING_SERVICE_URL || 'http://localhost:4002';
  const PAYMENT_TARGET = env.VITE_PAYMENT_SERVICE_URL || 'http://localhost:4004';
  const HANDOVER_TARGET = env.VITE_HANDOVER_SERVICE_URL || 'http://localhost:4005';
  const CLAIMS_TARGET = env.VITE_CLAIMS_SERVICE_URL || 'http://localhost:4006';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api/identity': {
          target: IDENTITY_TARGET,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/identity/, ''),
        },
        '/api/equipment': {
          target: EQUIPMENT_TARGET,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/equipment/, ''),
        },
        '/api/booking': {
          target: BOOKING_TARGET,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/booking/, ''),
        },
        '/api/payment': {
          target: PAYMENT_TARGET,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/payment/, ''),
        },
        '/api/handover': {
          target: HANDOVER_TARGET,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/handover/, ''),
        },
        '/api/claims': {
          target: CLAIMS_TARGET,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/claims/, ''),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
  };
});
