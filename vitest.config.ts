import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['./vitest.workers.config.ts', './vitest.client.config.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/client/main.tsx',
        'src/client/vite-env.d.ts',
      ],
    },
  },
});
