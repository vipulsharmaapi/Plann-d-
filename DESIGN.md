---
name: "Plann’d"
description: "Warm, clear discovery of small social plans in Jaipur."
colors:
  ink: "#34212f"
  berry: "#822c51"
  rose: "#f4e7eb"
  white: "#ffffff"
  surface: "#fbf8fa"
  line: "#e9e1e5"
  muted: "#75646f"
  berry-hover: "#6b2041"
  rose-hover: "#f8f0f4"
  focus: "#b86085"
  field-line: "#d7cad1"
  search-line: "#d6cbd1"
  date-line: "#d9ced4"
  secondary-line: "#cebcc5"
  switch-surface: "#f7f2f5"
  venue: "#695761"
  header-blush: "#fff1e8"
  header-line: "#f4e3d9"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "-0.025em"
  display-mobile:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title-mobile:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Instrument Sans Variable, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  description:
    fontFamily: "Instrument Sans Variable, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Instrument Sans Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  button:
    fontFamily: "Instrument Sans Variable, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  mode-label:
    fontFamily: "Instrument Sans Variable, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  venue-title:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  avatar-label:
    fontFamily: "Instrument Sans Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  wordmark:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "36px"
    fontWeight: 800
    letterSpacing: "-0.04em"
rounded:
  tag: "6px"
  switch-option: "7px"
  field: "8px"
  button: "9px"
  control: "10px"
  row: "12px"
  photo: "13px"
  map: "14px"
  dialog: "18px"
  mobile-switch: "24px"
  circle: "50%"
spacing:
  inset-4: "4px"
  gap-8: "8px"
  gap-12: "12px"
  inset-16: "16px"
  inset-20: "20px"
  gap-24: "24px"
  inset-28: "28px"
  gap-36: "36px"
  gutter-32: "32px"
  gutter-48: "48px"
components:
  button-primary:
    backgroundColor: "{colors.berry}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.berry-hover}"
    textColor: "{colors.white}"
  button-secondary:
    textColor: "{colors.berry}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "12px 20px"
  button-post:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.mode-label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  search-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "50px"
  form-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    width: "100%"
  date-filter:
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  date-filter-selected:
    backgroundColor: "{colors.berry}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  discovery-mode-selected:
    backgroundColor: "{colors.berry}"
    textColor: "{colors.white}"
    typography: "{typography.mode-label}"
    rounded: "{rounded.field}"
    padding: "12px 20px"
  venue-search-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    height: "48px"
  venue-row-selected:
    backgroundColor: "{colors.rose}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "16px"
  avatar:
    backgroundColor: "{colors.rose}"
    textColor: "{colors.berry}"
    typography: "{typography.avatar-label}"
    rounded: "{rounded.circle}"
  navigation-active:
    textColor: "{colors.berry}"
  plan-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "16px 12px"
    width: "100%"
  plan-row-selected:
    backgroundColor: "{colors.rose}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "16px 12px"
    width: "100%"
  mobile-view-switch:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.mobile-switch}"
    padding: "4px"
  map-pin:
    backgroundColor: "{colors.white}"
    textColor: "{colors.berry}"
    rounded: "{rounded.circle}"
    width: "44px"
    height: "44px"
  map-pin-selected:
    backgroundColor: "{colors.berry}"
    textColor: "{colors.white}"
    rounded: "{rounded.circle}"
    width: "44px"
    height: "44px"
---

# Design System: Plann’d

## Overview

**Creative North Star: "A Jaipur Courtyard"**

Plann’d feels like an invitation to spend an easy evening nearby. White space, aubergine text and rose selection surfaces create a warm, composed interface. The compact Jaipur panorama and warm blush header bring local character; clear plan and venue facts remain the focus.

This is the established world, extended by the final Live UX improvements handoff against the existing production services. The north-star phrase is descriptive shorthand inherited from the design, not a new brand claim. Preserve the fonts, compact illustrated header and clear visual hierarchy while presenting real accounts, plans, venues and request states. Product behavior and truth boundaries live in `PRODUCT.md`.

**Key Characteristics:**

- Warm blush navigation, rose selection and aubergine text on a white workspace.
- Expressive Bricolage headings paired with clear Instrument Sans UI text.
- The approved Jaipur panorama, illustrative activity artwork and restrained Lucide outline icons.
- Flat list surfaces, tonal selection and elevation for floating controls.
- Peer discovery modes, desktop list/detail views and dedicated phone detail and picker compositions.

Authority: the latest final handoff at `../plannd-redesign/live-improvements/HANDOFF.md` and `frame-index.json`, reconciled with the effective cascade in `src/index.css`, `src/App.tsx` and the shipped Explore, VenueDiscovery, VenueDetails, VenuePicker, PostSheet, Avatar, AccountGate, AuthSheet and retained plan components. The Figma entry is [Live UX improvements · Nov 2026](https://www.figma.com/design/xnIljT9gfTgCZzFcuesGl8/Plann-d?node-id=102-485); `../plannd-redesign/live-improvements/implementation-qa/` holds current fixture review captures. The earlier prototype remains historical authority for unchanged components. Frontmatter owns reusable primitives; `.impeccable/design.json` carries extensions and isolated component previews.

## Colors

Deep foregrounds, berry actions and soft rose support surfaces make the interface warm without coloring the whole page. Frontmatter values are normative; the existing `brand`, `gray` and `slate` CSS theme scales supply compatible operational states.

### Primary

- **Courtyard Berry** (`berry`): primary actions, active navigation, selected dates, open spots and selected map markers.
- **Deep Berry** (`berry-hover`): enabled primary-action hover.
- **Rose Focus** (`focus`): visible keyboard focus.

### Secondary

- **Soft Rose** (`rose`): selected plan rows and quiet supporting states.
- **Rose Mist** (`rose-hover`): plan-row hover.
- **Jaipur Blush** (`header-blush`): navigation and compact panorama background; it remains behind readable copy if the decorative image fails.

### Neutral

- **Aubergine Ink** (`ink`): primary text, toast background and floating mobile view-switch shell.
- **White** (`white`): the page, fields, navigation, photo labels and raised controls.
- **Rose Paper** (`surface`): disclosure panels, filters and quiet support surfaces.
- **Mauve Grey** (`muted`) and **Venue Grey** (`venue`): secondary explanations and venue facts.
- **Rose Divider** (`line`): list, field and disclosure separators.
- **Blush Divider** (`header-line`): the header separator and unresolved-account placeholder.
- **Control Strokes** (`field-line`, `search-line`, `date-line`, `secondary-line`): the distinct field, search, date and secondary-action borders.
- **Switch Paper** (`switch-surface`): the desktop List/Map track.

Image and map colors are content, not new UI palette tokens. Destructive operations and failures retain their semantic error treatment; do not use berry alone to imply success or acceptance.

**The Selection Rule.** Use soft rose for the selected plan, berry for active controls, and an explicit focus outline for keyboard focus. These are separate states.

## Typography

**Display Font:** Bricolage Grotesque Variable, with sans-serif fallback.
**Body Font:** Instrument Sans Variable, with sans-serif fallback.

Both are loaded from local Fontsource dependencies. Bricolage carries the informal heading and wordmark character; Instrument Sans carries facts, descriptions and controls. Keep the explicit family choice even if a generic design detector recommends another face.

### Hierarchy

- **Display:** the desktop invitation uses `display`; the mobile invitation uses `display-mobile`. Between 701px and 1100px the invitation is 34px; below 360px it is 29px. The compact header uses minimum heights so copy can grow.
- **Headline:** `headline` governs section titles. Desktop plan details use a 31px override; mobile details use 30px. Join review uses 28px.
- **Title:** `venue-title` is the venue-row heading; `title` is the desktop plan-row title; `title-mobile` is the phone row title. Intermediate widths reduce row titles through 19px and 18px.
- **Body:** the page uses `body`; plan descriptions use `description`, capped at 66ch, increasing line height to 1.6 in phone detail. Metadata uses 12–16px according to its role.
- **Label:** form fields use `label`; filter labels use weight 500. Keep visible labels and sentence case. Desktop navigation is 16px; phone bottom navigation is 10px below icons.
- **Button:** prominent actions use `button`; discovery modes, venue actions and the updated account/auth controls use the quieter `mode-label` weight. Selected navigation and availability use weight 650 where implemented.
- **Wordmark:** use `wordmark`, reducing to 29px in the phone header.

**The Two-Voice Rule.** Use Bricolage for headings and the wordmark; use Instrument Sans for actions, facts, labels and prose.

## Layout

Main content is centered at a maximum width of 1440px. Desktop side gutters are 48px. The updated header, hero, discovery modes, venue workspace and account pages use 28px gutters between 701px and 1100px, then 20px at 700px and below. Retained plan-list regions keep their established 32px intermediate gutter. The navigation is 80px tall on desktop and 66px on phone; above 1440px its interior can reach 1536px.

The shared Jaipur hero defaults to a 210px minimum height on desktop and 230px on phone, including plan map mode. The approved panorama is clipped within this band, with a directional blush scrim behind text. The desktop image is 940 × 313px, aligned right and shifted 95px upward; mobile uses 690 × 230px along the bottom, with left position `calc(50% - 425px)`. These are minimum hero heights, not fixed text-clipping constraints. Join plans and Explore venues follow immediately as peer controls; plan search is its own row below them.

Plan discovery retains the established split composition: large desktop columns use a 0.91:1.09 ratio and 42px gap; at 1200px they become equal with a 28px gap; at 900px they use a 0.9:1.1 ratio and 20px gap. Venue discovery instead uses 604:704 columns with a 36px gap, reduced to 24px at intermediate widths. Below 900px, venue selection opens a dedicated detail composition: the hero, discovery modes, search and results toolbar yield to detail and a Back control. These are surface-specific measurements, not a compulsory template for every screen.

At 700px and below, plan discovery becomes one column. A plan opens in a native full-screen detail sheet with the action row fixed at the bottom, safe-area padding and a 170px maximum action region; detail content reserves 190px below it. Bottom navigation adds the safe-area inset to its 72px height. The floating plan List/Map switch sits at 90px plus that inset. Venue List/Map remains in the results toolbar. Category/date strips may scroll horizontally; the page itself fits the viewport. The phone plan map retains `calc(100dvh - 350px)` with a 380px minimum; desktop is 610px tall.

Normal sheets use a 38rem maximum width and 90dvh maximum height; at 640px they meet the bottom edge and may reach 94dvh. Posting uses a 660px desktop maximum and 28px inset; its venue picker expands the same Sheet to 790px. Both become full-height, square-cornered surfaces at 700px and below, with 24px/20px padding and safe-area clearance. Picker actions remain sticky within that surface. Paired post fields stack below 380px. Auth and profile sheets likewise become full height on phone, with desktop maximum widths of 520px and 800px respectively.

Venue search has two labelled fields plus a visible submit action on desktop, stacking into one column with a full-width action on phone. Account gates are centered content groups with a 500px maximum width; their primary action fills the available width on phone. Spacing tokens record repeated steps rather than a compulsory universal grid. Keep related facts together and leave sufficient clearance for fixed navigation and sticky actions.

## Elevation & Depth

White space, thin dividers and tonal selection provide most hierarchy. Ordinary plan rows and the main detail remain flat. Elevation identifies floating controls, map markers/previews, profile menus, modal sheets and temporary feedback. Exact shadows, backdrop values and motion are in the sidecar.

**The Floating Surface Rule.** Add elevation when a control or temporary surface sits above content; keep ordinary plan rows and content panels flat.

State feedback is brief: button colors transition over 150ms and marker scale over 180ms when reduced motion is not requested. The global reduced-motion rule reduces animation and transition durations. Do not infer the unused prototype dialog entrance animation as a requirement for the production Sheet component.

## Shapes

Use the existing gently rounded family: compact badges, fields, buttons, controls, rows, photography, maps and dialogs each have a measured role. Fields use `field`, primary actions use `button`, plan rows use `row`, and large photos/maps use their respective clipping radii. Circles represent faces, initials, icon controls and plan pins. The mobile view switch is a capsule.

Phone detail and map imagery reach the viewport edge without rounded outside corners. Production sheets use `dialog` corners, while full-screen plan, posting/picker, auth and profile sheets remove them. Preserve these responsive exceptions. Lucide SVG icons supply the interface’s outline language; do not replace them with typographic glyphs.

## Components

### Buttons

Direct, berry primary actions use `button-primary` and a 48px minimum height. Their default width is intrinsic; join actions and explicit full-width controls fill their container. Secondary actions use the fine secondary stroke, berry text and at least 44px height. Post a plan retains the outlined header variant.

Enabled primary hover darkens the fill. Disabled primary actions use 0.45 opacity; prevent duplicate writes while busy. Pending join requests are presented as explanatory text plus Withdraw request, not as an accepted place. Cancelled and ended plans show Cancelled or Ended in the host/availability area instead of advertising open spots. Keep Share as a secondary action beside or below the primary join state.

Keyboard focus uses a 3px Rose Focus outline with 3px offset. Search uses a 2px focus-within outline with 2px offset. Icon-only actions require accessible labels and visible focus.

### Chips and filters

Date choices are rounded rectangles with berry/white inversion for selection. Phone date controls reduce to 38px minimum height. Categories are text tabs with a 3px active underline, not filled pills. Activity badges over photography are informational. Expanded production filters retain visible labels, semantic inputs and the quiet Rose Paper panel.

### Cards and plan rows

Plan rows are whole-row buttons with a portrait crop, title, time, venue, shared host avatar and availability. Selection uses Soft Rose; hover uses Rose Mist. Desktop thumbnails are 112px wide; phone thumbnails are 91px, reducing again below 360px. Host and availability stay together at the bottom of the copy column and wrap when needed. Dividers separate rows; resting shadows are absent.

Plan detail opens with the supplied activity artwork, a save control and an explicit illustrative-image caption. Real host photos or initials appear with host information. Keep the supplied activity files in their existing illustrative roles; use the approved panorama for the hero. Keep live Google venue photos separate and attributed; never imply activity artwork depicts a named venue or its participants.

### Inputs and fields

Search is an outlined white surface with search icon and optional clear action. It is 50px tall on desktop and 46px on phone. Forms use visible labels, fine strokes and gently rounded fields. Production `.field` controls use the `form-field` padding; filter controls have their existing local sizing. The join introduction remains an optional textarea with a 500-character limit and private-to-host explanation. Errors stay visible near the relevant action and provide recovery when available.

### Navigation

Desktop navigation uses icon/text pairs, berry active text and an underline. Phone navigation has four evenly distributed icon-over-label actions including Post a plan. The blush header retains the wordmark, Jaipur location and real account/sign-in state. Join plans and Explore venues are equal discovery-mode controls below the hero: berry-filled selection, outlined secondary alternative and an exposed pressed state. The plan List/Map switch remains light on desktop and a floating aubergine capsule on phone; venue List/Map stays in the results toolbar with a light track. Both use a white selected option.

### Jaipur map and plan preview

Google Maps displays host-stored coordinates through the existing loader and project key. Circular category pins invert white/berry and scale to 1.15 when selected. The preview repeats the same plan artwork, title, time and available places, and opens details. Keep Google attribution visible. Loading uses a plain status; failure hides the vendor canvas and presents one recovery message with Retry map, while List remains available. The map label describes meeting places from hosts; it does not claim independent location verification. The optional meeting-pin map in posting uses the same Google provider and an inline retry state.

### Posting dialog

The supplied form hierarchy stays intact: heading and short introduction, plan title, activity/open spots, venue, neighbourhood/date, start/end times, description, then the full-width berry action. The Bricolage heading is 28px on desktop and 26px on phone, with a 1.14 line height; Instrument Sans carries labels, fields and helper text. Fields are white, finely outlined and gently rounded, with 45px minimum height and 11px/12px padding. Phone fields use 16px text. Form rows are separated by 18px on desktop and 16px on phone.

Google venue suggestions appear directly beneath the venue field, with names, addresses, attribution and loading/error recovery. A selected meeting place receives a quiet confirmation and a Check meeting pin control. The IST preview sits directly below the time pair. More details begins closed and keeps optional production fields accessible without disturbing the supplied form’s main sequence. Its disclosure uses normal label text and a muted Optional qualifier. Save progress and errors remain beside the action. Explore Jaipur venues opens a picker inside the same native Sheet, keeping the mounted form and every draft value. Rows show tentative selection; Use this venue enables only after selection and commits only venue-associated fields. Cancel, close and browser Back return to the original draft. The selected summary exposes Change venue. The shared Sheet supplies focus, Escape dismissal and scroll locking; posting uses its own visible header close control.

### Venue list and detail

Venue rows pair a clipped provider image or a quiet building-icon fallback with the name, returned facts and upcoming-plan count. Selected rows use Soft Rose and retain that fill on hover; unselected hover uses Rose Paper. Desktop thumbnails are 110px square; phone crops are 76 × 100px, reducing below 360px. Photo credits remain beside the content. Details use real provider data and link existing plans into the plan-detail flow; absent ratings, hours and websites remain absent. Make a plan here is a full-width berry action. Map and list share place IDs and results; a missing coordinate removes only the marker.

### Shared avatars

Use the shared Avatar for header, profile, plan rows, host/member and message surfaces. Persisted photo URLs resolve through the canonical profile cache before saved fallback choices, current-name initials or the generic Lucide user icon. Images are circular and cover their frame. Visible sizes are 42px in the desktop header, 34px in its phone override, 88px in profile and 28px in plan rows; the header control remains 44px. Keep the previous persisted photo during upload or removal failure. Saved fallback emoji are user identity content, not the interface icon vocabulary.

### Account and sign-in states

Signed-out My plans and Inbox each use a single centered icon/title/explanation/action group with Sign in, Keep exploring and a public-browsing helper. Do not insert signed-in tabs or empty-content messaging into that group. Stable unresolved-session, signed-in loading, empty, failure/retry and populated states remain distinct. Sign-in retains the existing Email code and Password methods, associated inline errors, visible busy/resend feedback and the initiating destination or post draft. No sample code length or countdown from Figma becomes a product rule.

### Sheets and feedback

Production overlays use the shared native Sheet: accessible dialog naming, a Lucide close control, Escape dismissal, a tab loop, background scroll lock and focus restoration. Phone plan detail uses its own All plans back control. The join review contains actual plan context, optional introduction and a database-backed submit action. Toast/status feedback and request errors reflect real outcomes; loading and failure must not resemble successful submission.

## Do's and Don'ts

### Do:

- **Do** preserve the rose/aubergine palette and the Bricolage/Instrument Sans pairing.
- **Do** keep host, time, Jaipur meeting place and availability easy to scan together.
- **Do** use the approved compact Jaipur panorama and identify retained activity artwork as illustrative.
- **Do** give phone layouts their own composition and clearance for fixed controls.
- **Do** distinguish selection, hover, focus, saving, pending requests and accepted membership.
- **Do** preserve Google attribution beside the maps, venue results and photos it describes.
- **Do** preserve the posting hierarchy and More details, and keep tentative picker selection separate from the confirmed draft.
- **Do** use the shared avatar and preserve the distinction between guest, loading, empty and failed account states.

### Don't:

- **Don't** add resting shadows to every row or flatten the distinction between content and floating controls.
- **Don't** replace readable facts, action labels or Lucide icons with decorative glyphs.
- **Don't** stretch the desktop split view into a narrow phone viewport or stack an independent venue-picker modal over the post sheet.
- **Don't** use illustrative artwork or generated portraits as evidence of a real venue or user.
- **Don't** present a saved bookmark or pending request as a reserved or accepted place.
- **Don't** refill empty production discovery with fictional plans or carry prototype-only success claims into real flows.
