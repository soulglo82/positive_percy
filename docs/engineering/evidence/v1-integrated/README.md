# V1 integrated review pack

| Field | Value |
| --- | --- |
| Version | 2.0 |
| Issued | 2026-11-20 |
| Owner | Percy V1 engineering |
| Status | For the owner's full V1 visual and functional review (not a release candidate) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 2.0 | 2026-11-20 | Rebuilt on the latest green heads, with O-I1 and the visual-review fixes; three widths; side-by-side comparisons |
| 1.0 | 2026-11-19 | First pack (earlier heads of #60 and #63; superseded) |

## What was combined

A scratch merge, not pushed, of:
- #63 at `7fdbb4a`, which contains #62 `97294d6`, #61 `3e29350` and #59 `c72f941`;
- #60 at `0ccaaac`.

The only conflict was one line: the return value of `spendableFrom`. The #60 side, which adds `is_bigger_goal`, was kept.

## Results on the combined tree

| Check | Result |
| --- | --- |
| Unit and server tests (Vitest, with the database) | 878 passed, 48 files |
| Lint | 0 errors |
| Design tokens | OK |
| Browser tests, all screens and dialogs, with axe, 44 px and no-sideways-scroll checks (320/390/834/1280) | 42 passed, 14 skipped by design (specs that run at one width only) |
| Journeys (`e2e/v1-journeys.spec.js`, phone and desktop) | Passed |

The journey covers:
- the child asks for a reward, and nothing is spent;
- the parent sees the exact total;
- the requested reward is not in the direct Spend list (O-I1);
- the parent approves ("Approved 1 reward for …");
- Activity shows "Reward redeemed", and the goal under Goals but not Earned;
- the Children page;
- a Settings rename survives a reload.

## Files

- **`built/`:** Home, the Home Rewards dialog, Children, Child View, Activity, Rewards and Settings, at 390, 834 and 1280 px.
- **`compare/`:** the approved reference (left) and the built screen (right), for each screen and width. The approved file draws every width as a phone frame; the built app uses its responsive layouts at 834 and 1280.

## Fixed in this round of visual review

- **Activity:** day headings sit on a tinted band, and rows have no outer box, as approved.
- **Rewards:** the catalogue heading and "New reward" sit side by side on phones, as approved.

## Intended differences (owner decisions or recorded items)

- **Not built until D1:** savings figures, "Saving for something bigger" and "My next big adventure".
- **No reward subtitles.** There is no stored field for them (plan §8.4).
- **Selected child:** a purple border instead of the approved orange, which falls below 3:1 contrast.
- **Activity:** the "This week" numbers are centred (the owner's earlier direction), and the child filter is kept (A3).
- **Settings:**
  - row dialogs replace the full-page edit screens (E4);
  - "Planned" and "Review" are status labels;
  - Point defaults is read-only (D6).
- **Design-only notes are not shipped** (plan §8.6).
- **Fixture artefacts:**
  - behaviours created for the screenshots have no picker icon, so they show the default circle;
  - times are in the fixture family's zone.
