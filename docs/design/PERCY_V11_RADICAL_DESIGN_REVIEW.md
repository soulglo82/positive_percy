# Positive Percy V1.1 — Radical visual directions (23 November 2026)

**DESIGN CONCEPT — NOT IMPLEMENTED AND NOT APPROVED FOR PRODUCTION**

This replaces the rejected #68 ring-swapped reskin and the insufficient #69 five-screen card redesign. The original user-provided AI concept art was compelling because of **an immersive illustrated world, expressive typography, an oversized focal progress visual, delightful colour, layered illustration, and a rich sense of achievement**. Keeping V1's five cards and adding round progress bars does not meet that brief.

## Preview

- Interactive offline HTML: `design/previews/percy-v11-radical-two-directions.html`
- [Review in ChatGPT](https://chatgpt.com/space/page_3f85ba5d24a88191bbc3c182cf31e851)
- A/B toggle: **Adventure World** versus **Progress Studio**
- Home / Children toggle, selected child, synthetic Quick Points and Today Goal interactions, viewport 320/390/834/1280.
- The HTML includes original `public/brand/fox-1a-symbol-full.svg`, five approved Phosphor sources and four Nunito/Poppins WOFF2 files inline. No network requests for assets. This is not a React implementation.

## Option A — Adventure World

Product concept: a **story-like journey**, rather than a household admin dashboard.

1. Full-bleed landscape hero, giant three-ring progress world, Percy in the scenery, today's checkpoint.
2. Small child selector integrated with the header, not another card.
3. Quick Points become four illustrated tactile badges, plus a persistent parent award action.
4. Today's Goals become a readable quest trail with meaningful Done/Complete actions.
5. Bigger goals become illustrated destinations, not a nested savings card.
6. Children gets a full-bleed child-specific story and a distinct three-part journey map.

## Option B — Progress Studio

Product concept: a bold, typographic, premium consumer app.

1. Full-bleed violet/ink editorial masthead and oversized rings; not a standard white card.
2. Oversized headline and figure-led design; data legible and grounded in the existing V1 point system.
3. Quick Points become an expressive two-column colour field with authentic icons, rather than a card of buttons.
4. Today's Goals and points become editorial rows, with minimal separators rather than card stacks.
5. Children features a strong child identity hero, a three-part progress readout and a deliberately simple management zone.

## Exact feature and data boundaries

- **Parent/carer-operated only.** No child accounts, login, independent device view, new authorisation roles or new backend features.
- Retain the existing five navigation destinations and all award, Undo, correction, savings, expiry, assignment, reward, redemption and ledger invariants.
- Weekly ring = `child.week_points` / `child.weekly_target`; daily ring = completed/scheduled Today's Goals; savings ring = saved points / cost of **the same named goal**.
- Actual numbers are displayed independently of ring visual percentage, which clamps to 0–100%. No denominator = neutral ring (no fake percentage).
- Never introduce dollars/pounds, family pooled currency, child self-spending, or fabricated behaviour goals from the earlier AI illustration.
- Original Fox 1A's facial identity, single star, original orange and cream colours, tail **direction and white marking** are immutable. New poses must be original editable, source-faithful vectors and separately approved; generated images are mood-board references only.
- Preserve V1's approved purple/cream/orange identity, Nunito/Poppins typography, licence and accessibility rules; deliberately explore an ambitious composition while reusing these actual assets.

## Acceptance sequence

1. Owner chooses A, B, or a documented hybrid based on the original generated references, **without approving implementation of the other direction**.
2. Complete responsive, visual and semantic critique of the chosen design at 320,359,360,390,834,1280.
3. Translate into **real** responsive React UI components on a separate V1.1 branch and use the V1 APIs / business logic unchanged.
4. Develop Fox 1A illustration pose pack from the approved source, with exact identity, provenance and licensing.
5. Apply to Activity, Rewards and Settings in the same agreed system, then QA and sign off the complete V1.1.
6. Do not merge, deploy or alter production without separate explicit owner approval.

**Current QA:** A/B × Home/Children at six widths = 24 layout checks (no horizontal overflow, no button beyond container, one active screen). Child switching and award preview verified. These checks use synthetic HTML and do not replace code, browser accessibility or ledger regression tests for real V1.1 React implementation.
