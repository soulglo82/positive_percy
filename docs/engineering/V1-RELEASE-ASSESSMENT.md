# V1 release assessment

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-22 |
| Owner | Percy V1 engineering |
| Status | For the owner's release decision. Nothing has been merged or deployed |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.1 | 2026-11-22 | Owner's visual decisions built (icons, default Quick Points, Child View points box); the design critique of every page (§3.2); the owner's review of #65 (rollback write freeze, the cause of the archive change not called deliberate, legal and privacy split from technical security); the points-star statement corrected |
| 1.0 | 2026-11-22 | First issue: the final integrated validation of V1 (#57–#64), its findings, the open gates and the release candidate |

## 1. Recommendation

**Conditional go. Not ready to deploy.** The engineering validation is complete at the commit named in §2. Deployment waits on gates only the owner can pass (§5): the restore and reconciliation of a real production backup, a fresh and complete backup with the 10–11 November change explained, the owner's visual sign-off, access to run the rollback scripts, the legal and privacy review, and approval of the exact commit. The merge is the deployment, so all of them come before it.

A passing write-freeze rehearsal is **not** evidence about real data. It does not replace the restore and reconciliation of a production backup.

## 2. What was validated

**Every result below was produced on a clean checkout of commit `96f5462`**, the release candidate's code. The commit after it adds only this document's results and the checklist; CI then ran everything again at that final commit (§7).

| Check | Result at `96f5462` | Where |
| --- | --- | --- |
| Unit and server tests | 1,035 passed in 53 files; none skipped | `npm test` with a test database |
| Browser tests at 320, 390, 834 and 1280 px | 52 passed, 16 skipped by design | `npx playwright test`; the skips are explained in §4.2 |
| Reward forms and confirmation dialogs at 320, 359, 360, 390, 834 and 1280 px | Passed (part of the browser run; §3.3) | `e2e/responsive-dialogs.spec.js` |
| Accessibility (axe: nothing serious or critical), 44 px touch targets, 12 px text floor, no sideways scroll, no clipped text, no wrapped navigation, aligned tiles and figures, on every screen and dialog the browser tests open | Passed (asserted inside the browser tests) | `e2e/checks.js` |
| Lint | 0 errors (3 old warnings) | `npm run lint` |
| Design tokens | OK (85 files) | `npm run check:tokens` |
| Release gates (no gated artwork in the build) | OK: no gated file in the build | `npm run check:release-gates` |
| Generated icon module is current | Current | `node scripts/brand/build-approved-icons.mjs --check` |
| Restore-and-reconcile tool, **synthetic data** | 41 passed, 0 failed; no container left | `scripts/test/d1-restore-reconcile.test.sh` |
| Rollback write-freeze rehearsal, **synthetic data** | 166 checks, 0 failed (run on the same scripts before the commit) | `V1-ROLLBACK-FREEZE-DESIGN.md` §10–§11 |
| Integrated functional review against issue #56 | No critical finding; one major and five minor, all fixed (§3) | Independent reviewer |
| Design critique of every page at four sizes | 16 defects fixed; the rest listed as open (§3.2) | Three independent reviewers |
| Design reviews before each build, code reviews after | Nothing blocking left open (§4.3–§4.5) | Independent reviewers |
| Migration order | 014, 015, 016, 017 apply in name order on a database at 012, each once, each in its own transaction | `server/migrate.js`; the restore tool's tests |

**Not validated by any of this:** real production data (G3), the live backup (G4), Railway's behaviour during a deploy or rollback, and the owner's access to the production database.

**Evidence.** `docs/engineering/evidence/v1-integrated/` (14 screens × 4 sizes, 48 side-by-side comparisons with the approved design, the Fox 1A comparison, the capture and rehearsal scripts), `docs/engineering/evidence/v1-savings/` (10 savings screens × 4 sizes) and `docs/engineering/evidence/v1-owner-review/` (the option sheets and the owner's decisions). All data in them is synthetic.

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
| O1 | The Kindness and Bravery icons in Quick Points are not in the style of the others | **Built.** Owner chose K1 (heart) and B1 (shield with star) and approved the restyle. Every behaviour icon is now in the one icon family; no stored value changes. E03 design §11. For sign-off: twelve of the sixteen glyphs are engineering's same-subject mapping, not individual owner picks |
| O2 | The Child View box with the points to spend and the points saved looks too full, has no picture, and its wording is poor | **Built.** Owner chose layout C with a piggy bank and asked for the number and wording to be aligned. One figure, "{n} points" over "Ready to use". V1-B design §10. A shared check now measures the baseline and left edge of every such figure |

| O3 | Quick Points at 320 px "looks bad. It needs to be standardised alignment. Reduce text size accordingly" | **Fixed** (below) |

| O4 | "Kindness and caring are almost the same thing, choose another option as the default quick points" | **Built.** New families' Quick Points are Kindness, Helpfulness, Bravery and Resilience. **Existing families, including the owner's, keep theirs** until changed in Settings › Quick Points |
| O5 | "Use the design skills to check ALL the pages … to make sure they are not AI slop or poorly put together" | See §3.2 |

The option sheets the owner chose from, and the decisions, are in `evidence/v1-owner-review/`.

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

### 3.2 Design critique of every page (owner's request, 22 November)

**Method.** Three independent reviewers applied the design-critique framework (first impression, usability, visual hierarchy, consistency, accessibility) to every page and dialog at 320, 390, 834 and 1280 px, with a specific brief to look for generic or carelessly assembled work. Each finding was checked against the code before it was acted on.

**Verdict.** One disciplined system (spacing, control sizes, one icon family, strong contrast) and no gross "generic" look, but with real polish defects, mostly at 320 px, in the phone dialogs and in small alignment slips. No page was free of findings.

**Fixed in this round (16).**

| Area | What was wrong | Now |
| --- | --- | --- |
| Savings dialog | "Saved: 120" was a figure with no caption beside "90 / Available now" | Two tiles of one form: figure, caption |
| Activity | Undo and Correct sat 8 px in from the figure above them | One right edge |
| Activity | "4:34" and "AM" could split across lines | A time never breaks |
| Activity | Filter chips 44 px beside a 40 px select | Same height |
| Activity | "Joud started with Starting points" | "Joud started with 8 points" |
| All dialogs on a phone | A square band edge to edge | A card with a margin and the same corners as on a desktop |
| Child tiles | Two columns at 320 px left the third child alone | Three across from 320 px, as approved |
| Child tiles | The coloured ring hung 4 px left of the name | Flush with the text |
| Home, Children | "Manage goals" ended 12 px short of the card edge; other links were flush | Flush |
| Home | 8 px between tiles, 12 px between the buttons under them | One gap |
| Children | A card's button dropped under its heading on phones, in some cards and not others | The button stays right; the heading wraps |
| Rewards | "Your reward catalogue" broke into three one-word lines at 320 px | Heading above the button below 360 px |
| Child View, Settings | Narrower page than the other tabs, so the title jumped between tabs | One page width |
| Rewards | The tile's Edit was purple; every other outline button is ink | One colour |
| Reward delete | Its confirm button was the primary purple; the other deletes are red | Red, like the others |
| Reward form | Showed a gift emoji for a reward whose tile shows the gift icon | The same picture as the tile |

Also: the Settings "View parenting tips" line is underlined as the link it is.

**Open: wording (the owner's to approve; nothing changed).**

| # | Where | Now | Recommendation |
| --- | --- | --- | --- |
| W1 | Settings | "Permission-enforced access is still a launch gate", "Release only after legal and restore gates", "Available with existing family invitation flow" | Approved-design strings, but they read as developer notes. "Coming soon" for the two that are not features; "Invite another parent or carer" for the third |
| W2 | Child View | "A child-friendly view of goals, points and rewards. No independent child account." and "Only a parent-authorised confirmation can spend points." | "Children can't sign in." / "A parent confirms before points are spent." |
| W3 | Ending savings confirmation | Buttons "Save reward" and "Keep saving": two "save" labels with opposite results | "End savings" and "Keep saving" |
| W4 | Several | Mixed capitals: "Assign to Children", "Delete Reward", "All Children", "Corrections and Undo", "Today's Goals", "Quick Points" beside sentence case elsewhere | Sentence case throughout, keeping product names ("Today's Goals", "Quick Points") |
| W5 | Several | One idea has seven names: bigger goal, bigger reward, bigger achievement, something bigger, big adventure, bigger adventures, milestone | "Bigger goal" for the thing, "Saving for something bigger" for the section |
| W6 | Children, Rewards | The same rewards are "Weekly treats" on one page and "Other rewards" on the other; the page label for Child View says "My Rewards" | One name each |

**Open: opinions on the approved design (the built screen matches it; the owner decides).**

| # | Where | Point |
| --- | --- | --- |
| D1 | Home "Little wins, big adventures!", Children "Earned this week / Available now" and "Achievements", Activity "This week" | The same boxes-inside-a-box figure tiles the owner rejected on Child View. Recommendation: the same treatment (one figure with its picture, or plain rows). Not changed without the owner's word, because these are approved screens |
| D1a | Activity "This week" | The critique would left-align these figures and let the pair fill the card. **Not changed:** the centred figures are the owner's earlier direction (V1-C design v1.2). I changed them on the critique's word and the code review caught the conflict; it is restored, and the browser test now measures the text itself |
| D2 | Home's Rewards dialog ("Lara asked for") | Four nested boxes, a smaller title than the other dialogs, and 36 px buttons where the others are 44 px. Recommendation: rebuild it on the shared dialog header with flat rows |
| D3 | Settings "Point defaults" | No control, by the owner's decision D6; it reads as a setting that cannot be changed. Recommendation: fold it into the Quick Points row's description |
| D4 | Savings dialog | Four buttons, two of them filled. Recommendation: one primary action |
| D5 | Home, Children | Three motivational lines and several sub-titles that say little |

**Open: smaller build defects not fixed in this round (engineering).**

| # | Where | Defect |
| --- | --- | --- |
| E1 | Home at 320 px | A goal's details run to five lines beside its button; "90 points" and "Available now" both wrap |
| E2 | Home, Manage goals | The first or last goal row is 12 px taller than the others |
| E3 | Give Percy Points, goal form | The selected tile's border is 1 px thicker, shifting its content by 1 px; day chips grow 2 px when selected |
| E4 | Goal form, reward form | Select text is inset 4 px more than input text; checkboxes sit 4 px right of the fields |
| E5 | Dialogs | No line under a sticky dialog header, so content is cut mid-letter while scrolling |
| E6 | Onboarding | White cards on a white dialog; the approved design has them on cream |
| E7 | Children, Rewards | Three rewards in a two- or four-column grid leave one alone or a slot empty |
| E8 | Manage goals | The only dialog with no footer action |

These are polish, not function. They are listed so that nothing is called finished that is not.

### 3.3 Reward forms and confirmation dialogs at six widths (owner's request, 22 November)

`e2e/responsive-dialogs.spec.js` opens, at **320, 359, 360, 390, 834 and 1280 px**: the new-reward form; the edit form with its "savings will end" warning; the three confirmations (end savings, delete a goal with savings, redeem a goal); and the savings dialog. 359 and 360 px sit either side of the point where a dialog changes from full width to a card with a margin, which the four standard sizes do not land on.

| Checked on every dialog at every width | Result |
| --- | --- |
| No text wider than its box; no sideways scroll; no text under 12 px | Passed |
| Accessibility scan (axe: nothing serious or critical); every control has a name | Passed |
| Touch targets at least 44 px (the five widths up to 834 run with touch on) | Passed |
| The dialog lies inside the window; every button can be brought fully into view and nothing lies over it | Passed |
| Nothing was saved, ended or deleted by the test (every dialog is cancelled; the child's figures are compared afterwards) | Passed |

The test can fail: narrowing the form dialog on the smallest phones made it red at 320 px (clipped text), and making a confirmation wider than the window made it red (dialog outside the window).

**The 320 px dialog decision.** The design critique found dialogs on a phone drawn as a square band from edge to edge. The fix is a card with a margin and rounded corners. At 320 px that margin took a few pixels the reward form's icon row needs (the clipped-text check caught it), so below 360 px form dialogs stay full width; from 360 px up they are the card. Confirmations are the card at every width. This is a targeted fix, not a redesign.

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

That is 14 skipped browser tests; the six-width dialog test adds two (it runs in the touch phone project for 320 to 834 px and in the desktop project for 1280 px, and is skipped in the other two), making 16. Each test runs at one size or more. There is no `.only`, and no test is skipped outright.

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

### 4.5 Independent reviews of the second round (owner's decisions, the critique fixes, the write freeze)

**Before each build (design reviews).**

| Design | Blocking findings | Resolution |
| --- | --- | --- |
| Standard behaviour tile (§3.1 O3) | Three: a wrapped name shifted its neighbours' icons; long words did not break in the one-line form; the name spanned the badge's column | All in the build; guarded |
| Child View points card (V1-B §10) | One: no space between the figure and its unit ("90points") | Fixed; the unit test asserts the exact text |
| Behaviour icons and default Quick Points (E03 §11) | Three: the test fixture would create a fifth Quick Point; the legacy tick drew the "Done" mark; the picker offered a stored icon's look-alike, so a tap seemed to do nothing | Fixture swaps Resilience; the plain tick; the look-alike is left out of the cycle. Also adopted: the broom for Chores, the four-point star for Adventurous, a guard that one drawing has one meaning |
| Rollback write freeze | Two: the freeze could be lifted before the fixed version was live; the savings check missed reassignment, undo and deletion by the old app | The freeze is never lifted while the old app serves; conditions rewritten against the raw ledger; each is a control in the rehearsal |

**After the build (code review of the whole round).** No blocking defect.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Should fix | The child strip became four columns on a desktop, leaving an empty slot beside three children. It had been three: the old four-column rule never applied | Three at every width |
| 2 | Should fix | The savings check could fail on correct data and so keep writes off | Compared with a baseline taken when the freeze goes on (design §11) |
| 3 | Should fix | The Activity "This week" figures were left-aligned against the owner's recorded direction; the existing test could not tell | Restored to centred; the test measures the text itself |
| 4 | Note | The freeze status accepted a replica-only trigger | Only a trigger that fires for the app and calls the freeze function counts; rehearsed |
| 5 | Note | One rehearsal check could not fail; the controls did not assert "only this condition" | Removed; tightened |
| 6 | Note | The icon generator built with a legacy key missing; the app would then fail at start | The generator requires all sixteen; counter-examples in the test |
| 7 | Note | Tests that could not fail: the "status" rule of the new register group; an `aria-hidden` assertion that matched the icon itself | Both now have a failing case |
| 8 | Note | Tests with no assertion: screen-reader labels of the restyled icons; the reward form's preview for a reward with no emoji and its red delete button; the Children card header | **Recorded, not fixed.** Each is visible on the screenshots; none has a unit test |

**Not independently reviewed:** `e2e/responsive-dialogs.spec.js` (written after the review started). It is a test only, and two deliberate breaks made it fail (§3.3).

**Deliberate breaks shown red in this round:** five for the tile layout, two for the tile guard's additions, seven for the first review's fixes, one for the Undo handler, three for the points figure, two for the six-width dialog test.

## 5. Gates: what is complete and what is not

### 5.1 Complete: engineering validation

| Gate | State |
| --- | --- |
| G1 Functional | **Passed** at `96f5462` (§2, §3) |
| G7a Security (technical) | **Passed:** every route checked is scoped to the signed-in family; no secrets or family data in the repository or evidence; permanent deletion stays off |
| Responsive and accessibility checks | **Passed** at four sizes, and at six for reward forms and confirmations (§3.3) |
| Rollback procedure | **Designed, reviewed and rehearsed on synthetic data** (write freeze). Its use depends on §5.5 |

Engineering items still open, none of them functional: the eight smaller build defects from the design critique (§3.2, E1–E8) and the tests listed as missing in §4.5 (#8).

### 5.2 Not complete: production backup (G4) — owner

- The 10–11 November change (families 9 → 2, children 12 → 6, users 10 → 2; archive 8.68 MB → 646 kB) is consistent with records removed directly in the database. **Who and why is unproven; whether they were real families is unknown.**
- The live counts have not been compared with a restored copy.
- The 10 November archive is to be kept under restricted storage until its status is decided.
- A fresh, complete backup must be taken and checked before the merge.
- Detail: `V1-OPERATIONS-BACKUP.md` §1.

### 5.3 Not complete: migration reconciliation on real data (G3) — owner

- Migrations 014–017 have been reconciled on **synthetic data only** (41 checks).
- The restore of a real production archive into an isolated database, and its reconciliation, has **not been run**. It needs the archive, read-only storage credentials and a trusted machine, none of which may enter an engineering session, GitHub, logs or chat.
- It must be run at the exact commit to be approved. Command: `V1-OPERATIONS-BACKUP.md` §4.
- The write-freeze rehearsal does not stand in for it.

### 5.4 Not complete: branding and licensing (G6) — owner

- Passed by engineering: the runtime assets match the register; the gated Freepik map is absent from the build; nothing was generated or redrawn.
- Open: the owner's sign-off of the Fox 1A logo as it renders in the app.
- Open: the Freepik map's licence (the map stays out until then; V1 ships without it).
- For sign-off, new on 22 November: the restyled behaviour icons (twelve of the sixteen are engineering's same-subject mapping) and the piggy bank on Child View. All are Phosphor icons at the pinned commit, MIT.
- Not needed for V1: a dedicated points star (none is drawn in the app).

### 5.5 Not complete: operational (G5) — owner

- The owner's access to run SQL on the production database through Railway, tried once with the read-only status script. Without it there is no safe rollback once savings are in use.
- That Railway keeps the old deployment serving when a new one fails its health check (documented behaviour; not tested).
- Railway's build, start and health-check settings unchanged on the day (read on 22 November).
- Separate changes, not part of this release and not applied: the backup-job hardening (one blocking finding) and the 35-day expiry rule. Neither is to be enabled before the 10 November archive's status is decided.

### 5.6 Not complete: owner sign-offs

| Gate | What is needed |
| --- | --- |
| G2 Visual | The owner's acceptance of the screens as built, including the three changes of 22 November, and a decision on the open wording (W1–W6) and design points (D1–D5) in §3.2 |
| G7b Legal and privacy for a public launch | **Not reviewed; no engineering check covers it.** The privacy policy, the list of data processors (Railway, Cloudflare R2 and any other), the rights and contact wording, and the procedure for a privacy request while permanent deletion is switched off. The owner decides whether it blocks V1 deployment or only a public launch |
| G8 Release | The owner's approval of the exact commit, after the gates above |

**Blocks permanent deletion later, not V1:** the backup hardening and the expiry rule.

## 6. Brand and licensing

| Item | Finding |
| --- | --- |
| Fox 1A | The runtime logo matches the approved source in shape, face, tail direction, star and markings. It is drawn flat with traced edges where the approved board has a soft gradient. Comparison: `evidence/v1-integrated/brand/fox-1a-fidelity.png`. The register still records "live-app fidelity sign-off pending" |
| Points star | **Correction (v1.1):** no points star is drawn anywhere in the app. `public/illustrations/stickies-star.svg` is the approved decorative star sticker, shipped and credited but unused since V1-F. A dedicated points star is "not yet approved" in the register and nothing in V1 needs one: the Child View figure uses the piggy bank the owner chose |
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
| Exact commit | Code and tests: `96f5462`. The head of the release-candidate pull request is the documents-only commit after it (this file and the checklist); a file cannot name its own commit, so the pull request and the hand-back carry that SHA, read from GitHub, with CI's result at it |
| Migrations | 014, 015, 016, 017 |
| Railway files | No `railway.json` or `railway.toml` is tracked |
| Deployment plan | Release checklist §4 and §5 |

## 8. Risks

| Risk | Likelihood | What limits it |
| --- | --- | --- |
| A migration behaves differently on real data than on synthetic | Low | G3 is exactly this test; a failed migration leaves nothing behind |
| The backup taken before the deploy is not whole | Low | Check its size on the day and keep a downloaded copy; the hardened job is not yet deployed |
| An app rollback while families use savings | Low, but serious | A write freeze in the database for the whole rollback window, and a savings check before writes resume (`V1-ROLLBACK-FREEZE-DESIGN.md`; rehearsed, 166 checks). **This does not replace the restore and reconciliation of a real backup (G3)**. Depends on the owner being able to run SQL on the production database, which is still to be tried |
| The seven families removed on 11 November were not test data | Unknown | Owner's answer (G4). The 10 November archive is the only copy |
| A workflow with write permission (`percy-materialize-brand.yml`) arrives on the default branch with this release | Low | It runs only by hand or on a push to the brand hand-over branch, and its job is limited to that branch. It does nothing on the default branch |
