# Logic Audit — Phase 0

> Exact file, function, and line for every logic path relevant to the core loop.

---

## 1. Points Balance Calculation

**Storage:** `total_points` is a **stored integer** on the `children` table, not computed on-the-fly.

| What | File | Line | Detail |
|------|------|------|--------|
| Column definition | `server/db.js` | 22 | `total_points INTEGER DEFAULT 0` |
| Weekly points column | `server/db.js` | 23 | `weekly_points INTEGER DEFAULT 0` |
| Points spent column | `server/db.js` | ~148 | `points_spent INTEGER DEFAULT 0` (migration) |
| Adjust endpoint | `server/routes.js` | 386–409 | `POST /api/children/:id/adjust-points` |
| SQL | `server/routes.js` | 394 | `SET total_points = GREATEST(0, total_points + $1), weekly_points = GREATEST(0, weekly_points + $1)` |

**Key behaviour:**
- `GREATEST(0, ...)` prevents negative balances
- Both `total_points` AND `weekly_points` update atomically in one query
- No separate "balance" calculation — the column IS the balance

**Implication for Weekend Stack:** Stack total validation must compare against `total_points` directly. No derived calculation needed.

---

## 2. Reward Eligibility / Redemption Logic

### Current Flow (to be replaced by Weekend Stack)

| Step | File | Line | Detail |
|------|------|------|--------|
| Frontend check | `src/pages/ChildView.jsx` | 133 | `if (selectedChild.total_points < reward.cost_points)` → toast error |
| Confirmation dialog | `src/pages/ChildView.jsx` | 140–155 | Shows child name, reward title, cost |
| API call | `src/pages/ChildView.jsx` | 157 | `POST /api/children/${child.id}/redeem` |
| Server: begin transaction | `server/routes.js` | 443 | `await client.query('BEGIN')` |
| Server: lock + check | `server/routes.js` | 447 | `SELECT ... FOR UPDATE` — locks child row |
| Server: eligibility | `server/routes.js` | 456 | `if (childRows[0].total_points < reward_cost)` → 400 |
| Server: deduct | `server/routes.js` | 462 | `SET total_points = GREATEST(0, total_points - $1), points_spent = COALESCE(points_spent, 0) + $1` |
| Server: log redemption | `server/routes.js` | 471 | `INSERT INTO redemptions ... status = 'Completed'` |
| Server: commit | `server/routes.js` | 478 | `await client.query('COMMIT')` |
| Badge check | `src/pages/ChildView.jsx` | 167 | `POST /api/children/${child.id}/check-badges` after success |

**What to keep for Weekend Stack:** The transaction pattern (BEGIN → lock → check → deduct → log → COMMIT) is exactly what Phase 1.3 needs. The confirm-weekend endpoint should follow this same pattern but process ALL stack items in one transaction.

### Reward Visibility Filtering

| Step | File | Line | Detail |
|------|------|------|--------|
| Query filter | `src/pages/ChildView.jsx` | 52 | `Reward.filter({ visible_to_child: true })` |
| Assignment filter | `src/pages/ChildView.jsx` | 109–114 | If `assigned_child_ids` is empty → visible to all. If populated → only to listed children. |
| Parent toggle | `src/pages/Rewards.jsx` | 51–57 | `handleToggleVisibility` flips `visible_to_child` boolean |
| Card dimming | `src/components/rewards/RewardCard.jsx` | 16 | `opacity-60` when hidden in parent view |

**Keep as-is.** Visibility logic is orthogonal to the stack system.

---

## 3. Child State Shape

**Full shape returned from API** (columns from `server/db.js:19–30` + migrations at lines 126–150):

```
{
  id:              UUID (PK),
  name:            TEXT (NOT NULL),
  avatar_url:      TEXT | null,
  total_points:    INTEGER (default 0),
  weekly_points:   INTEGER (default 0),
  weekly_target:   INTEGER (default 50),
  last_reset_date: TEXT | null ("YYYY-MM-DD"),
  parent_email:    TEXT | null,
  family_code:     TEXT,
  created_date:    TIMESTAMPTZ,
  date_of_birth:   TEXT | null ("YYYY-MM-DD"),
  badges_earned:   TEXT[] (default '{}'),
  points_spent:    INTEGER (default 0)
}
```

**Frontend access:** `Child.list()` via `src/api/entities.js:91`, query key `['children']`.

---

## 4. Weekend Stack — Storage Recommendation

### Current state: Nothing exists

No `weekend_stack` column, table, or related code anywhere in the codebase.

### Option A: JSONB column on `children` table

```sql
ALTER TABLE children ADD COLUMN weekend_stack JSONB DEFAULT '[]';
```

**Pros:**
- Single query to fetch child + stack (no JOIN)
- Matches existing pattern (badges_earned is TEXT[] on same table)
- Simpler frontend — stack comes with child object automatically
- No FK constraints to manage

**Cons:**
- Can't query stack items across children without JSON functions
- No referential integrity to rewards table (reward could be deleted while in stack)

### Option B: Separate `weekend_stack_items` table

```sql
CREATE TABLE weekend_stack_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL,
  reward_title TEXT NOT NULL,
  reward_cost INTEGER NOT NULL,
  family_code TEXT NOT NULL,
  created_date TIMESTAMPTZ DEFAULT NOW()
);
```

**Pros:**
- Proper relational model
- Can query across children easily (`SELECT SUM(reward_cost) FROM weekend_stack_items WHERE family_code = $1`)
- Can add FK to rewards (but spec says store title+cost inline, so not needed)

**Cons:**
- Requires JOIN or separate query on every child load
- More complex confirm-weekend transaction (DELETE FROM weekend_stack_items WHERE child_id = $1)
- Extra migration

### **Recommendation: Option A (JSONB column)**

Reasons:
1. **Stack is ephemeral** — it gets cleared every weekend. It's not historical data worth normalizing.
2. **Frontend simplicity** — child object already flows through the app. Adding `weekend_stack` to the same object means zero new queries on ChildView, ChildCard, or HeroCard.
3. **Atomic confirm** — updating one row (`UPDATE children SET weekend_stack = '[]', total_points = total_points - $1 WHERE id = $2`) is simpler than coordinating across two tables.
4. **Precedent** — `badges_earned TEXT[]` is already stored inline on the same table.
5. **Cross-child query** (for hero "total stacked") can use `jsonb_array_length(weekend_stack)` or compute client-side from already-loaded children.

**Validation:** Server-side, before adding to stack:
```sql
SELECT total_points, weekend_stack FROM children WHERE id = $1 FOR UPDATE;
-- compute: stackTotal = SUM of weekend_stack[*].cost
-- check: stackTotal + newRewardCost <= total_points
-- if ok: append to weekend_stack JSONB array
```

---

## 5. Streak Calculation

| What | File | Line | Detail |
|------|------|------|--------|
| Endpoint | `server/routes.js` | 261–295 | `POST /api/family/check-streak` |
| Storage | `server/db.js` | 143–145 | `current_streak INTEGER`, `last_active_date TEXT`, `longest_streak INTEGER` on `families` table |
| Trigger | `src/pages/ParentDashboard.jsx` | 190–192 | Called on dashboard mount via `useEffect` |
| Milestones | `src/pages/ParentDashboard.jsx` | 182 | Confetti at 7, 14, 30, 60, 100 days |

**Logic:**
```
if last_active_date === today     → no change (already counted)
if last_active_date === yesterday → streak += 1
else                              → streak = 1 (reset)
```

**No changes needed.** Streak logic is independent of the weekend stack.

---

## 6. Category / Quick Action Source of Truth

### Behavior Categories

| What | File | Line | Detail |
|------|------|------|--------|
| Table schema | `server/db.js` | 109–119 | `behavior_categories` — name, icon, sort_order, is_default, UNIQUE(family_code, name) |
| Default seeding | `server/routes.js` | 202–213 | 6 defaults inserted on family creation: Helpfulness, Kindness, Learning, Responsibility, Creativity, Physical Activity |
| Backfill migration | `server/db.js` | 155–172 | Seeds defaults for existing families that have none |
| CRUD endpoints | `server/routes.js` | 617–771 | GET list, POST create, PUT update, DELETE (non-default only), POST reorder |
| Frontend manager | `src/components/settings/BehaviorCategoryManager.jsx` | 1–340 | Full CRUD UI in Settings |

### Quick Actions

| What | File | Line | Detail |
|------|------|------|--------|
| Table schema | `server/db.js` | 99–107 | `quick_actions` — label, points, icon, display_order |
| No DB defaults | — | — | Table is empty until user creates actions |
| Frontend fallback | `src/pages/ParentDashboard.jsx` | 26–31 | `DEFAULT_QUICK_ACTIONS` array: Helpfulness (5), Learning (10), Responsibility (5), Kindness (5) |
| Fallback logic | `src/pages/ParentDashboard.jsx` | 95–97 | Uses DB actions if any exist, else falls back to defaults |
| CRUD endpoints | `server/routes.js` | 860–944 | GET list, POST create, PUT update, DELETE |
| Frontend manager | `src/pages/ParentProfile.jsx` | 341–468 | QuickActionModal inline sub-component |

**No changes needed.** Categories and quick actions are orthogonal to the stack.

---

## 7. Weekly Reset Logic

| What | File | Line | Detail |
|------|------|------|--------|
| Endpoint | `server/routes.js` | 363–383 | `POST /api/children/weekly-reset` |
| Trigger | `src/pages/ParentDashboard.jsx` | 50–66 | Called on dashboard mount via `useEffect` |
| Condition | `server/routes.js` | 369 | Only runs on Monday (`dayOfWeek === 1`) |
| Action | `server/routes.js` | 374 | `SET weekly_points = 0, last_reset_date = $1` |
| Idempotency | `server/routes.js` | 377 | `WHERE last_reset_date IS NULL OR last_reset_date != $1` |

**Key:** Resets `weekly_points` only. `total_points` is NOT affected. Weekend stack is NOT affected (it clears only on parent confirm, per spec).

---

## 8. Activity Feed Construction

| What | File | Line | Detail |
|------|------|------|--------|
| Endpoint | `server/routes.js` | 949–997 | `GET /api/activity-feed` |
| Merge strategy | `server/routes.js` | 960–990 | `UNION ALL` of `point_events` + `redemptions` (status = 'Completed') |
| Sort | `server/routes.js` | 991 | `ORDER BY created_date DESC` |
| Pagination | `server/routes.js` | 951–952 | `limit` (default 50) + `offset` params |
| Filters | `server/routes.js` | 953 | `filter` param: `all` / `earned` / `spent` |

**Field mapping:**

| Source | → `type` | → `label` | → `points` |
|--------|----------|-----------|------------|
| point_events (positive) | `'earn'` | category | points |
| point_events (negative) | `'adjust'` | category | points |
| redemptions | `'spend'` | reward_title | -reward_cost |

**Phase 1.3 impact:** When weekend is confirmed, each reward creates a redemption record with `status = 'Completed'`. These will automatically appear in the activity feed via the existing UNION ALL query. No feed changes needed for Phase 1.

**Phase 4 impact:** Weekly summary needs a new endpoint or client-side aggregation from the feed data.

---

## 9. Motivation Metrics Endpoint

| What | File | Line | Detail |
|------|------|------|--------|
| Endpoint | `server/routes.js` | 773–858 | `GET /api/children/:id/motivation` |
| Returns | — | — | `{ rewards_earned, best_streak, next_unlock_title, next_unlock_cost, next_unlock_remaining }` |
| Next unlock logic | `server/routes.js` | 821–826 | Cheapest visible reward with `cost_points > total_points` |

**Phase 2:** This endpoint is not called after ChildView restructure. Can be left in place (no harm) or removed later.

---

## 10. Files to Create / Modify per Phase

### Phase 1 — Weekend Stack

**Create:**
| File | Purpose |
|------|---------|
| `src/components/weekend/WeekendStack.jsx` | Child-facing stack display |
| `src/components/weekend/WeekendStackSummary.jsx` | Parent home card stack summary |

**Modify:**
| File | Change |
|------|--------|
| `server/db.js` | Add `weekend_stack JSONB DEFAULT '[]'` migration on children table |
| `server/routes.js` | Add 3 endpoints: `POST /api/children/:id/stack/add`, `DELETE /api/children/:id/stack/:index`, `POST /api/children/:id/stack/confirm` |
| `src/components/rewards/RewardCard.jsx` | Replace "Redeem"/"Reward unlocked" with "Add to weekend"/"✓ Added"/"Need X more pts" |
| `src/pages/ChildView.jsx` | Pass stack state to RewardCard, wire add/remove actions |
| `src/components/child/ChildCard.jsx` | Add WeekendStackSummary + Confirm button |

### Phase 2 — Child View Restructure

**Modify:**
| File | Change |
|------|--------|
| `src/pages/ChildView.jsx` | Strip MotivationCard, BadgeDisplay, ShareableCard, activity section. Add WeekendStack as primary content. Replace `<Select>` child switcher with tab/avatar selector. |

### Phase 3 — Home Screen Restructure

**Modify:**
| File | Change |
|------|--------|
| `src/components/dashboard/HeroCard.jsx` | Replace per-child stats with family-level: streak, weekly total, stack total |
| `src/components/child/ChildCard.jsx` | Replace progress bar with "Can take X rewards" |
| `src/pages/ParentDashboard.jsx` | Remove Calendar references, remove Family Goals empty state, move Add Child to Settings |
| `src/pages/Activity.jsx` | Delete CalendarHeatmap (lines 283–370) and all calendarMonth state |

### Phase 4 — Activity Screen

**Modify:**
| File | Change |
|------|--------|
| `src/pages/Activity.jsx` | Add weekly summary as primary view. Collapse raw feed. Replace "Other" labels with note text. |

### Phase 5 — Brand & Global Chrome

**Modify:**
| File | Change |
|------|--------|
| `src/Layout.jsx` | Add Positive Percy logo, page title prop, persistent header |
| `server/routes.js` | Add profanity filter to family code generation (line ~188) |
