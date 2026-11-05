import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { siteCopy } from './src/content/siteCopy.ts'

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Fills the %SITE_...% markers in index.html from src/content/siteCopy.ts, so the page that paints before
// JavaScript runs always says what the app says.
const siteCopyPlugin = () => ({
  name: 'site-copy',
  transformIndexHtml: (html: string) =>
    html
      .replaceAll('%SITE_TITLE%', escapeHtml(siteCopy.title))
      .replaceAll('%SITE_DESCRIPTION%', escapeHtml(siteCopy.description))
      .replaceAll('%SITE_SHORT_DESCRIPTION%', escapeHtml(siteCopy.shortDescription))
      .replaceAll('%SITE_HERO_TEXT%', escapeHtml(siteCopy.heroText)),
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    siteCopyPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'apple-touch-icon.png',
        'fonts/manrope-latin-wght-normal.woff2',
        'fonts/space-grotesk-latin-wght-normal.woff2',
      ],
      manifest: {
        name: 'JobWahala | Real jobs across Africa',
        short_name: 'JobWahala',
        description: 'Find real jobs across Africa, or post jobs free and review applicants on one board.',
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
        // Keep the first-visit background download small for people on limited data: the CV builder,
        // admin screens and the realtime socket library are cached the first time they are used.
        globIgnores: ['**/CVGenerator-*.js', '**/AdminDashboard-*.js', '**/esm-*.js', '**/sentryClient-*.js'],
        navigateFallbackDenylist: [new RegExp('^/api/'), new RegExp('^/health'), new RegExp('^/ready')],
        runtimeCaching: [
          {
            // Hashed build files never change, so cache them on first use.
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-files',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
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
