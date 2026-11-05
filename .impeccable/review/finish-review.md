## verdict

1. **Resolved — filtered selection.** `Explore.tsx` resolves the active list detail from `filtered`, and filter writes clear the stale `p` parameter; `App.tsx` does the same for activity changes. The previously inspected, valid `filter-sports.png` shows the matching badminton result/detail, and `filter-empty.png` shows zero results without stale coffee details. The parent reports the regression test passing; this reviewer did not execute the browser or test suite.
2. **Resolved — production documentation.** Production `PRODUCT.md`, token-bearing `DESIGN.md` and parseable `.impeccable/design.json` now exist. The product document records the real Supabase flows, private saved plans and introductions, retained backend journeys, fixture-only QA, illustrative-artwork boundaries, actual venue-photo separation and the pinned prototype authority. The design document retains the supplied fonts, palette and component tokens. This closes the original persistence gate.
3. **Resolved — icon-system consistency.** `App.tsx` imports and renders Lucide `X` for notice dismissal instead of the Unicode glyph. Resolution is source-verified; that notice state was not recaptured.

## remaining

Clear. No regression is visible in the two filter recaptures. The additional narrow source check confirms `PlanContext.tsx` prioritizes Cancelled/Ended before remaining places; that state was not independently rendered here. Original desktop/mobile captures were unchanged by these non-layout fixes. Backend/RLS results, email delivery, complete authenticated journeys and uncaptured states remain outside this independent file review. Ship covers the scored fixes, not the whole surface.

disposition: ship
