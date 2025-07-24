import { defineConfig } from '@solidjs/start/config';

export default defineConfig({
  server: {
    preset: 'bun',
  },
  vite: {
    optimizeDeps: {
      include: ['@tanstack/solid-table', '@tanstack/solid-virtual'],
    },
  },
});
