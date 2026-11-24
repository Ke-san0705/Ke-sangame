import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const background = '#0F172A'

export default defineConfig({
  base: '/Ke-sangame/',
  plugins: [
    react(),
    VitePWA({
      injectRegister: 'script',
      includeAssets: [
        'monsters/*.png', 'stages/*.jpg',
        'assets/initial/characters/{samurai,enemy-swordsman}.png',
        'assets/initial/backgrounds/sunset-plain/*.png',
      ],
      manifest: {
        name: '計算無双',
        short_name: '計算無双',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: background,
        background_color: background,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
  },
})
