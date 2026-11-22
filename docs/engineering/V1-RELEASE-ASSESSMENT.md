# V1 release assessment

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-22 |
| Owner | Percy V1 engineering |
| Status | For the owner's release decision. Nothing has been merged or deployed |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-22 | First issue: the final integrated validation of V1 (#57–#64), its findings, the open gates and the release candidate |

## 1. Recommendation

**Conditional go.** The code passes every engineering check. Two visual changes the owner asked for on 22 November are still to be built (§3.1). Production release then waits on the owner's gates in §5; three of them (the drill on real data, a fresh backup with the 10–11 November change explained, and approval of the exact commit) must pass before the merge, because the merge is the deployment.

## 2. What was validated

Everything below was run on commit `0d8a662`, the app code of the release candidate. The commit after it changes test guards and documents only (§4.4); the UI browser tests (32) and the Activity unit tests were run again on it, and CI runs everything at the head (§7).

| Check | Result | Where |
| --- | --- | --- |
| Unit and server tests | 1,031 passed in 53 files; none skipped | `npm test` with a test database |
| Browser tests at 320, 390, 834 and 1280 px | 50 passed, 14 skipped by design | `npx playwright test`; the skips are explained in §4.2 |
| Accessibility (axe: nothing serious or critical), 44 px touch targets, 12 px text floor, no sideways scroll, no clipped text, no wrapped navigation, on every screen and dialog the browser tests open | Passed | `e2e/checks.js` |
| Lint, design tokens, release gates | 0 errors (3 old warnings); tokens OK; no gated file in the build | `npm run lint`, `check:tokens`, `check:release-gates` |
| Restore-and-reconcile tool on synthetic data | 41 passed, 0 failed, on a clean checkout of `0d8a662`; no container or volume left | `scripts/test/d1-restore-reconcile.test.sh` |
| Integrated functional review against issue #56, by behaviour | No critical finding; one major and three minor, all fixed (§3) | Independent reviewer, fresh context |
| Integrated visual review at the four sizes | Layout defects fixed (§3); no open defect | Independent reviewer over `evidence/v1-integrated/` and `evidence/v1-savings/` |
| Post-build code review of this round's changes | Two reviews, nothing blocking in either. Every should-fix and note fixed except two recorded (§4.3, §4.4) | Independent reviewers, fresh context |
| App rollback rehearsal | The production commit runs on a database at 017; V1 starts again after | Release checklist §5 |
| Migration order | 014, 015, 016, 017 apply in name order on a database at 012, each once, each in its own transaction | `server/migrate.js`; the restore tool's tests |

**Evidence.** `docs/engineering/evidence/v1-integrated/` (14 screens × 4 sizes, 48 side-by-side comparisons with the approved design, the Fox 1A comparison, the capture scripts) and `docs/engineering/evidence/v1-savings/` (10 savings screens × 4 sizes). All data in them is synthetic.

## 3. Findings

### Critical

None.

### Major (fixed)

| # | Finding | Fix | Guard |
| --- | --- | --- | --- |
| M1 | A redeemed reward could be undone only from the toast shown for a few seconds. After that there was no way back, although the server allows it for 10 minutes (V1-D §10 R3). A goal redemption spends saved points, so a slip could not be corrected | Activity offers **Undo** on a redemption for 10 minutes | `V1Activity.test.jsx` "Undo a redeemed reward"; the journey in `e2e/v1-journeys.spec.js` |

### Minor (fixed)

| # | Finding | Fix | Guard |
| --- | --- | --- | --- |
| m1 | "1 points" in the Correct dialog and "+1 points" in the Today's Goals message | Singular where the number is 1 | `V1Activity.test.jsx` |
| m2 | The savings dialog offered to move more than 1,000 points at once; the server refuses that | Each move is capped at 1,000 | `V1Savings.test.jsx` "one move is at most 1,000 points" |
| m3 | At 320 px the "+1" badge covered the end of a long behaviour name in Quick Points and in Award Points | First fix (the badge wrapped under the name) left each tile wrapping its own way; replaced by the standard tile (§3.1 O3) | New check in `e2e/checks.js`: no text wider than its box, on every screen |
| m4 | Long names were cut with "…" in the Spend dialog, the Quick Points settings and the Settings child list | Names wrap and show whole | The same check |
| m5 | At 834 px the "/ Family" page label beside the tabs broke onto two lines | The label shows from 1024 px up; the active tab names the page | New check: navigation text stays on one line |

### Recorded, not changed

| # | Item | Why it stays |
| --- | --- | --- |
| r1 | Child View and Home show one bigger goal: the one with the most saved. A child saving for two goals sees the second goal's savings only in the parent's Edit dialog, so the two tiles on Child View do not add up to the child's total | The reviewed design (D1 §5 O5 and N7). Showing every goal is an enhancement |
| r2 | Points held for a reward a child has asked for are not shown as their own figure: "Ready to use" already leaves them out | The approved design's figures (90 ready, 120 saved, Movie night asked for). Shipped behaviour |
| r3 | A direct spend refused because points are saved says "…already set aside for stacked rewards" | Reached only from a stale screen; the shipped message. Wording is the owner's |
| r4 | The parent's Spend list leaves out rewards hidden from children | The same in production today |
| r5 | Settings shows the approved design's wording for the two rows that are not features: "Permission-enforced access is still a launch gate" and "Release only after legal and restore gates" | Approved wording (V1-E design). The visual reviewer read it as internal language; changing it is the owner's call |
| r6 | The page label for Child View reads "My Rewards"; the page heading is "My Percy adventure" | Shipped label; wording is the owner's |
| r7 | The 320 px savings screenshots are single screens, so three of them stop above their subject | The whole screens at 320 px are in `evidence/v1-integrated/built/` |

### 3.1 Owner's visual review, 22 November (open)

| # | Owner's finding | State |
| --- | --- | --- |
| O1 | The Kindness and Bravery icons in Quick Points are not in the style of the others | Cause: the four starting behaviours still draw the older single-line icons (E03 design, contract 2: no stored icon was re-pointed without an owner decision). Options issued to the owner from the app's own icon family (Phosphor Duotone). **Waiting for the owner's choice** |
| O2 | The Child View box with the points to spend and the points saved looks too full, has no picture, and its wording is poor | Three layouts issued with the points star and the goal's picture. Wording is the owner's to approve. **Waiting for the owner's choice** |

| O3 | Quick Points at 320 px "looks bad. It needs to be standardised alignment. Reduce text size accordingly" | **Fixed** (below) |

O1 and O2 will be built on the release candidate through the usual steps (design note, review, tests), so the release-candidate commit will change before G8.

**O3: the standard behaviour tile.**

- **Cause.** The tile let its parts wrap freely, so each tile broke differently with the length of its name. That came from this round's first fix for m3. The same happened at 390 px, not only at 320.
- **Why one line cannot work on a phone.** At 320 px a tile has 105 px inside. On one line the name would get about 46 px; "Helpfulness" needs 71 px even at the 12 px minimum. Names are the family's own, so any layout that depends on a name fitting gives mixed tiles again.
- **Design** (`src/components/home/BehaviourTile.jsx`, used by Home's Quick Points and by "Give Percy Points"):
  - below 640 px every tile has the icon top left, the "+N" top right, and the name beneath on its own line;
  - from 640 px the icon, name and "+N" are on one line;
  - tiles in a row are one height, and on Home all four are;
  - text is 12 px below 360 px and 14 px above;
  - a word wider than the tile breaks; the name never runs under the badge;
  - below 360 px the "Award points" and "Rewards" buttons stack, because side by side the label ran to the button's edges.
- **Design review** (independent, before the build). It confirmed the two-row tile over a one-column list (about 150 px tall against 200 px for four tiles, and it keeps the approved 2 × 2 look). Three blocking points, all in the build: rows pinned to the top so a wrapped name does not shift its neighbours' icons; long words must break in both forms; the name must not span the badge's column in the one-line form. Also adopted: the dialog matches heights by row only, so one long name does not stretch five rows.
- **Guard.** `e2e/checks.js` measures every tile grid on every screen it checks: the icon, name and badge sit at the same place in each tile; the name and badge never overlap; heights match. A new browser test puts a long name with a 30-letter word and a "+1000" badge into Quick Points and the dialog at the four sizes. Shown red on the old layout at 320 and 390 px, and red for each of five deliberate breaks of the new one.
- **Not covered.** No test runs at 360 px, where the two buttons sit side by side with 11 px of side padding (16 px from about 380 px). Safari was not tested; the layout uses standard grid placement.

### Accepted deferrals (not in V1)

- Permanent family deletion (Batch C) stays off; there is no code path for it in the release candidate.
- Shared carers and the privacy controls are shown as "Planned" and "Review".
- The Goals empty-state map (Freepik) stays behind its licence gate; it is absent from the build.
- No child login, role or device restriction: V1 is operated by parents and carers only (owner's scope).

## 4. Test reliability

### 4.1 The intermittent Settings failure (CI, commit `2074d55`)

**Cause: a race in the test, not a defect in the app.** The step opens "Manage goals" and presses Escape at once. Measured in the page: an Escape sent in the same task in which the dialog mounts is ignored (0 of 10 closed); from the next task on it always works (10 of 10). It was the only step in the file with no pause before Escape. It could not be reproduced with the processor slowed, which fits a one-task window. A person cannot press a key in that window.

**Fix:** the test waits (at most one second) until focus is inside the dialog before pressing Escape. No app code changed.

### 4.2 Skipped tests

| Skip | Count | Why it is right |
| --- | --- | --- |
| Server test blocks that need a database (`describe.skipIf(!TEST_DATABASE_URL)`) | 25 blocks in 22 files | They run whenever a database is set. CI sets one, and so did every run reported here: none was skipped |
| Family report PDF | 3 of 4 sizes | One mobile browser covers PDF generation |
| First run of a new family | 3 of 4 sizes | One run avoids the sign-up rate limit |
| Export (two tests) | 6 | An API check and one layout check; one size each is enough |
| Journeys | 2 of 4 sizes | A phone and a desktop cover them |

That is the 14 skipped browser tests. Each test runs at one size or more. There is no `.only`, and no test is skipped outright.

### 4.3 Post-build code review of this round

| # | Finding | Outcome |
| --- | --- | --- |
| 1 | The Activity Undo was made anew on each redraw, so its one-tap guard and its request id did not survive a refresh; a second tap sent a second undo ("Undone", then "Already undone"). No double refund was possible: the server refuses it | Fixed: one handler per redemption for the life of the page. Test: a later tap replays the same request id |
| 2 | The test "never on an award" could not fail: its award was hours old | Fixed: the award in the test is one minute old |
| 3 | The 10-minute window and the one-tap guard were loosely tested | Fixed: rows at 9 and 11 minutes; a double tap is one request |
| 4 | Two singular-wording fixes had no test | Fixed: the dialog text and the exact goal message are asserted |
| 5 | "Undone. Lara has 1 points." | Fixed |
| 6 | The Points field's upper limit disagreed with "Move back up to" | Fixed, with a test |
| 7 | The nested-dialog wait in the Settings test passed at once | Fixed: it waits on the nested dialog itself |
| 8 | No screen check ran with the Undo button showing | Fixed: the journey checks that screen (axe, name, 44 px) |
| 9 | The Undo offer uses the device's clock. A clock 10 minutes fast hides it; a slow one offers it and the server answers "This can no longer be undone" | Recorded. The server decides; the message is clear |
| 10 | After Undo the button goes and keyboard focus falls to the page, as with Correct | Recorded; the toast announces the result |

Seven deliberate breaks of these fixes were each shown red.

### 4.4 Post-build code review of the standard tile

No defect in the app code. Four findings, all in the tests, all fixed:

| # | Finding | Outcome |
| --- | --- | --- |
| 1 | The long-name test cleaned up through the page. After a timeout the page is closed, so the shared test family would keep the long behaviour and later tests would fail | Fixed: its own connection, every reply checked, and the test first restores whatever an earlier run left |
| 2 | The tile guard missed a name cut off at the bottom, and unequal tiles in a row that were not top-aligned | Fixed: both are checked, as is any overlap between icon, name and badge. Two deliberate breaks shown red |
| 3 | The guard used whole-pixel widths, which could read aligned tiles as one pixel apart at widths not tested today (375 px) | Fixed: fractional figures |
| 4 | Only one redemption in the Undo unit test could be undone, so a handler tied to the wrong row would pass | Fixed: a second one, with its own address and id. The deliberate break is red |

## 5. Gates and what is still open

| Gate | State | Who | Blocks |
| --- | --- | --- | --- |
| G1 Functional | Passed | Engineering | – |
| G2 Visual | Engineering review done. **Owner review, 22 November: two changes asked for** (§3.1); sign-off open | Owner picks from the options; engineering builds | V1 deployment |
| G3 Data preservation | **Open.** The drill has run on synthetic data only | Owner runs it at the release-candidate commit (`V1-OPERATIONS-BACKUP.md` §4) | V1 deployment |
| G4 Backup safety | **Open.** The 10–11 November change is explained by inference, not confirmed; a fresh backup is needed on the day | Owner (`V1-OPERATIONS-BACKUP.md` §1) | V1 deployment |
| G5 Operational | Rollback rehearsed; Railway settings read on 22 November | Engineering; owner on the day | – |
| G6 Assets | 49 runtime assets match the register; gated map absent; no AI-generated artwork. Fox 1A live fidelity and the final points-star are **open with the owner** | Owner | Not V1 deployment unless the owner rejects the current fox or star; neither needs code |
| G7 Security and privacy | Passed: every route checked is scoped to the signed-in family; no secrets or family data in the repository or evidence | Engineering | – |
| G8 Release | **Open** | Owner approves the exact commit | V1 deployment |

**Blocks permanent deletion later, not V1:** the backup hardening PR (one blocking finding, `V1-OPERATIONS-BACKUP.md` §3) and the R2 expiry rule (§2 there). **Enhancements:** r1, and stronger backup validation.

## 6. Brand and licensing

| Item | Finding |
| --- | --- |
| Fox 1A | The runtime logo matches the approved source in shape, face, tail direction, star and markings. It is drawn flat with traced edges where the approved board has a soft gradient. Comparison: `evidence/v1-integrated/brand/fox-1a-fidelity.png`. The register still records "live-app fidelity sign-off pending" |
| Points star | `public/illustrations/stickies-star.svg`, the registered placeholder. The final master is outstanding |
| Runtime assets | All 49 files match the hashes in `RUNTIME_ASSETS.json` |
| Phosphor, Streamline | Recorded in the register with their licences; unchanged in this round |
| Freepik map | Gate open, clearance empty, file absent from `dist/` and `public/` (`check:release-gates`) |
| Replacements | None made. No artwork was generated or swapped |

## 7. The release candidate

| Field | Value |
| --- | --- |
| Branch | `claude/percy-v1-rc` |
| Base | `claude/migrate-base64-percy-code-PNAym` (the default and production branch, at `498e798`) |
| Contents | #57, #58, #59, #60, #61, #62, #63 and #64. The base is an ancestor, so the candidate only adds commits |
| Exact commit | The head of the release-candidate pull request, read from GitHub. A file cannot name its own commit; the pull request and the hand-back carry it |
| Migrations | 014, 015, 016, 017 |
| Railway files | No `railway.json` or `railway.toml` is tracked |
| Deployment plan | Release checklist §4 and §5 |

## 8. Risks

| Risk | Likelihood | What limits it |
| --- | --- | --- |
| A migration behaves differently on real data than on synthetic | Low | G3 is exactly this test; a failed migration leaves nothing behind |
| The backup taken before the deploy is not whole | Low | Check its size on the day and keep a downloaded copy; the hardened job is not yet deployed |
| An app rollback while families use savings | Low | The old app works but does not know savings (checklist §5); keep a rollback short |
| The seven families removed on 11 November were not test data | Unknown | Owner's answer (G4). The 10 November archive is the only copy |
| A workflow with write permission (`percy-materialize-brand.yml`) arrives on the default branch with this release | Low | It runs only by hand or on a push to the brand hand-over branch, and its job is limited to that branch. It does nothing on the default branch |
