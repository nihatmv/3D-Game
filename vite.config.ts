import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { CONTACT } from './src/story/projects.ts'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * Fills index.html's %APP_*% placeholders from projects.ts (name on the loading
 * screen, title, social preview), so the content stays in one data file.
 * VITE_SITE_URL makes og:image absolute, which link previews require.
 */
function portfolioHtml(siteUrl: string): Plugin {
  const values: Record<string, string> = {
    APP_NAME: CONTACT.name,
    APP_ROLE: CONTACT.role,
    APP_TITLE: `${CONTACT.name} · ${CONTACT.role}`,
    APP_DESCRIPTION: CONTACT.pitch,
    APP_URL: siteUrl || '/',
    APP_OG_IMAGE: `${siteUrl}/og.png`,
  }
  return {
    name: 'portfolio-html',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/%(APP_[A-Z_]+)%/g, (m, key: string) => (key in values ? escapeHtml(values[key]) : m)),
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.')
  return {
    plugins: [react(), portfolioHtml((env.VITE_SITE_URL ?? '').replace(/\/+$/, ''))],
    build: {
      // The island's App chunk is mostly three.js (~1 MB minified, ~295 kB gzip). It is lazy-loaded
      // (main.tsx), so /portfolio never downloads it. Manual vendor chunks broke module order in
      // production with rolldown, so it stays one chunk.
      chunkSizeWarningLimit: 1200,
    },
  }
})
