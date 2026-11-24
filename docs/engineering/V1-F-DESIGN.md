# V1-F design note: Award Points, Manage Goals, Goal form, Welcome, Onboarding

| Field | Value |
| --- | --- |
| Version | 1.7 |
| Issued | 2026-11-18 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-f-forms`, stacked on V1-A `claude/percy-v1-a-home`) |
| Status | Reviewed (design peer review v1.1; code review of PR #58 fixed, v1.2; §9 design and code reviews, v1.3 and v1.4) |
| Binding inputs | Approved HTML blob `9de1df2` (screens `award`, `goalsmanage`, `goalform`, `welcome`, `onboarding`); `V1-IMPLEMENTATION-PLAN.md` v1.1 (§2 rows Award Points, Manage Goals / Goal form, Welcome, Onboarding; §8.5, §8.6, §8.7); `E05-DESIGN.md` §9 (start-date safeguard), E04 R1/B2 |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-18 | First draft |
| 1.1 | 2026-11-18 | Peer review: 2 blocking and 4 of 5 non-blocking findings adopted, 1 answered (§7). §3 is replaced by a build-time gate. G4 and E14–E16 are added. The Settings tips are kept |
| 1.2 | 2026-11-18 | Code review of PR #58 (CodeRabbit-style): all 3 actionable and 5 nitpick findings fixed (§8). O corrected: Settings opens the parenting tips, not onboarding |
| 1.3 | 2026-11-23 | The owner asked for custom points back in Give Percy Points: a parent can change the amount (§9). This reverses the v1.0 removal of the free amount recorded in §2 |
| 1.4 | 2026-11-23 | Review of PR #73 found that the amount field was replaced on the first typed character, which dropped the keyboard. The field is no longer replaced at all (§9, "Review of the pull request") |
| 1.5 | 2026-11-24 | The owner rejected the §9 layout as too clunky and chose a new one from mock-ups: slim one-line behaviour boxes, one Points row under them in the form, and on Home a "Custom points" button in place of "Award points" (§10). §10 replaces §9's layout, §9's rule that a chosen amount survives a change of behaviour, and the 22 November two-line tile rule from 375 px up |
| 1.6 | 2026-11-24 | The owner saw the built §10 form and asked for more: − and + always on screen, no points on the category boxes, the amount set only by the Points box, and the whole pop-up compressed. Version "B" was chosen from mock-ups (§11). §11 replaces §10's form layout and amount rules; §10's Home card and slim tile stand |
| 1.7 | 2026-11-24 | The owner found creating a daily goal versus a bigger goal confusing and hard to navigate, chose option C from mock-ups (one button on Home, one pop-up with two sides) and set the names: Daily Wins and Big Goals (§12). §12 replaces the list and form layout of G1 to G4 and the wording of the goal screens; the E05 rules and every server contract are unchanged |

## 1. Scope

The five V1 supporting screens. No server change and no migration. Existing server contracts are unchanged: award, goals CRUD, the E04 409s and the E05 start-date rule.

| Screen | Replaces | Container |
| --- | --- | --- |
| Award Points "Give Percy Points" | `child/AddPointsModal.jsx` (deleted) | Dialog `home/AwardPointsDialog.jsx` |
| Manage goals "Manage {Name}'s goals" | the list half of `dashboard/ManageGoalsDialog.jsx` | the same dialog, list view |
| Goal form "New goal" | the form half of the same dialog | the same dialog, form view |
| Welcome "Every adventure starts with a goal!" | the `HeroCard` no-children band and the dashed "No children added yet" card | a card on Home, shown when there are no children |
| Onboarding "Let's get started" | the five-step `OnboardingTips` carousel on first run | Dialog (first run). The Settings link "View parenting tips" keeps the five tips (`ParentingTips.jsx`, unchanged content) until V1-E restyles Settings |

**Container decision.** The approved screens are drawn as pages with "Back" and the tab bar. They stay dialogs:
- The dialog primitive already provides the focus trap, Escape to close, a sticky footer that matches the design's bottom Cancel/primary pair, and the 44 px close control.
- No new routes are needed, so no deep link can open a form without its child context.
- The E2E coverage of the award and goal paths carries over.

The design's "Back" maps to the dialog's Close and Cancel. This is recorded as an intended deviation.

## 2. Contracts

**Award (A).** `onSubmit(child, {points, category, note})` uses the child chosen **in the dialog**, not the page's selection. The amount awarded is the selected behaviour's `points`. The request is unchanged: `POST /api/children/:id/award {points, category, note, request_id}` through `applyAward`. That keeps the per-child in-flight lock, the Undo toast, streak, confetti and `check-badges`.
- The free amount (+1…+10 and the number input) and the "Other" chip are removed, because the approved form has neither. This is a capability change taken from the locked design, recorded in the PR.
- A family that wants a different amount sets the behaviour's points in Settings, as today.
- **Superseded for the amount on 23 November 2026 (§9):** the owner asked for custom amounts back. "Other" stays removed.

**A1.** The behaviours offered are those with no `assigned_children`, or those assigned to the selected child. This is the same filter as Quick Points and the old modal.
**A2.** When the selected child changes, the selected behaviour is kept if the new child can use it. Otherwise it moves to that child's first behaviour, or to none.
**A3.** The submit button is disabled while no behaviour is selected or a submission is in flight. Its label is "Award N point" or "Award N points", where N is the selected behaviour's points.
**A4.** The summary reads "{Name} earns N Percy Point(s)" and "For {Behaviour}.". The design-only sentence "No points are actually awarded in this design preview." never ships (§8.6).
**A5.** On failure the dialog stays open. `applyAward` already shows the error toast, so no second message is added.

**Goals (G).** The E05 rules hold unchanged and are still enforced by the server:
- A running weekly routine never sends `start_date`.
- A completed one-off keeps its date.
- R1 kind-change and B2 errors show inline with `role="alert"` and keep the form open.

**G1.** List view: a child strip to switch child, then "Current goals" with "N goal(s) for {Name}" and "Add goal". Each row shows the category icon, the title, the meta "{Category} · {schedule} · +N point(s)" and an Edit button with the accessible name "Edit {title}". It ends with the note "Existing completions and earned points remain safe when a goal is edited or archived."
**G2.** Form view: "New goal" or "Edit goal", with "For {Name} · earned points are awarded when you mark a goal complete".
- Section 1: "Goal details", "Goal name", "Positive behaviour" (select) and "Point value comes from the selected behaviour."
- Section 2: "When should it happen?", "Repeat weekly" / "One-off", and the Mon–Sun chips.
- Footer: Cancel, then "Create goal" or "Save changes".
**G3.** Kept although the design does not draw them, because E05 requires them: the one-off date input; the weekly "Starts on" input, or "Started {date}" when the start is locked; and the new-schedule hint. Archive moves from the list row into the edit form's footer ("Archive goal", same confirmation). This is recorded as an intended deviation (design lock vs E05 safeguard, which wins).
**G4.** The strip exists only in the list view, so the child cannot change while the form is open or saving. Every way into the form ("Add goal", Edit) and every way out (Cancel, save, archive) clears the form. That includes `editingGoal` and the behaviour, which is re-picked from the **current** child's list. A stale behaviour or a stale start-date rule therefore never carries over (review finding 2).
**G6.** Editing a goal whose behaviour is no longer offered to that child (deleted or reassigned) shows the select empty, with the disabled option "Behaviour unavailable" (already shipped copy). "Save changes" stays disabled until the parent chooses (review finding 3).
**G5.** The schedule meta reuses `goalRecurrenceV1` from V1-A, so Home and Manage say the same thing.

**Welcome (W).** "Every adventure starts with a goal!", the approved body, and "Add your first child", which opens `AddChildModal`.
- The map is the exact approved PNG (sha256 `9f31c75a…8ad1`, the same bytes as the approved HTML's embedded image). It is decorative (`alt=""`). It is **release-gated** (§3): until the owner clears the licence, the card renders without the map.
- The design's "← Back to Home" does not apply, because this is Home.
- The Today's Goals empty state ("No goals scheduled…", "Set up goals") is unchanged in V1-F. The approved V1 HTML has no goals-empty screen, and the map is gated in any case.

**Onboarding (O).** "Let's get started", "Three ways to help good habits grow.", three numbered cards with the approved text, and "Explore Percy", which closes and sets `percy_onboarding_done`.
- The first-run flow opens it. The Settings link opens the five parenting tips (`ParentingTips.jsx`), unchanged.
- The kameleon-robot illustration and the stickies-star sticker leave the app, because neither is in the locked V1 design. The E03 placement count drops from 3 to 1 (reward form, until V1-D).

## 3. Licence gate for the treasure map (v1.1: build-time, replaces the CI-job gate)

Review finding 1 is adopted. The production branch has no protection, Railway deploys straight from it, and the user's E03 instruction was that the unlicensed map stays excluded. So the map must not be able to reach a production build. It is not enough for a check to turn red.
- **Never in `public/`, never in a normal build.** The PNG stays only at its design-library source. The E03 guard "the Freepik map is not shipped or referenced" is **kept unchanged**: no copy in `public/`, and no app source names it.
- **Record.** `design/brand/RELEASE_GATES.json`, gate `freepik-treasure-map-3570506`: the sha256, the source, the served path `gated/treasure-map-3570506.png`, the env name `VITE_WELCOME_MAP`, `status: "open"`, and what clears it.
- **Build.** `scripts/brand/gated-assets.mjs` (a Vite plugin) adds the file to the build, and sets `VITE_WELCOME_MAP` to its URL, only when the gate is `cleared` with a non-empty `clearance`.
  - `PERCY_PREVIEW_GATED=1` includes it in a **local** review build, for the visual comparison only.
  - The flag is ignored whenever any `RAILWAY_*` variable is present, so a Railway build never includes it.
  - Otherwise `VITE_WELCOME_MAP` is empty and `WelcomeCard` renders no image.
- **CI.** After `npm run build`, `scripts/check-release-gates.mjs` fails if `dist/` or `public/` holds any file with a gated hash while its gate is open. This is checked by hash, so a rename does not dodge it.
- **Clearance** is the owner's decision (licence posture). Engineering does not set it. A self-asserted "cleared" is still possible in a commit. The record makes it visible in review, and it cannot happen silently through a build flag.
- **Failing inputs, each tested:**
  - an open gate with the file in `dist` (fails);
  - the same with a renamed file (fails);
  - "cleared" with an empty clearance (still excluded);
  - the preview flag on Railway (excluded).
  - Verified by real builds: a normal build has no `dist/gated` and the check passes; a preview build has it and the check exits 1; a preview build with `RAILWAY_ENVIRONMENT` set has none.
- **Not covered:** a re-encoded copy of the map (different hash), and someone hand-editing the gate to "cleared" with an invented reference. Review of `RELEASE_GATES.json` changes covers both.
- **Also recommended to the owner (outside engineering's power):** branch protection with required checks on the production branch, and Railway "wait for CI".

## 4. Edge cases (input → expected)

| # | Input | Expected |
| --- | --- | --- |
| E1 | Family has no behaviours at all | The award form shows "Add a behaviour in Family settings first." (existing shipped copy) and the submit is disabled |
| E2 | A behaviour is assigned only to Omar; the award form opens for Lara, then switches to Omar | It is not offered for Lara; it appears for Omar; the selection follows A2 |
| E3 | A behaviour worth 1 vs 3 | "Award 1 point" vs "Award 3 points"; summary "1 Percy Point" vs "3 Percy Points" |
| E4 | Double tap on Award | One request (the button is disabled while in flight, plus the `applyAward` ref lock) |
| E5 | Award fails (500 twice) | The error toast; the dialog stays open with the same selection |
| E6 | Award opened from Home for the selected child | That child is preselected |
| E7 | Manage: 0, 1 and 2 goals | "No goals yet for {Name}." (existing); "1 goal for {Name}"; "2 goals for {Name}" |
| E8 | Edit a running weekly goal and rename only | No `start_date` is sent (E05 S2 test kept) |
| E9 | Change a one-off to weekly after a completion | The server returns 409 R1; the message is inline; the form stays open |
| E10 | Archive from the edit form; network failure | The confirmation stays open (existing behaviour) |
| E11 | 0 children | The Welcome card only; no strip, no Goals |
| E12 | Onboarding closed by Escape or the X | `percy_onboarding_done` is set (same as today) |
| E13 | Long child name or behaviour name at 320 px | Wraps between words; no horizontal scroll (Playwright overflow check) |
| E14 | In Manage, Add goal for Lara (a Lara-only behaviour is preselected), then Cancel, switch to Omar, Add goal | Omar's first offered behaviour; the payload has `child_id` Omar and his behaviour |
| E15 | Edit a running routine, Cancel, then Add goal | An empty form; "Starts on" editable; `start_date` sent |
| E16 | Edit a goal whose behaviour is now assigned only to a sibling | The select shows "Behaviour unavailable"; save is disabled until a choice is made |

**Abuse cases.**
- The client can still post any points from 1 to MAX_AWARD and any category, as before. The server is unchanged: V1-F narrows the UI and grants no new capability.
- No new input reaches the server.
- The map file is a static asset; it has no new code path.

## 5. Test plan

- **Render (Vitest/jsdom), `src/components/home/V1Forms.test.jsx`:**
  - Award: E1, E2, E3, E4, E5, E6 and A4, with every approved string.
  - Welcome: no map while the gate is open; the map is decorative when the build supplies it.
  - Onboarding: the three modes; "Explore Percy" sets the storage key.
- **Render, `ManageGoalsDialog.test.jsx`:**
  - G1 copy and counts (E7), and the form copy;
  - the E8 payload has no `start_date`; the E9 inline alert;
  - Archive only in edit; switching child changes the list;
  - E14, E15 and E16 (E16 mutation-checked).
- **Guards:** `approvedIcons.test.js`. The E03 "not shipped or referenced" test is unchanged; the illustration count drops from 3 to 1.
- **Gate tests (`src/test/releaseGates.test.js`):** the §3 failing inputs, for both the build decision and the dist check.
- **E2E:**
  - `ui.spec.js` home test: open Award points and award through the form (behaviour tile, button label), Undo.
  - `batch-e-goals.spec.js`: selectors moved to the list and form views (Add goal, Edit {title}, Create goal / Save changes, Archive goal).
  - `batch-c-first-run.spec.js`: the onboarding wording.
  - axe and 44 px checks on each dialog at all four projects.
- **Visual:** reference vs React at 390/834/1280 for award, goalsmanage, goalform, welcome and onboarding, in `docs/engineering/evidence/v1-f/`.
- **Copy rule (§8.6):** `src/test/copyRule.test.js` scans app sources for every design-only note in the approved HTML ("design preview", "design only", "No points are actually awarded", "This preview does not change", "Streak figure is sample content", "is a visual concept until"). A control proves the scan sees the new files.
- **One class not covered:** behaviour lists longer than the dialog body at 320 px landscape. Scroll is the dialog body's own; no test pins its scroll position.

## 6. Rollout and reversal

- A draft PR into `claude/percy-v1-integration`, stacked on V1-A.
- Reversal is a revert of the PR. There is no data change.
- The build-time gate keeps the map out of any normal or Railway build until the owner clears it.

## 7. Peer review record (v1.0 → v1.1)

| # | Finding | Ruling |
| --- | --- | --- |
| 1 | BLOCKING: the CI-job gate cannot stop the map (no branch protection, Railway deploys from production) and it reverses the user's E03 exclusion | **Adopted.** Build-time gate (§3). The map is never in `public/`; the E03 "not shipped" test is unchanged |
| 2 | BLOCKING: stale form state across a child switch, or after cancelling an edit | **Adopted.** G4; tests E14 and E15 |
| 3 | Edit with a missing or reassigned behaviour | **Adopted.** G6; test E16, mutation-checked |
| 4a | Goals empty state not addressed | **Adopted:** stated (unchanged in V1-F) |
| 4b | Award must use the dialog's child | **Adopted:** stated in A |
| 4c | Approved copy missing from the contract | **Adopted:** the render tests pin every approved string |
| 4d | A behaviours load failure reads as "add a behaviour" | **Recorded as a known gap.** The Home query already maps a failure to `[]`, as Quick Points does today. An error state needs new copy (owner); it is tracked for V1-E, where behaviours live |
| 4e | `railway.json` on the integration branch would replace the production start command when merged | **Recorded as a release-candidate blocker for V1-G** (not V1-F's file) |
| 5 | Capability losses need owner sign-off | **Partly adopted.** The five tips are kept for Settings (no content lost). The removal of free amounts and "Other" follows the locked design; it is listed in the PR for the owner, with the effect that changing a behaviour's points also changes Quick Points and goals. The unused `kameleon-robot.svg` and `stickies-star.svg` stay in `public/` and in the credits until a cleanup decision (harmless; their licences are recorded) |
| 6 | Weak guards: the clearance string, the gated path compared with itself, an incomplete design-only list | **Adopted.** The gated-path test is gone (the map is never in `public/`; the E03 hash scan stands). Clearance is limited as stated in §3. The list is completed |
| 7 | The placeholder "What went well?" is new copy | **Answered, not adopted:** it is the approved HTML's own placeholder (`<textarea id="award-note" placeholder="What went well?">`) |

## 8. Code review record (PR #58, v1.2)

| # | Finding | Fix | Test |
| --- | --- | --- | --- |
| 1 | Switching between list and form left focus on the dialog container | Focus moves to the new view's title (`tabIndex=-1`) | `ManageGoalsDialog.test.jsx`, mutation-checked |
| 2 | The E2E Undo check could pass before Undo ran | Waits for the "Undone." toast, then for it to clear | `e2e/ui.spec.js` |
| 3 | The gate hash was compared with a pasted copy only | The test hashes the source file and compares it with the record | `releaseGates.test.js` |
| N1 | A Welcome test name overstated its gate coverage | Renamed; the gate coverage is named | (test name) |
| N2 | Onboarding comment and §2 O said Settings opens it | Corrected (here and in the code) | (none) |
| N3 | The scroll region repeated the dialog's name | Its label is the approved subtitle | Playwright axe |
| N4 | `goalScheduleSummary` was unused | Removed with its test | (none) |
| N5 | Trailing blank line in `ci.yml` | Removed | (none) |

## 9. Custom amount in Give Percy Points (owner, 23 November 2026) (v1.3)

**Owner's report, after V1 went live.** "There is no quick way to give custom points to a child as there was on the old layout."

**What was lost.** The old "Award Percy Points" dialog let a parent choose any amount: six quick amounts (+1, +2, +3, +4, +5, +10) and a number field up to 1,000, placed at the top of the dialog. V1 removed both because the approved form had neither (§2, "The free amount ... removed"), so the amount became the behaviour's own points. A parent who wants to give 5 for something worth 1 has to edit the behaviour in Settings first. That is the regression. No other place in V1 gives a custom award.

**This is not an exact restoration.** In the old dialog the amount was independent of the category and started at 1. Here it starts as the chosen behaviour's points, which is what V1 does today and what the tiles' "+N" badges promise. Two other things the old dialog had are not restored: the "Other" category, and with it the ability to award when a family has no behaviours.

**Contract (replaces the second sentence of §2 A and rule A3's "N is the selected behaviour's points").**
- The amount awarded is a whole number from 1 to 1,000.
- Until the parent chooses an amount, it is the selected behaviour's points (1 if the behaviour has none stored), and it follows the selection when the behaviour or the child changes (A2).
- When the parent chooses an amount, with a quick amount or by typing, that amount stays until the dialog closes, whatever behaviour or child is picked afterwards. To go back to a behaviour's points the parent chooses that amount.
- Tapping the quick amount that is already showing, before any amount has been chosen, changes nothing: it does not fix the amount. (Otherwise "+1" tapped on a fresh dialog would silently hold the amount at 1 when a 3-point behaviour is picked next.)
- The amount controls are disabled while an award is being sent, and a child or behaviour picked in that time is ignored (v1.4), so what is shown is what was sent.
- The summary and the button show the amount. An amount that cannot be awarded (empty, zero, negative, not whole, over 1,000) shows no summary, disables the button and makes it read "Award points".
- The award is recorded under the selected behaviour's name. The server is unchanged: `POST /api/children/:id/award` already accepts any whole number from 1 to 1,000 for any category, with no cap, and stays idempotent through `request_id` (a retry with the same amount replays; a different amount under the same id is refused).

**How it is held.** One piece of state, the parent's own amount: not chosen, emptied, or a number. The amount shown is that number, or the behaviour's points while it is not chosen. Nothing copies the behaviour's points into state, so a reload of the behaviours cannot wipe a chosen amount and behaviours that arrive late are picked up without a special case.

**Every path that decides an amount credited to a child.**

| Path | Amount | Changed here |
| --- | --- | --- |
| Give Percy Points dialog (`AwardPointsDialog.jsx`), opened from Home's "Award points" | The amount above | Yes |
| Home Quick Points tiles (`handleQuickAction`) | The behaviour's points, one tap | No |
| Today's Goals "Complete" | The goal's behaviour's points, decided by the server | No |
| Activity "Correct" and Undo | Reverse an existing amount | No |
| "Starting points" when a child is added | 0 to 1,000, typed by the parent; not an award | No |
| Server `POST /api/children/:id/award` | Validates 1 to 1,000, whole number | No |

**Layout.** The amount is the second step, directly under the child picker and above the behaviours, as the old dialog had it. At 390 px and wider the quick amounts are on the first view of the dialog; at 320 × 568 the step's heading is and the buttons need a short scroll.

- Step 2 heading: "How many points?"
- Hint: "Use the behaviour's points, or choose another amount."
- Six buttons: +1, +2, +3, +4, +5, +10, in three columns below 640 px and six from 640 px. The one equal to the amount is pressed. The group is named by the heading.
- A number field named "Percy Points" (the app's existing term), with the number keypad on phones.
- One message for an amount that cannot be awarded, other than an empty field: "Points must be a whole number from 1 to 1000." It is the server's existing message for the same rule; it is announced, and the field is marked invalid and described by it.
- The behaviours become step 3.

**New wording for the owner to approve:** the heading "How many points?" and the hint. The message, the field's name and the button labels already exist in the product.

**Edge cases (input → expected).**

| Input | Expected |
| --- | --- |
| Dialog opens, first behaviour is worth 1 | Amount 1; "+1" pressed; "Award 1 point" |
| Choose a behaviour worth 3, amount not chosen | Amount 3; "+3" pressed |
| Tap "+5" | Amount 5; "earns 5 Percy Points"; "Award 5 points"; the request carries `points: 5` and the behaviour's name |
| Type 25 | Amount 25; no quick amount pressed; "Award 25 points" |
| Type 25, then press "+4" while the field still has focus | The field shows 4; it is the same field and keeps the focus |
| Focus the field, then pick a behaviour worth 3, amount not chosen | The field shows 3; it is the same field and keeps the focus |
| Focus the field and type "2", then "5" (one key at a time, over the amount the dialog opened with) | The field shows 25 and keeps the focus throughout; "Award 25 points" (v1.4) |
| Focus the field, clear it, type "7" | Empty, then 7; the focus is kept throughout (v1.4) |
| Type "03", press "+5", press "+3" with the focus left in the field | 03, then 5, then 3 (v1.4) |
| Type "005", press "+5" with the focus left in the field | The field keeps "005"; the amount is 5 either way (v1.4) |
| Press Award, then pick another behaviour or child before the answer comes back | Ignored: the amount, behaviour and child shown stay the ones sent (v1.4) |
| Type 25 and press Award with the focus left in the field; the server refuses | The same field, enabled again, still showing 25 (v1.4) |
| Select the amount and type the same digit again | Nothing changes (the browser reports no change), so the amount is still the behaviour's (v1.4) |
| Tap "+1" while it is already pressed and no amount is chosen, then pick a behaviour worth 3 | Amount 3 |
| Type "05" | Amount 5; "+5" pressed |
| Tap "+10", then choose another behaviour, then another child | Amount stays 10 throughout, including when the behaviour moves (A2) |
| Clear the field | No amount, no message; Award disabled, reads "Award points"; choosing a behaviour does not refill it |
| Type 0, -3, 1001 or 2.5 | The message; the field marked invalid; Award disabled |
| Type 1000, "1e3" or "007" | 1000, 1000 and 7 are awarded |
| Type "1e400" | Not awarded (the browser gives either nothing or infinity) |
| No behaviour available for the child | No amount step; Award disabled, as before |
| Behaviours arrive after the dialog opened | The amount step appears with the first behaviour's points |
| The same behaviours are reloaded | A chosen amount is kept |
| A behaviour with no stored points | Counts as 1 |
| Close and reopen | Fresh form: first behaviour, its points, no chosen amount |
| Double tap on Award; the server refuses | Unchanged: one request; the form stays open (A5) |

**Abuse.** The amount is typed by a signed-in parent and validated again by the server. Nothing new reaches the server: the old dialog sent the same field.

**Outcome records.** Unchanged: one `point_events` row with the amount, the behaviour's name and the note; the Undo toast; Activity shows the amount.

**Tests, written before the build.**
- Unit (`V1Forms.test.jsx`, "Award Points: the amount"): every row above. The fourteen tests written against the first draft failed on the old dialog; they were then brought into line with this reviewed design.
- Browser (`e2e/ui.spec.js`, Home journey, four sizes): zero shows the message and the screen passes the shared checks in that state; 25 shows on the button; "+4" tapped afterwards shows in the field; choosing a behaviour keeps it; the request carries `points: 4` and the child's total rises by 4. Four is an amount no seeded behaviour has.
- v1.4, unit: the field is the same element, with the focus, after each of two typed characters, after clearing and typing, and after a quick amount, a behaviour and a child are chosen with the focus left in it. The first three failed on the v1.3 dialog. `NumberInput.test.jsx` covers the field's new option on and off.
- v1.4, browser: real keys, one at a time (select all, "2", "5"; clear; "-", "5"; select all, "1", "2"), with a mark on the field that is lost if the page replaces it. On the v1.3 dialog this step fails with "2" in the field.
- **Not covered:** pasting into the field; a real phone's number keypad; a screen reader pressing a quick amount with focus left in the field, in a real browser (the unit test covers the logic); touch widths between 320 and 390 px (the quick amounts are three to a row there, about 85 px each at 320 px).

**Rollout and reversal.** One pull request, CI, the owner's approval of the exact commit and of the new wording, then the merge (which deploys), with the read-only before and after counts. No migration. Reversal: revert the commit.

**Design review (fresh context, before the build).** No blocking finding. Adopted:

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | The first draft put the amount below the behaviours, so on a phone it needed a scroll; the old dialog had it at the top | The amount is step 2, above the behaviours |
| 2 | The first draft reset the amount whenever a behaviour was chosen, which only worked with the amount below the behaviours | Replaced by the rule above: a chosen amount stays |
| 3 | Where the amount is set mattered: keyed on the child or on the behaviour objects it would break | Nothing is copied into state; the amount is read from the behaviour while not chosen |
| 4 | The number field keeps its own text while focused, so a quick amount pressed without moving focus would not show | The field is redrawn when a quick amount is chosen; unit test. Replaced in v1.4: the field follows the amount without being redrawn |
| 5 | An amount that cannot be awarded could still appear in the summary and on the button | Hidden for every such amount |
| 6 | Six buttons in a row are under 44 px wide on phones between 320 and 385 px | Three to a row below 640 px |
| 7 | No name for the group of quick amounts; the summary's live region came and went; the messages were not tied to the field; nothing said why zero was refused | Group named by the heading; the live region stays; one announced message tied to the field |
| 8 | "Points" would have been a third new string | The field is named with the existing "Percy Points" |
| 9 | Test gaps: late behaviours, reloaded behaviours, odd number forms, a reopen test that could not fail, a browser amount a seeded behaviour could produce | All added or corrected |
| 10 | The path table missed "Starting points"; the section did not say this is not an exact restoration, or what else the old dialog had | Added |

**Code review (fresh context, after the build).** No blocking finding. It confirmed that the amount sent is always the one on the button and in the summary, that every row of the table is satisfied, and that nothing else in the app depends on the old rule.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Should fix | While no amount is chosen, the field could show an old number if a behaviour or child was picked with focus left in the field (the button and summary were right) | Fixed: the field is redrawn when the behaviour's points change underneath it; unit test. This fix caused the v1.4 defect and is replaced there |
| 2 | Note | Tapping the already-pressed quick amount fixed the amount with no visible change | Changed: it does nothing until an amount has been chosen; unit test |
| 3 | Note | The amount could be changed while an award was being sent, so the disabled button could show a newer number than the one sent | Fixed: the amount controls are disabled while sending; unit test |
| 4 | Note | A change of amount might announce only the changed number | Fixed: the summary is announced whole |
| 5 | Note | Three rows were covered thinly (the emptied field's value, the reopened dialog's behaviour, a refused award with a custom amount); no test for a typed amount pressing a quick amount | All added |
| 6 | Note | The evidence screenshots are not taken with a touch pointer, so the 44 px sizes rest on the browser tests in the touch projects | Stated here; those tests pass |
| 7 | Note | A lone "-" in the field disables Award with no message; scrolling with the pointer over the focused field drops focus | Left as they are |

**Review of the pull request (PR #73, automated review of `8995ed0`) (v1.4).**

*Finding.* The field was redrawn (React `key`) whenever the amount changed other than by typing. The key also changed on the first typed character, because that is the moment the amount stops being the behaviour's and becomes the parent's. The browser then dropped the keyboard: typing "25" over the opening amount left "2". Confirmed two ways before the fix: three new unit tests failed, and the browser step with real keys failed with "2" in the field. The v1.3 tests set the whole amount in one event and could not see it.

*Contract repaired.* The amount field is one field for as long as the dialog is open. It shows what was typed while the typing still stands for the amount, and the amount when something else set it. It is never replaced, so nothing can take the focus from it.

*Fix.* The redraw is removed, not narrowed. `NumberInput` gains an option, `followModel`, off unless asked for: while the field has focus, if the typed text no longer stands for the value it was given, the field shows the value. "Stands for" means the text is the value's own text, or the number the text reported is the value (so "007" still stands for 7 and "1e3" for 1000). The dialog's `fieldKey` state and the `key` are deleted.

*Every user of `NumberInput`.* Give Percy Points (uses the option); the reward form, the behaviour manager, the add-child and edit-child forms and the savings dialog (do not, and behave exactly as before: two unit tests hold the default).

*Rejected.* Keeping the redraw and freezing the key when typing starts: it would still replace the field, and drop the focus, whenever a quick amount or a behaviour changed under a focused field.

*Design review (fresh context, before the build; the reviewer ran the rule in a real browser).*

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Blocking for the first sketch | Comparing texts breaks when the typed number equals the field's empty value: with an empty value of 0, "0.5" lost its leading zero and "-0.5" its sign | The rule compares numbers, not texts; unit tests for an empty value of 0 and of 1 |
| 2 | Note | "007", "2.5", a lone "-" and clear-then-type keep the text and the focus; no render loop | Confirmed; unit tests |
| 3 | Note | A part-typed entry ("-", "1e") reaches the page as empty text, so a guard for text that is not a number could never run | The guard is not written |
| 4 | Note | Typing "25" into the prefilled field with real keys gives 125 unless the old text is selected first | The browser step selects all first |
| 5 | Note | No path still needs a redraw: reopening builds a new field; child, behaviour and late behaviours all arrive as the value | Confirmed |
| 6 | Note | Typed text with leading zeros, then the quick amount for the same number with the focus left in the field, keeps the typed text (the amount is the same) | Left as it is; recorded in the table above as "005" and "+5"; unit test |
| 7 | Note | The summary is announced on each typed character of a longer amount | Existing behaviour (polite, announced whole); left as it is |
| 8 | Note | Not covered by events that set the whole text: real part-typed entries | Browser step with real keys added |

*Code review (fresh context, after the build).* No blocking finding. It confirmed that with the option off the field is identical to before, that nothing still depends on the removed redraw, and that the field, the button, the summary and the amount sent agree on every path.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Should fix (older than this change) | A behaviour or child could be picked while an award was being sent, so with no amount chosen the disabled field and button could show 3 while 1 was sent | Fixed: picks are ignored while sending; unit test, which failed first |
| 2 | Should fix | Two unit rows meant for an empty value of 0 ran with the empty text, and one skipped the step where the first sketch failed | Corrected: empty value 0 with "0", "0.5" and "-0", "-0.5" |
| 3 | Should fix | The listener for React's warnings silenced everything else React said in those tests | It now fails on anything React reports |
| 4 | Should fix | This section had a row with a quick amount that does not exist ("+7"), an out-of-date status line, and "keeps its caret" in the field's notes | Corrected |
| 5 | Note | A browser sends no blur when a focused field is disabled, so the field still counts as focused after a refused award | Harmless with the option on; unit test added |
| 6 | Note | Not covered: the field's arrow stepping, and paste | Arrow stepping added to the browser step; paste is not covered |

*Mutation checks (each makes a named test fail).* Picks allowed while sending; The option removed from the dialog; the option always on; the option passed through to the page; the number comparison removed; empty text compared as 0; the typed text not brought back in line after the value takes over; the v1.3 dialog restored.

## 10. Quick Points and Custom points (owner, 24 November 2026) (v1.5)

**Owner's decisions, from mock-ups (artifact "Give Points Options", versions 4 to 7).**
1. "We keep the boxes for quick points, but they are too chunky, take too much space."
2. "Below quick points needs to be an area for custom, but again small and tight."
3. On Home, the boxes and the "Award points" button were confusing: "has to be a clear distinction between quick points and custom". Option A was chosen: the button becomes "Custom points" and stops being solid purple.
4. Colours: "A4": Custom points in a soft orange tint, Rewards in a soft purple tint, dark text on both.

The §9 layout (a full "How many points?" step with six quick amounts and a number box) was released on 23 November without the owner seeing a picture of it. That is the process failure this section corrects: §10 was chosen from pictures, and the built screens are shown to the owner before any release.

**Prior ruling this touches.** Owner review 22 November ("standardised alignment"): in Quick Points at 320 px each tile wrapped its own way, so tiles became two rows below 640 px (`BehaviourTile.jsx`). §10 keeps the reason for that ruling and narrows where the two-row layout applies. The measurable rule in `e2e/checks.js` (same part positions in every tile of a grid, no overlap, no cut-off name, equal heights in a row, all equal on Home) is unchanged and still enforced at every width.

### 10.1 Contract

**Behaviour tile (Home Quick Points and the form share `BehaviourTile.jsx`).**
- From 375 px (new breakpoint `phone`): one row, icon, name, "+N", centred on the tile's middle line. From 375 to 639 px the name is 12 px and the icon 14 px, with 6 px side padding, 4 px top and bottom, 4 px between parts, and 4 px side padding in the badge; from 640 px it is as before (14 px, 20 px icon).
- Minimum height 44 px. Two lines of a 12 px name are 32 px; with 8 px of padding and a 1 px border each side that is 42 px, so a tile with a one-line name and a tile with a two-line name are both 44 px.
- A tile's border is 1 px in every state. The form marks the selected tile with a ring (a shadow, which takes no room), so selecting a tile cannot change the room its name has.
- A name wraps at spaces. A single word wider than its space breaks; it is never clipped and never runs under the badge. There is no hyphenation (measured: the browser left capitalised words alone and hyphenated a short word that fitted the next line).
- A name needing three or more lines makes its row taller (on Home, every tile).
- Below 375 px: unchanged from 22 November (icon and "+N" above, name beneath; 14 px from 360 px, 12 px below). One row cannot hold the default names there: at 360 px in the form "Adventurous" has about 65 px and needs 79.
- Measured room for the name with a "+1" badge: 88 px at 375 px in the form, 95 px at 390 px; the widest default name, "Adventurous", needs 79 px on the build machine and a few pixels more on CI's. A browser test requires at least 7 px spare for every default name from 375 px. A longer single word, or a default name beside a wide badge at 375 px, breaks onto a second line inside the same 44 px.
- The tile's accessible name, tap behaviour and order in the page are unchanged.

**Home Quick Points card.**
- Line under the heading: "Tap a box to give its points straight away." (was "Award points for positive behaviour, whenever it happens.").
- A box still awards its own points to the selected child in one tap. No amount control on Home.
- The line is shown only when there are boxes; with none, the card keeps "No quick points yet. Choose them in Settings".
- Buttons: "Custom points" (opens the form; soft orange: `warm-soft` fill, `warm-ink` border and icon, dark text) and "Rewards" (soft purple: `accent` fill, `input` border, `primary` icon, dark text). Neither is solid. Same sizes and one-column rule below 360 px as today.
- Colours: `sunrise`, the brand orange, is decorative only (2.9 to 1 on white; `tokens.test.js` forbids it as text or a border), so the button has two new tokens. `warm-soft` #f1e4d8 is the fill; `warm-ink` #c25000 is the border and icon (3.8 to 1 on the fill, 4.7 to 1 on the card). Text is the foreground: 13.3 to 1 on `warm-soft`, 13.5 to 1 on `accent`. The Rewards border, `input`, is 3.3 to 1 on `accent` and 4.0 to 1 on the card.

**Give Percy Points form.**
- Steps: 1 "Who's earned points?", 2 "What did {name} do?". The "How many points?" step, its hint and the six quick amounts are removed.
- Under the tiles, inside step 2: one row, the label "Points" on the left; on the right "−", the number field, "+". The row is absent when the child has no behaviour to choose (as the amount step was).
- The amount starts as the chosen behaviour's points. The parent's own amount (typed, or set with − or +) belongs to the behaviour it was chosen for: it stays through a child change that keeps the behaviour, and through a reload of the behaviours.
- **Changed from §9:** tapping a box, the selected one too, sets Points back to that box's points, and so does a child change that moves the behaviour. In §9 a chosen amount survived a change of behaviour, which suited an amount placed above the behaviours. Under the boxes it would be a trap: a "+3" box tapped and 1 awarded.
- Unchanged from §9: whole numbers 1 to 1,000; the rule message, the summary and the button; nothing that decides the amount moves while an award is being sent.
- "+" adds one and "−" takes one away, kept within 1 to 1,000. From an empty field, or an amount that is not a number, either button gives 1. From a number outside the range or not whole, "+" goes to the next whole number up and "−" to the next down, then into the range (2.5: 3 or 2; 0: 1; 1001: 1000).
- At the ends of the range the button is `aria-disabled` and dimmed, not disabled (a button that disables itself under the finger drops the focus); pressing it changes nothing. "−" at the behaviour's own 1, with nothing chosen, chooses nothing: the amount still follows the behaviour. The buttons are disabled only while an award is being sent.
- The row is a group named by its label "Points", which is also the field's label.
- The field is the §9 field (`NumberInput` with `followModel`): it shows an amount set by − or + while it has focus, and is never replaced.
- Screen-reader names: the field is "Points"; the buttons are "One point fewer" and "One point more".

**New wording for the owner to approve.** Seen: "Tap a box to give its points straight away.", "Custom points", "Points". Heard only: "One point fewer", "One point more". Removed: "How many points?", "Use the behaviour's points, or choose another amount.".

### 10.2 Every path that touches the contract

| Path | File | Change |
| --- | --- | --- |
| Tile layout, both uses | `src/components/home/BehaviourTile.jsx` (`TILE_LAYOUT`, `TILE_GRID`, `TILE_GRID_EVEN`, `BehaviourTileParts`) | One row from 375 px |
| Home card | `src/components/home/HomeSections.jsx::QuickPoints` | Line, button name, button colours |
| Button styles | `src/components/ui/button.jsx` (variants `warm` and `soft`) | New |
| Tokens | `tailwind.config.js` (`warm`; the screens, now the whole list in order with `phone` added), `src/index.css`, `src/lib/tokens.js`, `src/test/tokens.test.js` | New |
| Accessibility tests | `src/test/a11y.test.jsx` (renders the card) | Passes unchanged |
| Form | `src/components/home/AwardPointsDialog.jsx` | Step removed, Points row added |
| Number field | `src/components/ui/NumberInput.jsx` | None |
| Server | `POST /api/children/:id/award` | None |
| Layout checks | `e2e/checks.js` | None (already measures one-row tiles) |
| Tests and tools naming the old button or the old step | `e2e/ui.spec.js`, `src/components/home/V1Forms.test.jsx`, `src/components/home/HomeSections.test.jsx`, `docs/engineering/evidence/v1-integrated/tools/capture.cjs` | Updated |

Other users of `StepHeading` and `behavioursFor` (the reward form, Manage goals) are not changed.

### 10.3 Edge cases (input → expected)

| Input | Expected |
| --- | --- |
| 390 px, names "Kindness", "Helpfulness", "Adventurous", "+1" | Each on one line; every tile 44 px |
| 390 px, "Tidying up without being asked", "+1000" | One row; the name on several lines, not cut, not under the badge; tiles in its row (on Home, all) one height |
| 375, 390 and 414 px, the eight default names, "+1", selected or not | One row, one line, 44 px |
| 375 to 414 px, "Brushing teeth nicely", "+10", selected or not | Two lines, 44 px |
| 360 and 320 px | Two-row tiles, as before |
| 834 and 1280 px | As before (one row, 14 px) |
| Form opens, first behaviour worth 1 | Points 1; "Award 1 point" |
| Press + four times | 2, 3, 4, 5; "Award 5 points"; the request carries `points: 5` |
| Press − at 1; press + at 1000 | Stays 1; stays 1000; the button is `aria-disabled`, not disabled |
| Press − at the behaviour's own 1, then the behaviour's points become 2 | 2 (nothing was chosen) |
| Type 25, press − | 24 in the field, which is the same element and keeps the focus if it had it |
| Clear the field, press + (or −) | 1 |
| Type 2.5, press +; type 0, press −; type 1001, press + | 3; 1; 1000 |
| Press +, then another child who has the same behaviour | The amount stays |
| Set 10 or type 40 or clear the field, then tap a box (the selected one too) | Points is that box's points |
| Omar, "Piano", set 7, then Lara (Piano is not hers) | The behaviour moves to Kindness; Points 1 |
| Press Award, then − or + before the answer | The buttons are disabled; the amount shown is the amount sent |
| No behaviour for the child | No Points row; Award disabled |
| Home: tap a box | Its own points, one tap, as before |
| Home: "Custom points" | Opens the form for the selected child |

### 10.4 Abuse, outcome records

Nothing new reaches the server: the same field, validated again there. One `point_events` row per award, the Undo toast and Activity are unchanged.

### 10.5 Tests, written before the build

- Unit (`V1Forms.test.jsx`): every form row of 10.3; the quick amounts and the old heading are gone; the field is named "Points"; the §9 focus tests (same element, focus kept) with − and + in place of the quick amounts.
- Unit (`HomeSections.test.jsx`): the new line, "Custom points" opens the form, no "Award points" button, tapping a box still awards.
- Browser (`e2e/ui.spec.js`, four sizes): Home journey with "Custom points"; real keys in the field; + pressed four times sends `points: 5`; the long-name test on Home and in the form (the shared layout checks measure the tiles); at 390 px the tiles of the seeded family are 44 px.
- Mutation checks, listed with the code review.
- Browser, added after the design review: one test sets 360, 375, 390 and 414 px itself and checks every default name (one line, 44 px, selected and not) and a two-line name (44 px) on Home and in the form, with the shared layout checks at each width.
- **Not covered:** a real phone's keypad; a screen reader in a real browser; widths other than 320, 360, 375, 390, 414, 834 and 1280 px; a family's own single word longer than about 12 letters (it breaks onto a second line; no test fixes where).

### 10.6 Rollout and reversal

One pull request, CI, the built screens shown to the owner, the owner's approval of the exact commit and the wording, then the merge (which deploys) with the read-only before and after counts. No migration. Reversal: revert the merge commit.

### 10.7 Design review (fresh context, before the build; it measured the planned classes in a real browser)

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Blocking | The orange border and icon used `sunrise`, which `tokens.test.js` forbids as text or a border (2.9 to 1) | Two new tokens, `warm-soft` and `warm-ink`; contrast asserted in `tokens.test.js` |
| 2 | Blocking | "Two lines fit in 44 px" was false with the planned padding: 46 px on Home, 48 px for a selected tile | 4 px top and bottom from 375 px; a browser test holds a two-line name at 44 px |
| 3 | Blocking | The selected tile's 2 px border took 2 px from its name: selecting "Adventurous" re-wrapped it | The border is 1 px in every state; selection is a ring; the browser test selects the widest names |
| 4 | Blocking | 360 px was the worst width for one row ("Helpfulnes s", "Adventuro us"), and `hyphens: auto` did not help | One row starts at 375 px with tighter spacing; no hyphenation; 360 px keeps two rows |
| 5 | Note | `e2e/checks.js` passes as written at every width tried | No change |
| 6 | Note | "−" at 1 with nothing chosen was unspecified; "+" then "−" left 1 chosen, so a "+3" box tapped next would award 1 | "−" at 1 chooses nothing; tapping a box sets Points to the box's points (10.1, changed from §9) |
| 7 | Note | A press at the limit announces nothing; no group; "Points" reverses §9's "Percy Points" name for the field | `aria-disabled` at the limits; the row is a group named by its label; the owner chose "Points" from the mock-up |
| 8 | Note | The new line would also show above "No quick points yet" | Shown only when there are boxes |
| 9 | Note | The path table missed `a11y.test.jsx` and the token files | Added |
| 10 | Note | CI never ran 360 to 389 px | The widths test (10.5) |

### 10.8 Mutation checks (each makes a named test fail)

A box tap keeping the parent's amount; the amount not tied to its behaviour; no upper limit on "+"; "−" at 1 counting as a choice; a number that is not whole stepped by one; the buttons usable while an award is sent; a button disabled at the limit; the old button name on Home; the line shown with no boxes.

Not held by a test: the selected tile's border width (with the final spacing, a 2 px border no longer re-wraps the default names at the tested widths; the 1 px border and ring are kept for names nearer the limit).

### 10.9 Code review (fresh context, after the build; it measured the built app)

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Blocking | From 640 px the tiles had also become small (12 px text, 16 px icon, 4 px by 6 px padding): the added `phone` screen was written after `sm` in the built styles, so `phone:` beat `sm:` | The screens are now the whole list in ascending order in `tailwind.config.js`. Confirmed before the fix by a failing browser check at 834 and 1280 px |
| 2 | Should fix | No test could see finding 1: a 44 px height was true either way | The Home journey now reads each tile's text size, padding, gap and icon size at every width: as before from 640 px (and 46 px tall, as it always was there), slim from 375 px, two rows below |
| 3 | Should fix | An amount chosen earlier came back when a child change moved the behaviour away and a later one moved it back (each child with one behaviour of their own) | The amount is cleared whenever the behaviour moves; unit test, which failed first |
| 4 | Should fix | One unit test passed either way (it could not tell a chosen 1 from the behaviour's 1) | Rewritten to test what it can show (the buttons' state at the limit); the re-render test holds "chooses nothing" |
| 5 | Note | Two height loops would pass with no tiles; a comment sat inside the next test's comment; a stale comment; the clean-up skipped closing its connection if it threw | All corrected |
| 6 | Note | The path table said 360 px; an orphan comment in the form | Corrected |
| 7 | Note | A button at its limit still showed the hover fill and a pointer | It no longer does |
| 8 | Note | The hover fills are faint and their contrast is not asserted | Left as they are |
| 9 | Note | The selected tile's ring and the focus ring do not clash and are not clipped | Confirmed |

Added to the mutation checks: an amount coming back after the behaviour moves away and back.

### 10.10 CI failure on `31d0016` and its cause

CI's `ui` job failed in the widths test: at 375 px in the form, "Adventurous" was on two lines. Locally it had 2.6 px to spare (16 px icon, 6 px badge padding); CI's machine draws the same text a few pixels wider. Not a flake: a real phone could do the same. Fix: 14 px icon and 4 px badge padding from 375 to 639 px, which gives about 9 px spare at the tightest place, and the test now requires 7 px spare, so a knife-edge pass fails on any machine. The check failed locally on the old spacing (2.6 px) before the fix.

A second fault was in the test itself, found while fixing the first: run after other tests, it sometimes measured the boxes while the pop-up was still zooming open, and read a box a fraction short. It failed twice in two repeated runs before the change and passed six times in six after it; the test now waits for the pop-up's animations to finish before measuring.

## 11. The compact form, version B (owner, 24 November 2026) (v1.6)

**Owner's decisions, from the built screens and from mock-ups (artifact "Give Points Options", versions 9 to 12).**
1. "On the pop up the + − button has been removed": in the §10 build the Points row was under the boxes and below the first screen. Chosen: the row fixed above Cancel and Award ("middle option").
2. "The categories have points listed, these don't need to be there, just the categories." "The boxes with categories do not need a value. The value is determined by the box below and altered either by entering a number or by using the + − buttons."
3. "This can all be compressed as takes too much real estate." Then, of three levels: "B".

This changes parts of the form approved in the original V1 design (numbered steps, hint lines, child cards, the cream summary). The owner chose it from pictures of exactly those changes.

### 11.1 Contract (the form only; Home is §10)

**Layout, top to bottom.**
- Title "Give Percy Points" at 18 px. The line "Notice something positive, whenever it happens." is no longer shown; it stays as the dialog's description for screen readers.
- The child picker, straight under the title, with no heading: one line per child, a 24 px avatar (12 px initial) and the name, no weekly figure and no progress bar. The buttons wrap: each is as wide as its content, grows to share its row, and is never wider than the row; a name wraps only when it is wider than the whole row. The selected child is marked by a ring, so every button's border is the same width. The group keeps its name, "Choose a child". Home's picker is unchanged (the form uses a compact form of the same component).
- "What did {name} do?" as a plain heading at 16 px: no number badge, no hint line.
- The category boxes: icon and name, no "+N". One row at every width below 640 px (with no badge the name has room even at 320 px), 44 px tall, two-line names the same height, the selected box marked by the ring. From 640 px as the Home tile without its badge. Every category the child can use is listed, the family's own included (unchanged: `behavioursFor`).
- "Add a note": a link. Tapping it shows the note field (label "Add a note (optional)", placeholder "What went well?", two lines) and puts the cursor in it. It stays open once opened or once it holds text; a reopened form starts closed and empty.
- Fixed at the bottom of the pop-up, outside the scrolling part: the Points row (label "Points", "−", the number, "+"), then Cancel and the Award button.
- The cream "{name} earns N Percy Points / For {category}." box is no longer shown. The same sentence stays in a visually hidden polite live region outside the scrolling part, updated half a second after the last change, so a change of amount, child or category is still announced, once ("125", not "1", "12", "125").
- In a window under 420 px tall (a phone on its side, for instance) the footer cannot stay fixed without squeezing the list to nothing, so the pop-up scrolls as one piece. Whether a phone's keyboard makes the window that short depends on the browser; it was not tested on a device.
- The form exists only while the pop-up is open, so every opening starts from fresh state and nothing of the last one is drawn.
- While an award is being sent the note cannot be opened or changed either.

**The amount (replaces §9 and §10's amount rules).**
- Points starts at 1 each time the form opens.
- It changes only when the parent types a number or presses "−" or "+". Choosing a category or a child never changes it. A category's stored points are not used by the form (they are still what a Quick Points box gives on Home).
- Unchanged: whole numbers 1 to 1,000; "−" and "+" step by one inside that range, from an empty or unusable amount give 1, from a number that is not whole go to the next whole number in that direction; at a limit the button is `aria-disabled`, not disabled; the rule message "Points must be a whole number from 1 to 1000." for an amount that cannot be awarded. It is drawn over the bottom of the list, directly above the fixed area, and takes no room of its own: in the flow it moved the row and the buttons by up to 42 px under the finger; an empty field says nothing; the Award button reads "Award N point(s)" or, when it cannot award, "Award points" and is disabled; nothing moves while an award is being sent; the field is never replaced (`followModel`).
- With no category for the child: "Add a behaviour in Family settings first.", no Points row, Award disabled (as before).

**What is sent.** Unchanged: `{ points, category: the chosen category's name, note }`.

**Wording.** New: "Add a note" (the link). Kept: "Points", "One point fewer", "One point more", "Add a note (optional)", "What went well?". No longer shown: "Who's earned points?", "Select the child receiving the award.", "Choose a positive behaviour.", the numbers 1 and 2, the "+N" on the form's boxes, the cream summary.

### 11.2 Every path that touches the contract

| Path | File | Change |
| --- | --- | --- |
| Form | `src/components/home/AwardPointsDialog.jsx` | Layout and amount rules above |
| Child picker | `src/components/home/HomeSections.jsx::FamilyStrip` | A `compact` option, used only by the form |
| Tile | `src/components/home/BehaviourTile.jsx` | The badge is optional; a layout for tiles without one |
| Layout checks | `e2e/checks.js` | A tile grid that declares `data-tile-badge="none"` is measured without a badge and fails if one appears; any other grid still needs one on every tile |
| Avatar | `src/components/child/ChildAvatar.jsx` | A 24 px size |
| Screens | `tailwind.config.js` | `short` (height under 420 px) |
| Other users of `FamilyStrip` (Home, Children, Child View, Manage goals) and of the pop-up's building blocks (`dialog.jsx`) | | None |
| Evidence tool | `docs/engineering/evidence/v1-integrated/tools/capture.cjs` | None; pictures retaken |
| Home card, Quick Points awards, server | | None |
| Tests | `V1Forms.test.jsx`, `HomeSections.test.jsx`, `e2e/ui.spec.js` | Rewritten for the above |

`StepHeading` stays exported: the reward form and Manage goals use it.

### 11.3 Edge cases (input → expected)

| Input | Expected |
| --- | --- |
| Open the form | First child the form was opened for; first category selected; Points 1; "Award 1 point"; note closed |
| Tap a category worth 3 on Home's terms | Points stays 1 |
| Type 5, tap another category, tap another child | Points stays 5 |
| Press + four times | 5; the request carries `points: 5` and the chosen category's name |
| Clear the field | Empty; Award disabled, "Award points"; no message |
| 0, −3, 1001, 2.5 typed | The rule message; Award disabled |
| Tap "Add a note", type, send | The note is sent; reopening the form shows the link again and no text |
| 390 × 844 with nine categories | Everything visible without scrolling |
| More categories than fit | The list scrolls; the Points row and the buttons stay in view |
| A child with one category of their own, switch child | The category moves (A2); Points unchanged |
| 320 px | One-row boxes; names of the default set on one line |
| No category for the child | Guidance line; no Points row; Award disabled |
| Press Award, then +, a category or a child before the answer | Ignored; what is shown is what was sent |

### 11.4 Abuse, outcome records

As §10.4: nothing new reaches the server; one `point_events` row, the Undo toast and Activity unchanged.

### 11.5 Tests

- Unit (`V1Forms.test.jsx`): the layout (no numbers, hints, summary box, "+N"; the description kept for screen readers; the hidden live sentence); every amount row of 11.3; the note link; the compact picker's names; nothing moves while sending; focus kept in the field.
- Unit (`HomeSections.test.jsx`): the compact picker; Home's picker unchanged.
- Browser (`e2e/ui.spec.js`): the journey at four sizes (real keys, `points` in the request, the note); at 390 × 844 the form's scrolling part does not scroll with the fixture's categories and the Points row is inside the screen at every size; the widths test for the form's boxes at 320, 360, 375, 390 and 414 px with spare room; the long-name test.
- Browser, added after the design review: windows of 390 × 450, 320 × 300 and 568 × 320 (every control can be brought on screen and used); the form's boxes at 320 and 360 px as well.
- **Not covered:** a real phone's keypad and its effect on the fixed row (on an iPhone the keyboard does not resize the page; the browser has to bring the field into view itself); a screen reader in a real browser; more than about a dozen categories.
- The unit tests for this section were rewritten alongside the code, not before it; each rule is held by a mutation check (11.8).

### 11.6 Rollout and reversal

As §10.6, in the same pull request (#74). The built screens are shown to the owner before any release.

### 11.7 Design review (fresh context, before the build; measured on the mock-up's restyling of the built pop-up)

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Note | The fixed footer is 123 px (149 with the rule). The field and buttons stay inside the pop-up down to 320 × 300; Award is first lost in a window 200 px tall | Under 420 px of height the pop-up scrolls as one piece; browser test at three short sizes |
| 2 | Note | Nothing in the server or the app assumes an award from the form equals the category's points. Settings and the family report still show "N points" on each behaviour, which now applies to Quick Points and goals only | No code change; raised with the owner as a wording question for Settings |
| 3 | Note | The live sentence spoke on every digit; "Add a note" must be a button and the field must take the focus in the same tap or a phone keyboard will not open; the live region belongs outside the scrolling part | All adopted |
| 4 | Blocking | The child picker as three fixed columns left a name 27 to 41 px: "Omar" had 0.2 px spare at 390 px and broke at 320 px; the fixture's long name made the picker 256 px tall | Wrapping buttons sized by their content (11.1); 24 px avatar; ring for the selected child |
| 5 | Note | Tiles without a badge are sound at 320 px (99 px for the name). The layout checks should accept a badge-less grid only where the grid says so | `data-tile-badge="none"` |
| 6 | Note | The path table missed the avatar, the other users of the picker and the evidence tool; the heading's size was not stated | Added; 16 px |
| 7 | Note | No test ran at a reduced height; a typed amount, then a child with no category, then back, was untested | Both added |
| 8 | Note | The rule message in the flow moved the row by 13 to 42 px, enough for a second tap on "−" to land on a category | The message takes no room (11.1) |

### 11.8 Mutation checks (each makes a named test fail)

A category setting the amount; no reset to 1 on opening; no upper limit on "+"; the note field not focused when it opens; the description shown; the sentence spoken at once; the rule message in the flow; a child picked while an award is being sent; "−" disabled at 1; the Points row inside the scrolling part.

### 11.9 Code review (fresh context, after the build; it measured the built app)

No blocking finding. It confirmed that what is sent is what is shown on every path, that short windows scroll as one piece, that the compact picker never overflows (1 to 6 children, a 62-letter word, 320 and 390 px), and that the layout checks reject a Home grid without badges and any mixed grid.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | Should fix | The form was reset in an effect on the next opening, so a reopened pop-up drew the last opening for one frame: an old note field took the focus and was removed 12 ms later | The form is mounted only while the pop-up is open; the reset effect is gone. Unit test listens for the focus |
| 2 | Should fix | The short-window browser test passed with the short-window rule removed | It now reads which part scrolls at each size |
| 3 | Note | The note could be opened or typed in while an award was being sent | Disabled while sending; unit test |
| 4 | Note | At 320 px the rule message is two lines and, at the end of the list, covers most of the "Add a note" link while the amount is wrong | Left: it goes when the amount is corrected, and it no longer moves anything |
| 5 | Note | A comment said three children (the fixture has two); two pages using the picker were missing from 11.2; "Android with the keyboard open" was not verified | Corrected |
| 6 | Note | The sentence for screen readers is spoken half a second after every opening, as the old summary was | Left as it is |

Added to the mutation checks: the form reset in an effect and always mounted (the focus test); the short-window classes removed (the browser test).

## 12. Daily Wins & Big Goals, option C (owner, 24 November 2026) (v1.7)

The owner's report: "creating a daily goal vs a big goal is confusing and difficult to navigate". Found by reading the live code: a daily goal is added through a small "Manage goals" link (three taps); a bigger goal is added in the Rewards tab by ticking a box at the bottom of the reward form and is then funded from the Children tab; nothing on Home adds one; and "goal" names three things. The owner chose option C from mock-ups (rounds 1 to 3, sent as pictures) and set the names **Daily Wins** and **Big Goals**. The owner also asked for the Daily Win icons to be kept on the pop-up's rows.

The owner also called the "Little wins, big adventures!" card out of place and chose "Points 1" from two mock-ups; that is §13.

### 12.1 Contract

| ID | Rule |
| --- | --- |
| W1 | **Two names, one each.** The daily item is a "Daily Win"; the reward a child saves towards is a "Big Goal". Every string a parent or child can read, client and server, uses these names (table in §12.6). The word "goal" alone no longer names either; the weekly figure is always "weekly target". This is wording only: no table, column, API path, field name or query key changes, and no stored value changes: a completion still writes the note prefix `Today’s Goal: ` (it is parsed by `Activity.jsx::goalTitleOf`), and the family report shows it as "Daily Win: " |
| W2 | **One door on Home.** The Daily Wins card ends with one full-width button, "Manage Daily Wins & Big Goals". It opens the pop-up for the child selected on Home, on the Daily Wins side. The card's empty state has no button of its own |
| W3 | **One pop-up, two sides.** One Radix dialog with four views: the list, the Daily Win form, the Big Goal form and the savings view. List view: title "Daily Wins & Big Goals" (with a screen-reader description naming the child); in the body, the compact child picker (only with two or more children), then a switch: a group labelled "Show" of two `aria-pressed` buttons, "Daily Wins" and "Big Goals" (pressing the pressed one does nothing; focus stays on it), then a named region with the chosen child's items for the chosen side. The footer holds exactly one button, "Add Daily Win" or "Add Big Goal". Only the header and footer are fixed; the body (picker, switch, list) scrolls as one. Changing child keeps the side; changing side keeps the child |
| W4 | **Daily Wins side.** One row per Daily Win of the child that is not archived (the query the list uses today, `loadTodaysGoals(true)`): the behaviour's icon, the title, and "behaviour · recurrence · points". The whole row is one native button named "Edit {title}" that opens the form for that Daily Win. Loading, failure with "Try again", and empty ("No Daily Wins yet for {name}.") as today |
| W5 | **Big Goals side.** One list item per reward that is marked `is_bigger_goal` and assigned to the child (`goalRewardsFor`), at the server's figures when the child has savings in it (`child.goals` holds only goals with savings), else 0 saved, in `goalOrder`. Each item holds two sibling controls, never one inside the other: a native button named "Edit {name}" (the picture, name, "{saved} of {cost} points saved", the progress bar, and "Hidden from children" when it is), which opens the Big Goal form; and a button "Save points" (named "Save points for {name}") that opens the savings view on that goal, or "Redeem" (named "Redeem {name}") when the saved points already cover the cost. A goal the child has already asked for (in `reward_stack_priced`) has neither and says "Asked for" (rule S1 of the savings design). Rewards load while the pop-up is open (not per view); loading shows "Loading Big Goals…", a failure with no data shows "Could not load Big Goals." and "Try again"; empty: "No Big Goals yet for {name}." |
| W6 | **Daily Win form.** The fields, limits and rules of today's goal form, unchanged (G2 to G4, E05: a running routine never sends `start_date`; a completed one-off keeps its date; the server's 409s show inline). Layout: title "New Daily Win" / "Edit Daily Win", "For {name}"; "What is it?" (name); "Points for" (the behaviour select; each option reads "{behaviour} · {n} point(s)" and the chosen behaviour's icon shows beside the select); "When" ("Every week" / "One day", then the days and "Starts on", or "Date"); "Archive Daily Win" when editing. Buttons: Cancel, "Save Daily Win". No numbered steps, no hint lines |
| W7 | **Big Goal form.** `RewardForm` with `variant="bigGoal"` and `forChild`, shown inside the pop-up (`embedded`), so there is one save path and one delete path for rewards. It shows: title "New Big Goal" / "Edit Big Goal"; who it is for; "What is it?"; "Points needed"; the picture row with Change (the picker opens only on Change, with no numbered heading); "Delete Big Goal" when editing. It hides the description, "Visible to children", the Big Goal tick-box and the child list (by variant; `children` is still passed, the savings warnings need it). **New:** the payload is the form's usual one with `is_bigger_goal: true`, `assigned_child_ids: [forChild.id]` (an id taken from the live children list) and `visible_to_child: true`. **Edit:** the payload is only `title`, `cost_points` and, if the picture was changed, `icon_key`; the server's update is partial (`scopedUpdate` sets only the keys sent), so an edit here cannot change who the goal is for, hide it, un-mark it or end anyone's savings, whatever another device did meanwhile. Who it is for: "For {name}" on a new one; on an edit the names of the assigned children that still exist (ids compared in lower case), or "For the whole family". Delete uses the form's existing confirmation and savings warning (D1 §21) and says it deletes the Big Goal for everyone it is for |
| W8 | **One dialog, four views.** `ManageGoalsDialog` owns the child, the side and the view. The Big Goal form and the savings view are `RewardForm` and `SavingsDialog` rendered `embedded` (their own header, body and footer without their own dialog), so no dialog is ever stacked on or swapped for another (the confirmation alerts inside a form are the existing exception) and the picker's child and the side survive every view change. On every view change focus moves to the new view's title, as the pop-up does today. **Leaving a view:** Cancel or Close returns to the list on the side it came from; Escape, the X and a tap outside close the whole pop-up from any view, as they do from today's goal form. **After a savings move or a redeem succeeds the whole pop-up closes**, because the Undo toast cannot be used while a dialog is open (`SavingsDialog` reports `acted`). **After the pop-up closes** focus returns to the button that opened it when the caller passes it (`returnFocusRef`; Home does) |
| W9 | **Nothing a parent knows stops working.** Children page (its Daily Win buttons, its savings Edit, its reward form), Settings and the Rewards tab keep their routes and behaviour, with the new names. One addition: `start` accepts `{ side: 'bigGoals' }`, used by the Children page's "No Big Goals yet" line so it no longer sends the parent to the Rewards tab. A Big Goal for the whole family or for several children is still made in the Rewards tab; the pop-up makes one for one child |

### 12.2 Every path that touches the contract

| Path | File | Change |
| --- | --- | --- |
| Home card | `dashboard/TodaysGoalsPanel.jsx` | Title, empty state, messages (W1); one button (W2); passes `rewards` nothing: the pop-up loads its own |
| Pop-up | `dashboard/ManageGoalsDialog.jsx` | List view rebuilt (W3 to W5); form view relaid (W6); opens `RewardForm` and `SavingsDialog` as siblings (W7, W8); loads `['rewards']` only while open |
| Opened from | `TodaysGoalsPanel` (Home), `pages/Children.jsx` (`start`: list, new form, one goal, and now `side`), `pages/ParentProfile.jsx` (Settings) | All keep opening on the Daily Wins side unless `start.side` says otherwise |
| Big Goal form | `rewards/RewardForm.jsx` | `variant` prop (W7). Default variant unchanged except names |
| Reward save and delete | `hooks/useRewardMutations.js` | Optional toast words so a Big Goal says "Big Goal added." |
| Savings pop-up | `savings/SavingsDialog.jsx` | `embedded`, `initialGoalId` (honoured in the opening effect only when it is one of the options), `onClose({ acted })`, a line when there is nothing to save towards; names |
| Server messages | `server/todaysGoals.js`, `server/routes.js` | Message text only (W1). The stored note prefix is not changed |
| Family report | `lib/familyReport.js` | Shows the stored prefix as "Daily Win: " |
| Page error cards | `pages/ParentDashboard.jsx`, `pages/Children.jsx` | The "Couldn't load children" card shows only when there is nothing to show: a failed background refresh no longer unmounts the page and the open pop-up |
| Reward mutations | `hooks/useRewardMutations.js` | `save` resolves after the lists have been refetched, so the pop-up never returns to a stale list |
| Home "working towards" | `home/HomeSections.jsx`, `savings/GoalProgress.jsx` | Label "Big Goal" |
| Names elsewhere | `pages/Children.jsx`, `pages/Rewards.jsx`, `rewards/RewardTile.jsx`, `pages/Activity.jsx`, `pages/ChildView.jsx`, `pages/ParentProfile.jsx`, `OnboardingTips.jsx`, `home/WelcomeCard.jsx`, `lib/todaysGoals.js`, `server/routes.js` (messages only) | W1, per §12.6 |

Input survey (what has never run on this path): `RewardForm` has never been opened from Home or Settings, never without its child list, and never with a preset child; `SavingsDialog` has never been opened with a goal chosen for it; the goals pop-up has never loaded rewards. Each is an edge case below.

### 12.3 Edge cases (input → expected)

| # | Input | Expected |
| --- | --- | --- |
| X1 | One child in the family | No child picker; everything else the same |
| X2 | Child with no Daily Wins and no Big Goals | Both sides show their empty line and their Add button |
| X3 | Switch child while on the Big Goals side | Stays on Big Goals, lists the new child's |
| X4 | A Big Goal assigned to the whole family (empty `assigned_child_ids`) | Listed for every child; its form says "For the whole family"; saving an edit keeps the list empty |
| X5 | A Big Goal assigned to two children, edited from one child's pop-up | Form says "For Lara and Omar"; the save sends the same two ids |
| X6 | New Big Goal while another child is selected in the picker | Assigned to the child the picker shows, not the child Home shows |
| X7 | Big Goal with nothing saved | Listed at "0 of {cost} points saved" |
| X8 | Big Goal the child has asked for | Listed, "Asked for", no "Save points" |
| X9 | Big Goal fully saved | "{cost} of {cost} points saved · Ready to redeem"; "Save points" still opens the savings pop-up, where Redeem is |
| X10 | Editing a Big Goal's cost below what a child has saved | Server and form behave as from the Rewards tab (the form is the same component) |
| X11 | Delete a Big Goal with savings | The form's existing warning and confirmation; on success the row is gone and the pop-up is back |
| X12 | Rewards fail to load | Big Goals side shows "Could not load Big Goals." and "Try again"; Daily Wins side unaffected |
| X13 | Leave the Big Goal form or the savings view with Cancel / Close; with Escape, X or a tap outside | Cancel / Close: back on the Big Goals list for the same child, nothing saved. Escape, X, outside: the whole pop-up closes, nothing saved |
| X14 | Save points (or move back, or redeem) from the pop-up | The whole pop-up closes; the toast's Undo can be tapped; Home shows the new figure |
| X15 | Daily Win whose behaviour was removed | Row reads "Behaviour unavailable"; the form makes the parent choose again (unchanged rule) |
| X16 | Opened from Children with `start: { goal }` or `{ view: 'form' }` | Opens on that form; Cancel returns to the Daily Wins list |
| X17 | Long names (60 characters, no spaces) in rows and titles | Wrap inside the row; no sideways scroll at 320px |
| X18 | 320px wide; 390px with 12 Daily Wins; six children on a 568px-high screen | The title and the Add button stay put; the picker, switch and list scroll together; the list is never squeezed to nothing |
| X19 | Double tap on "Save Daily Win" or "Save Big Goal" | One request (the forms' existing guards) |
| X20 | A behaviour with 1 point and one with 5 | Options read "· 1 point" and "· 5 points" |
| X21 | Another device changes who a Big Goal is for, hides it or un-marks it while its form is open here; the parent then renames it | Only the name, cost and picture are sent; the other device's change stands; no savings warning appears |
| X22 | The reward was deleted elsewhere; Save | The server's 404 shows as an error toast, the form stays; Cancel returns to the list, which no longer shows it |
| X23 | A Daily Win archived elsewhere while its form is open; Save | The server's message shows inline (existing rule) |
| X24 | A Big Goal hidden from children | Listed, with "Hidden from children" |
| X25 | Saved more than the cost (cost lowered later) | The row shows the server's figures and offers Redeem |
| X26 | Rewards still loading when the Big Goals side is chosen; rewards refetch fails while a list is already shown | "Loading Big Goals…"; the list stays |
| X27 | The children refetch fails after a save while the pop-up is open | The page and pop-up stay; no error card replaces them |
| X28 | Points needed: empty, 0, 1, 1001, a decimal | Save is disabled for empty, 0 and a decimal; 1 and 1001 save |
| X29 | Two Big Goals with the same name | Both listed, each with its own figures |
| X30 | The Home button's label at 320px | Wraps inside the button; nothing is cut off |
| X31 | Child chosen in the picker differs from the child the pop-up opened for; open a form; Cancel | Back on the list for the picker's child |
| X32 | The pop-up closes after being opened from Home | Focus is on "Manage Daily Wins & Big Goals" |

### 12.4 Abuse, outcome records

No new input reaches the server: the Daily Win form sends today's payload and the Big Goal form sends a subset of `RewardForm`'s payload. Checked in `server/routes.js` (design review): a reward title is trimmed and cut to 100 characters, a cost must be a number of at least 1, an icon key must be a known one, and `assigned_child_ids` is lower-cased but **not** checked against the family. That gap is older than this change and is inert across families (the balance rule and migration 016's trigger are family-scoped), and this change does not widen it: the only id the pop-up sends is one read from the family's own children list. A decimal cost is refused by the form (`Number.isInteger`), as today. Both server gaps are recorded for the backlog rather than changed here, because a check must tolerate rows that already hold a deleted child's id. Outcome records are unchanged: Daily Win completions and savings moves are ledger rows as before; creating or editing either kind writes no points.

### 12.5 Tests

Unit (Vitest, failing first): the pop-up's sides and switch (W3), rows and their two sibling controls (W4, W5, X3, X7, X8, X9, X24, X25), one Add button per side, loading, empty and failed states (X2, X12, X26), the four views, return to the same child and side (W8, X13, X31), close after a savings move (X14), no nested interactive control (axe on both sides of the pop-up); the Daily Win form's payloads for a new weekly, a new one-day, an edit of a running routine (no `start_date`) and the option text (X20); `RewardForm` `bigGoal` variant: new payload (W7, X6), **an edit sends exactly `title`, `cost_points` and a changed `icon_key`, also after the `reward` prop changes under the open form (X21)**, who-it-is-for line (X4, X5, deleted child skipped), hidden controls absent, default variant's payload unchanged; `SavingsDialog`: `initialGoalId` honoured and ignored when not an option, `acted`; Home card: one button, new names, empty state without a button; family report prefix. Server: the message texts that tests already assert. Browser (Playwright, all four sizes): Home to pop-up to each form and back; add a Daily Win and see it on Home; add a Big Goal, save points towards it, **tap Undo on the toast**, save again and see it under "Big Goal" on Home; focus returns to the Home button (X32); the Children page's `start` paths and Settings open the pop-up; X17, X18 and X30 by measurement; no page scrolls sideways.

Naming guard (`src/test/naming.test.js`): parses every non-test `.js` and `.jsx` under `src` and every `.js` under `server` with `@babel/parser` and reads only string literals, template text and JSX text (never comments or identifiers). A text that reads as prose (it has a space, or starts with a capital letter) fails when it matches `/\bgoals?\b/i` not directly preceded by "Big ", or `/bigger|routine|Today.s Goal/i`, unless the exact text is in a short allow-list with a reason beside each entry (the stored note prefix, the unused "Goal Getter" badge and terminology file, the family-goals API messages, which have no screen). Its own counter-examples run in the same file: a fixture string "Edit goal" fails and "Edit Big Goal" passes. What it cannot see, text assembled from pieces at run time, is covered by the browser journey reading the rendered pop-up, forms, Home, Children, Rewards, Activity and Settings for the retired words.

Not covered: a real phone's on-screen keyboard over the forms; a screen reader in a real browser; the dialog's 200 ms open and close animation (the browser tests run with reduced motion).

### 12.6 Wording (for the owner's approval on built screens)

| Where | Today | New |
| --- | --- | --- |
| Home card title | Today's Goals | Daily Wins |
| Home card, nothing today | No goals scheduled for {name} today. / Add a weekly routine or a one-off task to give them something to work towards. / Set up goals | No Daily Wins for {name} today. / Something to do today or every week. |
| Home card button | Manage goals | Manage Daily Wins & Big Goals |
| Home card messages | Loading goals… / Could not complete the goal. Please try again. / That goal is already recorded. / This goal has already been completed. | Loading Daily Wins… / Could not complete the Daily Win. Please try again. / That Daily Win is already recorded. / This Daily Win has already been completed. |
| Pop-up title | Manage {name}'s goals | Daily Wins & Big Goals |
| Pop-up, removed | Create routines, update schedules or archive goals safely. / Current goals / {n} goals for {name} / Existing completions and earned points remain safe when a goal is edited or archived. | (none; the archive confirmation still says earned points stay) |
| Pop-up lists | Add goal / No goals yet for {name}. / Could not load goals. | Add Daily Win / No Daily Wins yet for {name}. / Could not load Daily Wins. / Add Big Goal / No Big Goals yet for {name}. / Loading Big Goals… / Could not load Big Goals. / Save points / Redeem / Asked for / Hidden from children |
| Daily Win form | New goal / Edit goal / Goal name / Positive behaviour / Repeat weekly / One-off / Create goal / Save changes / Archive goal | New Daily Win / Edit Daily Win / What is it? / Points for / Every week / One day / Save Daily Win / Archive Daily Win |
| Daily Win form, removed | the two numbered headings and their hints; "earned points are awarded when you mark a goal complete"; "Point value comes from the selected behaviour." | For {name} |
| Daily Win messages | Goal added. / Goal updated. / Goal archived. Earned points stay in history. / Archive this goal? / {title} will no longer appear in daily goals. … / Could not save the goal. / Could not archive the goal. | Daily Win added. / Daily Win updated. / Daily Win archived. Earned points stay in history. / Archive this Daily Win? / {title} will no longer appear in Daily Wins. … / Could not save the Daily Win. / Could not archive the Daily Win. |
| Big Goal form | (new) | New Big Goal / Edit Big Goal / For {name} / For the whole family / What is it? / Points needed / Picture / Change / Save Big Goal / Delete Big Goal / Big Goal added. / Big Goal updated. |
| Home label | Saving for something bigger | Big Goal |
| Savings pop-up | Saving for something bigger / Set points aside for {name}'s bigger goal. … / Bigger goal | Save points for a Big Goal / Set points aside for {name}'s Big Goal. … / Big Goal |
| Reward form (Rewards tab) | Bigger goal / End this bigger goal's savings? / … if you re-enable the goal. | Big Goal / End this Big Goal's savings? / … if you make it a Big Goal again. |
| Rewards tab | Bigger rewards / · Bigger achievement | Big Goals / · Big Goal |
| Activity | Goals completed / Bigger goal removed | Daily Wins completed / Big Goal removed |
| Tips and welcome | 1. Today's Goals / Make daily and weekly routines easy to see and celebrate. / 3. Save for something bigger / … or something bigger to save towards. / Every adventure starts with a goal! | 1. Daily Wins / Make things to do each day easy to see and celebrate. / 3. Save for a Big Goal / … or a Big Goal to save towards. / Every adventure starts with a Big Goal! |
| Home, other | Could not load today's goals. / View all goals and rewards / {name} hit their weekly goal. | Could not load Daily Wins. / View all Big Goals and rewards / {name} hit their weekly target. |
| Daily Win form, other | No behaviours available / Behaviour unavailable / Add a behaviour in Family settings first. / The new schedule starts on … / Started … | unchanged |
| Add a child | Goal they'll work towards each week | Target they'll work towards each week |
| Children page | Saving for something bigger / No bigger goals yet. / Mark a reward as a bigger goal / {name}'s goals / New goal / Manage all goals / Goals completed / Weekly target and bigger goal | Big Goals / No Big Goals yet. / Add a Big Goal / {name}'s Daily Wins / New Daily Win / Manage all Daily Wins / Daily Wins completed / Weekly target and Big Goals |
| Settings | Children & goals / Today's Goals / Recurring routines and one-off achievements | Children, Daily Wins & Big Goals / Daily Wins & Big Goals / Things to do and things to save for |
| Child View | A child-friendly view of goals, points and rewards. / My next big adventure | A child-friendly view of Daily Wins, points and rewards. / My Big Goal |
| Activity, other | Goals (filter) / a goal | Daily Wins / a Daily Win |
| Savings pop-up, other | … more than this goal needs. … | … more than this Big Goal needs. … |
| Big Goal form, other | Delete {title}? / This will permanently delete this reward. … / Reward deleted | Delete {title}? / This will permanently delete this Big Goal for everyone it is for. … / Big Goal deleted |
| Server messages (shown as they are) | Goal title must be 1–100 characters. / Choose a one-off or weekly routine. / Unable to save this goal right now. / Goal not found. / … Create a separate goal … / This goal is not scheduled for today. / Goal already completed today… / More than this goal needs / Could not update goals | Daily Win name must be 1–100 characters. / Choose every week or one day. / Unable to save this Daily Win right now. / Daily Win not found. / … Create a separate Daily Win … / This Daily Win is not scheduled for today. / Daily Win already completed today… / More than this Big Goal needs / Could not update Daily Wins |

Any other string found by the naming guard is renamed by the same two rules and added to this table. "Little wins, big adventures!" would have sat beside "Daily Wins"; §13 removes it.

### 12.7 Rollout and reversal

Client and server-message change only; no migration, no data change, nothing irreversible. Release is the usual merge after the owner approves the built screens and the exact commit. Reversal is a revert of the merge commit; a Daily Win or Big Goal made meanwhile is an ordinary goal or reward and stays valid.

### 12.8 Design review (fresh context, before the build; read against the code at `c256c5f`)

Seven blocking findings, all adopted in the text above; fourteen non-blocking, adopted unless noted.

| # | Finding | Ruling |
| --- | --- | --- |
| B1 | §12.4 claimed the server checks `assigned_child_ids` against the family; it only lower-cases them. It also accepts a decimal cost (500) and cuts, not refuses, a long title | §12.4 corrected. The id sent comes from the live children list (W7). The two server gaps predate this change and are not widened by it; recorded for the backlog (the reviewer offered this as one of two acceptable fixes) |
| B2 | "An edit sends the stored values for every hidden field" is a lost update: the form copies the reward once per opening, so a rename could revert another device's change or re-mark a goal | W7: an edit sends only `title`, `cost_points`, changed `icon_key`. X21 and its test |
| B3 | W8 did not say where state lives; closing and reopening the dialog around a sibling would lose the child, the side and the `start` form, and focus | W8 rewritten: one dialog, four views, `embedded` forms, focus rule, leaving rules; X13, X31, X32 |
| B4 | X14 was wrong: returning to a modal pop-up makes the Undo toast unusable | W8: the pop-up closes after a savings move or redeem; X14; the browser test taps Undo |
| B5 | W5 put a button inside a button | W5: two sibling controls per item; axe on the pop-up in the unit plan |
| B6 | The stored note prefix `Today’s Goal: ` is parsed by Activity and printed by the family report; W1 contradicted itself | W1: the stored prefix stays; the report translates it for display; `server/todaysGoals.js` added to §12.2 |
| B7 | The naming guard as drafted could not enforce W1 (only `.jsx`, six phrases, comments indistinguishable) | §12.5: parser-based guard over `src` and `server`, allow-list with reasons, counter-examples, plus rendered-page checks |
| N8, N9 | Strings the table missed; replacements that read wrongly ("Big Goal" over a list, "weekly goal", Child View's third name) | §12.6 extended; Children heading is "Big Goals"; "weekly goal" becomes "weekly target"; Child View's "My next big adventure" becomes "My Big Goal" (for the owner's approval with the rest) |
| N10 | Size of the test change, and mocks that break once the pop-up loads rewards | Accepted; the three suites get a `Reward` mock |
| N11 | Variant traps: defaults at open, hide by variant not by an empty child list, who-it-is-for matching, delete affects every child it is for, `done()` not awaited | W7; reward mutations row in §12.2 |
| N12, N13 | `initialGoalId` only if an option; nothing-to-save state; rewards query must follow the outer `open` | §12.2 savings row; W5 |
| N14 | A failed children refetch replaces the page (and the pop-up) with an error card | §12.2 page error cards row; X27 |
| N15 | Children's "No bigger goals yet" still sends the parent to Rewards; Settings row needs new words | W9 (`start.side`); §12.6 Settings row |
| N16 | Missing edge cases | X21 to X31 |
| N17, N18 | Switch details; the Home button at 320px | W3; X30 |
| N19, N20 | Test gaps; a description for each view | §12.5; W3 |
| N21 | The pop-up makes a Big Goal for one child only | W9 says so. Not changed: a whole-family goal stays a Rewards-tab task |

## 13. The points line on Home, "Points 1" (owner, 24 November 2026) (v1.7)

The owner: the "Little wins, big adventures!" card "looks out of place". It is a heading and a slogan around one number. From two mock-ups the owner chose Points 1: one slim line directly under the child picker.

### 13.1 Contract

| ID | Rule |
| --- | --- |
| P1 | Home shows the selected child's available points once, in one slim card directly under the child picker and above Quick Points: a 36px piggy-bank tile, "Available now for {name}", and "{n} point(s)" at `text-lg`. One `<p>` holds the label and the figure with a real space between them, so it reads and copies as "Available now for Lara 90 points"; the name is in `<bdi>`; the icon is hidden from screen readers; it is not a live region (an award already raises a toast). On a phone the figure sits at the right and drops under the label when both are too long for one line; from `lg` the figure follows the label directly rather than sitting at the far edge of a wide page. **This supersedes the owner's rule of 22 November (`V1-RELEASE-ASSESSMENT.md` §3.5, "Nothing sits between the child picker and Quick Points"), by the owner's own choice of this layout from a picture on 24 November.** The cost is measured on the built page and reported to the owner: where Quick Points now starts and whether its boxes and both buttons are still on the first screen at 390 × 844 |
| P2 | The figure is the one shown today: `available_points`, falling back to `total_points`, then 0, printed as plain digits. `data-available` stays on the bare number. The line carries no `data-figure` (that hook's alignment check in `e2e/checks.js` is for the stacked figure on Children and Child View, which keep `PointsFigure`); Home now differs from those two screens on purpose |
| P3 | The heading "Little wins, big adventures!" and the line "Every positive step counts." are removed. The line is a paragraph, not a heading, so the heading outline of Home is Welcome back, Quick Points, Daily Wins, What you're working towards |
| P4 | Order on a phone and in the DOM: child picker, points line, Quick Points, Daily Wins, What you're working towards. At desktop width the left column is Quick Points then Daily Wins and the right column is What you're working towards alone |

### 13.2 Paths, edge cases, tests

Paths: `home/HomeSections.jsx` (`LittleWins` becomes `AvailableLine`), `pages/ParentDashboard.jsx` (placement), their tests, the Home order test in `e2e/ui.spec.js`, `src/test/a11y.test.jsx`. `PointsFigure` stays for the Children page and Child View.

| # | Input | Expected |
| --- | --- | --- |
| A1 | 1 point | "1 point" |
| A2 | 0 points; no `available_points` but `total_points` 40; neither field | "0 points"; "40 points"; "0 points" |
| A3 | A 30-character name with no spaces and 1000000 points at 320px | The name breaks inside the line, the figure drops under it, nothing is clipped and the page does not scroll sideways |
| A4 | 1000000 points with a short name | "1000000 points" on one line at the right |
| A5 | Select another child | The name and the figure both change |
| A6 | Home loading, failed with nothing to show, or no children | No line |
| A7 | A name in Arabic script | The number and "points" keep their order (`<bdi>`) |
| A8 | Desktop, child with no Big Goal and no requests | The right column is the short "What you're working towards" card alone; columns stay level at the top |

Tests: unit for P1 to P3 (the exact text of the line, the bare number hook, no heading, no live region) and A1, A2, A5 (as a prop change), A7. Browser, all four sizes: the Home order test is rewritten, not edited: three headings (Quick Points, Daily Wins, What you're working towards); the line is directly under the picker and Quick Points directly under the line (replacing "Quick Points is within 48px of the picker"); the Quick Points heading is still on the first screen at 800px tall or more, and at 390 × 844 the Quick Points card ends above the bottom navigation for the test family; the line is outside the two-column grid; the right column holds exactly one card; columns level and equal width as before; A3 and A4 by measurement; A6. Not covered: a screen reader in a real browser; text zoom at 200%; widths under 320px.

### 13.3 Design review (fresh context, before the build)

Two blocking findings, both adopted: P1 overrode the owner's recorded rule of 22 November without saying so or measuring the cost (now stated in P1, measured and reported); the Home order test needed a rewrite, not an edit (now listed). Ten non-blocking, adopted: no `data-figure` and the bare-number hook (P2); the other readers of `LittleWins` (path list); one paragraph with a real separator and no live region (P1); the heading trade-off (the line belongs to no heading and is reached by reading on from the child picker: accepted); edge cases A2 split, A3 with A4, A6 to A8; the desktop figure kept next to its label (P1); "card" and "line" are the same thing: a card-styled row of about 52px.

Wording: "Available now for {name}" is new (today: "Available now" under the figure). Removed: "Little wins, big adventures!", "Every positive step counts.".

Rollout and reversal: as §12.7.

