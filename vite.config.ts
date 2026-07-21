import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-48.png', 'icon-72.png', 'icon-96.png', 'icon-128.png', 'icon-144.png', 'icon-152.png', 'icon-192.png', 'icon-384.png', 'icon-512.png', 'favicon.png'],
      manifest: {
        name: 'Global Radio Explorer',
        short_name: 'Global Radio',
        description: 'Explore radio stations from around the world on an interactive 3D globe',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-48.png', sizes: '48x48', type: 'image/png' },
          { src: '/icon-72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'satellite-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
