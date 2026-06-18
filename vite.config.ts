import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      swSrc: 'src/sw.ts',
      swDest: 'sw.js',
      injectManifest: {
        // The SW source (src/sw.ts) only imports workbox-precaching which is browser-compatible,
        // so no Node.js external configuration is needed for the sub-build.
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
      manifest: {
        name: 'NexusFlow',
        short_name: 'NexusFlow',
        description: 'AI Agent Orchestra for Software Development',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'maskable any'
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable any'
          }
        ]
      }
    })
  ],
  // @google/adk and its dependency tree import Node.js built-in modules.
  // These are not available in the browser, so the CJS resolver must ignore them.
  // The useAdkChat hook imports ADK dynamically — if loaded at runtime it will fail,
  // but the rest of the app works fine without ADK in the browser.
  build: {
    commonjsOptions: {
      ignore: [
        'https', 'crypto', 'fs', 'fs/promises', 'stream', 'path',
        'url', 'os', 'module', 'child_process', 'util', 'querystring',
        'node:fs/promises', 'node:path', 'node:os', 'node:process',
        'node:stream', 'node:stream/promises',
      ],
    },
    rollupOptions: {
      external: [
        /^node:/, 'module', 'https', 'crypto', 'fs', 'stream', 'path',
        'url', 'os', 'child_process', 'util', 'querystring',
      ],
      output: {
        manualChunks: {
          'adk-vendor': ['@google/adk'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ["@google/adk"],
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  }
});
