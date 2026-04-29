import { defineConfig } from 'vitest/config'
import { execFileSync } from 'node:child_process'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

const commitSha = (() => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim() } catch { return 'dev' }
})()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(commitSha),
  },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Poliklinik Ng PLT — Patient Records',
        short_name: 'Records',
        description: 'Vaccination and blood test history',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/home',
        icons: [
          { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', globals: true },
})
