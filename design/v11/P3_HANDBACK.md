# Positive Percy V1.1 — P3 handback: Home and Children in React

| | |
|---|---|
| Version | 0.3.0 |
| Issued | 23 November 2026 (revised 24 November) |
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
8. **The child selector wraps instead of scrolling sideways.** The repo forbids anything that scrolls sideways (`e2e/checks.js`). A family of six wraps onto more rows; nothing shrinks.
9. **Quick Point tiles use a 40px icon and 12px padding**, so a "+1000" badge fits beside the icon on the narrowest two-across tile (138px at 320px wide).

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

### 5b. Test changes in the e2e suite

| Spec | Change | Why |
|---|---|---|
| `e2e/ui.spec.js` "home, its dialogs and the Undo toast" | The V1 Home layout checks ("Welcome back!", the Little wins card, two-card columns from 22 Nov) replaced by the V1.1 contract: picker and balance in the hero, then Quick Points, Today's Goals, Working towards; Quick Points on the first screen; no rings on Home; column placement. Child chosen by name | Your direction of 23 Nov replaces the V1 Home layout. The dialog, request, Award, Undo, Manage goals, sign-out and onboarding checks are unchanged |
| `e2e/batch-e-goals.spec.js` (2 tests) | Picks Sam by name in the child picker, not by "Sam 0 / 30 this week" | The V1.1 picker names the child only; week figures are on Children |
| `e2e/v1-journeys.spec.js` | Children heading is the child's name, not "{name}'s page" | Profile heading |

The repo's own layout checks (`e2e/checks.js`: sideways scroll, text under 12px, clipped text, even tiles, 44px targets) are unchanged and pass. Two fixes came from them: the Quick Point tile parts and names now meet the even-tile contract, and the Manage labels are 44px targets in themselves.

### 5a. Test changes in `src/pages/V1Children.test.jsx`

| Test | Change | Kept |
|---|---|---|
| 1 available point is singular | Reads the figure under the name | "1 point" singular |
| approved copy and server figures | Heading "Lara" (level 2) and the screen-reader page title "Children"; profile shows initial and points; week stop figure; ring arc instead of bar width; achievement banners instead of plain rows | Every figure, "7 to reach this week's target", progressbar name, value text and values, no "7 weekly points to go" text, savings empty state, milestone subtitle |
| E3 target reached | Ring arc full (offset 0) instead of bar width 100% | "0 to reach…", valuenow 25 of 25; adds the unclamped "30 of 25 points" |
| ?child= picks the child | Heading "Omar"/"Lara" | Same behaviour |

## 6. Independent review

Findings and how each was handled are in section 8.

## 7. Results (final build)

| Check | Result |
|---|---|
| `npm test` | 780 passed, 294 skipped (33 files passed, 21 skipped; the same skipped files as before this work) |
| `npm run lint` | 0 errors, 3 warnings (pre-existing, in files this work does not touch) |
| `npm run check:tokens` | Tokens OK (89 files) |
| `npm run check:release-gates` | No gated file in dist/ or public/ |
| Playwright e2e, 4 projects (320, 390 touch, 834 touch, 1280), local Postgres | 56 passed, 0 failed, 16 skipped (the suite's own per-project skips) |
| App QA (`design/v11/qa/run-app-qa.mjs`) | 241 of 241 (`design/v11/evidence/app-qa-report.json`), including two control checks that must fail |
| Design QA on the review pages (`design/v11/qa/run-qa.mjs`) | 515 of 515 at `7bd07d7`; not rerun (the pages did not change) |

Not covered: Safari and real devices, screen-reader listening, production data, real child photos (none were used).

## 8. Review findings and outcomes

Independent fresh-context review (read-only, given the code and screenshots, not this report). It found the V1 logic intact: award lock and idempotence, confetti, Undo toasts, completion flow and focus, savings dialog focus return, reward editing, Edit child without delete, Manage goals, query keys and realtime refresh, approved icon ids, no tracking or uppercase, 44px targets, reduced motion, label-in-name.

| # | Finding | Outcome |
|---|---|---|
| 1 | **Blocking:** with no weekly target, the week figure vanished on Children | **Fixed.** The figure always shows ("12 points"), with no "of 0"; Children test and a component test added (both fail without the fix) |
| 2 | **Blocking:** savings and a11y tests still exercised the old Home components, which Home no longer renders | **Fixed.** New tests for the funded-goal celebration ("{name} has saved enough for {goal}!"), the chosen-reward lines, the empty state's Child View link, and an axe test of the V1.1 Home sections and parts. The old components stay (V1 `FamilyStrip` is still used by the dialogs) until the Activity, Rewards and Settings rollout retires them |
| 3 | The new today query had no loading or error state; "No goals yet." was new copy | **Fixed.** The Today stop reads "Loading…" or "Couldn't load today's goals"; the goals list shows loading or error and nothing when empty (as V1); the Manage card says "Loading…" or "Not loaded" until known |
| 4 | With no target, the week ring announced "0 weekly points to go" | **Fixed.** The ring is a progressbar only when there is a target |
| 5 | Home dropped some V1 copy, the week figure, the Today's Goals sparkle, and the Child View link for a child with nothing chosen; Award points became secondary | **Partly fixed.** Sparkle restored (E03 accent). The Child View link always shows. The copy and the missing Home week figure are deliberate under the agreed Home/Children split and are listed for approval in section 4. Award points is secondary because the tiles are the main action |
| 6 | Children dropped V1 copy | Deliberate; listed in section 4 |
| 7 | Green "earned" text on the meadow is about 4.4:1 | **Fixed.** On the meadow it is ink (the ring stays green) |
| 8 | The bigger goal was chosen from two sources, so different parts could name different goals | **Fixed.** One source (`goalRows[0]`, the current bigger goals in savings order) for the journey, the Manage card and Achievements. Bar on Home against ring on Children stays: Home has no rings by design |
| 9 | Several links to Rewards when there are no bigger goals | Kept: each is in a different context (Manage, savings empty state, treats). Recorded for owner review |
| 10 | Home's dialogs still use the V1 child picker | Deliberate (dialogs are outside this step). Recorded for the rollout |
| 11 | Treat rows copy `RewardTile`; goal progress drawn three ways; `pointsWord` redefined | `pointsWord` now imported. Treat rows kept separate so the Rewards tab is untouched (its tile has 40px buttons on non-touch screens and a tag that overflows at 200% text); to be merged when Rewards is redesigned |
| 12 | Unused and override CSS, unused tokens, stale comment | **Fixed.** Unused rules and six unused tokens removed; panel comment corrected. Two override blocks remain at the end of the stylesheet, commented |
| 13 | Manage card focus depended on `:has()` | **Fixed.** The card ring is used only where `:has()` is supported; elsewhere the label keeps its own focus ring |
| Nits | Type role use, tile colours by position, desktop empty space under Quick Points, clouds clipped behind the selector, selector inside the profile section, lilac borders, Done chip styled like a button | Clouds removed; journey "Saving for something bigger" heading now uses the stop-label style. The rest are recorded for the next visual pass |

## 9. Remaining blockers and known edges

- Fox artwork B1 to B6 (`design/v11/fox1a/asset-manifest.json`): no layered master, no pose art, colour questions, clipped stacked logos. Owner action: commission per the brief.
- Owner approval of the wording in section 4.
- Real-device check of the 12px tab labels (V1 tab bar, unchanged here).
- Safari / iOS check (`:has()` draws the Manage card focus ring where supported; elsewhere the label's own ring shows).
- A very long single first name (e.g. "Alexandra-Josephine Montgomery-Wellington") breaks mid-word in the 32px Home headline at 320px. It is readable; recorded for the next visual pass.
- Home at 1280px leaves space under Quick Points (review nit); the "before" screenshots use a different sample family from the "after" ones.

## 10. Validation round, 24 November

### 10a. Production moved on: merged, not overwritten

After PR #72 was opened, the owner approved and merged #73 and #74 into the base branch, and so into production. They change the very Quick Points card this PR replaces: the line "Tap a box to give its points straight away.", "Custom points" (soft orange) beside "Rewards" (soft purple) with neither solid, slimmer boxes, and a compact Give Percy Points form. As opened, PR #72 would have undone the wording and buttons.

The base was merged into this branch (a merge commit; no rebase or force-push). Then:

| Owner decision of 24 Nov (V1-F §10–11) | In V1.1 Home |
|---|---|
| "Tap a box to give its points straight away." (only when there are boxes) | Kept, exact |
| "Custom points" (soft orange) beside "Rewards" (soft purple), neither solid | Kept, exact, under Quick Points; Rewards moved out of the hero to sit beside it. The tokens are the owner's (`--warm-soft`, `--warm-ink`) |
| Compact Give Percy Points form | Unchanged; it comes from the base branch |
| Slimmer boxes, one row (icon, name, +N) from 375px | One row from 834px. On phones a compact two-row box (at most 80px; it was about 100px), see 10b |

### 10b. A decision for the owner: 12px or 15px names on phones

V1's one-row phone boxes fit names such as "Helpfulness" and "Adventurous" between 375 and 833px only at 12px. The V1.1 baseline (reaffirmed 24 Nov) keeps action labels at 15px and nothing interactive under 14px. Both cannot hold at once in two columns. This branch keeps V1.1 type: phone boxes are two rows (icon and +N, then the name), every default name stays on one line with at least 7px to spare (tested at 320, 360, 375, 390 and 414px), and from 834px boxes are one row. **If you prefer V1's one-row 12px phone boxes, say so and they will be used instead.**

### 10c. Test changes in this round

| Test | Change |
|---|---|
| `e2e/ui.spec.js` Home journey | Kept the owner's wording checks from #74 ("Tap a box…", no "Award points"); the V1 box measurements (height 44/46px, 12px names, 14px icons) replaced by the V1.1 contract (names ≥14px, boxes ≥44px, one row from 834px, compact two rows on phones); "Custom points" is in the Quick Points section |
| `e2e/ui.spec.js` slim boxes at 320–414px | Home part: one line, ≥7px to spare, ≤80px, at every width. The form part (V1 component) unchanged |
| `design/v11/qa/run-app-qa.mjs` | Opens the form with "Custom points" |

### 10d. For final acceptance (owner, 24 Nov)

- **A very long name at 320px:** "Alexandra-Josephine Montgomery-Wellington" breaks mid-word in the 32px Home headline. Readable, not yet acceptable; needs a design answer (for example, a smaller headline step for long names).
- **No real-photo visual test yet:** every screenshot shows initials. The photo path, sizes, crop and fallback are built and unit-tested with test cards, but nobody has looked at real child photos in the screens. Needs authorised photos on the owner's device (they are never committed), or a one-off local review.
### 10e. Codex review

Requested on PR #72 ("@codex review") at `71759da`; completed 24 Nov 07:07 UTC. This is the Codex review; the fresh-context review in section 8 was not.

| Finding | Severity | Verified | Outcome |
|---|---|---|---|
| Today's Goals progress dots do not wrap: 20 goals need 316px against 288px at 320px, so the page scrolls sideways (sooner with larger text) | P2 | **Yes.** Reproduced on a local server: 12px of sideways scroll at 320px with 20 goals; 344px at 200% text | **Fixed.** The dot strip and the header items wrap within the width; "n of m done" stays the figure. App QA now seeds a child with 20 goals and checks 320px at 100% and 200% text; those checks failed on the unfixed build and pass on the fix |

### 10f. App QA control made deterministic

While verifying this round, the control that injects 10px Quick Point labels once reported nothing small: the injected style had not taken effect when the check ran, so the check passed without testing anything. The cause was not found. The control now waits until the labels really are 10px, and a separate harness check fails if the style never takes, so it cannot silently pass again. Two consecutive runs: 246 of 246.

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-11-23 | First issue |
| 0.3.0 | 2026-11-24 | Codex review (10e); deterministic QA control (10f) |
| 0.2.0 | 2026-11-24 | Section 10: base merged (#73, #74); 24 Nov Quick Points decisions in V1.1; 12px/15px decision; final-acceptance items |
