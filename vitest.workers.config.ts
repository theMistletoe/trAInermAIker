import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);
  return {
    plugins: [
      cloudflareTest({
        singleWorker: true,
        isolatedStorage: true,
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          d1Databases: ['DB'],
          compatibilityFlags: ['nodejs_compat'],
          // AI_STUB keeps summarization deterministic and offline in tests.
          bindings: { TEST_MIGRATIONS: migrations, AI_STUB: '1' },
        },
      }),
    ],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, './src/shared'),
        '@server': path.resolve(__dirname, './src/server'),
      },
    },
    test: {
      name: 'workers',
      include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
      setupFiles: ['./tests/integration/setup.ts'],
    },
  };
});
