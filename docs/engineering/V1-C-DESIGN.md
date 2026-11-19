# V1-C design note: Activity

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-c-activity`, stacked on V1-B `claude/percy-v1-b-children`) |
| Status | Draft, for fresh-context peer review |
| Binding inputs | Approved HTML blob `9de1df2`, screen `activity`. Plan v1.1 §2 (Activity row) and the server row "Activity filters": Goals = join `today_goal_completions.point_event_id`, never the note prefix; the Earned and Spent filters keep the undone flag |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-19 | First draft |

## 1. Scope

- `pages/Activity.jsx` is restyled to the approved screen.
- **Two additive server changes, with no migration:**
  - `GET /api/activity-feed` gains a `goals` filter and goal fields on each row.
  - `GET /api/summary` gains `goalsCompleted`.

## 2. Screen (approved strings verbatim)

- **Heading:** "Activity" and "Every point has a story. This is your family's history."
- **"This week":**
  - "{n}" with "Points earned": the sum of each child's `week_points` (the figure the page shows today).
  - "{n}" with "Goals completed": today's-goal completions this week that have not been undone.
  - The design-only line "Sample summary only; this is not a streak metric." is not shipped (§8.6).
- **"Activity log":**
  - It is shown open: the approved design has no collapse. The shipped collapse button is removed.
  - Filter chips: "All", "Earned", "Goals", "Spent" (pressed state, as in Rewards).
  - Date groups: "Today · {Weekday d Month}", "Yesterday · {Weekday d Month}", and plain "{Weekday d Month}" for older days. The last form is not in the approved HTML (owner item A1).
- **Row shapes:**

| Row | Line 1 | Line 2 | Amount |
| --- | --- | --- | --- |
| A goal completion (award with a completion) | `{Child} completed “{goal title}”` | `Today’s Goal · {category} · {time}` | `+n` |
| Other award | `{Child} earned {category}` | `{note} · {time}`, or `{time}` when there is no note | `+n` |
| Spend | `{Child} redeemed {reward}` | `Parent-confirmed reward · {time}` (owner item A2) | `−n` |
| Starting, correction, undo, deduction | The shipped wording ("started with", "had a one-off", "undo:", "had an earlier adjustment for", "adjusted") | `{time}` | Signed |

  - Time is `h:mm a` in the browser's zone (unchanged).
  - An undone row is struck through, with " · undone" (shipped).
- **Corrections:** "Correct" on eligible awards (this week, not undone) stays, with its shipped dialog.
- **Paging:** "Load earlier activity" replaces "Load More".
- **"Corrections and Undo" card:** "Historical entries remain visible when a parent corrects a mistaken award or reverses an eligible action." The design-only sentence "This preview does not change a real ledger." is not shipped.
- **Retained, not in the approved screen:** the child filter (Select labelled "Child", shown when there is more than one child). Owner item A3: keep it or drop it.
- **Removed from this screen:** "active days" and "Top categories". Their server data stays; the family report uses it.
- Empty log: the shipped "No activity found".

## 3. Server

### 3.1 Feed

- **One source.** The four filters select from the same row set as "All" (the existing union), wrapped as a subquery. Each filter is a projection of "All", so it can never disagree with it.
  - **Earned:** `type = 'earn'`.
  - **Goals:** `type = 'earn' AND goal_completion_id IS NOT NULL`.
  - **Spent:** `type IN ('spend', 'adjust')`.
  - Every filter keeps `undone`. This fixes the plan's finding: the Earned filter used `effective_point_events`, which drops undone awards, so the shipped Earned list silently disagreed with All.
- **Goal fields** on point-event rows come from a `LEFT JOIN today_goal_completions x ON x.point_event_id = p.id`, then `LEFT JOIN today_goals g ON g.id = x.goal_id`. They are `goal_completion_id`, `goal_title` (the goal's current title) and `goal_category` (`x.category_name`, as recorded at completion). Redemption rows carry NULLs.
  - An undone completion still tags its award, which is also undone. The row shows as a struck-through goal completion.
  - The join is unique: `today_goal_completions(point_event_id)` has a partial unique index (migration 014), so a row can never be duplicated.
- An unknown filter value is treated as "all" (unchanged).

### 3.2 Summary

- `goalsCompleted` counts `today_goal_completions` for the family where `created_at >= weekStart` (the family's week, as for the points) and `undone_at IS NULL`.

## 4. Contracts and code paths

| Contract | Paths |
| --- | --- |
| Feed rows | `/api/activity-feed` (only Activity reads it) |
| Summary | `/api/summary`: Activity, and `lib/familyReport` (additive field, unaffected) |
| Refresh after changes | `POINTS_QUERY_KEYS` already holds `activityFeed` and `weeklySummary`. Completing a goal refreshes `todaysGoals`; it must also refresh `weeklySummary` (it already calls `refreshPoints`, to be checked) |

## 5. Edge cases (input → expected)

| # | Input | Expected |
| --- | --- | --- |
| E1 | Goal completed, then undone | All: the award and its undo row, both struck through; the award shows as a goal. Goals: the award, struck through. "Goals completed" does not count it |
| E2 | Goal renamed after completion | The current title |
| E3 | Goal archived | Still tagged (the goal row remains) |
| E4 | An award with no completion whose note starts like a goal | Not a goal: the tag is the join only |
| E5 | A spend reversed | Spent: the spend, struck through |
| E6 | No events | "No activity found" |
| E7 | Paging across the filter | Offset applies to the filtered set |
| E8 | Long names and goal titles at 320 px | Wrap; no sideways scroll |
| E9 | A completion from before this week | Not counted in "Goals completed" |

## 6. Test plan

- **Server (DB):**
  - Every filter is a subset of All, with the same `undone`.
  - The goal tag comes from the join, not the note (E4).
  - The undone goal (E1).
  - The rename (E2).
  - `goalsCompleted` counts this week only and not undone ones (E1, E9).
  - Mutation checks: drop the `undone_at` condition; use the note prefix.
- **Render:**
  - The approved copy.
  - The three row shapes.
  - The date group labels.
  - The four filters calling the right filter.
  - Load earlier activity.
  - The Corrections card.
  - No design-only lines.
- **E2E:** the existing Activity test is updated (log open by default; the "This week" box-centring check moves to the new boxes), with axe and 44 px checks at 4 sizes.
- **Evidence:** reference vs React at 390/834/1280.
- **One class not covered:** time-zone differences between the browser and the family (rows use the browser zone, the week uses the family zone; unchanged from today).

## 7. Owner items

| # | Item |
| --- | --- |
| A1 | Older date groups as "{Weekday d Month}" (e.g. "Monday 16 November"); only "Today ·" and "Yesterday ·" are approved |
| A2 | Every spend row says "Parent-confirmed reward", including spends made before V1 through the old Child View "Spend" button (also on a parent's device) |
| A3 | The child filter is kept although the approved screen has none |
