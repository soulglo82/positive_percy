# V1 integrated review pack

| Field | Value |
| --- | --- |
| Version | 3.0 |
| Issued | 2026-11-20 |
| Owner | Percy V1 engineering |
| Status | For the owner's final visual and functional sign-off of the release candidate. Not an approval |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 3.0 | 2026-11-22 | Final validation. The whole V1 including savings, on the release-candidate branch; four widths (320 added); whole-page captures; the capture scripts are now in `tools/`; Fox 1A comparison in `brand/`. Sections below v3.0 are kept as history |
| 2.3 | 2026-11-20 | Full checks rerun on the combined heads (910 unit/server, 42 browser, 14 skipped by design); rebuilt on the latest heads with the approved reward artwork (owner decision 2026-11-20); every screen retaken; the artwork row is closed |
| 2.2 | 2026-11-20 | Correction: the Streamline licence row was written before searching; the repository does record Streamline assets and their licence (see the corrected row) |
| 2.1 | 2026-11-20 | Owner visual review answered (§Owner review): supporting screens added; Home retaken with behaviours that carry their approved icons |
| 2.0 | 2026-11-20 | Rebuilt on the latest green heads, with O-I1 and the visual-review fixes; three widths; side-by-side comparisons |
| 1.0 | 2026-11-19 | First pack (earlier heads of #60 and #63; superseded) |

## v3.0: the release candidate (2026-11-22)

**What it shows.** The release-candidate branch: everything in #57–#64, including savings. Results, findings and gates are in `docs/engineering/V1-RELEASE-ASSESSMENT.md`.

**Files.**

| Folder | Contents |
| --- | --- |
| `built/` | 14 screens at 320, 390, 834 and 1280 px (56 images): Home, the Home Rewards dialog, Children, Child View, Activity, Rewards, Settings, Award Points, Manage Goals, the goal form, the reward form, the savings dialog, Onboarding and Welcome. Main screens are whole pages |
| `compare/` | The approved design (left) and the built screen (right) for the 12 screens the approved design has, at the four widths (48 images). The approved file draws every width as a phone frame; the built app uses its responsive layouts at 834 and 1280 |
| `brand/fox-1a-fidelity.png` | The approved Fox 1A source crop beside the runtime logo files |
| `tools/` | `run.sh` rebuilds the pack: `capture.cjs` seeds a synthetic family and photographs the app, `reference.cjs` photographs the approved design (git blob `9de1df2`), `compose.py` sets them side by side. `rollback-rehearsal.cjs` is the app rollback rehearsal (release checklist §5). `escape-timing-probe.playwright.js` and `escape-real-key/` are the two measurements behind the Settings test's wait before Escape (release assessment §4.1) |
| `../v1-savings/` | The savings dialogs and confirmations at the four sizes (40 images) |

**Retaken again on 22 November** for the Achievements card, the repetition trims and Home's new order (release assessment §3.5, §4.7, §4.8).

**Retaken on 22 November** after the owner's visual decisions (behaviour icons, default Quick Points, the Child View points card) and the design critique (release assessment §3.1 and §3.2). The capture scripts also include the write-freeze rehearsal, `tools/rollback-freeze-rehearsal.cjs`.

**The fixture** matches the approved design's figures: Lara has 18 of 25 this week, 90 ready to use and 120 of 300 saved towards New bike, with Movie night asked for.

**Differences from the approved design that are intended** (owner decisions or recorded items; unchanged from v2.3 except savings, which is now built):
- Home's order: Quick Points sits directly under the child picker, above Today's Goals (owner, 22 November; release assessment §3.5). The approved design has it last.
- No reward subtitles ("Weekly treat", "Family reward"): there is no stored field for them (plan §8.4).
- The Welcome screen has no map: the Freepik map stays behind its licence gate.
- Savings wording follows the owner's final wording (D1 design §21.8), where it differs from the approved file's sample text.

## History: v2.3 and earlier (2026-11-20)

The sections below describe the v2.3 pack. They are kept as written.

## What was combined

A scratch merge, not pushed, of:
- #63 at `f8d2692`, which contains #62 `fdaf955`, #61 `58ca0c2` and #59 `80a0965`;
- #60 at `6c3fc42`.

The only conflict was one line: the return value of `spendableFrom`. The #60 side, which adds `is_bigger_goal`, was kept.

## Results on the combined tree

| Check | Result |
| --- | --- |
| Unit and server tests (Vitest, with the database) | 910 passed, 49 files |
| Lint | 0 errors |
| Design tokens | OK |
| Browser tests, all screens and dialogs, with axe, 44 px and no-sideways-scroll checks (320/390/834/1280) | 42 passed, 14 skipped by design (specs that run at one width only) |
| Journeys (`e2e/v1-journeys.spec.js`, phone and desktop) | Passed (now also checks the approved artwork in Child View) |

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

