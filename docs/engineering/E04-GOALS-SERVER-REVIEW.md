# E04: Today's Goals server review and hardening (PR #45)

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-18 |
| Owner | Percy v2 engineering. Branch `claude/percy-v2-e04-goals-server-review`, cut from PR #45 head `264960c` |
| Status | Review complete; fixes and tests on the branch. Not merged; PR #46 stays on design hold |
| Parent plan | `PERCY_V2_IMPLEMENTATION_PLAN.md`, W3 and ticket E04 |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-18 | Review, findings, fixes and test evidence |
| 1.1 | 2026-11-18 | CI green at `f8e4aa6`. N6 raised from accepted note to E05 must-fix, per the follow-up on PR #53; E05/E07 carry-over list made explicit |

## 1. Scope and method

E04 is an independent review and hardening of the backend in PR #45. It is not a rewrite.

**Code reviewed:**
- `server/migrations/014_todays_goals.sql`
- `server/todaysGoals.js`
- the parts of `server/routes.js` that touch goals: mounting, award, undo/correct (`reverseAward`), category edit/delete, family timezone
- `server/export.js`

**Baseline check.** The server files on the redesign branches (#49 → handover → #51/#52) are byte-identical to PR #45's head: `git diff` returns empty for all five files. As a control, the same diff does show changes for `src/lib/todaysGoals.js`, which is #46's client.

**Two independent passes:**
1. My own read, plus 19 new tests in `server/test/todays-goals-e04.test.js` targeting what the Batch E suite does not cover.
2. A fresh-context reviewer given only the code and the required properties, not my findings.

Every finding was reproduced with a failing test before it was fixed.

## 2. Required properties: verdicts

| Property | Verdict | Evidence |
| --- | --- | --- |
| Concurrent completion never double-awards | **Holds** | Complete locks the child row, then the goal row, then checks idempotency and done-today. The partial unique index `today_goal_once_per_day` backs this up. Tests: same request id ×6 in parallel gives one award with the rest `duplicate:true`; 6 distinct ids in parallel give one award and 5 × 409. Existing double-tap test |
| Idempotent awards | **Holds after R3** | Replay only for the same endpoint and args. A completion id reused on another goal gets 409. An award or undo id reused on a completion gets 409. **R3:** a completion id reused on the manual award route used to replay (fixed) |
| Family-local dates, timezone boundaries | **Holds** | The date and ISO weekday come from Postgres `NOW() AT TIME ZONE` once per request; inside a transaction `NOW()` is fixed. Tests at +14:00 (Kiritimati) and −11:00 (Pago Pago) are checked against the JS `Intl` tz database. NULL zone gives the UTC calendar. Completion re-checks "due" on the server at completion time, so a zone change between viewing and tapping gives 409. A one-off dated yesterday is refused |
| Ledger integrity | **Holds** | Complete → undo → redo → correct → redo: balance equals the sum of `point_events`. Each completion's `awarded_points` equals its event's points, and undone ⇔ reversed. A category repriced after completion keeps the awarded amount. A deleted category leaves the goal listed but not completable (409). Archive keeps earlier awards |
| Undo and re-completion | **Holds** | Undo/correct mark the completion `undone_at`, and the same day can be completed again (tests above plus existing correction test) |
| Cross-family isolation | **Holds** | Another family gets 404 on list, edit, archive and complete, and the row is unchanged. Another family's child or category cannot be attached on create or edit. A category restricted to other children is refused |
| Migration 014 | **Holds** | `IF NOT EXISTS` throughout. Re-running it twice leaves families, children, points, events, goals and completions unchanged. No backfill: a family that never used goals has none. Schema refuses 7 malformed shapes (missing date, weekdays on a one-off, a date on a weekly, empty weekdays, 0, 8, unknown kind) |
| Existing-family compatibility | **Holds** | Additive tables only; no change to existing rows (re-run snapshot test) |
| Export completeness | **Holds** | Includes archived goals and undone completions (with `undone_at`), and no other family's ids |

## 3. Findings

| # | Severity | Finding | Trigger | Disposition |
| --- | --- | --- | --- | --- |
| R1 | Should-fix | A weekly goal with completions, edited to a one-off, could never be completed again. The one-off "already done" check counts completions from any day | Complete a weekly goal, edit it to one-off for a later day, try to complete it | **Fixed.** Edit refuses a kind change once the goal has active completions (409 "Create a separate goal…"), the same rule as moving to another child. Kind changes on unused goals are still allowed. Test R1 |
| R2 | Should-fix | Goal edit and category delete could deadlock, or 500 on a foreign-key error. Edit locked goal → category; delete locks category → goal (ON DELETE SET NULL) | Edit a goal onto category C while C is being deleted | **Fixed.** Edit takes `FOR KEY SHARE` on the category before locking the goal, the same order as delete. 23503 maps to 404 and 40P01 to 409 on create and edit. Test R2 (a real concurrent delete transaction) went from 500 to 404 |
| R3 | Should-fix | A completion's request id was replayed by `POST /api/children/:id/award` as a duplicate award (200) instead of 409. No points were double-awarded | Complete with id R, then award with id R for the same child, category and points | **Fixed.** The award route refuses an id already claimed by a non-award endpoint before replaying. Plain award retries still replay. Test R3 |
| R4 | Note, fixed | Upper-case UUIDs passed validation but failed string comparisons (`assigned_children`, child-move check) and gave a wrong 404/409 | Upper-case `child_id` with a restricted category | **Fixed.** `parseGoal` lower-cases the ids. Test R4 |
| N1 | Note | Replaying a completion after the goal is archived returns 404 rather than the stored result | Archive, then retry the same request | Accepted. It cannot double-award, and the client treats 404 as gone |
| N2 | Note | The database does not reject duplicate weekdays (`{1,1}`) or multi-dimensional arrays. The API does reject them | Direct SQL only | Recorded. A CHECK needs an immutable helper; to do in a later migration, not in E04 |
| N3 | Note | No index on `today_goals(child_id)` or `(category_id)`, so cascades scan the table. The completions `goal_id` index is partial | Child or category delete at scale | Recorded for scale; not needed at current volume |
| N4 | Note | Migration 013 is reserved but missing. If it lands later it runs after 014 on deployed databases but before 014 on fresh ones | A future 013 | **Owner of 013 must make it order-independent.** Recorded here |
| N5 | Note | Switching a family from no timezone to a real one can move "today" back one day, so a weekly goal done for the UTC day can be done again for the new local day | First timezone auto-set | Accepted; inherent and one-off |
| N6 | **E05 must-fix** (raised in 1.1) | Editing a weekly goal that started in the past resets `start_date` to today: the #46 client clamps it (`ManageGoalsDialog` `startEditing`) and `PUT` writes it back on every save, so a rename silently moves the routine's original effective date. A past one-off cannot be edited at all | Rename an established routine | **E05**: keep the original `start_date` on title/category-only edits (the API must accept an unchanged past start date when the schedule is unchanged); ask for or state a new effective date only when the schedule actually changes. Tests: rename-only save leaves `start_date` unchanged; a deliberate reschedule sets the new date. If the reset were kept on purpose, it would need explicit owner approval |

## 4. Changes on the branch

- `server/todaysGoals.js`:
  - R1: kind-change guard on edit.
  - R2: category lock before goal, plus `conflict()` mapping for 23503 and 40P01.
  - R4: id lower-casing.
- `server/routes.js`: R3, a claimed-id check before the award replay.
- `server/test/todays-goals-e04.test.js`: 23 tests (19 hardening, 4 findings).

There are no schema changes, no data changes and no client changes. The one user-visible change: editing a completed goal from weekly to one-off (or back) now returns a clear 409. **E05 must show that message.**

## 5. Test evidence (local, Postgres 16)

| Check | Result |
| --- | --- |
| E04 tests before fixes | 19 passed; the 4 finding tests failed as predicted (200 instead of 409, 500 instead of 404, 200 instead of 409, 404 instead of 201) |
| Mutations, each restored afterwards: zone ignored; family filter removed from complete; undo leaves completion active; replay ignores args; done-check and unique index removed | Each turned at least one E04 test red |
| Full `vitest` with `TEST_DATABASE_URL` after fixes | 26 files, 408 passed (baseline on this branch: 404) |
| `eslint server` | Clean |
| `playwright test` (4 viewports, axe) | 27 passed, 9 skipped (single-viewport specs) |

**Not covered:**
- A true 40P01 deadlock is not reproduced in a test. The lock-order change removes the cycle by construction, and the mapping is the backstop.
- Wall-clock midnight is not simulated. The timezone-change test exercises the same server re-check.

## 6. Carried into E05 and E07

These come from this review and from the follow-up comment on PR #53 (2026-11-18), which is a review note, not owner sign-off or merge authorisation.

**E05 (Today's Goals UI in v2), must do:**
- [ ] Keep the original `start_date` when a weekly goal is renamed or its category changes. Change the effective date only when the schedule changes, and make that explicit. Adjust `PUT /api/todays-goals/:id` as needed. Tests: a rename-only save leaves `start_date` unchanged; a deliberate reschedule is applied (N6).
- [ ] Show the R1 409 message ("Create a separate goal…") when the parent changes the schedule type of a completed goal.
- [ ] Return the category `icon_key` with goals, and keep the category icon on completed goals with a separate Done mark (E03 completed-goal rule; the E03 test exemption is removed then).
- [ ] Make the selected child unmistakable in Today's Goals. In the current screenshots, one child's points card sits directly above a goals panel set to another child.

**E07 (screens):**
- [ ] Onboarding presents all three Percy use modes (everyday goals, positive behaviours, bigger achievements), instead of leading with screen time.

**Unchanged:** PR #46 stays on design hold. Nothing here authorises a merge or deploy.

## 7. CI

GitHub CI on PR #53 head `f8e4aa6` (run 44267690722): `build-and-test` success, `ui` success.
