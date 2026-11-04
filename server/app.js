import express from 'express'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectPreview, previewData, renderPreview, UUID } from './preview.js'

// Only the public anon key is used. No service-role access, user sessions, private
// contacts or chat content are available to the preview renderer.
export function createApp({
  root = resolve('dist'),
  env = process.env,
  fetchImpl = fetch,
  html = readFileSync(resolve(root, 'index.html'), 'utf8'),
} = {}) {
  const app = express()
  app.disable('x-powered-by')
  const url = env.VITE_SUPABASE_URL,
    key = env.VITE_SUPABASE_ANON_KEY
  const cache = new Map()
  async function getPlan(id) {
    if (!UUID.test(id)) return null
    const cached = cache.get(id)
    if (cached && cached.until > Date.now()) return cached.value
    if (!url || !key) throw new Error('Preview database configuration is missing')
    const endpoint = new URL('/rest/v1/intents', url)
    endpoint.searchParams.set('id', `eq.${id}`)
    endpoint.searchParams.set(
      'select',
      'id,title,venue_name,starts_at,ends_at,status,spots_needed,spots_filled',
    )
    endpoint.searchParams.set('limit', '1')
    const response = await fetchImpl(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('Preview lookup failed')
    const value = (await response.json())[0] ?? null
    if (cache.size >= 250) cache.delete(cache.keys().next().value)
    cache.set(id, { value, until: Date.now() + 15000 })
    return value
  }
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })
  app.get('/healthz', (_req, res) => res.set('Cache-Control', 'no-store').json({ ok: true }))
  app.get('/og/site.png', (_req, res) =>
    res
      .type('png')
      .set('Cache-Control', 'public, max-age=3600')
      .send(renderPreview(previewData(null))),
  )
  app.get('/og/plans/:id.png', async (req, res) => {
    try {
      const plan = await getPlan(req.params.id)
      if (!plan)
        return res
          .status(404)
          .set('Cache-Control', 'no-store')
          .type('text')
          .send('Plan unavailable')
      res
        .type('png')
        .set('Cache-Control', 'public, max-age=60')
        .send(renderPreview(previewData(plan)))
    } catch {
      res
        .status(503)
        .set('Cache-Control', 'no-store')
        .type('text')
        .send('Preview temporarily unavailable')
    }
  })
  // Never allow source, configuration or server files to be served as static files.
  app.use(
    express.static(root, {
      index: false,
      dotfiles: 'deny',
      maxAge: '1h',
      setHeaders: (res, path) => {
        if (path.includes('/assets/'))
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      },
    }),
  )
  app.get('/', async (req, res) => {
    const id = req.query.p
    if (!id)
      return res
        .type('html')
        .set('Cache-Control', 'no-cache')
        .send(injectPreview(html, previewData(null)))
    try {
      const plan = typeof id === 'string' ? await getPlan(id) : null
      if (!plan)
        return res
          .status(404)
          .type('html')
          .set('Cache-Control', 'no-store')
          .send(
            injectPreview(
              html,
              {
                ...previewData(null),
                title: 'Plan unavailable',
                description: 'This plan could not be found. Browse upcoming plans in Jaipur.',
              },
              true,
            ),
          )
      res
        .type('html')
        .set('Cache-Control', 'no-cache')
        .send(injectPreview(html, previewData(plan)))
    } catch {
      // The app still loads and can retry independently. Crawlers must not cache
      // a false "deleted" result when Supabase is temporarily unavailable.
      res
        .status(503)
        .type('html')
        .set('Cache-Control', 'no-store')
        .send(
          injectPreview(
            html,
            {
              ...previewData(null),
              title: 'Plan temporarily unavailable',
              description: 'Please try this plan again shortly.',
            },
            true,
          ),
        )
    }
  })
  app.use((_req, res) => res.status(404).type('text').send('Not found'))
  return app
}
