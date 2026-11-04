import { afterEach, expect, test, vi } from 'vitest'
import { createApp } from '../server/app.js'
import { previewData, renderPreview, SITE_URL } from '../server/preview.js'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

const plan = {
  id: '20000000-0000-4000-8000-000000000001',
  title: 'Coffee & conversation',
  venue_name: 'Public café',
  starts_at: '2027-01-02T09:30:00Z',
  ends_at: '2027-01-02T11:30:00Z',
  status: 'open',
  spots_needed: 2,
  spots_filled: 1,
}
const servers: Server[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))))
})
async function serve(fetchImpl: typeof fetch, renderImage = renderPreview) {
  const app = createApp({
    html: '<html><head><title>Old title</title><meta property="og:title" content="Old" /></head><body><div id="root"></div></body></html>',
    env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-key' },
    fetchImpl,
    renderImage,
  })
  const server = app.listen(0, '127.0.0.1')
  servers.push(server)
  await new Promise<void>((r) => server.once('listening', r))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

test('a crawler receives plan-specific metadata and PNG without JavaScript or authentication', async () => {
  const lookup = vi.fn(async () => new Response(JSON.stringify([plan])))
  const base = await serve(lookup)
  const response = await fetch(base + '/?p=' + plan.id, {
    headers: { 'User-Agent': 'facebookexternalhit/1.1' },
  })
  const html = await response.text()
  expect(response.status).toBe(200)
  expect(html).toContain('Coffee &amp; conversation | Plann’d')
  expect(html).toContain('2 Jan, 2027')
  expect(html).toContain('3:00 PM to 5:00 PM IST')
  expect(html).toContain('1 spot available')
  expect(html).toContain(`${SITE_URL}/og/plans/${plan.id}.png`)
  expect(html.match(/property="og:title"/g)).toHaveLength(1)
  const query = new URL(lookup.mock.calls[0][0])
  expect(query.searchParams.get('select')).not.toMatch(/user_id|whatsapp|email|note|messages/)
  const image = await fetch(base + `/og/plans/${plan.id}.png`)
  expect(image.headers.get('content-type')).toContain('image/png')
  const bytes = new Uint8Array(await image.arrayBuffer())
  expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const dimensions = new DataView(bytes.buffer)
  expect([dimensions.getUint32(16), dimensions.getUint32(20)]).toEqual([1200, 630])
})

test('untrusted titles are escaped; unavailable plans and source/config files are not exposed', async () => {
  const base = await serve(
    async () =>
      new Response(
        JSON.stringify([
          {
            ...plan,
            title: '"><script>alert(1)</script>',
            venue_name: '<img src=x onerror=alert(1)>',
          },
        ]),
      ),
  )
  const html = await (await fetch(base + '/?p=' + plan.id)).text()
  expect(html).not.toContain('<script>alert(1)</script>')
  expect(html).not.toContain('<img src=x')
  expect(html).toContain('&lt;script&gt;')
  for (const path of ['/?p=invalid', '/.env', '/server.js', '/server/assets/Manrope-400.ttf'])
    expect((await fetch(base + path)).status).toBe(404)
  const empty = await serve(async () => new Response('[]'))
  expect((await fetch(empty + '/?p=' + plan.id)).status).toBe(404)
  const unavailable = await serve(async () => new Response('Unavailable', { status: 503 }))
  const response = await fetch(unavailable + '/?p=' + plan.id)
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toBe('no-store')
})

test('cancelled, ended and full plans never advertise available spots in a share preview', () => {
  expect(previewData({ ...plan, status: 'cancelled' }).status).toBe('Cancelled')
  expect(previewData(plan, Date.parse('2028-01-01')).status).toBe('Ended')
  expect(previewData({ ...plan, spots_filled: 2 }, Date.parse('2026-01-01')).status).toContain(
    'Full',
  )
  expect(renderPreview(previewData(null)).length).toBeGreaterThan(10000)
})

test('concurrent shares coalesce database lookups and cache repeated PNG rendering', async () => {
  const lookup = vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 30))
    return new Response(JSON.stringify([plan]))
  })
  const renderImage = vi.fn(renderPreview)
  const base = await serve(lookup, renderImage)
  const responses = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      fetch(base + (i % 2 ? `/?p=${plan.id}` : `/og/plans/${plan.id}.png`)),
    ),
  )
  await Promise.all(responses.map((r) => r.arrayBuffer()))
  expect(responses.every((r) => r.status === 200)).toBe(true)
  expect(lookup).toHaveBeenCalledOnce()
  expect(renderImage).toHaveBeenCalledOnce()
  await Promise.all(Array.from({ length: 10 }, () => fetch(base + '/og/site.png')))
  expect(renderImage).toHaveBeenCalledTimes(2)
})

test('failed preview lookups release their slot so the next visit can recover', async () => {
  const lookup = vi
    .fn()
    .mockResolvedValueOnce(new Response('Down', { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([plan])))
  const base = await serve(lookup)
  expect((await fetch(`${base}/?p=${plan.id}`)).status).toBe(503)
  expect((await fetch(`${base}/?p=${plan.id}`)).status).toBe(200)
})

test('a refreshed plan invalidates its rendered image when availability changes', async () => {
  const now = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  try {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([plan])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...plan, status: 'cancelled' }])))
    const renderImage = vi.fn(renderPreview)
    const base = await serve(lookup, renderImage)
    await (await fetch(`${base}/og/plans/${plan.id}.png`)).arrayBuffer()
    clock.mockReturnValue(now + 16000)
    await (await fetch(`${base}/og/plans/${plan.id}.png`)).arrayBuffer()
    expect(renderImage).toHaveBeenCalledTimes(2)
    expect(renderImage.mock.calls[1][0].status).toBe('Cancelled')
  } finally {
    clock.mockRestore()
  }
})
