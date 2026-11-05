# Plann’d

Plann’d helps people in Jaipur find small social plans, request to join, or host a plan at a local venue. This is the Supabase-connected application. Discovery, accounts, requests, approvals, chat, profiles and saved plans use the existing backend.

## People and purpose

The audience is Jaipur residents looking for a low-pressure coffee, sport, meal or shared activity with a few people nearby. A visitor needs to understand the activity, time, meeting place, host and remaining places before deciding to join. Joining an existing plan is the primary journey; posting and venue discovery support it.

## Product behavior

- Explore opens on upcoming Jaipur plans. Search, category, activity, date, neighbourhood, time, distance, open-place and women-only filters narrow the same live results. Dates use India time. A filtered-out plan must not remain selected in the adjacent detail view.
- Desktop discovery uses a list beside plan details or a Leaflet map. Phone discovery uses a single list or map, a floating List/Map switch and bottom navigation. Opening a phone plan shows a full-screen sheet with the join action at the bottom.
- Request to join requires authentication. The review sheet allows an optional introduction of up to 500 characters. Sending creates a pending request; it does not reserve a place or grant chat access. The host accepts or declines requests. Existing capacity, eligibility, blocking and plan-status checks remain authoritative.
- Join introductions belong to the request and are private to the requester and host under the existing participant/host access policies. They are not public profile text or public plan content.
- Hosts and accepted members can use the existing group chat and permitted contact actions. Members can leave; requesters can withdraw pending requests; hosts can edit or cancel plans and manage members.
- Saved plans are private bookmarks, persisted per signed-in account in `saved_plans` and available in My plans → Saved. Saving does not request membership, reserve a place or notify the host. The saved state acknowledges a successful database response; failures remain visible with a retry path.
- Posting, signup/sign-in, email verification, profile editing, host approvals, inbox updates, safety/report/block controls, sharing, calendar export and in-app reminders remain connected to the existing services. Calendar downloads are snapshots and must be downloaded again after a plan changes. Optional reminders appear in the app 30 minutes before a plan; no new email, SMS or push reminder channel is implied.
- Venue search and discovery retain the existing Google Places integration. Actual venue photos, ratings and attribution come from Google. The venue result is context for making a plan, not a booking, guarantee of availability or endorsement.

## Truth and data boundaries

Production displays backend plans and truthful loading, empty and failure states. Do not add fictional plans, people, availability or success messages to fill a production screen. Local visual QA used fixture plans because discovery had no upcoming live plans during review; those fixtures are not production data or part of the source download.

The four supplied WebP assets are reused unchanged: `jaipur-canopy.webp`, `jaipur-cafe.webp`, `jaipur-badminton.webp` and `jaipur-games.webp` in `public/images/`. They are illustrative activity artwork, not evidence of a named venue or its attendees. Details visibly identify the activity image as illustrative; Google venue photographs remain a separate, attributed section. `redesign-provenance.json` records only these four shipped WebP files, their SHA-256 hashes and their user-supplied origin. Real profile photographs or initials represent users. Generated concept portraits must not represent live hosts.

The plan map renders the host's stored latitude and longitude. Its label says “Meeting places from hosts”; it no longer presents fictional neighbourhood pins. Keep OpenStreetMap attribution visible. A stored location is host-provided information, not independent venue verification.

The transactional migration `supabase/migrations/202611050001_saved_plans_and_introductions.sql` adds owner-scoped bookmark policies and the 500-character introduction constraint. Its application and database checks are recorded in `docs/OPERATIONS.md`. Existing request-access policies and the host-only response RPC remain in force. Historical bootstrap SQL contains demo seeds and must not be replayed to populate production.

## Design authority

The user selected the supplied prototype at `../plannd-redesign/prototype` and requested its exact fonts, four artwork files and layout with the real existing backend. The visual direction is settled; do not reopen concept selection. Root `DESIGN.md` records the integrated implementation, with `src/index.css` and the shipped components as the implementation authority.

The editable design remains in [the existing Figma file](https://www.figma.com/design/xnIljT9gfTgCZzFcuesGl8?node-id=41-91). Source frame: `41:91`; connected join review: `78:172`; connected pending state: `78:199`. The visual review captures are in `.impeccable/review/`. They establish the reviewed appearance, not proof of live signup email delivery or every authenticated backend state.

## Continuity

Keep Jaipur as the supported city, joining as the first task, and all retained backend journeys available. Extend the established rose/aubergine world using the recorded components. Operational setup, deployment and service limitations belong in `README.md` and `docs/OPERATIONS.md`; visual tokens and interaction presentation belong in `DESIGN.md`.
