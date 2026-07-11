# Plann'd 🙋

**Who's in?** — a map-based app for Jaipur that matches people by *intent*: post an activity (badminton tonight, morning 5K, coffee + startup talk), see who else is down, team up.

## Stack

- **React + TypeScript + Vite** — static SPA, no server needed
- **Tailwind CSS v4**
- **MapLibre GL** with OpenStreetMap tiles
- **Supabase** (Postgres + PostGIS, phone OTP auth, realtime) — pending wiring; the app currently runs on mock data

## Develop

```bash
npm install
cp .env.example .env   # add Supabase keys when ready (optional for now)
npm run dev
```

## Deploy (Hostinger)

```bash
npm run build
```

Upload the contents of `dist/` to the site's `public_html/` (hPanel File Manager or FTP). `dist/.htaccess` is included for SPA routing.

## Roadmap

- [x] Map + browse today's intents (mock data)
- [ ] Supabase schema: `users`, `intents` (PostGIS), `join_requests`, `reports` + RLS
- [ ] Auth (OTP) — required only to post/join
- [ ] Post-intent flow (activity → time → venue/pin → spots → WhatsApp link)
- [ ] Join flow: request → approve → WhatsApp handoff
- [ ] Realtime pin updates, intent expiry at midnight IST
- [ ] Telegram broadcast bot ("Plann'd Jaipur" channel)
