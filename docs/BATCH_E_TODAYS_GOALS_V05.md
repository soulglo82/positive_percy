# Positive Percy — Batch E / Item #6: Today's Goals, v0.5

Status: **implementation specification, draft for UI review**. This PR provides the secure Goals engine first. The wider Progress/Spend split needs separate mockup approval and will not be rushed into production.

## Confirmed product decisions
- Parent-operated: shared-code account has no individual adult identity yet. No separately permissioned child account.
- Two goals: (1) **one-off** with an exact local calendar date, (2) **weekly recurring** with selected Monday–Sunday weekdays and a start date.
- Each goal applies to **one child**, links to an existing behaviour category, and awards that category's **live configured points** on completion (default +1). No separate goal point settings, deductions, or penalties.
- Completion applies only for **today in the family's timezone**, once per goal/date. There are no retroactive, future or missed-day awards.
- Today’s Goals belong in **Progress**, not a new family calendar. Parent can create/edit/retire goals. A missed one-off can be rescheduled, but not automatically charged.
- Corrections remain auditable in the point ledger. Correcting an award will mark its goal completion undone; it may be completed again if due, but only after that reversal is committed and if funds are available.
- Archived goals remain in history; editing behaviour categories doesn't rewrite past earned points.

## Data contract, migration 014 (013 reserved for pending Batch C deletion)
- `today_goals`: UUID, family_code, child_id, category_id, title, schedule_kind ('one_off'|'weekly'), scheduled_date DATE (one-off), weekdays SMALLINT[] (1..7 ISO), start_date DATE, archived_at, created/updated timestamps.
- `today_goal_completions`: UUID, family_code, goal_id, child_id, scheduled_for DATE, point_event_id, awarded_points, category_name, created_at, undone_at. Unique **active** completion for (goal_id, scheduled_for).
- Database checks protect schedule shape, date, and positive historic points. FK relationships guard accidental cross-row orphans; family scope still enforced by every API query.
- Existing family balances/categories/history are unchanged.

## API
- `GET /api/todays-goals`: today-local, per-child due goals with completion status; optional `?manage=true` includes all unarchived goals.
- `POST /api/todays-goals`: create for one owned child with owned category.
- `PUT /api/todays-goals/:id`: edit future goal settings, never past completion history.
- `DELETE /api/todays-goals/:id`: archive, not hard delete.
- `POST /api/todays-goals/:id/complete`: body `{request_id: UUID}`, **no points or date** accepted. Transaction locks the child, verifies the category and schedule today, claims idempotency, inserts a normal positive point event and completion, updates balance and streak, then commits. Duplicate requests replay; another completion the same day is rejected without new points.

## Fail-closed cases
- Wrong family/child/category -> 404, not a cross-family disclosure.
- Non-due goal or archived goal -> 409/404, no points.
- Same day duplicate, concurrent taps, retry after network failure -> at most one point award per goal/day.
- Category removed or not assigned to child -> cannot award until parent fixes it.
- Family timezone changes: schedule uses the current family timezone at completion, as do existing weekly stats. The scheduled_for local calendar date is saved on the completion. No migration of historical dates.

## UI sequence
1. Parent Dashboard Today's Goals component — per-child selected chip, due-list, complete action, recent success. Empty state links to setting up a goal.
2. Manage Goals UI — per-child title, category picker, one-off date or weekly weekdays, create/edit/archive confirmation.
3. Progress/Spend redesign mockups and review — merge Activity into Progress, child quick points there, saving for a big reward, cleaner Spend.
4. Browser/mobile and accessibility verification; data export coverage for new tables.

## Deployment boundaries
The first branch must pass PostgreSQL-backed correctness/tenant/idempotency tests and browser checks. UI redesign PR and production merge both require explicit review. Do not bypass unfinished Batch C deletion/legal gates by publishing misleading policy text.
