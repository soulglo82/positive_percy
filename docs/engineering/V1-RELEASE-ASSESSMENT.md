# V1 release assessment

| Field | Value |
| --- | --- |
| Version | 1.5 |
| Issued | 2026-11-22 |
| Owner | Percy V1 engineering |
| Status | For the owner's release decision. Nothing has been merged or deployed |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.5 | 2026-11-22 | Home: Quick Points moved directly under the child picker, above Today's Goals, in the order the owner approved after comparing it with the live Home (§3.5, §4.10) |
| 1.4 | 2026-11-22 | The intermittent Settings failure returned on CI at `a9bc57b` (one of two runs of the same commit). Its cause is reproduced and the first fix shown to be wrong; the test now waits for the right signal (§4.1, §4.9). No app code changed |
| 1.3 | 2026-11-22 | Achievements card on Children redesigned at the owner's instruction (two plain rows, a weekly progress bar); the owner-approved repetition trims on Children, Home, Child View and Activity (§4.7) and their focused review (§4.8); results restated at the final commit (§2, §7) |
| 1.2 | 2026-11-22 | Owner's final release handover: the real-backup restore is waived as a mandatory gate (owner-accepted residual risk); the November change is explained (approved maintenance); four targeted items handled (§3.4); the points figure applied consistently to Home and Children at the owner's instruction; operational and privacy findings (§5) |
| 1.1 | 2026-11-22 | Owner's visual decisions built (icons, default Quick Points, Child View points box); the design critique of every page (§3.2); the owner's review of #65 (rollback write freeze, the cause of the archive change not called deliberate, legal and privacy split from technical security); the points-star statement corrected |
| 1.0 | 2026-11-22 | First issue: the final integrated validation of V1 (#57–#64), its findings, the open gates and the release candidate |

## 1. Recommendation

**Go, on the owner's explicit approval of the exact commit, after three checks on the day.** Engineering validation is complete at the commit named in §2, and the owner has decided the two gates that were open on data (§5.2, §5.3). What remains is short and is not development:

1. a fresh backup, checked by an authorised operator (§5.2);
2. proof, with a read-only command, that a trusted operator can run SQL on the production database, so the rollback write freeze is usable (§5.5);
3. the owner's visual acceptance of the screens (§5.6).

Deploying this version to the existing production environment is a separate decision from opening the product to the public. No privacy policy, contact details or list of data processors exists in the app or this repository (§5.6); that does not change with this release, and it is a matter for the owner before any public launch.

The merge is the deployment. Nothing is merged without the owner's approval of the exact commit.

## 2. What was validated

**Every result below was produced on a clean checkout of commit `07aa9fc`**, the release candidate's code and tests. (The app's code last changed at `3f9747f`; `07aa9fc` changes one browser test and adds its evidence, §4.1.) The commit after it adds only these results to this document; CI then ran everything again at that final commit (§7). (The same checks passed at `96f5462` before the final-handover changes, with 1,035 unit and server tests and 52 browser tests, at `6d0698f` and `9fa450d` before the repetition trims, with 1,039 and 52, and at `3f9747f` before the Settings test fix, with 1,040 and 52.)

| Check | Result at `07aa9fc` | Where |
| --- | --- | --- |
| Unit and server tests | 1,040 passed in 53 files; none skipped | `npm test` with a test database |
| Browser tests at 320, 390, 834 and 1280 px | 52 passed, 16 skipped by design | `npx playwright test`; the skips are explained in §4.2 |
| Reward forms and confirmation dialogs at 320, 359, 360, 390, 834 and 1280 px | Passed (part of the browser run; §3.3) | `e2e/responsive-dialogs.spec.js` |
| Accessibility (axe: nothing serious or critical), 44 px touch targets, 12 px text floor, no sideways scroll, no clipped text, no wrapped navigation, aligned tiles and figures, on every screen and dialog the browser tests open | Passed (asserted inside the browser tests) | `e2e/checks.js` |
| Lint | 0 errors (3 old warnings) | `npm run lint` |
| Design tokens | OK (86 files) | `npm run check:tokens` |
| Release gates (no gated artwork in the build) | OK: no gated file in the build | `npm run check:release-gates` |
| Generated icon module is current | Current | `node scripts/brand/build-approved-icons.mjs --check` |
| Restore-and-reconcile tool, **synthetic data** | 41 passed, 0 failed; no container left | `scripts/test/d1-restore-reconcile.test.sh` |
| Rollback write-freeze rehearsal, **synthetic data** | 166 checks, 0 failed (run on these scripts at `96f5462`; `scripts/` and `server/` are unchanged since) | `V1-ROLLBACK-FREEZE-DESIGN.md` §10–§11 |
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

### 3.4 The owner's final release handover, 22 November: targeted items

| Item | Finding | Outcome |
| --- | --- | --- |
| W3 | The ending-savings confirmation had "Save reward" beside "Keep saving": two "save" labels with opposite results | **Fixed:** "End savings" and "Keep saving". The action is unchanged (it saves the reward and ends the savings); a test asserts the two labels |
| E1 | At 320 px a goal's details ran to three lines beside its button, and "90 points" wrapped in its tile | **Fixed:** below 360 px the action sits under the text. The figures are now the shared points figure (below), which does not wrap |
| E5 | Scrolled content in a dialog was cut in mid-air under the header | **Fixed:** a line under the dialog header, as there is above its footer |
| D2 | Home's Rewards dialog: are "Spend" and "Not this time" at least 44 px? | **Confirmed, no change:** they are 44 px on touch screens (the browser tests measure this dialog on the touch phone and tablet) and 36 px with a mouse, like the app's other compact buttons. The critique measured a mouse capture |
| Consistency (owner, in the session) | "Why is the home page and child page points / icons different? The changes we just made … need to be consistently applied" | **Fixed:** one shared figure (`src/components/PointsFigure.jsx`) on Child View, Home's "Little wins" and the Children weekly-target card: the icon in a tile, the figure with its unit, the approved label beneath. Labels are unchanged per screen. The boxes-inside-a-box tiles on those two cards are gone with it (critique D1) |
| Achievements card on Children (owner, in the session) | "Achievements boxes in children is cramped and looks bad. Redesign" | **Fixed:** two plain rows with a picture each (a circled tick, a trophy), a line between on a phone, side by side from 640 px. On seeing it the owner asked for a small progress bar in place of "{n} weekly points to go": done, with the sentence kept as the bar's spoken value. The other wording is unchanged (V1-B design §11; critique D1) |

**Not reopened** (handover): Activity "This week" stays centred; Child View says "Ready to use"; Quick Points keep their layout and new-family defaults; existing families keep their Quick Points; no child login, session, app or device mode.

**Deferred to V1.1 (issue #66)** at the owner's direction: the remaining cosmetic items of §3.2 (W1, W2, W4–W6; D2's nested boxes, D3–D5; E2–E4, E6–E8).

### 3.5 Home: Quick Points moved up (owner, 22 November)

**Owner's instruction.** "On the home page the award points box needs to come above the points available and working toward sections it's the critical part of this page. Need to make it really quick and easy to give kids points so parents keep doing it". The owner then compared the live Home, the first reorder (Quick Points under Today's Goals) and a variant with Quick Points directly under the child picker, and approved the variant: "Final V1 Home order: Family streak and welcome. Child picker. Quick Points. Today's Goals. Weekly progress and points. Bigger goals and rewards… No further Home layout changes for V1."

**This departs from the approved Home design** (blob `9de1df2`), which put Quick Points last. The change is the owner's.

**Why.** On a 390 px phone the earlier V1 Home had no award button on the first screen; the owner's screenshot of the live app shows four. With the approved order, for the family in the evidence pack (three children with short names), all four Quick Points and "Award points" are on the first screen at 390 px, and awarding to any child is at most two taps.

**Contract.** After the family streak, the welcome and the child picker, Home shows four cards in this reading order: Quick Points, Today's Goals, "Little wins, big adventures!" (available points), "What you're working towards". The order in the page's markup is the same, so Tab and screen readers follow it. Nothing sits between the child picker and Quick Points. Nothing inside any card changes: same wording, same buttons, same data, same width.

| Layout | Before | After |
| --- | --- | --- |
| One column (under 1024 px wide) | Goals, Little wins, Working towards, Quick Points | Quick Points, Goals, Little wins, Working towards |
| Two columns (1024 px and wider) | Left: Goals, Quick Points. Right: Little wins, Working towards | Left: Quick Points, Goals. Right: Little wins, Working towards. Only the left column's two cards swap |

**Code path.** `src/pages/ParentDashboard.jsx` only: the order of four components, in two plain columns; and the page now waits for the first load of the family's behaviours before it draws, as it already waits for the children (see "While the behaviours load" below). No component, server, style token or wording changed. The two columns are now two wrappers read top to bottom, so on desktop the Tab order is the left column and then the right (before, it ran Goals, Little wins, Working towards, Quick Points while Quick Points sat under Goals).

**Edge cases.**

| Case | What happens |
| --- | --- |
| No Quick Points chosen | The card keeps its own empty state and its "Award points" and "Rewards" buttons; the order does not depend on a card's content |
| No goals today, or nothing being worked towards | Each card keeps its own empty state; no card can render nothing, so no card moves into another's place |
| Many goals today | Today's Goals grows downwards in the left column; nothing is pushed below it except the end of the page on desktop, and the two lower cards on phones |
| While the behaviours load | Before this change the Quick Points card said "No quick points yet. Choose them in Settings" until the behaviours arrived, then swapped to the tiles. That was at the foot of the page; as the first card it would be the first thing a parent saw, with Today's Goals jumping down after it. The page now shows its loading state until the behaviours' first load finishes. If that request fails, the page appears after one retry (about a second) with the card's empty state, as before, and a later reload of the behaviours does not take the page away again. A failure to load the children is still reported at once. If the behaviours request never answers, the loading state stays until the browser gives up; the children request already behaved that way |
| How far down Quick Points starts | It depends on the height of the child picker, which depends on the children's names. Evidence-pack family (short names): at 320 × 568 the heading starts at 429 px and the tiles are below the bottom navigation, so they need a short scroll; at 390 × 844 the whole card, with both buttons, is above the bottom navigation. Browser-test family (one 41-character name, so a taller picker): the heading starts at about 570 px at 320 × 568, and at 390 × 844 the two buttons are cut by the bottom navigation |
| Uneven columns on desktop | The shorter column ends first, at the end of the page, as before; there is no card below the two columns |

**Tests.** Two browser tests, at all four sizes.

The order test asserts: the markup order; that Quick Points is the first thing under the child picker (no more than the gap and the card's padding between them) and that the first card holds the "Award points" button; that each column holds exactly two cards with the normal 20 px gap between them. On one column: the four cards stack in order at the same left edge. On two columns: Today's Goals is under Quick Points on the left, Working towards under Little wins on the right, and the columns are equally wide and start level. On screens at least 800 px tall: Quick Points starts on the first screen. It was written first and failed on the old build at all four sizes; with the desktop columns swapped on purpose it fails on desktop only.

The loading test delays the behaviours' reply by 1.2 seconds and asserts that "No quick points yet" is never shown before the tiles appear. It was written first and failed at all four sizes before the fix.

**Not covered by the tests:** the exact 1024 px breakpoint (the test sizes are 320, 390, 834 and 1280); how far down the page Quick Points starts for a family with more than three children or with long names (see the table above); landscape phones; the failed-request path of the loading state.

**Reversal.** Restore the one block.

### Accepted deferrals (not in V1)

- Permanent family deletion (Batch C) stays off; there is no code path for it in the release candidate.
- Shared carers and the privacy controls are shown as "Planned" and "Review".
- The Goals empty-state map (Freepik) stays behind its licence gate; it is absent from the build.
- No child login, role or device restriction: V1 is operated by parents and carers only (owner's scope).

## 4. Test reliability

### 4.1 The intermittent Settings failure (CI, commits `2074d55` and `a9bc57b`)

**What happened.** The Settings browser test opens "Manage goals" and presses Escape straight away. On CI the dialog sometimes stays open and the test fails. It failed once at `2074d55`. At `a9bc57b` CI ran the same commit twice (once for each pull request): the `ui` job passed in one run and failed in the other, in three of the four screen sizes, at this one step.

**Cause: a race in the test, not a defect in the app. Reproduced.** The dialog library ignores an Escape that arrives before the dialog has registered itself as the top layer. Focus enters the dialog a few milliseconds before that registration, and the test's wait (added after `2074d55`) was "focus is inside the dialog", so it let the key go at the one moment it cannot work. Two measurements, both kept in `evidence/v1-integrated/tools/`:

| Measurement | Old wait (focus inside the dialog) | New wait (the library's mark on the dialog) |
| --- | --- | --- |
| Real key presses on a stand-alone page with the same library and browser, four runs of 100 (`escape-real-key/run.cjs`) | Lost 19, 20, 17 and 11 of 100. Every lost key arrived before the mark | Lost 0 of 100 in every run |
| The independent reviewer's own runs of that experiment | Lost between 0 and 52 of 150 from batch to batch | Lost 0 of 480 |
| An Escape sent from inside the app's page at a chosen moment, 20 trials each (`escape-timing-probe.playwright.js`) | 0 of 20 dialogs closed | 20 of 20 closed |

The swing from batch to batch fits what CI showed: three failures in one run and none in the other, on the same commit.

**The first fix was wrong.** It narrowed the window without closing it, and I recorded the cause then as a one-task window that the wait covered. The table shows it did not.

**Fix (test only; no app code changed).** The test waits for the mark (the dialog carries the library's inline `pointer-events: auto`), then two frames, before it presses Escape; the same for a nested dialog. The step still closes "Manage goals" straight after opening it, so every CI run exercises the wait, and then opens it again for the shared screen checks. If a library update drops the mark, the wait fails with its own message instead of racing. If an Escape is ever lost again, the test prints what the page saw: each Escape as it arrived, whether a handler took it, and every dialog's state at the time of the failure.

**Why only this step.** Every other Escape in the browser tests is pressed after the dialog has been open for the length of a screen check (about a second). This was the only one pressed at once.

**Limits of the evidence.** The real-key loss was reproduced on a stand-alone page, not inside the app: 176 attempts at this step in the app, and 24 runs of the whole test, lost none locally. Why the browser lets a key overtake the library's queued work is not established. The reviewer traced the library's source and found no remaining window after the mark in this version; that rests on how the library attaches a ref, not on a documented guarantee, which is why the test also allows two frames. A person cannot press a key inside a window of a few milliseconds, so users are not affected.

**Checks on the fix.** With Escape replaced by another key, the test fails and prints the diagnostics. With the mark's pattern changed to one that never matches, the wait fails with its own message. The independent review found nothing blocking; its findings are in §4.9.

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

### 4.6 Focused independent review of the final-handover changes

Scope: the five small changes of §3.4 and nothing else. **No blocking defect.** The review confirmed that `server/`, `server/migrations/` and `scripts/` are untouched, and that the ending-savings action is unchanged.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Should fix | Home's weekly figure would print "0 / null" for a child with no weekly target stored | Fixed: it shows 0; a test covers it |
| 2 | Should fix | The new "points" unit on the Children card had no test for the singular | Fixed: "1 point Available now" is asserted |
| 3 | Note | The 320 px goal-row change (E1) and the dialog header line (E5) have no automated check | **Recorded, not fixed.** Both are visible in the screenshots (`home-320.png`; any dialog). Layout class changes only |
| 4 | Note | Children now has two elements carrying the "available" marker when the savings dialog is open | Recorded; nothing depends on it. The tests that use the marker are scoped to one screen |
| 5 | Note | An unused marker on the weekly figure | Removed |
| 6 | Note, for the owner | Side effects of the shared figure beyond the icons: "18" is large with "/ 25" beside it as the unit; Children's "Available now" now reads "90 points"; the tiles' borders are gone; the two figures sit one under the other below 640 px | For the owner's visual sign-off |

### 4.7 Focused independent review of the Achievements card

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Raised as blocking on scope | The sentence "{n} weekly points to go" is no longer shown, while a code comment and the design note still said the wording was unchanged | The owner asked for the bar in its place ("instead of 25 weekly points to go put a small progress bar"). The comment and the design note are corrected; the sentence is the bar's spoken value |
| 2 | Should fix | On a phone the two rows could not shrink, so a 100-character goal name with no spaces would push the page sideways | Fixed: the rows can shrink and the name breaks |
| 3 | Note | The bar's width followed the longest line of text, so it differed between children | Fixed: the text column takes the row's width |
| 4 | Note | The test's "not a box" check depended on the order of two class names | Fixed: it checks each on its own |

Confirmed: every other string, the condition for the goal line and the data sources are unchanged; both icons are approved and hidden from assistive technology; `server/`, `scripts/` and `e2e/` are untouched.

**Repetition across the screens (owner, 22 November).** The owner approved option A (trim) on Children, Home, Child View and Activity, with conditions: the "Next milestone" row and its bar stay; no new wording, no restructured cards, no functionality removed; both tabs keep their responsibilities, and the information architecture is reviewed in V1.1 (#66). Built as four removals of repeated text (V1-B design §12).

### 4.8 Focused independent review of the repetition trims

**No blocking defect.** The review confirmed the change is only the four removals and their tests: no new wording, no restructured card, no removed function, and `server/` and `scripts/` untouched. It also confirmed, for each removal, where the same fact still appears on that screen, and that nothing else reads the removed text (filters, exports and screen-reader labels are independent of it).

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Should fix | With the week removed from "Little wins", a child's tile is the only place Home shows the weekly target, and for a child with none stored it read "18 /  this week" | Fixed: the tile shows 0; a test covers it |
| 2 | Should fix | Nothing tested the trimmed second line of the saving and moved-back rows | Fixed: both are asserted to be the time alone |
| 3 | Note | The goal row's test guarded only against the old prefix | Fixed: the line is asserted exactly |
| 4 | Note | The Children header's test was one missing substring | Fixed: the header's whole text is asserted |
| 5 | Note | The browser journey's check would also pass with the old text | Fixed: it asserts the old phrase is gone |
| 6 | Note | The Activity design table still showed the old second lines | Fixed (V1-C design v1.5) |

### 4.9 Independent review of the Settings test fix

**No blocking finding.** The reviewer traced the library's source from mount to a live Escape handler, confirmed the mark is a sound signal for the row's dialog, for a nested dialog and after a nested dialog closes, and reproduced the loss with real key presses (§4.1).

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Should fix | The Home change was being made in the same working copy during the review | The test fix is committed on its own |
| 2 | Should fix | The screen check I had added before the Escape would itself hide the race, so a green CI run would say nothing about the new wait | Fixed: the step closes the dialog straight after opening it, as before, and only then reopens it for the screen check |
| 3 | Should fix | The failure message recorded the dialogs only as each key arrived | Fixed: it also prints every dialog's state and the focused element at the time of the failure, with a two-second limit on reading them |
| 4 | Note | My probe never showed a real key press being lost | Fixed: `escape-real-key/run.cjs` does, and is kept with the evidence |
| 5 | Note | That the handler is live as soon as the mark appears rests on an incidental detail of this library version | Recorded in the test; two frames are allowed after the mark |
| 6 | Note | An unused variable in the probe; mismatched figures between two comments; the evidence README did not list the probe; the recorder ignored confirmation dialogs; the nested close had no failure message | All fixed |

### 4.10 Independent reviews of the Home order

Two reviews, each with no blocking finding: one of the first reorder (Quick Points under Today's Goals, since replaced) and one of the approved order as built. Both confirmed that the four components receive exactly the properties they did before, that no wording, handler or component file changed, that the markup order matches the order on screen at every layout, and that on desktop the Tab order is now the left column and then the right.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Should fix (first reorder) | The record claimed a short Goals card left no hole above a full-width "Working towards" card; it left 69 px | The approved layout has no full-width card: two plain columns, every card at its earlier width |
| 2 | Note (first reorder) | "Working towards" became twice as wide on desktop, stretching "no change inside any card" | As above; measured the same widths and heights as before at all four sizes |
| 3 | Should fix | The record gave the 320 px figure (570 px) for the browser-test family as if it were the evidence family's, and said the whole card is on the first screen at 390 px without saying for which family | Fixed: both families' figures are given, with the bottom navigation allowed for (§3.5) |
| 4 | Should fix | The change log cited a section that did not exist yet; the integrated evidence README did not list this departure from the approved design | Fixed: this section; the README lists it |
| 5 | Should fix | The test assumed the page had not scrolled before measuring | Fixed: it scrolls to the top first |
| 6 | Should fix | Wrong layouts the test would pass: unequal columns, an extra element between cards, a stretched gap, a Quick Points card without its buttons | Fixed: column widths, the number of cards a column, the gaps and the "Award points" button are asserted. Still not covered: a two-column breakpoint other than 1024 px between the test sizes |
| 7 | Note | While the behaviours load, the card's empty message would now be the first thing on the page | Fixed in the page, with a test written first (§3.5) |
| 8 | Should fix (review of the loading fix) | After a failed first load, any later reload of the behaviours would have put the whole page back to its loading state, closing an open Manage goals dialog; and a failure to load the children would have waited for the behaviours before being shown | Fixed: only the first attempt holds the page back, and the children's error is checked first |
| 9 | Note | The last recorded browser run was the deliberate-failure run, not a pass of the final state | The final state passed at all four sizes afterwards, and again in the full validation (§2) |

## 5. Gates: what is complete and what is not

### 5.1 Complete: engineering validation

| Gate | State |
| --- | --- |
| G1 Functional | **Passed** at `07aa9fc` (§2, §3) |
| G7a Security (technical) | **Passed:** every route checked is scoped to the signed-in family; no secrets or family data in the repository or evidence; permanent deletion stays off |
| Responsive and accessibility checks | **Passed** at four sizes, and at six for reward forms and confirmations (§3.3) |
| Rollback procedure | **Designed, reviewed and rehearsed on synthetic data** (write freeze). Its use depends on §5.5 |

Engineering items still open, none of them functional: the eight smaller build defects from the design critique (§3.2, E1–E8) and the tests listed as missing in §4.5 (#8).

### 5.2 Production backup (G4)

- **The 10–11 November change: explained and closed.** Owner's decision, 22 November: it was approved production maintenance on 11 November (two families kept, seven removed with their orphan records; recorded outcome 2 families, 6 children, 3 photos), per the owner's master backlog v2.4 and the 11 November handover. That record is outside this repository; it is recorded here on the owner's statement and agrees with the archive figures. No further investigation is a condition of release.
- **The 10 November archive** is handled under the privacy and retention obligations that apply to it, and is never exposed in GitHub or logs.
- **Still to do on the day:** a fresh backup, checked by an authorised operator (the object exists, a plausible size, `gzip -t` and a tar listing pass, a copy retrieved and kept securely). No full restore is required. Last run read from Railway's log: 21 November, 19:02 UTC, "Backup archive file is valid", 655.45 kB, uploaded.

### 5.3 Migration reconciliation on real data (G3): waived by the owner

- **Owner's decision, 22 November: not a mandatory V1 gate.** It has not been run.
- **Recorded as an owner-accepted residual risk:** migrations 014–017 have been proved on synthetic data only (41 restore-tool checks, migration-order tests, the full suites, CI). They have not been tried on real production data.
- The drill remains available as an optional extra assurance (`V1-OPERATIONS-BACKUP.md` §4).
- What limits the risk: each migration runs in one transaction and a failure stops the start, so a migration that cannot apply leaves the old version serving; 014–017 add tables and columns and do not rewrite existing rows; the post-deploy checks compare counts and each child's points.

### 5.4 Not complete: branding and licensing (G6) — owner

- Passed by engineering: the runtime assets match the register; the gated Freepik map is absent from the build; nothing was generated or redrawn.
- Open: the owner's sign-off of the Fox 1A logo as it renders in the app.
- Open: the Freepik map's licence (the map stays out until then; V1 ships without it).
- For sign-off, new on 22 November: the restyled behaviour icons (twelve of the sixteen are engineering's same-subject mapping) and the piggy bank on Child View. All are Phosphor icons at the pinned commit, MIT.
- Not needed for V1: a dedicated points star (none is drawn in the app).

### 5.5 Operational readiness (G5)

| Check | Result |
| --- | --- |
| Railway app service settings (read 22 November, read-only) | Source branch `claude/migrate-base64-percy-code-PNAym`; build `npm install && npm run build`; start `npm start`; health check `/api/health`, 120 s; one replica; it deploys on push and does not wait for CI. Unchanged since the first read |
| Live deployment | `498e798`, healthy; Railway reports it can be redeployed and rolled back to |
| Railway configuration in the code | None: no `railway.json` or `railway.toml` is tracked |
| Migration order | 014, 015, 016, 017 by name, each once, each in its own transaction. They contain no statement that inserts, updates or deletes rows (searched, with a control on earlier migrations that do) |
| Rollback and fix-forward procedure | Written and rehearsed on synthetic data: release checklist §5, `V1-ROLLBACK-FREEZE-DESIGN.md`, `scripts/ops/` |
| **Open: a trusted operator's access to the production database** | To be proved with the read-only `scripts/ops/write-freeze-status.sql` (expected answer `NOT FROZEN`). The freeze itself is not to be turned on for the test. Engineering has no database access and cannot do this |
| Backup-job hardening; the 35-day expiry rule | Separate operational backlog items, not V1 dependencies (owner). Neither is applied |

### 5.6 Owner approvals

| Subject | State |
| --- | --- |
| Visual acceptance (G2) | **For the owner.** The screens as built are in `evidence/v1-integrated/built/` and `evidence/v1-savings/`: Home, Children, Activity, Rewards, Settings, Today's Goals, savings and redemption, Fox 1A and the icons. The Freepik map is absent |
| Branding and licensing (G6) | Runtime assets match the register; nothing generated or redrawn; the Freepik map stays out until its licence is cleared. For the owner's sign-off: Fox 1A as rendered; the restyled behaviour icons (twelve of sixteen are engineering's same-subject mapping); the piggy-bank and target icons on the points figures. All are Phosphor icons at the pinned commit, MIT |
| Privacy and legal (G7b) | **Engineering's finding, not a legal opinion.** (1) No privacy policy, terms, contact details or list of data processors exists in the app or this repository; an earlier note lists "final reviewed policy text … and DPIA before publishing" as outstanding (`docs/BATCH_C_PR1_IMPLEMENTATION.md`). (2) Settings shows "Privacy & account controls" as "Review"; it is a label, not a feature. (3) Permanent family deletion is off; a family can download its data (JSON and a PDF report), and removal is by hand. No written procedure for a privacy request exists in the repository. (4) Data is held by Railway (the app runs in its Singapore region; the database is a Railway service in the same project, whose region was not read) and Cloudflare R2 (backups); a search of the app and server code found no analytics or other third-party service. (5) Anyone who reaches the app can create a family (ten per hour per address); there is no closed registration, so "restricting public acquisition" means not publicising the address. **None of this changes with V1.** Whether it must be settled before this deploy or only before a public launch is the owner's decision |
| Release (G8) | The owner's approval of the exact commit |

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
| Exact commit | Code and tests: `07aa9fc`. The head of the release-candidate pull request is the documents-only commit after it (this file and the checklist); a file cannot name its own commit, so the pull request and the hand-back carry that SHA, read from GitHub, with CI's result at it |
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
