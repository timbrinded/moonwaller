import { defineConfig } from '@solidjs/start/config';

export default defineConfig({
  start: {
    server: {
      preset: 'bun',
    },
  },
  vite: {
    optimizeDeps: {
      include: ['@tanstack/solid-table', '@tanstack/solid-virtual'],
    },
  },
});
