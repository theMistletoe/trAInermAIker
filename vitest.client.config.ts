import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@': path.resolve(__dirname, './src/client'),
    },
  },
  test: {
    name: 'client',
    include: ['tests/client/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/client/setup.ts'],
    env: {
      // Shrink polling so client tests use real timers + waitFor.
      VITE_POLL_INTERVAL_MS: '20',
    },
  },
});
