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

The migration records `202611040001`, `202611040002` and `202611040003` in `public.app_migrations`. Verify the two cron jobs in Supabase Integrations → Cron: `expire-intents` and `plannd-reminders`. Review failed cron runs after deployment. Realtime publishes `join_requests` as well as the existing intent/message/notification tables. The frontend also refreshes on focus and periodically. Private block pairs are deliberately excluded from Realtime because DELETE payloads do not apply RLS; block actions refresh the current browser directly.

Monitor API errors, database advisor findings, auth email delivery and storage limits. Keep dependencies updated. `npm run check` and `npm audit --audit-level=high` run in CI. Compiler-only React lint rules are disabled because this app does not use React Compiler; normal hooks and correctness rules remain enabled.

## Before paid acquisition

The owner confirmed the project-wide auth email cap is 30 emails/hour on 4 November 2026. SMTP is configured through `smtp.gmail.com`; Supabase warns that this provider is intended for personal rather than transactional email. Resends and account recovery also consume email capacity. Keep the cap until a transactional provider, verified sender and its quotas are configured; raising Supabase's number alone does not improve delivery. Do not publish credentials or put verification codes in release evidence.

The sign-in form supports resending after 60 seconds and resumes the pending email step when reopened after a reload. Its optional sessionStorage checkpoint expires after 30 minutes and contains only email, verification method and send time; passwords/codes are never included. Restricted storage does not prevent sign-in. The browser-help link retains only the public plan ID, excluding auth fragments and other URL parameters.

Run the actual Instagram-to-site path on an Android phone and an iPhone before launching ads: open the destination, request a code, switch to email and back, verify, complete a profile, request a plan and receive host approval. Do not count a resized desktop browser as an Instagram webview test. Start with a small campaign only after hosting verification and mail delivery are cleared, then monitor successful signup/request counts and hosting resources.

## Boundaries

The app UI is client-rendered, served by a small Express process. Shared plan URLs return crawler-readable titles, dates, venue and availability plus a PNG preview before JavaScript loads. Cancelled, ended and full states are reflected. Missing plans return 404/noindex; temporary database failures return 503/no-store. No private contact or chat fields are queried. Public lookups use a bounded 15-second cache; preview images have a 60-second HTTP cache. Social platforms may keep their own previews longer.

Matching in-flight preview lookups are coalesced; at most 64 different lookups can be active. Rendered PNGs are cached by their public-data version and bounded to 64 entries/8 MiB per process. A refreshed plan changes its image version when details or availability change, including cancellation and expiry.

The Google browser key must permit the production domain, the Maps JavaScript API and the Places API (New), including Details and Photos. Plan discovery and meeting-pin selection use this same Google integration; there is no alternate map or venue-search provider. A failed map canvas is hidden, with retry and a List recovery path for discovery. Venue search saves a place ID; older plans are matched only when a nearby listing has the same normalized name and is unambiguous. Google photos, attribution and ratings load when plan details open, with retry and no-photo states. Only the place ID and host-provided menu URL are persisted. Menu URLs are optional HTTPS links: Google does not provide a standard menu URL in the queried Place fields. Hosts can add an official menu page when posting or editing. Menus and prices may change.

Do not switch Hostinger back to a static Vite preset: that removes the server preview routes. Use Express, npm, entry `server.js`, Node 22 and the existing environment settings. `/healthz` confirms process health; also check a real plan's HTML and image after redeployment.

Hostinger's edge can return a bot-verification page before a request reaches the app, including for health probes. Inspect HTTP status and content type rather than treating any response as application health. A Facebook-style metadata request passed during verification; some other synthetic crawler requests were challenged. If a real social platform fails to show a preview, inspect its debugger/cache and Hostinger bot logs before changing the application. Preserve hosting security protections and make only a targeted, reviewed configuration change if required.

Supabase SQL Editor verification and mobile/desktop screenshots are retained in the local audit directory. No production auth tokens, email addresses, private contacts or chat contents are included in repository fixtures or release artifacts.

## Venue discovery

Explore → Find a place lets visitors browse Jaipur venues by activity, including football and cafés, without signing in. Searches use the existing Places API (New) key and request 12 results at a time, with user-triggered pagination up to five pages. Each category change cancels the previous search; requests time out after 12 seconds and offer retry. Photos load lazily. Discovery is a separate lazy-loaded frontend chunk and needs no new database migration.

Highest rated and Most reviewed sort only the fetched results; Google relevance preserves the search order. Closed venues, missing coordinates and results outside the existing Jaipur posting area are excluded. This is not a complete venue directory, live booking inventory or a curated endorsement. Venue operators must confirm access, opening times, prices and reservations. Attribution stays with Google content, including photo authors and any supplied providers. Live Google content is not copied into a persistent discovery cache.

Make a plan here retains activity, venue name, place ID and coordinates while a guest completes the in-app sign-in flow, then prefills the existing editor. It does not publish or reserve anything automatically. The host still supplies a title, date, time and group size. A full page reload resets this venue selection; the existing email-code checkpoint is separate. The existing `save_plan` RPC persists the resulting host-confirmed plan.

The Google key's production-origin restriction remains in place; local fixture checks do not establish that production search or photos work. Verify real football and café listings, a photo, rating sort and editor prefill on the deployed domain after release. Search requests and photo views consume the project's existing Google Maps quotas and billing; monitor those before scaling acquisition.

## Shared hosting worker budget

This hosting account shares a 120-process/thread limit across its websites. During the Express rollout, baseline usage was already around 108–109 and rose to the limit, causing 503 responses and repeated Node restarts. Plann’d uses `UV_THREADPOOL_SIZE=1` and `NODE_OPTIONS=--v8-pool-size=1` in Hostinger to reduce its worker count. Keep these runtime settings when redeploying. Do not stop all account processes as routine maintenance; that interrupts unrelated sites. Review the account's Max Processes graph if errors return.

Hostinger Agent's 4 November diagnosis also attributed the intermittent bot verification to account-wide process-limit protection, overlapping deployment activity; it reported the restriction cleared at 16:14 IST. Its initial I/O explanation was corrected after comparing usage with the quota. Avoid overlapping builds and check process usage during rollout. If verification continues despite normal usage, request human technical review of the origin protection; do not assume a CDN exception will resolve it or disable protections globally.


## Rose Jaipur frontend (5 November 2026)

`202611050001_saved_plans_and_introductions.sql` was applied to production before the frontend correction. It is transactional and re-runnable, retains existing plan/account data, creates three owner-scoped RLS policies on saved_plans, and limits join introductions to 500 characters. Join requests retain the existing participant/host policies and host-only status RPC. The SQL Editor check confirmed RLS enabled, three policies, introduction column present and the migration record present.

Saved plans are bookmarks, not a reserved place. The bookmark acknowledgement follows a successful database response. A refresh or new sign-in reads bookmarks again; another account cannot read or mutate them. No scheduled email/push delivery was added. Keep the existing in-app reminder and calendar behavior.

Visual QA used local-only fixture plans because discovery had no upcoming live plans at review time. Those fixtures are excluded from production and from the downloadable source. The database/behavior suite covers allowed and denied save/intro operations, retries, pending host approvals, capacity, chat privacy, cancellation, reminders and existing venue flows. Email delivery checks from earlier releases remain separate; this integration did not send a fresh pair of signup emails.

## Prototype posting and Google Maps correction (5 November 2026)

The posting dialog now preserves the supplied prototype’s typography, field order and white/berry treatment while using the existing backend. A Google venue result carries its exact coordinates and place ID into `save_plan`. Choosing a manual meeting pin clears the place ID; an address typed without a selected location is not enough to publish. Times are interpreted and previewed in IST. More details starts closed and retains cost, skill level, booking, meeting instructions, menu, WhatsApp group link and women-only fields. The private group-link loading and atomic save, edit and repost behavior are retained.

The main plan map and optional meeting-pin map use Google Maps through the existing loader/key. Legacy map components, Leaflet/MapLibre dependencies and the Photon search fallback have been removed. Load/auth failures hide the failed vendor canvas and expose retry; discovery directs visitors to List. The key’s production-origin restriction remains unchanged. Local checks cover the UI and simulated provider behavior; they do not establish successful Google tiles, live venue results or production posting.

Before marking this correction released, verify the deployed domain’s plan map, selected pin and detail preview; Google venue search and exact location prefill; manual pin selection; and a permitted authenticated save/edit using the existing RPC. Recheck the 320px stacked fields and the paired layout at 390px and desktop. Final local verification passed 78 tests, lint, TypeScript and the production build. The narrow review’s two fixes are marked resolved in `.impeccable/review/prototype-followup-verdict.md`, with desktop, 390px and 320px captures plus the Google failure state in the same directory. The initial findings remain in `prototype-followup-review.md`. This documentation update does not claim deployment or live-provider verification.
