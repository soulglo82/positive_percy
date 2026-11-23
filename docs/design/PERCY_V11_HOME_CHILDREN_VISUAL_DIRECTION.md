# Positive Percy V1.1 — Home & Children visual direction

**Status:** Isolated design exploration; no production change, merge or deployment authorised.
**Preview:** design/previews/percy-v11-home-children-exploration.html
**Source:** approved V1 product decisions, Fox 1A asset system and issue #66.

## Principles
- Preserve parent/carer-only operation, the existing five-tab navigation and all V1 business logic.
- Home is the action screen: family welcome and child picker; Quick Points; Today's Goals; weekly/available balances; bigger-goal savings.
- Children is the configuration/progress screen: child profile, edit weekly target, goals, rewards and savings, without repeating Home's action cards.
- Keep the real checked-in Fox 1A and preserve its original face, proportions, tail direction and white tail marking. The original logo and wordmark do not change.
- Never ship generated dog/hedgehog/fox concept art. New Percy poses require source-faithful editable vectors and owner approval.
- Retain approved identity: purple #4B1D8C, orange #FF6A00, sunshine #FFC938, warm cream #FFF6E8, ink #271737, lilac #E5DCEA; earned green #2A6E33 for progress.
- Nunito for display and Poppins for body, with existing licensed Phosphor and Streamline source assets.

## Code-rendered activity-style rings (not artwork)
| Ring | Value | Target | Meaning |
| --- | --- | --- | --- |
| Today's Goals | Number completed today | Number scheduled today | Completion count, not points |
| Weekly target | child.week_points | child.weekly_target | Points earned this week, not available points |
| Bigger goal | named child.goals[].saved | The same goal's cost | Saved Percy Points, not a family pool |

Render visual stroke at min(100%, actual progress), keeping exact uncapped numbers in visible labels. If target is zero/missing, render neutral empty state ('No target set' or 'No goals scheduled'), not a spurious percentage. Multiple bigger goals remain separate. Available points are a spendable balance, not a ring.

Use reusable SVG/React components, not baked images. The arcs are aria-hidden with adjacent complete readable numerical labels. Maintain 44px controls, visible focus, contrast, screen-reader names, text wrapping, and reduced-motion behaviour. Ring colours must have textual labels.

## Initial preview
The interactive preview switches between Home and Children, selects a child and demonstrates synthetic award/goal interactions; it performs NO API requests or persistent writes. Source paths refer to actual repository SVG and font files. To view the complete artwork, open the HTML within a checked-out repository, rather than downloading the HTML alone. Test widths at 320, 390, 834 and 1280px using the preview toolbar.

This is a design specimen, not a React implementation or a claim of live data parity. Do not merge it into the V1 production branch.

## Fox 1A illustration work
Explore 3 separately reviewed directions A: polished flat, B: restrained soft-dimensional, C: editorial outlined. Each must show the unchanged original seated Fox 1A next to walking, leaping, reaching, peeking, resting, waving and celebrating; the last two are proposals, not approved poses. Include enlarged face/tail crops and 48px samples. Keep single yellow-star symbol, correct face, proportions and white belly/tail marking.

Existing five provisional pose concepts: docs/brand/FOX_1A_POSE_LIBRARY.md. Checked-in symbol SVG is a source-traced board derivative, not a certified original illustrator master, so human owner fidelity review is required. No AI concept output may be shipped as the mascot.

## Gate to the real V1.1 build
Owner reviews the linked preview at 320/390/834/1280 and approves visual direction, ring scale and Home/Children split. Only then implement actual reusable components and the responsive Home/Children integration on an isolated feature branch. Regression-test the server-led points, undo, savings, multi-goal and reward flows, and obtain owner final acceptance before any production merge.

Further screens (Activity, Rewards, Settings and dialogs) follow the approved component system, not one-off picture-based mockups.