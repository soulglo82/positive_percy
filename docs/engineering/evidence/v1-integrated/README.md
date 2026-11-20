# V1 integrated review pack

| Field | Value |
| --- | --- |
| Version | 2.2 |
| Issued | 2026-11-20 |
| Owner | Percy V1 engineering |
| Status | For the owner's full V1 visual and functional review (not a release candidate) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 2.2 | 2026-11-20 | Correction: the Streamline licence row was written before searching; the repository does record Streamline assets and their licence (see the corrected row) |
| 2.1 | 2026-11-20 | Owner visual review answered (§Owner review): supporting screens added; Home retaken with behaviours that carry their approved icons |
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

## Owner review of v2.0 (2026-11-20)

| Priority | Finding | Status |
| --- | --- | --- |
| High | Reward artwork: the reference embeds colourful Streamline-style illustrations; the build uses the 71 approved Phosphor picker icons | **Owner decision needed** (licensing and picker permission). The repository records 16 Streamline assets from `webalys-hq/streamline-vectors` (commit `52d750c`), licensed **CC BY 4.0**, in `design/assets/streamline/asset-registry.json`. Six are reward candidates: controller-1, film-slate, book-1, camera-1, ice-cream-2 and bicycle-bike. Every one is marked `review_only_not_approved`. The registry notes say not to expose the icons to users "until parent-selectable picker licensing and attribution are explicitly reviewed". The V2 handover says Streamline Plump rewards need "correct licensed actual assets and written picker permission"; until then, Phosphor Duotone is the fallback. `public/licenses/CREDITS.txt` already carries a Streamline CC BY 4.0 credit line. **Options:** (a) give written approval for named Streamline reward icons as selectable artwork, with the CC BY 4.0 attribution (engineering then adds them as a separate, approved source in the picker); or (b) approve the Phosphor fallback explicitly for V1. Recommendation: (b) for V1, then (a) as a follow-up once the full illustration set the owner wants is licensed and listed |
| High | D1 savings sections absent | Gated: the restored-backup reconciliation (owner) comes first, then the D1 features, then a review of the finished screens |
| Medium | Supporting screens missing from the pack | **Done.** `built/` and `compare/` now hold Award Points, Manage Goals, the goal form, the reward form with picker, Onboarding and Welcome, at 390, 834 and 1280 px, from the same combined build (#63 `75a7cb4` and #60 `0ccaaac`) |
| Medium | Today's Goals shows generic circles | **Explained and retaken.** The circles came from fixture behaviours created without an icon. `home-*` is retaken with behaviours that carry their approved icons (Learning, Helping, Reading), and the rows show those icons. Families' seeded behaviours always carry icons; new ones are chosen from the approved set |
| Launch gate | Points star placeholder; Fox 1A and asset provenance | Not in engineering's gift: it needs the final points-star artwork from the owner or designer. Fox 1A provenance is to be verified at the release-gate step (UNVERIFIED here) |

### Notes on the supporting screens

- **Award Points, Manage Goals and the goal form** are dialogs over Home. The approved file shows them as full screens with "Back". Behaviour, copy and steps match.
- **Onboarding** is a dialog, as in V1-F, rather than a page with "← Back to Home".
- **Welcome** has no treasure map. The Freepik map stays behind its licence gate (standing constraint).
- **The reward form** opens with the picker, as approved.

