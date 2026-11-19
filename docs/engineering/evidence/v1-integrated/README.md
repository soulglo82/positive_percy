# V1 integrated review pack

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering |
| Status | For the owner's full V1 visual and functional review |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-19 | First pack |

## What was combined

A scratch merge, not pushed and not a release candidate, of:
- #63 at `3ddf54c` (which contains #62, #61, #59 and earlier);
- #60 at `e0de5f4` (the savings ledger, migration 016).

The only conflict was one line, `spendableFrom`'s return value. The #60 side, which adds `is_bigger_goal`, was kept.

## Results on the combined tree

| Check | Result |
| --- | --- |
| Unit and server tests (Vitest, database) | 871 passed, 48 files |
| Lint | 0 errors (3 old warnings) |
| Design tokens | OK |
| Browser tests (Playwright, 320/390/834/1280) | 42 passed, 14 skipped by design (single-viewport specs) |
| Journeys (`e2e/v1-journeys.spec.js`, phone and desktop) | Passed: the child asks; the parent sees the exact total and approves; Activity shows "Reward redeemed" and the goal under Goals; the Children page; a Settings rename survives a reload |

## Screens (390 and 1280 px)

Home, the Home Rewards dialog with a request, Children, Child View, Activity, Rewards and Settings. The fixture family has Lara (with a request for Movie night and two goals done today), Omar and Joud.

## Observations for the owner (not changed)

| # | Observation |
| --- | --- |
| O-I1 | In the Home Rewards dialog, a reward the child has asked for also appears in the direct-spend list below. Spending it directly is safe, because only unreserved points count. But a parent might spend it there instead of approving the request, and the request would then stay open. Engineering can hide requested rewards from the direct list, or leave them as they are |
