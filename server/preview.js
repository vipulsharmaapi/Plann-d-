import { createHash } from 'node:crypto'
import { Resvg } from '@resvg/resvg-js'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const metrics = JSON.parse(
  readFileSync(new URL('./assets/font-metrics.json', import.meta.url), 'utf8'),
)

export const SITE_URL = 'https://mediumvioletred-stork-498786.hostingersite.com'
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
const clean = (value, max) =>
  String(value ?? '')
    .replace(/\p{Cc}/gu, ' ')
    .slice(0, max)
const date = (iso) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
const time = (iso) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))

export function previewData(plan, now = Date.now()) {
  if (!plan)
    return {
      title: 'Make time for a plan.',
      venue: 'Find your people in Jaipur',
      when: 'A game, a coffee, a little company.',
      status: 'Plann’d · Jaipur',
      description: 'Find a game, share a coffee, or host a plan in Jaipur.',
      url: `${SITE_URL}/`,
      image: `${SITE_URL}/og/site.png`,
    }
  const status =
    plan.status === 'cancelled'
      ? 'Cancelled'
      : plan.status === 'expired' || Date.parse(plan.ends_at) <= now
        ? 'Ended'
        : plan.spots_filled >= plan.spots_needed
          ? 'Full · no spots available'
          : `${Math.max(0, plan.spots_needed - plan.spots_filled)} ${plan.spots_needed - plan.spots_filled === 1 ? 'spot' : 'spots'} available`
  const title = clean(plan.title, 120),
    venue = clean(plan.venue_name, 160)
  const when = `${date(plan.starts_at)} · ${time(plan.starts_at)}–${time(plan.ends_at)} IST`
  const version = createHash('sha256')
    .update(JSON.stringify([title, venue, when, status]))
    .digest('hex')
    .slice(0, 12)
  return {
    title,
    venue,
    when,
    status,
    description: `${when} · ${venue} · ${status}. View this plan on Plann’d.`,
    url: `${SITE_URL}/?p=${plan.id}`,
    image: `${SITE_URL}/og/plans/${plan.id}.png?v=${version}`,
  }
}

export function injectPreview(html, data, unavailable = false) {
  const title = `${data.title} | Plann’d`
  const tags = `\n<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(data.description)}" />
<link rel="canonical" href="${escapeHtml(data.url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Plann’d" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(data.description)}" />
<meta property="og:url" content="${escapeHtml(data.url)}" />
<meta property="og:image" content="${escapeHtml(data.image)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${escapeHtml(`${data.title} — ${data.venue}. ${data.when}. ${data.status}`)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(data.description)}" />
<meta name="twitter:image" content="${escapeHtml(data.image)}" />
${unavailable ? '<meta name="robots" content="noindex" />' : ''}`
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+(?:name|property)="(?:description|og:[^"]*|twitter:[^"]*)"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace('</head>', tags + '\n</head>')
}

function lines(text, size, count, weight) {
  const width = (s) =>
    Array.from(s).reduce((n, c) => n + (metrics[weight][c.codePointAt(0)] ?? 1) * size, 0)
  const limit = 1040
  const words = text.split(/\s+/).flatMap((word) => {
      const chunks = []
      let chunk = ''
      for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(
        word,
      )) {
        if (chunk && width(chunk + segment) > limit) {
          chunks.push(chunk)
          chunk = ''
        }
        chunk += segment
      }
      if (chunk) chunks.push(chunk)
      return chunks
    }),
    out = []
  let line = ''
  for (const word of words) {
    if (line && width(line + ' ' + word) > limit) {
      out.push(line)
      line = word
    } else line += (line ? ' ' : '') + word
  }
  if (line) out.push(line)
  return out.slice(0, count).map((s, i) => {
    if (i !== count - 1 || out.length <= count) return s
    const chars = Array.from(s)
    while (width(chars.join('') + '…') > limit) chars.pop()
    return chars.join('') + '…'
  })
}

export function renderPreview(data) {
  const title = lines(data.title, 58, 3, 800)
    .map(
      (s, i) =>
        `<text x="72" y="${208 + i * 70}" font-size="58" font-weight="800">${escapeHtml(s)}</text>`,
    )
    .join('')
  const venue = lines(data.venue, 27, 2, 400)
    .map(
      (s, i) =>
        `<text x="76" y="${450 + i * 35}" font-size="27" font-weight="500">${escapeHtml(s)}</text>`,
    )
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f7f8fc"/><g font-family="Manrope" fill="#181c2a"><text x="72" y="90" font-size="38" font-weight="800">Plann’d</text><text x="1128" y="88" text-anchor="end" font-size="24" fill="#5143a8">Jaipur</text>${title}<text x="76" y="397" font-size="25" font-weight="600" fill="#5143a8">${escapeHtml(data.when)}</text>${venue}<path d="M72 529H1128" stroke="#d8dbe5"/><text x="76" y="579" font-size="25" font-weight="700">${escapeHtml(data.status)}</text><text x="1128" y="579" text-anchor="end" font-size="24">Who’s in?</text></g></svg>`
  return new Resvg(svg, {
    font: {
      fontFiles: [
        ...[400, 600, 800].map((w) => `Manrope-${w}.ttf`),
        ...[400, 800].map((w) => `NotoSansDevanagari-${w}.ttf`),
        'NotoSansSymbols2-Regular.ttf',
      ].map((name) => fileURLToPath(new URL(`./assets/${name}`, import.meta.url))),
      loadSystemFonts: false,
      defaultFontFamily: 'Manrope',
    },
  })
    .render()
    .asPng()
}
