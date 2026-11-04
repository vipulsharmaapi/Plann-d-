# Plann’d

A React + Vite app for finding and hosting activities in Jaipur. Hosted on Hostinger, with Supabase Auth, Postgres, Storage and Realtime.

## Local development

Use Node.js 22 or later.

```sh
npm ci
cp .env.example .env.local
# Fill in your own Supabase URL and publishable anon key.
npm run dev
```

`VITE_GOOGLE_MAPS_API_KEY` is optional. Without it, maps use MapLibre/OpenStreetMap and venue search uses Photon. Restrict any Google browser key to your site domains and the Maps/Places APIs you use. Never put a Supabase service-role key in a `VITE_` variable.

```sh
npm run check    # lint, behavior/database tests, production build
npm audit
npm run preview
```

An unconfigured build displays a configuration notice and cannot silently use production. Local `.env` files are ignored. Vite embeds publishable values at **build time**; set them in Hostinger’s build environment before deploying from GitHub.

## Database

The original `supabase/*.sql` scripts are historical bootstrap scripts; `schema.sql` includes demo seed data and must not be rerun on production. New, ordered upgrades live in `supabase/migrations/`.

`202611040001_integrity_and_safety.sql` upgrades the existing v10 schema. It is transactional and re-runnable. It retains existing data and enforces pending requests, host decisions, account suspensions, atomic capacity, and private participant access. `save_plan` saves a plan and its WhatsApp link together with a stable ID for safe retries. The upgrade was tested locally against PostgreSQL using PGlite, dry-run against production with rollback, then applied through Supabase’s SQL Editor. `public.app_migrations` records each version. Apply `202611040002_private_block_events.sql` afterward to keep block pairs out of Realtime DELETE payloads.

The database tests use synthetic local users, not live accounts. They check both allowed and denied operations. They do not exercise Supabase email delivery, browser permission prompts or simultaneous production sessions.

## Deployment

Keep the current domain: https://mediumvioletred-stork-498786.hostingersite.com/.

- For a Hostinger GitHub build, set the three environment variables above, use `npm ci && npm run build`, and publish `dist`.
- For static hosting, build locally with the correct configuration, then upload the **contents** of `dist` (including `.htaccess`) into the existing website’s document root. Keep a copy of the previous assets until the new release has been verified.
- Apply the database migration before the corresponding frontend release. The capacity guards safely handle older clients’ attempts to update counters.
- Verify discovery, sign-in, posting, host approval, chat, cancellation, calendar export and mobile layout. Real sign-in/email delivery requires an account owner to complete authentication.
- Reverting the frontend should not remove the database security protections. Diagnose failed requests and fix forward; do not restore the old broad grants.

See [operations](docs/OPERATIONS.md) for moderation, reminders and maintenance. CI validates every pull request and main-branch update. CI builds without production keys on purpose; its output is not a production deployment artifact.
