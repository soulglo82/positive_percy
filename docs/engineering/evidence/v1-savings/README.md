# D1 savings: screen evidence

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-21 |
| Owner | Percy V1 engineering |
| Status | Evidence for review. Not merged, not deployed |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.1 | 2026-11-22 | The list of screens corrected: it named five, and the folder holds ten at four sizes (40 images). Retaken at the release-candidate head |
| 1.0 | 2026-11-21 | First set: five screens |

Taken by `e2e/v1-savings.spec.js` on synthetic data (one test child and two test goals, removed afterwards). The test runs at four sizes. Each screen passed axe (no serious or critical findings), 44px touch targets on touch sizes, the 12px text floor, no sideways scroll, no text wider than its box, and named controls.

Files are named `{size}--{screen}.png`. The sizes are `phone-320`, `phone-390-touch`, `ipad-834-touch` and `desktop-1280`. The screens are:

| Screen | Shows |
| --- | --- |
| `children-with-savings` | The "Saving for something bigger" card, scrolled into view |
| `savings-dialog` | Save points, Move points back, Redeem |
| `redeem-goal-confirm` | The confirmation before a goal is redeemed |
| `child-view-with-savings` | "Saved towards" and "My next big adventure" |
| `child-view-fully-saved` | A funded goal: "{Child} has saved enough for {Goal}!" |
| `rewards-with-bigger-rewards` | The "Bigger rewards" section |
| `unmark-warning` | The per-child warning when a goal is turned off |
| `end-savings-confirm` | The confirmation before savings end |
| `delete-goal-with-savings` | The per-child warning when a goal with savings is deleted |
| `activity-with-savings-rows` | Activity: saved, moved back and savings-ended lines |

Screenshots show the viewport only: a full-page capture in Chromium drops touch emulation. The whole-page views of every main screen are in `../v1-integrated/built/`.

Design and final wording: `docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md` §19–§21.8.
