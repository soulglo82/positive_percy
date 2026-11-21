# D1 savings: screen evidence

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-21 |
| Owner | Percy V1 engineering |
| Status | Evidence for review. Not merged, not deployed |

Taken by `e2e/v1-savings.spec.js` on synthetic data (one test child and one test goal, removed afterwards). The test runs at four sizes, and each screen passed axe (no serious or critical findings), 44px touch targets on touch sizes, the 12px text floor, no sideways scroll and named controls.

Files are named `{size}--{screen}.png`. The sizes are `phone-320`, `phone-390-touch`, `ipad-834-touch` and `desktop-1280`. The screens are:

- `children-with-savings`;
- `savings-dialog`;
- `child-view-with-savings`;
- `rewards-with-bigger-rewards`;
- `redeem-goal-confirm`.

Screenshots show the viewport only: a full-page capture in Chromium drops touch emulation. So on phones, the Children "Saving for something bigger" card is below the fold in `children-with-savings`. The card is checked by the test either way.

Design and wording list: `docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md` §19.8.
