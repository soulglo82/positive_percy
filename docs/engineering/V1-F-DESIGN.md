# V1-F design note: Award Points, Manage Goals, Goal form, Welcome, Onboarding

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-18 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-f-forms`, stacked on V1-A `claude/percy-v1-a-home`) |
| Status | Reviewed (fresh-context peer review adopted, v1.1) |
| Binding inputs | Approved HTML blob `9de1df2` (screens `award`, `goalsmanage`, `goalform`, `welcome`, `onboarding`); `V1-IMPLEMENTATION-PLAN.md` v1.1 (§2 rows Award Points, Manage Goals / Goal form, Welcome, Onboarding; §8.5, §8.6, §8.7); `E05-DESIGN.md` §9 (start-date safeguard), E04 R1/B2 |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-18 | First draft |
| 1.1 | 2026-11-18 | Peer review: 2 blocking and 4 of 5 non-blocking findings adopted, 1 answered (§7). §3 is replaced by a build-time gate. G4 and E14–E16 are added. The Settings tips are kept |

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
- The first-run flow and the Settings link both open it.
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
