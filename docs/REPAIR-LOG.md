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


## Published verification

PR #1 was merged as `47c0e766ed76761f8f0bd66b856407af4075cea3`. GitHub checks passed on the release branch, pull request and main. Hostinger fetched that commit directly, built successfully with Node 22 and published it on 4 November 2026 at 14:19 IST. Its dependency audit also reported zero vulnerabilities. The deployed entry JavaScript, shared runtime and CSS matched the locally tested build byte for byte.

Production browser checks verified the live plan list, Google Maps and its real plan marker, shared-plan reload, sign-in validation and return to the plan, mobile navigation, and no horizontal overflow at 320 px. A 390 px screenshot and desktop screenshots are retained with the local audit. No email was sent and no test customer account or plan was created.

Supabase verification confirmed both migration versions, private block events excluded from Realtime, and successful latest runs of both minutely jobs. Actual email delivery and a complete two-account browser session remain untested. The operations guide records the static-site limitation for per-plan crawler previews.

The release follow-up makes Help, privacy & safety available directly inside every sign-in/signup step, preserving the form while users read it.
