# V1 integrated review pack

| Field | Value |
| --- | --- |
| Version | 2.3 |
| Issued | 2026-11-20 |
| Owner | Percy V1 engineering |
| Status | For the owner's full V1 visual and functional review (not a release candidate) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 2.3 | 2026-11-20 | Rebuilt on the latest heads with the approved reward artwork (owner decision 2026-11-20); every screen retaken; the artwork row is closed |
| 2.2 | 2026-11-20 | Correction: the Streamline licence row was written before searching; the repository does record Streamline assets and their licence (see the corrected row) |
| 2.1 | 2026-11-20 | Owner visual review answered (§Owner review): supporting screens added; Home retaken with behaviours that carry their approved icons |
| 2.0 | 2026-11-20 | Rebuilt on the latest green heads, with O-I1 and the visual-review fixes; three widths; side-by-side comparisons |
| 1.0 | 2026-11-19 | First pack (earlier heads of #60 and #63; superseded) |

## What was combined

A scratch merge, not pushed, of:
- #63 at `f8d2692`, which contains #62 `fdaf955`, #61 `58ca0c2` and #59 `80a0965`;
- #60 at `6c3fc42`.

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

- **`built/`:** Home, the Home Rewards dialog, Children, Child View, Activity, Rewards, Settings, Award Points, Manage Goals, the goal form, the reward form, Onboarding and Welcome, at 390, 834 and 1280 px. The fixture rewards carry the approved artwork, as in the reference.
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

## Owner review of v2.0 (2026-11-20)

| Priority | Finding | Status |
| --- | --- | --- |
| High | Reward artwork | **Done.** The owner settled licensing on 2026-11-20. The approved artwork (`APPROVAL_REGISTER.json` `decisions.rewards`: 11 Streamline Plump Duo, plus the Phosphor book-bookmark for New book) is selectable in the reward picker. It is drawn in the Rewards catalogue, Child View, the Home requests and the Children treats. The 71 Phosphor icons remain, and existing rewards keep their art. V1-D design §14 |
| High | D1 savings sections absent | Gated: the restored-backup reconciliation (owner) comes first, then the D1 features, then a review of the finished screens |
| Medium | Supporting screens missing from the pack | **Done.** `built/` and `compare/` now hold Award Points, Manage Goals, the goal form, the reward form with picker, Onboarding and Welcome, at 390, 834 and 1280 px, from the same combined build (#63 `75a7cb4` and #60 `0ccaaac`) |
| Medium | Today's Goals shows generic circles | **Explained and retaken.** The circles came from fixture behaviours created without an icon. `home-*` is retaken with behaviours that carry their approved icons (Learning, Helping, Reading), and the rows show those icons. Families' seeded behaviours always carry icons; new ones are chosen from the approved set |
| Launch gate | Points star placeholder; Fox 1A and asset provenance | Not in engineering's gift: it needs the final points-star artwork from the owner or designer. Fox 1A provenance is to be verified at the release-gate step (UNVERIFIED here) |

### Notes on the supporting screens

- **Award Points, Manage Goals and the goal form** are dialogs over Home. The approved file shows them as full screens with "Back". Behaviour, copy and steps match.
- **Onboarding** is a dialog, as in V1-F, rather than a page with "← Back to Home".
- **Welcome** has no treasure map. The Freepik map stays behind its licence gate (standing constraint).
- **The reward form** opens with the picker, as approved.

