# V1-C design note: Activity

| Field | Value |
| --- | --- |
| Version | 1.5 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-c-activity`, stacked on V1-B `claude/percy-v1-b-children`) |
| Status | Reviewed (§8); build may start |
| Binding inputs | Approved HTML blob `9de1df2`, screen `activity`. Plan v1.1 §2 (Activity row) and the server row "Activity filters": Goals = join `today_goal_completions.point_event_id`, never the note prefix; the Earned and Spent filters keep the undone flag |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.5 | 2026-11-22 | Owner's visual review: a row's second line no longer repeats its kind ("Today's Goal ·", "Reward redeemed ·", "Savings ·"); a time never breaks across lines; "started with {n} points"; Undo on a redemption for 10 minutes. The approved row shapes of §3 are otherwise unchanged. Detail: V1-B design §12 and the release assessment §3.2 |
| 1.4 | 2026-11-19 | Post-build code review (§10); §2, §3.1 and §6 brought in line with §9 |
| 1.3 | 2026-11-19 | Owner review of PR #62 (§9): A1 accepted with the year when not this year; A2 changed to "Reward redeemed"; A3 kept; A4 changed to the title at completion (from the award's note, linked rows only, "a goal" otherwise); days, Today/Yesterday and times in the family's zone |
| 1.2 | 2026-11-19 | Build: approved row icons (tick, heart, gift; Undo arrow or info for other kinds); "This week" numbers stay centred (owner's earlier direction); feed `limit` capped at 200 |
| 1.1 | 2026-11-19 | Peer review (§8): filters follow the approved design and the C7 rule (Earned and Goals are separate and exclude undone awards; Spent is redemptions only); query shape fixed; legacy category rows classified; child filter on the server; factual fixes |
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
| A goal completion (award with a completion) | `{Child} completed “{goal title}”` | `{category} · {time}` (v1.5: the kind is no longer repeated; it was `Today’s Goal · {category} · {time}`) | `+n` |
| Other award | `{Child} earned {category}` | `{note} · {time}`, or `{time}` when there is no note | `+n` |
| Spend | `{Child} redeemed {reward}` | `{time}` (v1.5; it was `Reward redeemed · {time}`, A2, §9) | `−n` |
| Starting, correction, undo, deduction | The shipped wording ("started with", "had a one-off", "undo:", "had an earlier adjustment for", "adjusted") | `{time}` | Signed |

  - Time is `h:mm a` in the family's zone (§9; a change from the shipped "MMM d, h:mm a": the date is now in the group header, as approved).
  - An undone row's amount is struck through, with " · undone" after the time (shipped).
  - An award in the category "Other" with a note reads "{Child} earned {note}" (shipped swap kept).
- **Corrections:** "Correct" on eligible awards (this week, not undone) stays, with its shipped dialog.
- **Paging:** "Load earlier activity" replaces "Load More".
- **"Corrections and Undo" card:** "Historical entries remain visible when a parent corrects a mistaken award or reverses an eligible action." The design-only sentence "This preview does not change a real ledger." is not shipped.
- **Retained, not in the approved screen:** the child filter (Select labelled "Child", shown when there is more than one child). Owner item A3: keep it or drop it.
- **Removed from this screen:** "active days", "Top categories" and the shipped empty-week line "No activity yet this week. Award some points to get started!" (the approved figures simply read 0). The summary keeps returning those fields; nothing else reads them (the family report reads the export, not the summary).
- Empty log: the shipped "No activity found".

## 3. Server

### 3.1 Feed

- **One source.** The four filters select from the same row set as "All" (the existing union), wrapped as a subquery: `SELECT * FROM (…union…) f WHERE <filter> [AND child_id = $4] ORDER BY created_date DESC, type, id LIMIT $2 OFFSET $3`. The order and paging are outside, so filters run before the page is cut, and the tie-breaker keeps paging stable. Typed NULLs in the redemption branches.
  - **Earned:** `type = 'earn' AND NOT undone AND goal_completion_id IS NULL` (the approved filter shows non-goal awards only).
  - **Goals:** `type = 'earn' AND NOT undone AND goal_completion_id IS NOT NULL`.
  - **Spent:** `type = 'spend' AND NOT undone` (the approved filter shows redemptions only; deductions and reversals appear under All).
  - **All:** every row, undone ones marked (unchanged).
  - **C7 is kept:** an undone award never appears as earned (server/test/undo.test.js "C7" stays green, unchanged). The plan's "keep the undone flag" concern is met because the filtered lists never contain undone rows, and All keeps the flag.
  - **Legacy rows:** `kind = 'award'` rows whose category is 'starting points', 'balance correction' or 'undo' (the rows `effective_point_events` excludes, migration 009) are typed 'starting', 'correction' and 'undo', so they are never 'earn'.
- **Child:** an optional `child_id` (UUID) narrows the set on the server, so a page is never cut before the child filter (review 10).
- **Goal fields** on point-event rows come from a `LEFT JOIN today_goal_completions x ON x.point_event_id = p.id`, then `LEFT JOIN today_goals g ON g.id = x.goal_id`. The field is `goal_completion_id` (a `LEFT JOIN today_goal_completions` only; no join to `today_goals`). The title shown is the one saved at completion in the award's note (§9). The category is the row's existing `label`, which the completion wrote. Redemption rows carry NULLs.
  - An undone completion still tags its award, which is also undone: under All it shows as a goal completion with its amount struck through.
  - The join is unique: `today_goal_completions(point_event_id)` has a partial unique index (migration 014), so a row can never be duplicated.
- An unknown filter value is treated as "all" (unchanged).

### 3.2 Summary

- `goalsCompleted` (review 6: verified correct; Undo and Correct both set `undone_at`) counts `today_goal_completions` for the family where `created_at >= weekStart` (the family's week, as for the points) and `undone_at IS NULL`.

## 4. Contracts and code paths

| Contract | Paths |
| --- | --- |
| Feed rows | `/api/activity-feed` (only Activity reads it) |
| Summary | `/api/summary`: read only by Activity (additive field) |
| Refresh after changes | Closed: completing a goal calls `refreshPoints` (TodaysGoalsPanel), Undo calls it (points.js), and the realtime `points_updated` event refreshes every key in `POINTS_QUERY_KEYS`, which holds `activityFeed` and `weeklySummary` |

## 5. Edge cases (input → expected)

| # | Input | Expected |
| --- | --- | --- |
| E1 | Goal completed, then undone | All: the award (shown as a goal) and its undo row, amounts struck through. Goals and Earned: not listed (C7). "Goals completed" does not count it |
| E1b | The same goal completed on two days | Two tagged rows |
| E1c | Legacy award row with category "Starting points" and positive points | Typed 'starting'; not under Earned |
| E2 | Goal renamed after completion | The current title |
| E3 | Goal archived | Still tagged (the goal row remains) |
| E4 | An award with no completion whose note starts like a goal | Not a goal: the tag is the join only |
| E5 | A spend reversed | Spent: not listed. All: the spend and its refund, struck through |
| E5b | A deduction (negative award) | All only |
| E6 | No events | "No activity found" |
| E7 | Paging across the filter and the child | Offset applies to the filtered set; the child is filtered on the server |
| E8 | Long names and goal titles at 320 px | Wrap; no sideways scroll |
| E9 | A completion from before this week | Not counted in "Goals completed" |

## 6. Test plan

- **Server (DB):**
  - Every filter is a subset of All; Earned, Goals and Spent hold no undone rows; Earned and Goals are disjoint.
  - The existing C7 test stays unchanged and green.
  - The goal tag comes from the join, not the note (E4).
  - The undone goal (E1).
  - The rename (E2).
  - `goalsCompleted` counts this week only and not undone ones (E1, E9).
  - Mutation checks: drop the `undone_at` condition; drop `NOT undone` from Earned; move the LIMIT inside the subquery.
- **Render:**
  - The approved copy.
  - The three row shapes.
  - The date group labels.
  - The four filters calling the right filter.
  - Load earlier activity.
  - The Corrections card.
  - No design-only lines.
- **E2E:** the existing Activity test is updated: the log is open by default (no "Activity log" button click), and the centring check uses the new boxes instead of `.bg-earn-soft`/`.bg-star-soft`. Axe and 44 px checks at 4 sizes.
- **Evidence:** reference vs React at 390/834/1280.
- **One class not covered:** a family zone the browser does not know: the page falls back to the browser's zone (tested), so days may then differ from the weekly totals.

## 7. Owner items

| # | Item |
| --- | --- |
| A1 | Older date groups as "{Weekday d Month}" (e.g. "Monday 16 November"); only "Today ·" and "Yesterday ·" are approved |
| A2 | Every spend row says "Parent-confirmed reward", including spends made before V1 through the old Child View "Spend" button (also on a parent's device) |
| A3 | The child filter is kept although the approved screen has none (now filtered on the server) |
| A4 | Goal rows show the goal's current title (a renamed goal shows its new name in history) |

## 8. Peer review (fresh context, v1.0)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | "Every filter keeps undone" breaks the C7 contract test (an undone award never appears as earned) | Blocking | C7 kept: Earned and Goals exclude undone awards; the test is unchanged (§3.1) |
| 2 | In the approved HTML, Earned excludes goal rows and Spent shows redemptions only | Blocking | Filters follow the approved design (§3.1) |
| 3 | Wrapped query unspecified: ORDER/LIMIT placement, tie-breaker, typed NULLs | Non-blocking | Specified (§3.1) |
| 4 | Uniqueness claim correct (partial unique index, migration 014) | Confirmed | Test E1b added |
| 5 | Legacy `award` rows with excluded categories would become 'earn' | Non-blocking | Classified as starting, correction or undo (§3.1, E1c) |
| 6 | `goalsCompleted` correct | Confirmed | — |
| 7 | Refresh paths already covered | Non-blocking | §4 closed with citations |
| 8 | Family report does not read the summary; time format is a change; only the amount is struck through | Non-blocking | Corrected (§2, §4) |
| 9 | Empty-week line, "Other" swap, meaning of Points earned | Non-blocking | Line dropped; swap kept; net `week_points` kept (as shipped) |
| 10 | The child filter runs on pages already cut | Non-blocking | `child_id` on the server (§3.1) |
| 11 | Drop `goal_category`; current vs completion title; e2e selectors | Non-blocking | `label` used; A4; e2e noted (§6) |

## 9. Owner review of PR #62 (v1.3)

| # | Owner decision | Built |
| --- | --- | --- |
| A1 | Accept, adding the year when necessary | "Monday 16 November"; "Wednesday 31 December 2025" when not this year (in the family's zone) |
| A2 | Change: not "Parent-confirmed reward" for every redemption; "Reward redeemed" unless a confirmation is recorded | Every spend row reads "Reward redeemed · {time}". Verified: no redemption records a parent confirmation (both `redeem` and `stack/confirm` insert the same columns; the request-replay cache is not an audit record). Recording one would need a new column: not built |
| A3 | Keep the child filter | Kept (server-side, §3.1) |
| A4 | Change: the goal's name when it was completed | The completion writes `Today’s Goal: {title}` into the award's note (server/todaysGoals.js, verified). The title is read from it **only** for an award linked to a completion; otherwise the row reads "{Child} completed a goal" (no invented title). The current-title join is removed |
| TZ | Use the family's zone for day groups, Today/Yesterday and times | `/api/summary` returns `timezone` (the family's, `UTC` when unset); days and times are formatted in it with `Intl`. Test: 16:30 UTC is "Today · Thursday 19 November" in Singapore and "Yesterday · Wednesday 18 November" in London. Mutations (zone ignored; note trusted without a completion link) fail tests |

New copy introduced by these decisions: "Reward redeemed" (owner's wording) and the neutral "a goal" (owner asked for a neutral description; this exact wording is for approval).

## 10. Post-build code review (fresh context, PR #62 at `9741ca3`)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | `?filter=constructor` (or `__proto__`, `toString`, `hasOwnProperty`) read an inherited property into the SQL: 500 | Minor | Own keys only (`Object.hasOwn`); unknown values are All. Test (4 values) |
| 2 | A refresh (Correct, Undo, another parent) collapsed loaded pages; a load during a refresh could skip rows | Minor | `useInfiniteQuery`: a refresh reloads every loaded page. Test fails on the old code |
| 3 | Offset paging could show a row twice | Minor | Rows de-duplicated by kind and id across pages. Test fails on the old code |
| 4 | The old filter's rows showed under the new chip while loading | Minor | Shown on a muted background with `aria-busy` while placeholder data shows (no opacity on content: token rule) |
| 5 | A zone the browser does not know crashed the page | Minor | `safeZone` falls back to the browser's zone. Test |
| 6 | Tests that pass with the feature broken: look-alike note prefix, child filter never selected, Correct untested | Minor | Real prefix; e2e selects a child and waits for `child_id` in the request; Correct render test (mutation `canCorrect = false` fails it) |
| 7 | Device zone before the summary loads; a failed summary showed zeros | Nit | The page waits for the summary; its failure shows the shipped "Couldn't load activity" card. Test |
| 8 | Stale design text; an extra round trip for the zone | Nit | §2, §3.1, §6 corrected; the zone comes with the week-start query |

