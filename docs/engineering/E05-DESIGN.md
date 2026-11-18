# E05 design: Today's Goals in v2 (parent UI and server integration)

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-18 |
| Owner | Percy v2 engineering, branch `claude/percy-v2-e05-todays-goals` |
| Base | The E03 head (`f09fcf5`, which contains #45, #46 and the E01–E03 stack) merged with the E04 branch (`b9d5b6a`) |
| Status | Reviewed design (v1.1); being built |
| Parent plan | `PERCY_V2_IMPLEMENTATION_PLAN.md` W4, ticket E05 |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-18 | First design |
| 1.1 | 2026-11-18 | Peer review adopted (3 blocking, 9 non-blocking). Section 9 supersedes the sections it names |

## 1. Requirements

**Sources:**
- plan W4;
- register `goals_interactions` (completed_goal A, recurring_indicator A, header_accent B, control_size_weight A);
- E04 review section 6, which records the follow-up comment on PR #53;
- v2 prototype screens 03 (Today's Goals), 08 (Manage goals) and 09 (Add a goal).

| # | Requirement | Source |
| --- | --- | --- |
| Q1 | A completed goal keeps its category icon; a separate Done mark with visible "Done" text | Register completed_goal; E03 exemption |
| Q2 | Recurring goals show the repeat icon and the actual schedule, e.g. "Repeats Mon, Wed, Fri" | Register recurring_indicator |
| Q3 | Sparkle accent next to the heading (already in E03) | Register header_accent |
| Q4 | Completion control has a 44 px target and a 24 px glyph | Register control_size_weight |
| Q5 | The selected child is unmistakable | Follow-up comment (Ava's card above a panel set to Ben) |
| Q6 | Renaming or recategorising a weekly goal keeps its original `start_date`. A new effective date only when the schedule changes, stated to the parent | E04 N6, follow-up comment |
| Q7 | The R1 409 message is surfaced when the parent changes a completed goal's schedule type | E04 R1 |
| Q8 | Server-authoritative date and points shown; no client-supplied points; no future-day completion; no duplicate processing | W4 |
| Q9 | Keyboard and screen-reader access; outcomes of failure and Undo exposed accurately | W4 |
| Q10 | No sixth navigation tab; panel on Home; Manage goals as a dialog | W4, plan §3 |
| Q11 | Empty state stays text-only; the Freepik map is not used until licensed | Register visuals |
| Q12 | Real-browser E2E: create, complete, undo, retry, edit, archive. Views at 390, 834 and 1280 px | W4 acceptance |

## 2. Server changes

**S1 (Q1).** `BASE_SELECT` adds `bc.icon_key AS category_icon_key`. It is read-only and additive. Existing clients ignore the field.

**S2 (Q6). Start-date rule on `PUT /api/todays-goals/:id`.** The goal row is read with `schedule_kind`, `weekdays`, `start_date` and `scheduled_date`.

| Edit | `start_date` result | Past dates |
| --- | --- | --- |
| weekly → weekly, weekdays unchanged, `start_date` omitted or equal to stored | **Stored value kept** | Allowed (it is unchanged) |
| weekly → weekly, weekdays changed, or a different `start_date` | Client value, or today if omitted | Must be today or later, else 400 "Choose today or a future start date for the new schedule." |
| one_off → one_off, `scheduled_date` equal to stored | Kept | Allowed, so a past one-off can be renamed |
| one_off → one_off, date changed | New date | Must be today or later (400) |
| Kind change | E04 R1: 409 if the goal has completions; otherwise the creation rules | As for creation |

Weekday comparison uses sorted arrays (`parseGoal` already sorts them). Date comparison uses `YYYY-MM-DD` strings from `to_char`, with no `Date` parsing.

**Contract:** a rename never changes `start_date`, `scheduled_date` or completions. No migration.

## 3. Client changes

### 3.1 `TodaysGoalsPanel` (Home)

**Selected child (Q5).**
- A child colour band across the top of the panel uses that child's `childColour(...).band`, the same band as their ChildCard.
- Under the heading sits a row with the child's avatar (their colour) and the text "**{Name}** · {done} of {n} complete".
- The child chips become avatar + name chips with `aria-pressed`. The selected chip uses a 2 px border in the child's colour and the selected surface.
- The polite live region announces "Showing goals for {Name}" when the selection changes.

**Server date (Q8).** A date line, e.g. "Thursday 12 November", is formatted from the server's `date` string, parsed as a UTC calendar date. It is never derived from the device clock.

**Goal row (Q1, Q2, Q4).**
- Category tile: `CategoryIcon` drawn from `category_icon_key`, **identical whether or not the goal is done**.
- Title.
- Metadata: "{Category} · +{points} point(s)", and for weekly goals a second line with the repeat icon and "Repeats Mon, Wed, Fri" (or "Repeats every day" when all 7 days are set).
- Not done: a button with visible text "+{points}", `aria-label="Complete {title}"`, at least 44×44 with a 24 px glyph (superseded by section 9, B1).
- Done: check-circle plus the "Done" text, `role="status"`.

**Lucide removal.** `CheckCircle2` and `ClipboardCheck` are removed. The E03 exemption test is deleted and the ban applies.

**Unchanged:** the completion logic (same request id on retry, in-flight guard, Undo toast, 409 handling).

### 3.2 `ManageGoalsDialog`

**List rows.**
- Category icon, title, and "{Category} · {schedule} · +{points}". The schedule reads "Mon–Fri" style or "One-off · 16 Nov".
- The repeat icon shows for weekly goals.
- Edit and archive buttons are unchanged.

**Editing a weekly goal (Q6).**
- The form keeps the stored `start_date`. The client clamp is removed.
- The start-date input is shown only when creating, or when the weekdays differ from the stored ones. In that case it defaults to the later of today and the stored date, with `min` set to today, and a hint: "The new schedule starts on {date}."
- Otherwise a read-only line shows "Running since {date}", and `start_date` is sent unchanged.

**Editing a one-off.** The date input's `min` is today, unless the date is still the stored date, so a past one-off can be renamed.

**Q7.** The server's 409 text is shown inline under the schedule buttons (`role="alert"`) as well as in the toast, and the form stays open.

## 4. User-facing text: new or changed, for owner approval (D2)

1. "{Name} · {done} of {n} complete"
2. "Showing goals for {Name}" (screen readers)
3. "Repeats Mon, Wed, Fri" and "Repeats every day". The first is the register's own example.
4. "Running since {date}"
5. "The new schedule starts on {date}."
6. Server: "Choose today or a future start date for the new schedule."
7. E04 R1 server message: "This goal has been completed before. Create a separate goal for a different schedule."

The date line uses the browser's `en-GB` formatting of the server date. These strings ship in the draft PR and are listed in it as **owner-approval blockers**.

## 5. Edge cases

| Input | Expected |
| --- | --- |
| Category deleted (`category_icon_key` null) | Neutral circle icon; "Behaviour unavailable"; complete disabled (as today) |
| Legacy key (`heart`) | Lucide heart, unchanged (E03 contract) |
| One child | No chips; avatar row still names the child |
| 7 weekdays | "Repeats every day" |
| Weekly goal created today, renamed today | `start_date` = today, unchanged |
| Weekly goal started 30 days ago, renamed | `start_date` unchanged (server test sets it with SQL) |
| Same goal: weekdays changed, stored start in the past, client resends the stored date | 400 (server); the UI never sends it, because it defaults to today |
| Past one-off renamed | 200, date unchanged |
| Past one-off moved to another past date | 400 |
| Child colour index missing (pre-010 child) | `childColour` fallback order (existing) |
| Device clock or zone differs from the family's zone | Date line and due-ness come from the server |
| Double tap, or lost reply then retry | Existing guards (in-flight set, same request id); the server is idempotent (E04) |

## 6. Decisions not taken (no inference)

- **Button glyph:** the completion button shows "+N" text only, as in the prototype. Using the approved Add icon there is not an approved mapping.
- **Panel position:** the panel stays where it is on Home. Moving it next to the selected child's card is a layout change for E07. Q5 is met inside the panel.
- **Progress, Pause, Child switch icons:** no UI in E05 (Pause is not a W4 task).

## 7. Tests

- **Server** (`todays-goals-e05.test.js`):
  - `category_icon_key` is present and follows category edits;
  - every row in the §2 table: weekly rename keeps the past start; omitted start keeps it; changed weekdays with a past start gives 400 and with today gives 200; past one-off rename is 200 and moving it to a past date is 400;
  - a rename keeps completions.
- **Unit:**
  - `goalSchedule`/`goalRepeatText` formatting, including all 7 days and unsorted input;
  - the date-line formatter for a fixed date string, including a non-UTC test runner;
  - the start-date state machine as a pure function (`editStartDate(goal, weekdays, today)`).
- **E2E** (`batch-e-goals.spec.js` extended), at 390 / 834 / 1280 with the existing axe and layout checks in `ui.spec`:
  - create weekly, complete, Undo from the toast (balance restored, button back), complete again, retry (no double award), rename (start date unchanged in the API), change weekdays (the new start hint shows), archive;
  - weekly → one-off on a completed goal shows the R1 message inline;
  - selected-child chip `aria-pressed`, and the avatar row names the child.
- **E03 guard:** remove `E05_EXEMPT`; `TodaysGoalsPanel` bans `CheckCircle2` and `ClipboardCheck`.
- **Evidence:** before/after screenshots of the panel and dialog at the three widths.
- **Not covered:** the owner's judgment of the copy and the visual result, which is what the screenshots are for.

## 7a. Guards and what they miss

| Guard | Fails on | Misses |
| --- | --- | --- |
| Server start-date tests | A rename that changes `start_date` | Client sending a wrong date for a changed schedule; covered by the E2E test |
| Category-icon-retained test (unit render: done and not-done rows draw the same icon component) | Done row swaps to a check | Styling differences (screenshots) |
| E2E undo/retry ledger check against the API | Double award; Undo not restoring | (none listed) |

## 8. Rollout and reversal

- **Rollout:** no deploy. The work goes on a stacked draft PR into #52's branch. There is no migration.
- **Server:** additive (one extra field) plus a relaxed rule (unchanged past dates accepted).
- **Reversal:** revert the E05 commits. Old clients keep working with the new server, because they always send today or later.

## 9. Amendments in v1.1 (these supersede the sections named)

**§2 S2, rewritten.**
- **Single locked read.** The `FOR UPDATE` read takes `child_id, schedule_kind, weekdays, to_char(start_date), to_char(scheduled_date)`. A second, unlocked read could compare against stale values.
- **Check order:**
  1. 404 if the goal is not found;
  2. R1 409 if the kind changed on a completed goal;
  3. **B2 409** if a completed one-off's date changed: "This goal has been completed. Create a separate goal for another date.";
  4. 409 if the child changed;
  5. 404 if the category is unavailable;
  6. 400 for date rules.
- **Weekday comparison** sorts and de-duplicates both sides. The database allows `{1,1}` (E04 N2).

| Edit | `start_date` result | Past dates |
| --- | --- | --- |
| weekly → weekly, weekdays unchanged, stored start in the **past** | **Stored value kept; the client's `start_date` is ignored.** This also neutralises old #46 tabs that send today (N1d) | Allowed (unchanged) |
| weekly → weekly, weekdays unchanged, stored start today or later | Client value if given, else stored | Must be today or later (400) |
| weekly → weekly, weekdays changed | Client value, else **the later of today and the stored start** (N1a) | Must be today or later (400 "Choose today or a future start date for the new schedule.") |
| one_off → one_off, date unchanged | Kept | Allowed (rename) |
| one_off → one_off, date changed | B2 409 if completed; otherwise the new date | Must be today or later (400) |
| Kind change | R1 409 if completed; otherwise the creation rules | As for creation |

**§3.1, the goal row.**
- **B1.** The completion button is the approved Complete control: check-circle at `h-6 w-6` with "+N".
  - It uses a new Button size, `goal` (`min-h-11 min-w-11`), added to `button.jsx`, because a height class on `<Button>` fails check-tokens (N2).
  - The Done state is a plain earn-coloured "Done" label with a smaller check-circle and no button chrome. The screenshots must show the two states can be told apart.
- **N3.** `aria-label="Complete {title}, +{N} point(s)"`, so the visible "+N" is part of the name.
- **N4, announcements and focus.**
  - Rows have no `role="status"`. Outcomes are announced by the toast only.
  - "Showing goals for {Name}" is a single polite region, updated only when the parent clicks a chip.
  - After completion, focus moves to the row's Done label (`tabIndex=-1`).
  - After an Undo from the toast, focus stays in the toast region. That is recorded, not built.
- **N5.** `ChildAvatar` gets `decorative` (`alt=""`, `aria-hidden`), so a chip's name stays "Sam". Colour classes come only from the `childColour()` slots, never from a built string.
- **N9.** The date line is formatted from fixed weekday and month arrays on the server's `YYYY-MM-DD` string. It never depends on the browser's locale or zone.

**§3.2, the dialog.**
- **N1b.** The start-date input shows when creating, when the weekdays change, or when the stored start is today or later ("Starts on"). Otherwise a read-only line shows "Started {date}". This is **N8**: "Running since" is dropped, because it reads like a streak.
- **N4.** The 409 is shown once, inline (`role="alert"`). There is no toast for save errors.
- Rows lose "Completed today" (N7). Rows show "{Category} · {schedule} · +{N} point(s)".

**§4, text for owner approval (full list, replacing the v1.0 list):**
1. "{Name} · {done} of {n} complete"
2. "Showing goals for {Name}" (screen readers)
3. "Repeats Mon, Wed, Fri" and "Repeats every day"
4. "Started {date}" and "Starts on"
5. "The new schedule starts on {date}."
6. Button "+{N}" and its name "Complete {title}, +{N} point(s)", including the singular "point"
7. Date line, e.g. "Thursday 12 November"
8. Dialog row formats: "{Category} · Mon–Fri · +1 point", "One-off · 16 Nov", "Every day"
9. Removal of the "Completed today" row text
10. Server: "Choose today or a future start date for the new schedule."
11. Server: "Choose today or a future date." (existing, unchanged)
12. Server, E04 R1: "This goal has been completed before. Create a separate goal for a different schedule."
13. Server, B2: "This goal has been completed. Create a separate goal for another date."

**§5, added rows.**
- **N1c.** Changing the schedule of a goal completed today (start moved to tomorrow, or today's weekday removed) removes today's Done row from Home. The points and history stay. This is expected and documented.
- **N1d.** An old #46 tab that sends today with unchanged weekdays is ignored when the stored start is in the past (first table row), so N6 cannot reappear from a stale client.

**§7 and §7a.**
- **N2.** E2E asserts the completion button is at least 44 px on desktop too.
- **N6.** The E2E rename check cannot backdate (the API refuses past starts). The past-start rename is proven in the server test, which backdates with SQL. The E2E test only proves the UI keeps the value it was given.

## Peer review record (v1.0 → v1.1)

| # | Finding | Disposition |
| --- | --- | --- |
| B1 | Q4's 24 px approved glyph dropped by inference | Adopted: check-circle `h-6 w-6` plus "+N", with distinct Done styling |
| B2 | A completed one-off moved to a new date can never be completed again | Adopted: 409, plus a test and the message added to §4 |
| B3 | S2 read and check order unspecified; stale-read risk | Adopted: single locked read, explicit order, deduplicated weekday compare |
| N1 | Table gaps (a–d) | Adopted (a, b, d); c documented |
| N2 | 44 px not buildable on `Button`; desktop not checked | Adopted: `goal` size, desktop E2E assertion |
| N3 | Visible "+N" not in the accessible name | Adopted |
| N4 | Live-region spam, focus loss, double 409 | Adopted. Undo focus return recorded, not built |
| N5 | Avatar alt doubles the chip name | Adopted: `decorative` |
| N6 | E2E rename proves nothing | Adopted: server test is the proof, and this is stated |
| N7 | Missing customer-facing text | Adopted: §4 is now the full list |
| N8 | "Running since" reads like a streak | Adopted: "Started {date}", flagged for the owner |
| N9 | Locale-dependent date | Adopted: fixed arrays |

## Verification record (2026-11-18, this branch)

| Check | Result |
| --- | --- |
| E05 server tests before the server change | 8 failed as predicted, 3 already passing |
| `vitest` with `TEST_DATABASE_URL` (local Postgres 16), after | 31 files, 681 passed |
| Client helpers under `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago` | 10/10 in both |
| Mutation: done tile swapped to a check icon | Render test failed; restored |
| `check:tokens` / `lint` | OK (74 files) / 0 errors, 5 warnings (baseline) |
| `playwright test` (4 viewports, axe; new E05 flow on each) | 35 passed, 9 skipped |
| Screenshots | `docs/engineering/evidence/e05/`: panel (Ben selected; Ava selected with a done goal) and dialog, at 390, 834 and 1280, before and after |
