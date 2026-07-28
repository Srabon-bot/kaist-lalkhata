import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Dev-only: runs api/**.ts (Vercel Edge Functions, all `handler(req: Request):
// Promise<Response>`) directly inside the Vite dev server via ssrLoadModule,
// so `npm run dev` alone exercises the real /api/gemma proxy — no `vercel
// dev` needed. `vercel dev` invokes @vercel/static-build for local builds,
// which shells out to `yarn` regardless of vercel.json's installCommand;
// that's a CLI-level limitation unrelated to this app, not fixable here.
// Never runs in production — `apply: 'serve'` only, and prod deploys use
// Vercel's own builder for api/*.ts regardless of this file.
function apiDevMiddleware(): Plugin {
  return {
    name: 'local-api-dev-middleware',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) return next()

        const routePath = url.split('?')[0]
        const modulePath = path.resolve(__dirname, '.' + routePath + '.ts')

        try {
          const mod = await server.ssrLoadModule(modulePath)
          const handler = mod.default as (request: Request) => Promise<Response>

          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const bodyBuffer = chunks.length ? Buffer.concat(chunks) : undefined

          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value)
            else if (Array.isArray(value)) headers.set(key, value.join(', '))
          }

          const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
          const request = new Request(`http://localhost${url}`, {
            method: req.method,
            headers,
            body: hasBody ? bodyBuffer : undefined,
          })

          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          const text = await response.text()
          res.end(text)
        } catch (err) {
          console.error(`[api dev middleware] ${routePath}:`, err)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'dev_proxy_error', message: String(err) }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // api/*.ts reads process.env directly (same as it does deployed on
  // Vercel) — Vite doesn't populate process.env from .env* files on its
  // own, so pull them in explicitly for the dev middleware above.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [
      react(),
      tailwindcss(),
      apiDevMiddleware(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Haal Khata',
          short_name: 'Haal Khata',
          description: 'Voice-first bookkeeper for mudi dokans',
          lang: 'bn',
          theme_color: '#B3261E',
          background_color: '#7A1512',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Ledger viewing must work fully offline; only the Gemma call needs network.
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
  }
})
