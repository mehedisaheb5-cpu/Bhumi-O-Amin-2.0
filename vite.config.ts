import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

// GitHub Pages serves from /<repo>/; set GH_PAGES=true in the Actions build only.
const BASE = process.env.GH_PAGES === 'true' ? '/Bhumi-O-Amin-2.0/' : '/';

export default defineConfig(() => {
  return {
    base: BASE,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: BASE,
          name: 'ভূমি ও আমিন – ফিল্ড আমিন সংস্করণ',
          short_name: 'ফিল্ড আমিন',
          description: 'মাঠের আমিনের জন্য অফলাইন অ্যাপ — দখল পরিমাপ, হ্যান্ড ম্যাপ ও রিপোর্ট।',
          lang: 'bn',
          dir: 'ltr',
          orientation: 'portrait',
          categories: ['productivity', 'utilities'],
          theme_color: '#065f46',
          background_color: '#065f46',
          display: 'standalone',
          start_url: BASE,
          scope: BASE,
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          // Offline-first: precache shell + HTML so flight-mode still opens the app.
          // index.html is cached but runtime navigation is NetworkFirst (stale while revalidate) so updates not stuck.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }: any) => request.mode === 'navigate',
              handler: 'NetworkFirst' as const,
              options: {
                cacheName: 'pages-cache',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
              },
            },
            // Firebase বন্ধ — firestore ক্যাশ সরানো হয়েছে।
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('leaflet')) return 'vendor-leaflet';
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
              if (id.includes('lucide') || id.includes('motion')) return 'vendor-ui';
              return 'vendor';
            }
            // keep mouza + survey + measure together to avoid circular chunk (mouza-map.ts ↔ survey)
            if (id.includes('/components/mouza/') || id.includes('/components/survey/') || id.includes('/components/measurement/') || id.includes('/components/calculator/') || id.includes('/components/maps/')) return 'chunk-survey-mouza';
            if (id.includes('/components/report/')) return 'chunk-report';
            if (id.includes('/components/marketplace/')) return 'chunk-market';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Sandbox-preview only: allows the hosted preview domain. Inert when unset.
      allowedHosts: process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',') : undefined,
    },
  };
});
