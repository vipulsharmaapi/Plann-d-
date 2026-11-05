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
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.13
    letterSpacing: "-0.025em"
  display-mobile:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.1
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
    textColor: "{colors.berry}"
    typography: "{typography.button}"
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

Plann’d feels like an invitation to spend an easy evening nearby. White space, aubergine text and rose selection surfaces create a warm, composed interface. Jaipur courtyard greenery, pale pink walls and small shared activities bring the local character; clear plan facts remain the focus.

This is the supplied prototype’s chosen world, implemented against the existing production services. The north-star phrase is descriptive shorthand inherited from that design, not a new brand claim. Preserve the same fonts, artwork and visual hierarchy while presenting real accounts, plans and request states. Product behavior and truth boundaries live in `PRODUCT.md`.

**Key Characteristics:**

- Warm rose and aubergine on a predominantly white canvas.
- Expressive Bricolage headings paired with clear Instrument Sans UI text.
- The four supplied Jaipur artwork files and restrained Lucide outline icons.
- Flat list surfaces, tonal selection and elevation for floating controls.
- Deliberate desktop and phone compositions with legible plan facts.

Authority: the effective cascade in `src/index.css`, `src/App.tsx`, and the Explore, PlanRow, PlanDetail, JoinSection, Sheet and JaipurMap components. The source prototype is `../plannd-redesign/prototype`; `.impeccable/review/` holds integration review captures. Frontmatter owns reusable primitives; `.impeccable/design.json` carries extensions and isolated component previews. This is the integrated system, not the prototype’s session-only behavior.

## Colors

Deep foregrounds, berry actions and soft rose support surfaces make the interface warm without coloring the whole page. Frontmatter values are normative; the existing `brand`, `gray` and `slate` CSS theme scales supply compatible operational states.

### Primary

- **Courtyard Berry** (`berry`): primary actions, active navigation, selected dates, open spots and selected map markers.
- **Deep Berry** (`berry-hover`): enabled primary-action hover.
- **Rose Focus** (`focus`): visible keyboard focus.

### Secondary

- **Soft Rose** (`rose`): selected plan rows and quiet supporting states.
- **Rose Mist** (`rose-hover`): plan-row hover.

### Neutral

- **Aubergine Ink** (`ink`): primary text, toast background and floating mobile view-switch shell.
- **White** (`white`): the page, fields, navigation, photo labels and raised controls.
- **Rose Paper** (`surface`): disclosure panels, filters and quiet support surfaces.
- **Mauve Grey** (`muted`) and **Venue Grey** (`venue`): secondary explanations and venue facts.
- **Rose Divider** (`line`): navigation, list and disclosure separators.
- **Control Strokes** (`field-line`, `search-line`, `date-line`, `secondary-line`): the distinct field, search, date and secondary-action borders.
- **Switch Paper** (`switch-surface`): the desktop List/Map track.

Image and map colors are content, not new UI palette tokens. Destructive operations and failures retain their semantic error treatment; do not use berry alone to imply success or acceptance.

**The Selection Rule.** Use soft rose for the selected plan, berry for active controls, and an explicit focus outline for keyboard focus. These are separate states.

## Typography

**Display Font:** Bricolage Grotesque Variable, with sans-serif fallback.
**Body Font:** Instrument Sans Variable, with sans-serif fallback.

Both are loaded from local Fontsource dependencies. Bricolage carries the informal heading and wordmark character; Instrument Sans carries facts, descriptions and controls. Keep the explicit family choice even if a generic design detector recommends another face.

### Hierarchy

- **Display:** the desktop invitation uses `display`; the mobile invitation uses `display-mobile`. Intermediate desktop widths use a smaller invitation, matching the supplied composition.
- **Headline:** `headline` governs section titles. Desktop plan details use a 31px override; mobile details use 30px. Join review uses 28px.
- **Title:** `title` is the desktop row title; `title-mobile` is the phone row title. Intermediate widths reduce row titles through 19px and 18px.
- **Body:** the page uses `body`; plan descriptions use `description`, capped at 66ch, increasing line height to 1.6 in phone detail. Metadata uses 12–16px according to its role.
- **Label:** form fields use `label`; filter labels use weight 500. Keep visible labels and sentence case. Desktop navigation is 16px; phone bottom navigation is 10px below icons.
- **Button:** prominent actions use `button`; selected navigation and availability use weight 650 where implemented.
- **Wordmark:** use `wordmark`, reducing to 29px in the phone header.

**The Two-Voice Rule.** Use Bricolage for headings and the wordmark; use Instrument Sans for actions, facts, labels and prose.

## Layout

Main content is centered at a maximum width of 1440px. Desktop side gutters are 48px, reducing to 32px at 1200px and 20px at 700px. The header is 80px tall on desktop and 66px on phone; above 1440px its interior can reach 1536px.

Explore retains the supplied invitation/search band, category strip, date filters and list/detail composition. Large desktop columns use a 0.91:1.09 ratio and 42px gap; at 1200px they become equal with a 28px gap; at 900px they use a 0.9:1.1 ratio and 20px gap. These measurements describe Explore, not every future surface. Filter results and the selected detail must agree.

At 700px and below, discovery becomes one column. A plan opens in a native, full-screen detail sheet. The action row is fixed at the bottom, includes safe-area padding and is bounded to 170px with overflow when needed; the detail reserves 190px below its content. Bottom navigation adds the safe-area inset to its 72px height. The floating List/Map switch sits above it at 90px plus that inset. Category and date strips can scroll horizontally; the page itself should fit the viewport.

Phone map mode hides the large invitation and retains search. Its map height is `calc(100dvh - 350px)` with a 380px minimum. The desktop map is 610px tall. The 360px breakpoint reduces gutters and row thumbnails further. Normal sheets use a 38rem maximum width and a 90dvh maximum height; at 640px they meet the bottom edge and may reach 94dvh. The plan sheet has its own wider desktop and full-screen phone treatment.

Spacing tokens record repeated steps rather than a compulsory universal grid. Use space to separate tasks and tight gaps to keep related facts together. My plans and venue discovery retain the same page gutters while accommodating their existing functional content.

## Elevation & Depth

White space, thin dividers and tonal selection provide most hierarchy. Ordinary plan rows and the main detail remain flat. Elevation identifies floating controls, map markers/previews, profile menus, modal sheets and temporary feedback. Exact shadows, backdrop values and motion are in the sidecar.

**The Floating Surface Rule.** Add elevation when a control or temporary surface sits above content; keep ordinary plan rows and content panels flat.

State feedback is brief: button colors transition over 150ms and marker scale over 180ms when reduced motion is not requested. The global reduced-motion rule reduces animation and transition durations. Leaflet fitting is unanimated. Do not infer the unused prototype dialog entrance animation as a requirement for the production Sheet component.

## Shapes

Use the existing gently rounded family: compact badges, fields, buttons, controls, rows, photography, maps and dialogs each have a measured role. Fields use `field`, primary actions use `button`, plan rows use `row`, and large photos/maps use their respective clipping radii. Circles represent faces, initials, icon controls and plan pins. The mobile view switch is a capsule.

Phone detail and map imagery reach the viewport edge without rounded outside corners. Production sheets use `dialog` corners, while the full-screen plan sheet removes them. Preserve these responsive exceptions. Lucide SVG icons supply the interface’s outline language; do not replace them with typographic glyphs.

## Components

### Buttons

Direct, berry primary actions use `button-primary` and a 48px minimum height. Their default width is intrinsic; join actions and explicit full-width controls fill their container. Secondary actions use the fine secondary stroke, berry text and at least 44px height. Post a plan retains the outlined header variant.

Enabled primary hover darkens the fill. Disabled primary actions use 0.8 opacity; prevent duplicate writes while busy. Pending join requests are presented as explanatory text plus Withdraw request, not as an accepted place. Cancelled and ended plans show Cancelled or Ended in the host/availability area instead of advertising open spots. Keep Share as a secondary action beside or below the primary join state.

Keyboard focus uses a 3px Rose Focus outline with 3px offset. Search uses a 2px focus-within outline with 2px offset. Icon-only actions require accessible labels and visible focus.

### Chips and filters

Date choices are rounded rectangles with berry/white inversion for selection. Phone date controls reduce to 38px minimum height. Categories are text tabs with a 3px active underline, not filled pills. Activity badges over photography are informational. Expanded production filters retain visible labels, semantic inputs and the quiet Rose Paper panel.

### Cards and plan rows

Plan rows are whole-row buttons with a portrait crop, title, time, venue, host initial and availability. Selection uses Soft Rose; hover uses Rose Mist. Desktop thumbnails are 112px wide; phone thumbnails are 91px, reducing again below 360px. Host and availability stay together at the bottom of the copy column and wrap when needed. Dividers separate rows; resting shadows are absent.

Plan detail opens with the supplied activity artwork, a save control and an explicit illustrative-image caption. Real host photos or initials appear with host information. Reuse the exact four supplied WebP files. Keep live Google venue photos separate and attributed; never imply activity artwork depicts a named venue or its participants.

### Inputs and fields

Search is an outlined white surface with search icon and optional clear action. It is 50px tall on desktop and 46px on phone. Forms use visible labels, fine strokes and gently rounded fields. Production `.field` controls use the `form-field` padding; filter controls have their existing local sizing. The join introduction remains an optional textarea with a 500-character limit and private-to-host explanation. Errors stay visible near the relevant action and provide recovery when available.

### Navigation

Desktop navigation uses icon/text pairs, berry active text and an underline. Phone navigation has four evenly distributed icon-over-label actions including Post a plan. The header retains the wordmark, Jaipur location and a real account/sign-in state. The List/Map switch is separate: light track on desktop, floating aubergine capsule on phone, white selected option in both.

### Jaipur map and plan preview

Leaflet displays OpenStreetMap tiles and host-stored coordinates. Circular category pins invert white/berry and scale to 1.15 when selected. The preview repeats the same plan artwork, title, time and available places, and opens details. Keep map attribution visible and preserve a useful list path when tiles fail. The map label describes meeting places from hosts; it does not claim independent location verification.

### Sheets and feedback

Production overlays use the shared native Sheet: accessible dialog naming, a Lucide close control, Escape dismissal, a tab loop, background scroll lock and focus restoration. Phone plan detail uses its own All plans back control. The join review contains actual plan context, optional introduction and a database-backed submit action. Toast/status feedback and request errors reflect real outcomes; loading and failure must not resemble successful submission.

## Do's and Don'ts

### Do:

- **Do** preserve the rose/aubergine palette and the Bricolage/Instrument Sans pairing.
- **Do** keep host, time, Jaipur meeting place and availability easy to scan together.
- **Do** reuse the four supplied WebP assets and identify activity artwork as illustrative.
- **Do** give phone layouts their own composition and clearance for fixed controls.
- **Do** distinguish selection, hover, focus, saving, pending requests and accepted membership.
- **Do** preserve OpenStreetMap and Google attribution beside the content they describe.

### Don't:

- **Don't** add resting shadows to every row or flatten the distinction between content and floating controls.
- **Don't** replace readable facts, action labels or Lucide icons with decorative glyphs.
- **Don't** stretch the desktop split view into a narrow phone viewport.
- **Don't** use illustrative artwork or generated portraits as evidence of a real venue or user.
- **Don't** present a saved bookmark or pending request as a reserved or accepted place.
- **Don't** refill empty production discovery with fictional plans or carry prototype-only success claims into real flows.
