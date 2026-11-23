# Positive Percy V1.1 — P3 handback: Home and Children in React

| | |
|---|---|
| Version | 0.1.0 |
| Issued | 23 November 2026 |
| Owner | Percy V1.1 design engineering |
| Status | **Draft PR for owner review. Not merged, not deployed.** Production V1 is untouched. |
| Direction | Owner review of 23 November 2026 (P3 go-ahead with conditions 1 to 9) |
| Builds on | `design/v11/HANDBACK.md` (P0 to P2, commit `7bd07d7`) |

## 1. What changed

Home and Children in the real app now use the V1.1 design system, on V1's own data and business logic. Activity, Rewards and Settings, the header and the tab bar are unchanged.

| Area | Files |
|---|---|
| Tokens | `src/index.css` (`:root`: six scene tints and the V1.1 roles, sizes and type, all built from existing tokens), `src/lib/tokens.js` (the six tints) |
| Styles | `src/styles/percy-v11.css`, scoped to `.pv` so other tabs are unaffected; passes `scripts/check-tokens.mjs` |
| Parts | `src/components/percy/parts.jsx` (avatar, child selector, fox slot, progress ring, journey stop, scene shapes), `src/components/percy/HomeV11.jsx` |
| Home | `src/pages/ParentDashboard.jsx` (render only; every query, the award lock, streak, confetti, Undo toast and dialog is as before) |
| Today's Goals | `src/components/dashboard/TodaysGoalsPanel.jsx` (markup only; completion, focus, Undo toast and Manage goals unchanged) |
| Children | `src/pages/Children.jsx` (render, plus the plain today's-goals query for the Today ring) |

## 2. Owner conditions

| # | Condition | Done how |
|---|---|---|
| 1 | Typography, spacing, photo sizes as baseline | The P2 tokens, moved into `index.css`. Photo sizes 72 / 52 / 104px on phones, 88 / 64 / 136px from 834px |
| 2 | Keep both tabs, distinct jobs | Home: balance, Quick Points, Today's Goals, working towards. Children: profile, Manage, journey, savings, goals, treats, achievements. No Quick Points or completion on Children; no rings on Home (QA checks both) |
| 3 | Quick Points sooner; Children management easier to reach | Home hero is about 400px tall on a 390px phone (the prototype's was about 640px): Quick Points start about 500px down at 390 × 844, with the first tiles above the fold. Children: a Manage grid (weekly target, all goals, savings, rewards) sits straight under the profile, before the journey |
| 4 | Real integration, V1 logic preserved | Same queries, mutations, dialogs and server calls. Interactions are checked against a real local server (section 5) |
| 5 | Seated Fox 1A as placeholder only | Every pose key (`waving`, `walking`) resolves to the unaltered seated file; a unit test checks it. No generated mascots |
| 6 | Commissioning brief | `design/v11/fox1a/COMMISSIONING_BRIEF.md` |
| 7 | Keep the mascot's own colours | The fox is shown from its file; no recolouring. Colour questions are listed in the brief for the owner |
| 8 | New draft PR; leave #71 alone | Draft PR from `claude/percy-v11-redesign-handover-3hjlyc`; #71 and its branch untouched |
| 9 | Independent critique | See section 6. Codex itself is not available in this environment; an independent fresh-context review ran instead and is labelled as such |

## 3. Deviations from the P2 prototype, and why

1. **Goal rows keep V1's "Complete" button and "Done" mark** instead of the prototype's round checkbox and per-row Undo. The repo's tests and e2e journeys rely on the visible "Complete" name and on focus moving to "Done"; Undo stays in the toast, as in V1.
2. **Overlines are sentence case with no letter-spacing.** The showcase used uppercase with tracking, which the repo's copy rules forbid.
3. **The reached week reads "0 to reach this week's target"** (approved V1 E3 wording), not the prototype's "Target reached, 4 extra". The ring turns full and green, and the figure shows 35 of 30.
4. **Savings keep the approved wording "{saved} of {cost} points saved"** on one line, rather than a large number beside a fragment.
5. **The Today ring counts only goals scheduled today.** Children's existing list (`?manage=true`) returns every goal, which would have been the wrong denominator; the page now also reads the plain today list (the same query Home uses).
6. **Treats on Children are drawn in V1.1 rows** with the V1 tile's content (icon, title, points, visibility, Edit). The V1 `RewardTile` had 40px Edit buttons on non-touch screens and its tag overflowed at 200% text. `RewardTile` itself is unchanged, so the Rewards tab is unaffected.
7. **Header and tab bar stay V1.** The V1.1 navigation waits for the other tabs.

## 4. New or changed wording (for owner approval)

| Where | Text | Was |
|---|---|---|
| Home headline | What went well for {name} today? | Welcome back! / Good things are happening, one small step at a time. |
| Home balance label | Available now · {n} points | Little wins, big adventures! … Available now |
| Children page | {name} (profile heading); "Children" kept as the page title for screen readers | Children / See what every child has achieved… / {name}'s page |
| Children profile | {n} points available now | (in the weekly-target card) |
| Children Manage | Weekly target · {n} points a week / Not set; All goals · {n} goals; Saving for something bigger · {n} points saved / Nothing saved yet / Mark a reward as a bigger goal; Rewards · Treats and bigger goals | Edit buttons inside each card |
| Children journey | {name}'s journey · Today, this week, and the bigger goal.; Today's goals · {d} of {n} done · {k} to go / All done today / No goals scheduled today; This week · {w} of {t} points; No weekly target set yet; Bigger goal | {name}'s weekly target card |
| Children goals | No goals yet. | (nothing shown) |

Approved V1 strings kept: Quick Points and its subtitle, Award points, Rewards, Today's Goals, {name}'s checklist, {d} of {n} done, Complete, Done, Manage goals, No goals scheduled for {name} today, Set up goals, What you're working towards, Saving for something bigger, {saved} of {cost} points saved, {n} to go, Saved!, Ready when a parent agrees, View all goals and rewards, View as child, {n} to reach this week's target, Weekly treats to choose from, All rewards, Visible to children, Hidden from children, Achievements, Goals completed, Recognise effort over time, {n} today, Next milestone, Weekly target and bigger goal.

## 5. Tests

Results with exact counts are in section 7 and the session handback.

- **Unit:** `src/components/percy/PercyV11.test.jsx` (new, 17 tests: ring clamp, neutral ring with its counter-examples, photo fallback, child colour, selector, fox resolution, balance, tile names, disabled while saving, empty states). `src/pages/V1Children.test.jsx`: 4 tests changed where wording or markup changed on purpose (see 5a). Every other test is unchanged.
- **App QA on the real React pages** (`design/v11/qa/run-app-qa.mjs`, local server, fictional seeded families): six widths (320, 359, 360, 390, 834, 1280); six children with a long name; one child with nothing set up; 150% and 200% text; axe WCAG 2.1 A and AA inside the page; 44px targets; no text under 14px; nothing clipped or squeezed; real award, Undo, goal completion, focus to Done, child switching, and every dialog opening. Two control checks prove the target and type checks can fail.
- **Repo suites:** `npm test`, `npm run lint`, `npm run check:tokens`, `npm run check:release-gates`, and the Playwright e2e suite at 320, 390 touch, 834 touch and 1280.

### 5a. Test changes in `src/pages/V1Children.test.jsx`

| Test | Change | Kept |
|---|---|---|
| 1 available point is singular | Reads the figure under the name | "1 point" singular |
| approved copy and server figures | Heading "Lara" (level 2) and the screen-reader page title "Children"; profile shows initial and points; week stop figure; ring arc instead of bar width; achievement banners instead of plain rows | Every figure, "7 to reach this week's target", progressbar name, value text and values, no "7 weekly points to go" text, savings empty state, milestone subtitle |
| E3 target reached | Ring arc full (offset 0) instead of bar width 100% | "0 to reach…", valuenow 25 of 25; adds the unclamped "30 of 25 points" |
| ?child= picks the child | Heading "Omar"/"Lara" | Same behaviour |

## 6. Independent review

Findings and how each was handled are in section 8.

## 7. Results

Filled in at commit time.

## 8. Review findings and outcomes

Filled in at commit time.

## 9. Remaining blockers

- Fox artwork B1 to B6 (`design/v11/fox1a/asset-manifest.json`): no layered master, no pose art, colour questions, clipped stacked logos. Owner action: commission per the brief.
- Owner approval of the wording in section 4.
- Real-device check of the 12px tab labels (V1 tab bar, unchanged here).
- Safari / iOS check (`:has()` is used for the Manage card focus ring; supported from Safari 15.4).

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-11-23 | First issue |
