# Positive Percy V1.1 — FULL visual redesign (owner correction, 23 November 2026)

**Status:** New direction for owner review. **V1 is live: no production merge authorised.** Supersedes closed PR #68 (rings-only reskin).
**Tracking:** Issue #66.
**Prototype supplied to the owner in the Positive Percy conversation:** `Positive_Percy_V11_Full_Redesign_Concept.html` (interactive five-screen standalone design specimen; ask the owner to attach this exact file to Claude Code before coding).
**Reference:** The three earlier generated mobile concept images shared with the owner (Home / Children / Bigger Goal). They communicate visual ambition, not approved content or artwork.

## Why the first draft failed

It reused V1's exact hierarchy, white cards and layout, changing a bar into a ring. **That is explicitly rejected.** The replacement must produce a visibly new premium consumer experience while retaining the app's existing functionality. Do not submit another V1-like reskin or rely on a few decorative rings as evidence of redesign.

## Design principles: substantial, not cosmetic

- New page compositions with **expressive hero areas**, asymmetrical depth, layered cream, lilac, pastel-yellow and approved progress-green surfaces, editorial spacing, carefully balanced shadows, rounded artwork containers and delightful illustrations.
- **Large, prominent progress art** with three concentric rings on Home, not a mini ring buried in an otherwise unchanged card.
- **Richer reward art galleries**, playfully scaled asset icons, distinctive reward-selection cards, clean readable badges, intentional focus/hover states.
- Strong typographic hierarchy with approved Nunito 700/800 headings and Poppins 400/500/600 body text; modern product polish, not childish clutter.
- Accessible subtle transitions, reduced motion, empty-state quality and deliberate celebration moments.
- Keep the **locked Percy purple brand** (#4B1D8C), warm cream (#FFF6E8), orange (#FF6A00; decorative only when contrast fails), sunshine (#FFC938), ink (#271737), lilac (#E5DCEA); earned green (#2A6E33) for meaningful positive progress. Do not silently replace the brand with the generated mockups' generic green theme.
- **Only real, approved Fox 1A art** as mascot. Checked-in source: `public/brand/fox-1a-symbol-full.svg`, source provenance in `design/brand/RUNTIME_ASSETS.json`; fidelity approval still applies to new artwork. Fox face, tail direction and markings, proportions, colours, single yellow star and wordmark are immutable; no dog, hedgehog, generic fox, AI-manufactured logo or mirrored tail.
- New Fox poses and polished source vector illustrations are a separate art workstream. Do not ship generated concept art or unlicensed Streamline/Freepik assets.

## Screen architecture (all five screens are in scope)

### Home: action plus delight
- Compact Percy brand header and warm illustrated family greeting; authentic seated Percy may appear without modifying the original logo.
- Child selector as attractive, functional profile chips/cards with current weekly context, not fabricated photos.
- Parent Quick Points remain a **priority action**, immediately accessible after selection, with four expressive colour-coded tiles and actual licensed icon assets.
- A substantial **Your progress** hero with the three measured rings, layered illustrative surface, clear numeric legend and encouraging copy. This is the visual signature of the app.
- A streamlined Today's Goals checklist; complete/done behaviour, existing idempotency and Undo are untouched.
- Clear Available Percy Points display and one named bigger-goal/reward feature, without excessive repeated figures.
- Keep the already approved parent workflows; V1.1 can propose a new *presentation* order, but any functional ordering change must be owner-approved.

### Children: profile + progress management
- Dramatic, child-specific branded hero (not a copy of Home), editable identity and selected child.
- A polished three-measure progress overview sized for phones; daily routine, weekly points and named savings remain semantically distinct.
- Easy-to-find Edit weekly target, Manage goals, Manage savings and Manage rewards actions.
- Achievement/weekly milestone feature with progress language grounded in real data.
- Avoid duplicating Quick Points and completed checklist actions from Home.
- Any informational Child View remains a screen in the parent app. **No child authentication, account or independent device mode.**

### Activity: narrative timeline
- Contextual weekly summary in a visually distinct pastel surface.
- Clear timeline cards, badges for earned/redeemed/saved/undone, readable time and correct amounts.
- Filters and controls, with genuine accessible behaviour.
- No repeated first/second-line descriptions or false event labels.

### Rewards: curated illustration-led catalogue
- Strong friendly hero, visually recognisable art for weekly treats and bigger goals.
- Reward tiles have source-verified approved Streamline/Phosphor illustrations, legible cost and assignment visibility.
- Distinguish ordinary treat, asked-for reward and bigger goal. Preserve existing saving, affordability and parent-confirmed redemption semantics.
- Do not introduce real-money currency, new rewards or family-contributions functionality from the image-generation examples.

### Settings: calm, intentional controls
- Branded family panel, coherent grouped cards, strong heading hierarchy and discoverable actions.
- Real settings and planned features visually separated; no internal engineering gate wording as final product copy.
- Keep legal/privacy/user controls as implemented or explicitly staged; no new backend role model.

## Data and component contract

Use reusable React/CSS/SVG components built **from the real app**, never rasterised screenshot widgets:
- `PercyPageHero` (consistent illustration slots), `PercySpotlight`, `PercyQuickTile`, `PercyProgressRings`, `PercyProgressLegend`, `PercyPointsBalance`, `PercyGoalSpotlight`, `PercyRewardTile`, `PercyTimelineRow`, `PercySettingsRow`.
- Ring A: number of selected child's goals completed today / goals scheduled today.
- Ring B: `child.week_points` / `child.weekly_target`.
- Ring C: `child.goals[].saved` / the **same** goal's point cost.
- Visual fill clamps to 100%; visible numeric values remain accurate when progress exceeds target. Zero/missing target gives a neutral, non-percent empty state. Available points are a balance, not a ring. Multiple bigger goals must be labelled separately and not silently summed as one goal.
- Match actual server data and preserve award, Undo, correction, save, unmark, reassignment, delete confirmation, redeem and activity history invariants. No schema migrations should be necessary for this UI-only pass.
- Brand asset manifest, licence gates, points-star semantics and current navigation must stay intact.

## Implementation process

1. Open the **new full five-screen HTML prototype** from the conversation, NOT the earlier closed #68 specimen; use the three original inspirational images only for hierarchy, richness and look/feel.
2. Perform a source-based and code-level design critique. Produce a coherent screenshot pack at **320, 359, 360, 390, 834 and 1280px** for Home, Children, Activity, Rewards and Settings.
3. Review with owner: overall quality, amount/position of rings, new Home/Children distinction, typography, approved art fidelity. Do not presume this conceptual preview is already approved.
4. Build genuine reusable React components and route integrations on an isolated `v1.1` branch based on live production.
5. Use real API contract and representative data (zero goals, one/several children, long names, one/multiple bigger goals, no rewards, full and overtarget progress). Verify accessibility, visible labels, focus and touch.
6. Run lint, token checks, unit tests, Playwright/axe and build; preserve V1 data/ledger/accounting security invariants and reduced-motion behaviour. Capture before/after designs for every page.
7. Owner approves the final actual-app design and exact commit **before** merging. No new AI icons, generic fox substitutes or product features.

## Important handoff distinction

The provided interactive HTML is a **visual specification with synthetic interactions**. It is not a production React build, backend or complete fidelity proof. All new Fox poses need separate original editable source vectors and human fidelity review.

**Do not merge this documentation or any V1.1 code into the default branch without owner's explicit approval.**
