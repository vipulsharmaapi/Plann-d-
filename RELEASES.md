# Website releases

Number each approved website release v.01, v.02, v.03 and onward. Preserve Git tags and archived artifacts. Figma design snapshots and deployed website versions are separate records.

## v.02

Implements the v.02 first-visit and joining flow from Figma file xnIljT9gfTgCZzFcuesGl8, page 141:730.

- Explore plans and Post a plan are the main homepage actions. Venue discovery is secondary.
- Three plan cards across desktop, compact cards on phones, real provider photos with attribution and a missing-photo fallback.
- Public plan detail page, protected request action and explicit pending state with View my plans.
- Existing filters, query parameters, Google Maps, posting drafts, profile photos and Supabase permissions retained.

Source tag: `v.02` after verification and deployment. The implementation receipt records the exact merge commit, bundle, checks and artifact checksums.

## v.01

Source tag: `v.01`. Commit: `7f2ded7d65149b4ad28e8a7cdcfd18716b68718a`.

Connected Figma redesign with compact Jaipur artwork, venue list/map, post venue picker and profile-photo recovery states. Saved before v.02 implementation.

## Rollback

Use the release tag to obtain the corresponding source, or the archived build package with the existing deployment configuration. Secrets are deliberately excluded. No database migration is part of v.02.

For the Git-connected Hostinger deployment, create a new branch from main and revert the v.02 merge commit with `git revert -m 1 <v.02-merge-commit>`. Run `npm ci` and `npm run check`, merge through the usual reviewed workflow, then verify the deployed bundle and health endpoint. Do not rewrite main or delete release tags. Keep both design packages intact.
