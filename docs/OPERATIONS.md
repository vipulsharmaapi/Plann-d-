# Operating Plann’d

## Moderation

Only project administrators with existing Supabase dashboard access can moderate. No new app administrator role or credential is introduced.

In Table Editor → `reports`, review `new` reports and set `status` to `reviewing`, `resolved` or `dismissed`. Record `reviewed_at` and an internal `moderator_note`. Report authors can read their own reason and status; internal notes are not exposed through their column grants. Account/help requests have a null `intent_id`.

To suspend an account, set `profiles.banned = true` through the dashboard. Ordinary users cannot modify this column, identity, join count or creation timestamp. Suspended accounts cannot host, join or chat. Use a targeted, reviewed operation for any requested account removal; this release does not delete customer accounts automatically.

Profile gender is self-declared and is not identity verification. Review `profile_change_requests`; correct the corresponding `profiles.gender` through the dashboard, then mark the request `resolved` or `declined`. The immutable-gender trigger allows project administrators to make corrections while rejecting ordinary direct changes.

Blocks are private to the blocking user. Blocking a host or participant closes their pending/accepted requests together, releases capacity, and prevents new requests. Chat messages from blocked peers are hidden. Unblocking does not automatically reinstate old membership.

## Reminders

A user opts in from an accepted/hosted plan. `plan_reminders` records the choice. The `plannd-reminders` cron job runs every minute and queues one inbox notice per user, plan and start timestamp in the 30 minutes before the start. Opening/refocusing the app also checks due reminders. Cancellation, expiry, suspension, blocking and withdrawn membership prevent delivery. A changed start time permits a new reminder. No email, push or SMS reminder service is configured.

Calendar downloads contain real UTC timestamps, escaped text, stable event IDs, Unicode-safe folded lines and a 30-minute display alarm. Calendar applications control whether alerts are enabled. Downloads are snapshots; users must download again after a plan changes.

## Checks

The migration records `202611040001` and `202611040002` in `public.app_migrations`. Verify the two cron jobs in Supabase Integrations → Cron: `expire-intents` and `plannd-reminders`. Review failed cron runs after deployment. Realtime publishes `join_requests` as well as the existing intent/message/notification tables. The frontend also refreshes on focus and periodically. Private block pairs are deliberately excluded from Realtime because DELETE payloads do not apply RLS; block actions refresh the current browser directly.

Monitor API errors, database advisor findings, auth email delivery and storage limits. Keep dependencies updated. `npm run check` and `npm audit --audit-level=high` run in CI. Compiler-only React lint rules are disabled because this app does not use React Compiler; normal hooks and correctness rules remain enabled.

## Boundaries

The app remains a client-rendered static site. Public plan links resolve expired/cancelled/unavailable states and set a useful page title after load. Social crawlers receive the site-level Open Graph metadata; per-plan social preview images need a server-rendered or edge-rendered route. This release does not invent SEO pages for non-existent plans or index private chat/contact data.

Supabase SQL Editor verification and mobile/desktop screenshots are retained in the local audit directory. No production auth tokens, email addresses, private contacts or chat contents are included in repository fixtures or release artifacts.
