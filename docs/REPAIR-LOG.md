# Plann’d repair log

Scope: the 4 November 2026 audit, preserving the current Hostinger domain and existing visual identity. Reminders stay inside the app; calendar exports work without a notification service.

## Release checklist

- [x] Enforce pending requests, host-only decisions, atomic capacity and protected suspension flags.
- [x] Save plans and private links in one transaction; prevent duplicate retries.
- [x] Add blocking, reporting workflow, plan-change notifications and opt-in reminders.
- [x] Replace fake-data fallback with honest loading, error and empty states.
- [x] Repair mobile navigation, accessible dialogs, fields, keyboard focus and motion.
- [x] Add My plans, useful discovery filters, deep-link states and calendar downloads.
- [x] Keep approvals and inbox current; load latest chat messages with older-page access.
- [x] Update dependencies: npm audit reports zero vulnerabilities after update.
- [x] Split map/editor bundles; remove committed environment configuration.
- [x] Add meaningful database/behavior tests, CI and operational documentation.
- [x] Apply and verify the tested migration; build and visually verify the app.
- [x] Publish the source and production build; verify the hosted release.

Baseline: repository commit bd311b98c7dfb6bfc6ff89e650c43f674b333bb8 matched the deployed JS/CSS byte for byte. Database policies/functions were inspected through the signed-in Supabase dashboard and saved outside this repository. No customer data was copied.

Validation before publication: 11 automated tests pass, lint has no findings, production build succeeds and npm audit reports zero vulnerabilities. Browser checks cover a 320 px layout, 390 px mobile layout, public plan details, labelled sign-in fields, email validation, modal focus trapping and Escape/focus restoration. The initial JavaScript is about 140 kB gzip plus a small shared runtime, versus 406.57 kB gzip previously. The on-demand MapLibre chunk remains about 292 kB gzip.

Hostinger uses the existing main-branch GitHub auto-deployment with Node 22 and Vite. Explicit Supabase build settings were added. Applying those settings attempted to restore the July deployment source, which Hostinger could not rebuild (package.json missing in its restored source). The new release must be fetched from GitHub rather than reusing that old source snapshot.


## Initial release verification (before the follow-up)

PR #1 was merged as `47c0e766ed76761f8f0bd66b856407af4075cea3`. GitHub checks passed on the release branch, pull request and main. Hostinger fetched that commit directly, built successfully with Node 22 and published it on 4 November 2026 at 14:19 IST. Its dependency audit also reported zero vulnerabilities. The deployed entry JavaScript, shared runtime and CSS matched the locally tested build byte for byte.

Production browser checks verified the live plan list, Google Maps and its real plan marker, shared-plan reload, sign-in validation and return to the plan, mobile navigation, and no horizontal overflow at 320 px. A 390 px screenshot and desktop screenshots are retained with the local audit. No email was sent and no test customer account or plan was created.

Supabase verification confirmed both migration versions, private block events excluded from Realtime, and successful latest runs of both minutely jobs. Actual email delivery and a complete two-account browser session remain untested. The operations guide records the static-site limitation for per-plan crawler previews.

The release follow-up makes Help, privacy & safety available directly inside every sign-in/signup step, preserving the form while users read it.

## Social previews and venue details

The follow-up adds an Express server for crawler-readable plan metadata and 1200 × 630 PNG previews, including availability and cancelled/ended states. Preview requests select only public plan fields. Venue details add fresh Google photos with attribution, rating/review links, website/maps links and an optional host-supplied HTTPS menu URL. Migration 003 was tested twice locally, dry-run with rollback in production, then applied successfully.

Both owner-authorized test aliases received production SMTP verification codes and completed profile creation. Automated coverage includes preview responses/escaping/private-field exclusion, venue matching/link validation and transactional venue metadata updates.

## Follow-up verification — 4 November 2026

PR #3 (`8914d2cf`) deployed the Express preview server and venue UI. PR #4 (`6625cf55`) deployed at 15:24 IST with in-app confirmations, gallery error recovery, Hindi/symbol preview fonts and uncached health responses. GitHub checks passed. The temporary domain remains unchanged.

Two clearly labelled accounts, QA Host and QA Guest, used owner-controlled email aliases. Both completed email-code signup and profile creation. The host used the deployed site; the guest used an isolated loopback frontend connected to the same production Supabase project. Production venue and public preview checks used the deployed site. This was not a two-device test, and no password-based signup was tested.

Verified through the UI:

- Create a labelled temporary plan, request a spot, receive the host's pending request, approve it, update capacity to full and show the joined plan in My plans.
- Exchange messages in both directions; keep chat/contact access unavailable before approval and after leaving.
- Enable an in-app reminder and receive its inbox notice. Download and inspect the actual calendar file: UTC timestamps, CRLF lines, escaped venue text and a 30-minute alarm.
- Leave and release the spot, request again and approve again. The replacement confirmation's Go back and Escape preserve membership; focus returns to the initiating control and Tab stays in the confirmation.
- Cancel as host, receive the guest's cancellation notice, close joining/chat controls, and move the plan to Past & cancelled. The temporary plan was cancelled at 15:37 IST and disappeared from public Explore. Test accounts remain labelled; no real plan was changed.

The keyboard test found React portal cancellation also dismissed the parent plan. The final patch stops nested cancel/Tab propagation and adds a regression test. Preview descriptions now use a neutral viewing action for full, ended or cancelled plans. Current validation: 19 tests pass, lint/build pass, and the scoped UI detector reports no findings.

Live venue verification showed attributed Google photos, a 4.6/5 rating with 286 reviews at test time, the official website/maps links and a host-provided menu URL. Photos 1 and 2 loaded. Desktop, 390 px and 320 px captures are retained locally; no horizontal overflow was observed. The restricted Google browser key correctly refuses loopback origins, where the fallback and retry/menu/maps controls were checked.

Server-rendered plan metadata and the 1200 × 630 PNG were verified on the deployed domain. A request using Facebook's crawler user agent received HTTP 200 and plan metadata. Hostinger presented bot verification to some other automated requests, including a synthetic WhatsApp user agent from the test machine; this does not establish what a real WhatsApp crawler receives. Actual social-platform preview caching was not tested. The app does not disable hosting security protections.

During rollout, the shared hosting account reached its 120-process/thread limit. Reducing only this app's worker pools restored normal browser traffic; the settings and monitoring guidance are in OPERATIONS.md. No unrelated website processes were stopped.
