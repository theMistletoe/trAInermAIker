import path from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), react(), cloudflare()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@': path.resolve(__dirname, './src/client'),
    },
  },
  build: {
    // @cloudflare/vite-plugin nests each environment under outDir
    // (client -> dist/client, worker -> dist/<worker_name>), which is exactly
    // the layout wrangler.jsonc's assets.directory ("./dist/client") expects.
    outDir: 'dist',
    emptyOutDir: true,
  },
});
