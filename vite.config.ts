import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'JobWahala | Elite African Talent',
        short_name: 'JobWahala',
        description: 'Find jobs, hire talent and get paid securely across Africa.',
        theme_color: '#2f6df6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [new RegExp('^/api/'), new RegExp('^/health'), new RegExp('^/ready')],
        runtimeCaching: [
          {
            // Public listings only: requests without credentials, so personalised responses are never shared.
            urlPattern: ({ url, request }: { url: URL; request: Request }) =>
              request.method === 'GET' &&
              !request.headers.has('Authorization') &&
              (url.pathname === '/api/jobs' || url.pathname.startsWith('/api/jobs/') || url.pathname.startsWith('/api/services')),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'public-listings',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 3 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
      '/ready': 'http://localhost:5000',
    },
  },
})
