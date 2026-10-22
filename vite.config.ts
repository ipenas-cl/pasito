/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE lets the same build work on GitHub Pages (/pasito/) and locally (/).
const base = process.env.BASE ?? '/';

// Strict CSP for production builds: no third-party origins at all (kid-safe, no trackers).
const csp = {
  name: 'pasito-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'" />`,
    ),
};

export default defineConfig({
  base,
  plugins: [
    react(),
    csp,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Pasito: aprende jugando',
        short_name: 'Pasito',
        description: 'Aprende a hablar, contar y leer jugando. Sin anuncios, funciona sin conexión.',
        lang: 'es-CL',
        theme_color: '#ff8a3d',
        background_color: '#fff8ef',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: { include: ['src/domain/**'] },
  },
});
