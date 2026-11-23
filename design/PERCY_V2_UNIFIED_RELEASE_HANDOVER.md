# Positive Percy — unified v2 redesign + Today's Goals implementation gate

**Source of truth:** 11 November 2026 Positive Percy Brand Identity Board / Fox 1A selection, STYLE_GUIDE.md, and the *later* icon-fidelity brief (Phosphor navigation and categories; optional licensed Streamline Plump rewards). The current merged Batch D Figtree/Fredoka/burnt-orange style is **not** the v2 redesign.

## Owner-facing mockups

13 HTML prototypes are staged at `design/previews/percy-v2-full-review.html` on this branch, paired with a screen-by-screen image review in the project conversation. They are design proposals, not a claim of pixel-perfect production readiness.

1. Home / family dashboard: 1A identity, weekly earned total, child choice, visible compact Today’s Goals, quick positive actions.
2. Children / Progress: child balance, weekly progress, reward saving and parent-operated spend.
3. Today’s Goals: child-specific family-local checklist; parent-operated; no sixth tab.
4. Activity: weekly numbers and auditable entries, earned/redeemed treatments.
5. Rewards: visible-first catalogue, one coherent reward icon language.
6. Settings: behaviour categories, quick-action configuration, children, privacy and grown-ups.
7. Reward create/edit: named, accessible icon picker with non-destructive legacy mapping.
8. Manage goals: active one-off and weekly routines, edit/archive, preserve history.
9. Goal create/edit: existing linked behaviour points; weekly days, future start, one-off dates.
10. Add points: positive-only awards, optional notes, existing Undo and idempotent ledger.
11. Save/spend: queued choices with final parent confirmation; no automatic deduction on selection.
12. Shared carers: design-only invitation/access view, backend and authorisation still required.
13. Onboarding: first-run brand treatment with simple steps.

## Non-negotiable styling

- **Brand:** approved sleek seated Fox 1A with one star, custom purple wordmark. The *temporary vector silhouette in the HTML prototype is an explicit concept placeholder*, not the accepted master vector. Obtain the **actual outlined vector and wordmark master** and integrate unchanged. The prior merged fox-with-foliage logo is not the new identity.
- **Colours:** Percy purple #4B1D8C, orange #FF6A00, sunshine #FFC938, warm cream #FFF6E8, ink #271737, fine lilac #E5DCEA. White text on vivid orange fails normal text contrast. Purple primary buttons with white text.
- **Fonts:** Nunito 700/800 headings; Poppins 400/500/600 text. Self-host subsets and OFL notices before production. The standalone HTML uses web fonts if online and local fallbacks if offline.
- **Icon set:** the later icon-fidelity brief supersedes the generic Lucide recommendation in the earlier style kit. Use **official @phosphor-icons/react** (regular inactive, accessible tested active variant) for navigation, behaviours and generic UI. Icons rendered in the preview are inline verified Phosphor SVG paths, not generated icon approximations. The points star remains brand-specific.
- **Reward icons:** Streamline Plump requires correct licensed actual assets and **written picker permission** before the app lets families select them. Until then, Phosphor Duotone is the legal/engineering fallback; never fabricate Streamline art or drop existing reward emoji data.
- **Navigation:** keep existing five destinations (Home / Children / Activity / Rewards / Settings) until item #6 navigation sign-off; Today's Goals is not independently operable by children. No new child account, currency, deductions, retrospective awards or parent/child permissions by styling alone.

## Engineering release strategy

**One coordinated v2 production release**, not an intermediate launch of old-look Today's Goals:

- Draft **PR #45**: the goals backend and migration (passed CI, independent review still needed).
- Draft **PR #46**: functional parent Goals UI implemented against the old design (passed CI, **DESIGN HOLD**).
- **This branch** stacks on PR #46 and stages the *entire* visual migration as one cohesive release. It is **not finished implementation** merely because mockups and CI for earlier PRs exist.
- Implement atomic shared token migration across `src/index.css`, `src/lib/tokens.js`, Tailwind and token/contrast tests; self-host Nunito/Poppins; install real Phosphor package; migrate nav and icon registries with server/client key parity; preserve reward legacy data; apply the same design primitives across every route and dialog; integrate goals from PR #46 into new dashboard hierarchy.
- Shared carers require separate server-enforced identity, invite and permission tests before marked ready. Mockup does not imply that feature exists.
- Preserve the original DB/ledger invariants and undo policies. Do not enable legal/privacy account deletion or backup purge flags as a consequence of styling.

## Release blockers / acceptance

1. Actual final **Fox 1A outlined SVG + wordmark** supplied/validated (a preview PNG crop is not the master).
2. Owner approval of all rendered layouts **at 390, 834 and 1280 px**, with 1/2/3/6 children, long names, zero/many rewards, empty and complete daily goals.
3. Asset licence review for selectable Streamline icons; otherwise Phosphor fallback explicitly approved.
4. Working implementation with full navigation/routes and authenticated points, rewards, export and goals flows; tests for idempotency, simultaneous taps, multiple carers and timezones.
5. `npm run lint`, `npm run build`, `npm run check:tokens`, Vitest/DB tests, Playwright + axe and manual iPhone/Safari smoke checks all pass.
6. Independent code/privacy/security review and **explicit owner visual approval** before merge/deploy.

**Do not describe this branch as production-ready until the above are complete.**
