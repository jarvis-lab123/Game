import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// PWA build is served from https://jarvis-lab123.github.io/game/voki/
// Tauri build (--mode tauri) loads files relative to the app bundle.
export default defineConfig(({ mode }) => {
  const tauri = mode === 'tauri'
  return {
    base: tauri ? './' : '/game/voki/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        disable: tauri,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Voki – Vokabeltrainer',
          short_name: 'Voki',
          description: 'Vokabeln lernen mit Spaced Repetition und Prüfungsplanung.',
          lang: 'de',
          theme_color: '#0b0d12',
          background_color: '#0b0d12',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: 'index.html',
        },
      }),
    ],
    server: { port: 5173, strictPort: true },
  }
})
