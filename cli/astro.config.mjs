import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// https://astro.build/config
export default defineConfig({
  base: '/ui',
  output: 'static',
  build: {
    format: 'file',
  },
  integrations: [react()],
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:19000',
          changeOrigin: true,
          ws: true,
        }
      }
    },
    // 依然保留对 latex.js 的支持
    optimizeDeps: {
      include: ['libphonenumber-js/max'],
      esbuildOptions: {
        loader: {
          '.keep': 'text',
        },
      },
    },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    }
  },
});
