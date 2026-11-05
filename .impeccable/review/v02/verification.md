# v.02 implementation verification

Local visual fixtures are served only through ignored integration-qa.local/vite.config.mjs. They contain synthetic people and plans and do not ship. The missing second card image deliberately exercises the fallback. Production photos use the existing strict Google place matching; detail and venue disclosure share a single lookup.

Automated: npm run check passed, 92 tests in 18 files. Coverage includes public discovery, exact venue branches, auth/draft handoff, posting recovery, profile photos, failed join submissions, server-confirmed pending status, host approval, capacity and row-level privacy. npm audit --audit-level=high: zero vulnerabilities. Two pre-existing map ref lint warnings and the existing main-chunk size advisory remain.

Browser through CUA: 1440x980, 1280x900, 768x1024, 390x1180 and 320x900. No document horizontal overflow at these sizes. Desktop/mobile details and pending state also captured at 1440x1100 and 390x1100. The fixed mobile navigation appears partway through full-page captures because it is fixed to the viewport, not the page; scrolling reaches subsequent content.

Verified: Explore plans moves focus to the upcoming heading; matching View plan opens public details; Request to join opens auth with the selected title; dismiss and Back restore the originating view; filters retain activity/query; venue search stays Roastery after Back to plans and re-enter; pending state offers View my plans and never accepted/chat access. No live plan/request was created for visual QA. Native 200% zoom and new email delivery were not exercised in this release.

Real production Google data, signed-in session and final bundle verification are recorded in the deployment receipt after merge.


Review correction verification: computed card title weight is 700. Mobile selects are 16px at 390/320; activity/date labels are fully visible, and 320 wraps Map to its own row. Search & filters and Back to plans have 44px minimum targets; Back measured 44px. Expanded 320px filter screenshot is filters-320.png. No horizontal document overflow across the five measured widths.

Native zoom limitation: the supported viewport capability exposes width/height set/reset only. A tab-scoped Meta+= shortcut left innerWidth1440, devicePixelRatio1 and visualViewport.scale1 unchanged. No native200% zoom pass is claimed. Global desktop/browser keyboard shortcuts were not used because they could affect unrelated user tabs. This remains an unverified acceptance check.
