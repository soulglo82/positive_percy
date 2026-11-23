# Positive Percy V1.1 — P0 to P2 handback

| | |
|---|---|
| Version | 0.1.0 |
| Issued | 23 November 2026 |
| Owner | Percy V1.1 design engineering |
| Status | **Stopped for owner visual approval** (stop gates P1 and P2). No React work, no merge, no production change. |
| Brief | `docs/design/PERCY_V11_CLAUDE_CODE_EXECUTION_HANDOVER.md` |

## Summary

The design foundation is ready to review: a Fox 1A production board, one token file, ten components shown in every state, and a working Home and Children prototype built from those same files. The fox artwork is the limiting factor. The repository holds one pose, as a rough trace of a small screenshot; no pose or animation artwork exists, and none was invented here.

## A. Source inventory and Fox 1A fidelity gaps

Full record: `P0_SOURCE_INVENTORY.md`. The points that matter:

1. **There is no editable original.** The "master" is a three-shape, straight-line trace of a 341 × 435 px crop of the approved board. The crop has labels over the artwork and cuts off the paws. The board file itself and any illustrator file are not in the repository.
2. **The trace cannot be posed or animated limb by limb.** The body is one closed shape. Its edges are visibly faceted from about 144px.
3. **Shape fidelity is good; colour is not settled.** Face, muzzle, ears, proportions, tail and star match the board. The star is `#FFA600` (palette sunshine is `#FFC938`), inner areas are cream where the brief says white, and the orange is a gradient.
4. **The four stacked logo files are clipped**: the "y" in Percy is cut off at the bottom of the file.
5. **PR #71's prototype shows a 🦊 emoji, not Fox 1A**, although its notes say the real SVG is embedded.
6. **"Reward requests" is not a V1 feature.** V1 has parent-initiated redeem only, so the prototype does not include a request panel.

## B. Illustration and animation board

`review/fox1a-production-board.html`, driven by `fox1a/asset-manifest.json`.

- Logo set: 12 variants, shown unchanged.
- Fidelity: board against trace, whole figure and face, tail and star close-ups; 15-row checklist.
- Size tests: 48px, 96px and hero on cream, white and purple.
- Poses: 5 approved concepts and 6 proposals, each with a brief, an **empty** artwork slot and the seated master beside it. All 11 are marked NOT SHIP READY. Recommended from the proposals: waving, celebrating, pointing.
- Motion: 7 storyboards. Three play on the page using the unaltered master (peek, award response, idle). Four are blocked on artwork.
- Unapproved entries are flagged on every card.

## C. Typography, spacing and photo showcase

`review/component-showcase.html`.

- Nine type roles on the approved fonts; the page prints the size it measures. Smallest text needed to act: 14px. Action labels: 15px. 12px only for tab labels and overlines.
- Colour: locked palette plus five new background tints, with contrast ratios for each text pair in use.
- Spacing on an 8px cadence, three radii, three shadows.
- Photos: 72px selected / 52px others / 104px profile on phones (88 / 64 / 136px from 834px), up from 32 to 64px in V1. Initial fallback at the same size; failed photo falls back without moving the layout.
- Components: ChildAvatar, ChildSelector, QuickPointTile, TodayGoalRow, PercyProgressRings, BiggerGoalDestination, AchievementBanner, ManageAction, AppNavigation, PercyHeroSlot, each in its edge states.

## D. Home and Children concept, before and after

`review/home-children.html`; comparisons in `evidence/before-after-*.png`.

- **Home (do today):** child selector with large photos, an illustrated morning scene with the real Fox 1A, the points balance as a number, Quick Points, Today's Goals with Undo. No rings, no weekly dashboard, no savings controls.
- **Children (plan and understand):** profile with a 104px photo, a journey with three rings (today's goals, this week, one named bigger goal), achievements, and management entries. No Quick Points, no completion controls.
- Honest limits: data is synthetic; the scene shapes are code-drawn placeholders; the fox is the seated logo in every slot; children show initials because no authorised photos exist in the repository (the prototype and showcase let you load your own, locally).

## E. Tests and outstanding blockers

`node design/v11/qa/run-qa.mjs` — **515 of 515 checks pass** (`evidence/qa-report.json`).

| Covered | How |
|---|---|
| Six widths: 320, 359, 360, 390, 834, 1280 | Home and Children: no page overflow, nothing off-screen, no text under 14px, no clipped text, 44px targets, images loaded |
| Edge cases | 1, 2 and 6 children; long names; no goals; zero target; no bigger goal; 4-digit totals; failed photo |
| Larger text | Root text at 125%, 150% and 200% on 320 and 390px |
| Accessibility | axe WCAG 2.1 A and AA on every page; keyboard reaches and operates the selector; reduced motion stops Percy |
| Semantics | Balance and undo; goal complete and undo; over-target number unclamped with the arc full; zero target draws the neutral ring; Children has no action tiles; Home has no rings |
| Fox | Never mirrored; build fails if the Fox 1A file changes |
| Control | The same checks fail on PR #71's prototype (51 undersized text elements), which shows the checks can fail |

Not covered: real devices and Safari (Chromium only); screen-reader listening tests; the React app (not started); real photographs.

Repository checks after this work: `npm run lint` 0 errors; unit tests, token check and release-gate check results are stated in the session handback.

Blockers B1 to B6 are in `fox1a/asset-manifest.json`. None can be cleared by engineering.

## F. Branch and commit

Stated in the session handback, read from GitHub after the push. No pull request was opened and nothing was merged.

## Decisions needed from the owner

1. **Fox source.** Supply the designer's vector or the full-resolution board, or approve commissioning a clean layered redraw of the seated fox.
2. **Fox colours.** Star `#FFA600` or `#FFC938`; inner areas white or cream.
3. **Poses.** Send the five approved concepts to an illustrator; pick from the six proposals.
4. **Interim motion.** Approve the three master-only motions for use until pose art exists.
5. **Type, spacing and photo sizes** as shown in the showcase, including 12px tab labels.
6. **Home and Children direction** as shown in the prototype, including the five new background tints and the placeholder scene shapes.
7. **Photos for review.** Provide authorised child photos if you want them in the screenshots.
8. **Reward requests.** Confirm it stays out, or raise it as a separate feature.

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-11-23 | First issue |
