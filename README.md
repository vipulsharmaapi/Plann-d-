# Plann’d

A React + Vite app with an Express server for social previews for finding and hosting activities in Jaipur. Hosted on Hostinger, with Supabase Auth, Postgres, Storage and Realtime.

## Local development

Use Node.js 22 or later.

```sh
npm ci
cp .env.example .env
# Fill in your own Supabase URL and publishable anon key.
npm run dev
```

`VITE_GOOGLE_MAPS_API_KEY` is optional. Without it, maps use MapLibre/OpenStreetMap and venue search uses Photon. Restrict any Google browser key to your site domains and the Maps/Places APIs you use. Never put a Supabase service-role key in a `VITE_` variable.

```sh
npm run check    # lint, behavior/database tests, production build
npm audit
npm start        # built app + crawler previews on port 3000
```

An unconfigured build displays a configuration notice and cannot silently use production. Local `.env` files are ignored. Vite embeds publishable values at **build time**; set them in Hostinger’s build environment before deploying from GitHub.

## Database

The original `supabase/*.sql` scripts are historical bootstrap scripts; `schema.sql` includes demo seed data and must not be rerun on production. New, ordered upgrades live in `supabase/migrations/`.

`202611040001_integrity_and_safety.sql` upgrades the existing v10 schema. It is transactional and re-runnable. It retains existing data and enforces pending requests, host decisions, account suspensions, atomic capacity, and private participant access. `save_plan` saves a plan and its WhatsApp link together with a stable ID for safe retries. The upgrade was tested locally against PostgreSQL using PGlite, dry-run against production with rollback, then applied through Supabase’s SQL Editor. `public.app_migrations` records each version. Apply `202611040002_private_block_events.sql` afterward to keep block pairs out of Realtime DELETE payloads.

Apply `202611040003_venue_details.sql` before the venue release. It adds Google place IDs and optional host-provided HTTPS menu links, while preserving older clients and atomic plan saves. Photos and ratings are fetched fresh from Google and are not stored in the database.

The automated database tests use synthetic local users. They check both allowed and denied operations. Email delivery and multi-account browser checks are recorded separately in the repair log.

## Deployment

Keep the current domain: https://mediumvioletred-stork-498786.hostingersite.com/.

- Use Hostinger's **Express** framework preset, Node 22, npm, entry file `server.js`, root `./`, branch `main`. Keep the three existing environment variables available at build and runtime. The `postinstall` script builds `dist`; `npm start` serves it and the preview routes on Hostinger's assigned `PORT`.
- `/?p=<plan UUID>` returns plan-specific Open Graph/Twitter HTML before JavaScript runs. `/og/plans/<UUID>.png` renders a 1200 × 630 image. `/healthz` checks the server process. Only public plan fields are read through the anon key; no service-role key is required.
- Static-only hosting does **not** support these preview routes. Keep the Node server enabled. `npm run preview` is only for inspecting Vite's static output.
- Apply database migrations before the corresponding frontend release. Verify discovery, email verification, posting, host approval, chat, cancellation, calendar export and mobile layout.
- Reverting the frontend should not remove the database security protections. Diagnose failed requests and fix forward; do not restore the old broad grants.

See [operations](docs/OPERATIONS.md) for moderation, reminders and maintenance. CI validates every pull request and main-branch update. CI builds without production keys on purpose; its output is not a production deployment artifact.
