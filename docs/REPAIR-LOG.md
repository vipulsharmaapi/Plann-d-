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
- [ ] Publish the source and production build; verify the hosted release.

Baseline: repository commit bd311b98c7dfb6bfc6ff89e650c43f674b333bb8 matched the deployed JS/CSS byte for byte. Database policies/functions were inspected through the signed-in Supabase dashboard and saved outside this repository. No customer data was copied.

Validation before publication: 11 automated tests pass, lint has no findings, production build succeeds and npm audit reports zero vulnerabilities. Browser checks cover a 320 px layout, 390 px mobile layout, public plan details, labelled sign-in fields, email validation, modal focus trapping and Escape/focus restoration. The initial JavaScript is about 140 kB gzip plus a small shared runtime, versus 406.57 kB gzip previously. The on-demand MapLibre chunk remains about 292 kB gzip.

Hostinger uses the existing main-branch GitHub auto-deployment with Node 22 and Vite. Explicit Supabase build settings were added. Applying those settings attempted to restore the July deployment source, which Hostinger could not rebuild (package.json missing in its restored source). The new release must be fetched from GitHub rather than reusing that old source snapshot.
