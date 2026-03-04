import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  server: { host: true, port: 1420 },
  vite: { 
    server: {
      strictPort: true,
      headers: {
        // Avoid stale module cache in Tauri WebView dev mode
        // 避免 Tauri WebView 开发态命中旧模块缓存
        'Cache-Control': 'no-store',
      },
    },
    optimizeDeps: {
      exclude: ['@fileuni/shared'],
      include: ['react-i18next', 'lucide-react', 'zustand', 'zustand/middleware'],
    },
    plugins: [tailwindcss()],
  },
  integrations: [react()]
});
