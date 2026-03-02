# Positive Percy -- Feature & Enhancement Backlog

> Derived from the full code and psychological review (see REVIEW.md).
> Each item includes priority, category, affected files, acceptance criteria, and implementation notes.

---

## How to Read This Backlog

**Priority levels:**
- **P0 -- Critical:** Security or data-loss bugs. Fix before any new users.
- **P1 -- High:** Directly impacts retention or child safety. Ship in next sprint.
- **P2 -- Medium:** Improves engagement or UX meaningfully. Ship within 2-4 weeks.
- **P3 -- Low:** Nice-to-have polish. Ship when bandwidth allows.

**Categories:**
- `BUG` -- Existing broken or dangerous behavior
- `SECURITY` -- Vulnerability that must be patched
- `FEATURE` -- New capability
- `ENHANCEMENT` -- Improvement to existing capability
- `INFRA` -- Backend, performance, or architecture change

---

## P0 -- Critical

### BUG-001: Points can go negative

**Category:** BUG
**Review ref:** Psychological Concerns #4
**Affected files:**
- `src/pages/ParentDashboard.jsx` (lines 134-140)

**Problem:**
When subtracting points via `handlePointsSubmit`, `total_points` and `weekly_points` are decremented without floor guards. A child can end up with -5 total points displayed on their profile. This is psychologically demoralizing and breaks the reward-affordability check.

The redemption handler at line 167 correctly uses `Math.max(0, ...)` for `weekly_points`, but the general subtraction path does not, and neither path guards `total_points`.

**Acceptance criteria:**
- [ ] `total_points` never drops below 0 after any operation
- [ ] `weekly_points` never drops below 0 after any operation
- [ ] If a subtraction would exceed current points, clamp to 0 (don't reject)
- [ ] Toast warns parent: "This will reduce [child]'s points to 0"

**Implementation:**
In `handlePointsSubmit` (~line 134), change:
```js
total_points: selectedChild.total_points + data.points,
weekly_points: selectedChild.weekly_points + data.points,
```
to:
```js
total_points: Math.max(0, selectedChild.total_points + data.points),
weekly_points: Math.max(0, selectedChild.weekly_points + data.points),
```
Also add the same guard in `handleApproveRedemption` for `total_points` (~line 166).

---

### SEC-001: SQL injection via unvalidated column names

**Category:** SECURITY
**Review ref:** Technical Code Review -- Security Issues
**Affected files:**
- `server/routes.js` (lines 259-278, 281-301, 228-256, 174-196)

**Problem:**
All generic CRUD routes and the `PUT /api/auth/me` route take `Object.keys(req.body)` and interpolate them directly into SQL strings as column names. While values are parameterized, column names are not. A crafted request body with a key like `"name; DROP TABLE children--"` could inject arbitrary SQL.

The `buildSort` function (line 8-13) also interpolates the `sort` query parameter directly into `ORDER BY` without validation.

**Acceptance criteria:**
- [ ] Column names are validated against a per-table whitelist before any SQL interpolation
- [ ] Sort fields are validated against the same whitelist
- [ ] Requests with invalid column names return 400 with a clear error
- [ ] Filter keys in POST `/api/:entity/filter` are also validated

**Implementation:**
Add a `COLUMN_WHITELIST` map in `routes.js`:
```js
const COLUMN_WHITELIST = {
  children: ['name', 'avatar_url', 'total_points', 'weekly_points', 'weekly_target', 'last_reset_date', 'parent_email', 'family_code'],
  point_events: ['child_id', 'points', 'category', 'note', 'child_name', 'family_code'],
  redemptions: ['child_id', 'child_name', 'reward_id', 'reward_title', 'reward_cost', 'status', 'family_code'],
  rewards: ['title', 'description', 'cost_points', 'image_url', 'emoji', 'visible_to_child', 'assigned_child_ids', 'family_code'],
};
```
Add a validation helper:
```js
function validateColumns(table, keys) {
  const allowed = COLUMN_WHITELIST[table];
  const invalid = keys.filter(k => !allowed.includes(k));
  if (invalid.length > 0) throw new Error(`Invalid columns: ${invalid.join(', ')}`);
}
```
Call it at the top of each CREATE, UPDATE, FILTER, and LIST handler. Apply the same approach to `buildSort` and the `PUT /api/auth/me` route.

---

### SEC-002: No authorization on entity routes

**Category:** SECURITY
**Review ref:** Technical Code Review -- Security Issues
**Affected files:**
- `server/routes.js` (all entity CRUD routes)
- `src/api/entities.js`

**Problem:**
Any user who guesses or brute-forces a 6-character family code can read/modify that family's data. The `family_code` is passed as a query parameter with no session token, cookie, or JWT validation. With ~887 million possible codes, this is not real security.

**Acceptance criteria:**
- [ ] Server issues a session token (JWT or signed cookie) on family create/join
- [ ] All entity routes require and validate the session token
- [ ] The token encodes `family_code` so the server enforces data isolation
- [ ] Invalid/missing tokens return 401

**Implementation notes:**
Add `jsonwebtoken` dependency. On `POST /api/family/create` and `POST /api/family/join`, return a JWT containing `{ family_code }` signed with a server secret. Store the token in localStorage on the client. Send it as `Authorization: Bearer <token>` on all API calls. Add Express middleware to validate the token and inject `req.familyCode` for all `/api/:entity` routes.

---

## P1 -- High

### BUG-002: Weekly reset runs inside a query function (side effect in read)

**Category:** BUG
**Review ref:** Technical Code Review -- Data Integrity Issues
**Affected files:**
- `src/pages/ParentDashboard.jsx` (lines 28-55)

**Problem:**
The Monday reset logic runs inside a React Query `queryFn`. This means:
1. It fires every time the children list is fetched (on focus, on refetch, on mount)
2. If two browser tabs are open, both run the reset concurrently
3. It performs N sequential API calls (one per child) inside a read operation
4. It mutates server state inside what should be a pure data fetch

**Acceptance criteria:**
- [ ] Weekly reset is a server-side operation, not client-side
- [ ] Reset runs exactly once per Monday per family, regardless of how many tabs/devices are open
- [ ] The children list query is a pure read with no side effects

**Implementation:**
Add a `POST /api/children/weekly-reset` endpoint in `routes.js`:
```sql
UPDATE children SET weekly_points = 0, last_reset_date = $1
WHERE family_code = $2 AND (last_reset_date IS NULL OR last_reset_date != $1)
AND weekly_points > 0
```
Call this endpoint once on `ParentDashboard` mount (or in a `useEffect`), not inside the `queryFn`. Alternatively, add the reset check to the server-side `GET /api/children` handler so it's atomic and runs once.

---

### BUG-003: Race condition on point calculations

**Category:** BUG
**Review ref:** Technical Code Review -- Data Integrity Issues
**Affected files:**
- `src/pages/ParentDashboard.jsx` (lines 134-140, 163-169)

**Problem:**
Points are calculated client-side: the client reads `selectedChild.total_points` from its cache, adds/subtracts, and sends the new total to the server. If two parents award points simultaneously, the second write overwrites the first. Example: child has 50 points. Parent A awards +10 (sends 60). Parent B awards +5 (sends 55, because their cache still shows 50). Child ends up with 55 instead of 65.

**Acceptance criteria:**
- [ ] Point operations use atomic server-side increments (`SET total_points = total_points + $1`)
- [ ] No client-side arithmetic on point totals
- [ ] Concurrent awards from two parents both apply correctly

**Implementation:**
Add a dedicated endpoint `POST /api/children/:id/award-points`:
```js
router.post('/api/children/:id/award-points', async (req, res) => {
  const { points } = req.body;
  const { rows } = await pool.query(
    `UPDATE children
     SET total_points = GREATEST(0, total_points + $1),
         weekly_points = GREATEST(0, weekly_points + $1)
     WHERE id = $2 RETURNING *`,
    [points, req.params.id]
  );
  res.json(rows[0]);
});
```
Update `handlePointsSubmit` in `ParentDashboard.jsx` to call this endpoint instead of computing the total client-side.

---

### FEAT-001: Confetti and celebration effects

**Category:** FEATURE
**Review ref:** Psychological Concerns #5
**Affected files:**
- `src/pages/ChildView.jsx` (lines 182-189)
- `src/pages/ParentDashboard.jsx` (after point award)
- `package.json` (`canvas-confetti` v1.9.4 already installed but unused)

**Problem:**
The only celebration when a child hits their weekly goal is a text message. For children ages 4-8, visual celebrations are critical motivation drivers. `canvas-confetti` is already in `package.json` but never imported or used.

**Acceptance criteria:**
- [ ] Confetti burst fires on the ChildView when `progressPercent` hits 100%
- [ ] Confetti fires on the ParentDashboard when a point award causes a child to hit their target
- [ ] Confetti fires when a parent approves a redemption request
- [ ] Effect is a satisfying 2-3 second burst, not a sustained annoyance
- [ ] Only fires once per goal achievement (not on every re-render)

**Implementation:**
```js
import confetti from 'canvas-confetti';

// Fire when weekly goal is first achieved
confetti({
  particleCount: 150,
  spread: 80,
  origin: { y: 0.6 },
  colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6'],
});
```
Track "already celebrated" state with a `useRef` or by comparing previous vs current `weekly_points` values.

---

### FEAT-002: Positive-to-negative ratio indicator

**Category:** FEATURE
**Review ref:** Psychological Concerns #1
**Affected files:**
- `src/pages/Summary.jsx` (new card in stats section)
- `src/components/child/AddPointsModal.jsx` (optional nudge)

**Problem:**
Parents can overuse the "Remove Points" feature without awareness. Research shows the ratio of positive-to-negative interactions should stay above 5:1 for effective behavior change. The app tracks the data but doesn't surface the ratio.

**Acceptance criteria:**
- [ ] Summary page shows a "Positivity Ratio" card per child (e.g., "8:1" with a green badge, or "2:1" with a warning)
- [ ] If the ratio drops below 4:1, show a gentle nudge: "Research shows kids thrive with at least 5 positive interactions for every correction"
- [ ] When a parent opens the "Remove Points" modal, show the current ratio for that child as context
- [ ] Ratio is calculated from point_events for the current week

**Implementation:**
In `Summary.jsx`, add a new stat card after the existing 4-card grid. Calculate per child:
```js
const positiveCount = childEvents.filter(e => e.points > 0).length;
const negativeCount = childEvents.filter(e => e.points < 0).length;
const ratio = negativeCount === 0 ? positiveCount : (positiveCount / negativeCount);
```
Display as `{ratio.toFixed(0)}:1` with color coding: green >= 5, amber 3-4, red < 3.

---

### FEAT-003: Pre-populated reward ideas library

**Category:** FEATURE
**Review ref:** Viral/Engagement Concerns #4
**Affected files:**
- `src/components/rewards/AddRewardModal.jsx` (add "Browse Ideas" tab/section)
- New file: `src/data/reward-templates.js`

**Problem:**
Parents must create all rewards from scratch. This is a friction point that slows first-time setup and leaves the reward store empty for most new families. An empty reward store means the child view has nothing to show, reducing engagement from day one.

**Acceptance criteria:**
- [ ] "Browse Ideas" button/section in the AddRewardModal
- [ ] At least 20 pre-populated reward ideas organized into categories:
  - Quick Wins (5-15 pts): Extra bedtime story, Choose breakfast, 10 min extra play
  - Medium (20-50 pts): Movie night pick, Sleepover, Choose dinner, Extra screen time
  - Big Goals (75-200 pts): Toy store trip, Day out, New game, Special outing
- [ ] Each template includes title, emoji, suggested cost, and description
- [ ] Tapping an idea pre-fills the AddRewardModal form (parent can edit before saving)
- [ ] Ideas persist (they don't disappear after one is selected)

**Implementation:**
Create `src/data/reward-templates.js` with a static array. Add a scrollable "Ideas" section at the top of `AddRewardModal`. On click, populate the form fields. No server changes needed.

---

### ENH-010: Simplify tracker to total points only

**Category:** ENHANCEMENT
**Review ref:** User feedback (live app testing)
**Affected files:**
- `src/components/child/ChildCard.jsx` (lines 9-10, 54-58, 61-78)
- `src/pages/ChildView.jsx` (lines 153-164, 166-191)
- `src/pages/Summary.jsx` (lines 77-79, 191, 225-227)
- `src/components/child/AddChildModal.jsx` (weekly target field)
- `src/components/child/EditChildModal.jsx` (weekly points fields)

**Problem:**
The current child card shows three overlapping numbers that are confusing:
1. "Total: 24 points" (text under the name)
2. "2 / 50" (weekly badge in the corner)
3. "Weekly Progress 4%" (progress bar label)

Parents are the only users of this system and they just want to see how many points a child has. The weekly-target-vs-weekly-points tracking adds cognitive overhead without clear value. "2 / 50" next to "Total: 24" raises the question: which number matters? What does 50 mean? Why are there two different point counts?

**Acceptance criteria:**
- [ ] ChildCard shows a single, prominent total points number (not weekly vs total)
- [ ] Remove the weekly `X / Y` badge from ChildCard
- [ ] Remove the "Weekly Progress" percentage bar from ChildCard
- [ ] Replace with a simple, clear display: child name + total points
- [ ] ChildView shows total points as the primary number (remove or de-emphasize weekly split)
- [ ] Weekly target and weekly points fields become optional/advanced in AddChildModal and EditChildModal
- [ ] Summary page can still show weekly breakdown for parents who want analytics (this is the right place for that detail)
- [ ] The progress bar and weekly tracking can remain available as an opt-in "advanced" feature, not the default view

**Implementation notes:**
The simplest approach is to restructure `ChildCard.jsx`:
- Remove the `weekly_points / weekly_target` Badge (lines 54-58)
- Remove the progress bar section (lines 61-78)
- Make `total_points` the hero number on the card, displayed large and prominent
- Keep the Add/Remove buttons as-is

In `ChildView.jsx`:
- Show a single large points display instead of the 2-column Total/This Week grid
- Move weekly detail to a collapsible "This Week" section if desired

This simplification also reduces the impact of BUG-001 (negative points) and BUG-002 (weekly reset issues) since weekly tracking becomes less prominent.

---

### ENH-011: Remove reward approval process -- direct redemption

**Category:** ENHANCEMENT
**Review ref:** User feedback (live app testing)
**Affected files:**
- `src/pages/ChildView.jsx` (lines 50-54, 68-84: redemption creation)
- `src/pages/ParentDashboard.jsx` (lines 58-62, 154-180, 196-215: pending redemptions section)
- `src/components/redemptions/RedemptionCard.jsx` (entire component)
- `src/components/rewards/RewardCard.jsx` (lines 87-105: request button logic)
- `server/routes.js` (redemption routes)

**Problem:**
The current flow is: Child requests reward -> creates "Pending" redemption -> parent sees it on dashboard -> parent approves/denies -> points deducted.

This is pointless because **the only users of the system are parents**. There is no separate child login. The "Child View" is just a tab that parents navigate to. So the parent is effectively requesting a reward from themselves, then switching tabs to approve their own request. This adds unnecessary friction:

1. Parent navigates to Child View
2. Parent taps "Request" on behalf of the child
3. Parent navigates back to Dashboard
4. Parent sees the pending request
5. Parent taps "Approve"
6. Points are finally deducted

This should be a single action: parent taps "Redeem" and points are deducted immediately.

**Acceptance criteria:**
- [ ] "Request" button on RewardCard changes to "Redeem" (or "Use Reward")
- [ ] Tapping "Redeem" immediately deducts points from the child (no pending state)
- [ ] Show a confirmation dialog before deducting: "[Child] will spend [X] points on [Reward]. Continue?"
- [ ] On confirm: deduct points, show success toast, optionally fire confetti
- [ ] Remove the "Pending Reward Requests" section from ParentDashboard
- [ ] Remove the 5-second polling for pending redemptions (`refetchInterval: 5000`)
- [ ] The `redemptions` table can still log completed redemptions for history purposes (status = 'Completed' directly, skip 'Pending')
- [ ] Remove the weekend-only restriction (`isWeekend()` gate) -- parents should be able to redeem rewards any time since they control the process
- [ ] The "Rewards" page remains as the parent's tool to create/manage available rewards

**Implementation approach:**

**Option A -- Minimal (recommended):**
Change `handleRequestReward` in `ChildView.jsx` to:
1. Show a confirmation dialog (use existing Shadcn `AlertDialog`)
2. On confirm, call `adjust-points` endpoint (from BUG-003) with negative `reward.cost_points`
3. Create a redemption record with `status: 'Completed'` for history
4. Show success toast + confetti
5. Remove the `isWeekend()` gate
6. Remove the pending redemptions query and UI from `ParentDashboard.jsx`

**Option B -- Keep approval as opt-in:**
If some families later want the approval flow (e.g., when children are old enough to have their own device), add a family setting `require_approval: boolean` in the families table. Default to `false` (direct redemption). This can be a future enhancement if demand arises.

**Side effects:**
- The `RedemptionCard` component becomes unused (or repurposed for history-only display)
- The 5-second polling on ParentDashboard is eliminated, improving performance
- The `ChildView` weekend restriction is removed, making rewards accessible any day
- Dashboard becomes simpler and more focused on the core action: awarding points

---

### FEAT-004: Parent onboarding tips

**Category:** FEATURE
**Review ref:** Psychological Concerns #3
**Affected files:**
- `src/pages/ParentDashboard.jsx` (show tips on first visit)
- New file: `src/components/OnboardingTips.jsx`

**Problem:**
The app gives parents a token economy tool but no education on how to use one effectively. Common mistakes: targets too high, inconsistent tracking, over-punishing, rewarding intrinsic behaviors.

**Acceptance criteria:**
- [ ] First-time users see a 3-4 step tip carousel/modal before reaching the dashboard
- [ ] Tips are evidence-based and concise:
  1. "Start small -- set weekly targets your child can hit 80% of the time"
  2. "Be specific -- 'Great job sharing your toy!' works better than 'Good job'"
  3. "Stay positive -- aim for 5 rewards for every 1 correction"
  4. "Be consistent -- even 2 minutes of logging each evening builds the habit"
- [ ] Users can dismiss the tips and they don't show again (localStorage flag)
- [ ] A "Tips" link in the profile or nav allows revisiting

**Implementation:**
Create a dialog/carousel component. Check `localStorage.getItem('percy_onboarding_done')` on `ParentDashboard` mount. Show the modal if not set. On dismiss, set the flag. Use the existing `Dialog` component from shadcn/ui.

---

## P2 -- Medium

### FEAT-005: Shareable achievement cards

**Category:** FEATURE
**Review ref:** Viral/Engagement Concerns #3
**Affected files:**
- `src/pages/ChildView.jsx` (add share button when goal achieved)
- `src/pages/Summary.jsx` (add share button per child)
- `package.json` (`html2canvas` v1.4.1 already installed but unused)

**Problem:**
There's no way for parents to share a child's achievement. A "brag" feature creates organic word-of-mouth -- parents love sharing their kids' wins on WhatsApp groups, Instagram stories, and family chats.

**Acceptance criteria:**
- [ ] "Share Achievement" button appears when a child hits their weekly goal
- [ ] Generates a branded image card: child name, avatar, points, week, Percy branding
- [ ] Uses native `navigator.share()` on mobile, clipboard fallback on desktop
- [ ] Image includes "positivepercy.app" watermark for organic discovery
- [ ] Card is visually appealing (gradient, large numbers, celebratory)

**Implementation:**
Use `html2canvas` (already installed) to capture a hidden DOM element as a PNG. Render a styled card off-screen, capture it, then share via the Web Share API. On unsupported browsers, offer "Save Image" download.

---

### FEAT-006: Parent streak tracking

**Category:** FEATURE
**Review ref:** Viral/Engagement Concerns #2
**Affected files:**
- `src/pages/ParentDashboard.jsx` (display streak badge)
- `server/db.js` (add streak columns to families table)
- `server/routes.js` (add streak calculation endpoint)

**Problem:**
The app tracks children's weekly points but not parent consistency. A streak mechanic rewards parents for daily logging, which is the single most important habit for the system to work.

**Acceptance criteria:**
- [ ] Dashboard shows current streak: "5-day streak!" with a flame icon
- [ ] Streak increments when at least 1 point event is logged on a calendar day
- [ ] Streak resets to 0 if a day is missed
- [ ] Milestone celebrations at 7, 14, 30 days
- [ ] Streak data persists server-side (not just localStorage)

**Implementation:**
Add `current_streak INT DEFAULT 0` and `last_active_date TEXT` to the `families` table. Create `POST /api/family/check-streak` that compares `last_active_date` to today. On each point award, call the streak check. If `last_active_date === yesterday`, increment streak. If `last_active_date === today`, no-op. Otherwise, reset to 1.

---

### FEAT-007: Age field with smart defaults

**Category:** FEATURE
**Review ref:** Psychological Concerns #2
**Affected files:**
- `src/components/child/AddChildModal.jsx` (add age/DOB field)
- `src/components/child/EditChildModal.jsx` (add age/DOB field)
- `server/db.js` (add `date_of_birth TEXT` to children table)
- `src/components/child/AddPointsModal.jsx` (filter categories by age)

**Problem:**
A 4-year-old and a 12-year-old get the same categories, the same default weekly target (50), and the same reward costs. This is developmentally inappropriate.

**Acceptance criteria:**
- [ ] Optional "Age" or "Date of Birth" field on Add/Edit Child
- [ ] Suggested weekly target adjusts by age:
  - Ages 3-5: 20 points (small, frequent wins)
  - Ages 6-8: 35 points
  - Ages 9-12: 50 points
  - Ages 13+: 75 points
- [ ] Categories filter by age:
  - Ages 3-5: Hide "Homework", show "Sharing", "Listening"
  - Ages 6-8: All current categories
  - Ages 9-12: Add "Independence", "Self-Care"
- [ ] Defaults are suggestions only -- parent can override

**Implementation:**
Add an optional number input for age in `AddChildModal`. Use it to set `weeklyTarget` default. In `AddPointsModal`, pass the child's age (or compute from DOB) and filter `CATEGORIES` based on age brackets.

---

### FEAT-008: Family-wide collaborative goals

**Category:** FEATURE
**Review ref:** Viral/Engagement Concerns #6
**Affected files:**
- `src/pages/ParentDashboard.jsx` (new family goal card)
- `server/db.js` (add `family_goals` table)
- `server/routes.js` (add family goal CRUD)

**Problem:**
For multi-child families, there's no collective goal. Sibling dynamics are a powerful motivator. A family-wide target ("If everyone hits 80%, the family earns pizza night") drives cooperative behavior.

**Acceptance criteria:**
- [ ] Parents can create a "Family Goal" with a title and condition (e.g., "All children hit 80% of weekly target")
- [ ] Family goal progress is visible on the dashboard as a shared card
- [ ] When the family goal is met, a family-wide celebration triggers
- [ ] Children can see the family goal on their ChildView
- [ ] Supports one active family goal at a time

**Implementation:**
New table `family_goals`: `id, title, description, condition_type, condition_value, reward_text, is_active, family_code, created_date`. Condition types: `all_hit_percent` (all children hit X% of their weekly target), `total_family_points` (combined family points reach N). Check condition on each point award.

---

### ENH-001: Move logo to local asset

**Category:** ENHANCEMENT
**Review ref:** Technical Code Review -- UX/Performance Issues
**Affected files:**
- `src/pages/ParentDashboard.jsx` (line 188)
- `src/Layout.jsx` (line 28)
- `public/` (add logo file)

**Problem:**
The logo loads from an external Supabase storage URL. If that bucket is deleted, reconfigured, or rate-limited, the logo disappears across the entire app.

**Acceptance criteria:**
- [ ] Logo file is saved as `public/logo.png`
- [ ] All `<img>` references updated to `/logo.png`
- [ ] No external URL dependencies for branding assets

---

### ENH-002: Add loading and error states to queries

**Category:** ENHANCEMENT
**Review ref:** Technical Code Review -- UX/Performance Issues
**Affected files:**
- `src/pages/ParentDashboard.jsx`
- `src/pages/Summary.jsx`
- `src/pages/Rewards.jsx`
- `src/pages/History.jsx`
- `src/pages/ChildView.jsx`

**Problem:**
Most React Query hooks destructure only `data` and ignore `isLoading` and `isError`. If the API is slow or fails, users see a blank page with no feedback.

**Acceptance criteria:**
- [ ] All pages show a spinner/skeleton while data loads
- [ ] All pages show a user-friendly error message on query failure
- [ ] Error messages include a "Retry" button that triggers `refetch()`
- [ ] Loading states use consistent skeleton components across the app

---

### ENH-003: Paginated history

**Category:** ENHANCEMENT
**Review ref:** Technical Code Review -- UX/Performance Issues
**Affected files:**
- `src/pages/History.jsx` (line 30: hardcoded `limit=100`)
- `server/routes.js` (LIST endpoint)

**Problem:**
History page loads only 100 events with no pagination. For an active family logging 5-10 events per day, this limit is reached in 2-3 weeks. Older events become inaccessible.

**Acceptance criteria:**
- [ ] "Load More" button or infinite scroll at the bottom of the history list
- [ ] Server accepts `offset` parameter in addition to `limit`
- [ ] Initial page loads 50 events; each "Load More" fetches the next 50
- [ ] Filter changes reset to page 1

**Implementation:**
Add `OFFSET ${parseInt(req.query.offset) || 0}` to the LIST endpoint query. On the client, use React Query's `useInfiniteQuery` or manage a page counter manually.

---

### ENH-004: Server-side summary aggregation

**Category:** ENHANCEMENT / INFRA
**Review ref:** Technical Code Review -- UX/Performance Issues
**Affected files:**
- `src/pages/Summary.jsx` (lines 21-32: loads 200 events, filters client-side)
- `server/routes.js` (add summary endpoint)

**Problem:**
The Summary page fetches 200 raw point_events and does all aggregation (weekly filter, per-child stats, category breakdown) in the browser. This is wasteful and will break as data grows.

**Acceptance criteria:**
- [ ] New endpoint `GET /api/summary?family_code=&week_start=` returns pre-aggregated data
- [ ] Response includes: total weekly points, per-child stats, top categories, event counts
- [ ] Summary page consumes this endpoint instead of raw events
- [ ] Server query uses SQL aggregation (GROUP BY, SUM, COUNT)

---

### ENH-005: Rename "Remove Points" UX and add guardrails

**Category:** ENHANCEMENT
**Review ref:** Psychological Concerns #1
**Affected files:**
- `src/components/child/ChildCard.jsx` (line 91: "Remove" button label)
- `src/components/child/AddPointsModal.jsx` (line 57: "Remove Points" title)

**Problem:**
The "Remove" label and red styling makes point deduction feel punitive. Combined with the "Misbehavior" category, it encourages parents to use the system as a punishment tool rather than a teaching moment.

**Acceptance criteria:**
- [ ] Button label changed from "Remove" to "Adjust"
- [ ] Modal title changed from "Remove Points" to "Adjust Points"
- [ ] Modal includes a brief note: "Tip: Try to keep adjustments rare. Research shows 5 positives for every 1 correction works best."
- [ ] "Misbehavior" category renamed to "Needs Improvement" or "Learning Moment"
- [ ] Modal shows current positive-to-negative ratio for that child this week

---

## P3 -- Low

### FEAT-009: Push notification reminders (requires Capacitor)

**Category:** FEATURE
**Review ref:** Viral/Engagement Concerns #1
**Affected files:**
- New Capacitor setup
- `server/routes.js` (add push token storage and send endpoint)
- `server/db.js` (add `push_tokens` table)

**Problem:**
No notification system exists. Parents need evening reminders to log points. Without them, usage follows the pattern: excited week 1, sporadic week 2, abandoned week 3.

**Acceptance criteria:**
- [ ] Daily local notification at 7:30 PM: "How did the kids do today? Log their points!"
- [ ] Push notification when a child submits a reward request
- [ ] Push notification on Monday morning: "New week! Points have been reset."
- [ ] Users can configure notification time or disable them
- [ ] Works on both iOS and Android via Capacitor

**Implementation notes:**
Requires Capacitor native wrapper (see app strategy discussion). Use `@capacitor/local-notifications` for scheduled reminders. Use `@capacitor/push-notifications` + a push service (Firebase Cloud Messaging) for server-triggered notifications.

---

### FEAT-010: Milestone badges

**Category:** FEATURE
**Review ref:** Psychological Concerns #5
**Affected files:**
- `src/pages/ChildView.jsx` (new badges section)
- `server/db.js` (add `badges` table)
- New file: `src/data/badge-definitions.js`

**Problem:**
No milestone or achievement system beyond the weekly goal text. Children thrive on collecting badges and visual representations of accomplishment.

**Acceptance criteria:**
- [ ] Badge definitions: First Points, 100 Club, 500 Club, 1000 Club, Week Warrior (hit weekly goal), Streak Star (3 weeks in a row), Kind Kid (10 Kindness events), Homework Hero (10 Homework events)
- [ ] Badges display on the ChildView profile card
- [ ] New badge earned triggers confetti + special toast
- [ ] Parents see badges earned on the Summary page
- [ ] Badge check runs server-side after each point event

---

### FEAT-011: Capacitor native app wrapper

**Category:** FEATURE / INFRA
**Review ref:** App strategy discussion
**Affected files:**
- New: `capacitor.config.ts`
- New: `ios/` and `android/` directories
- `package.json` (add Capacitor dependencies)

**Problem:**
The app is web-only. For App Store/Google Play distribution, subscription monetization, and native capabilities (push notifications, haptics, badges), a native wrapper is needed.

**Acceptance criteria:**
- [ ] Capacitor initialized with `com.positivepercy.app` bundle ID
- [ ] iOS and Android projects generated and building
- [ ] Splash screen with Percy branding
- [ ] App icons at all required sizes
- [ ] Web build syncs to native projects via `npx cap sync`

---

### FEAT-012: Freemium subscription gating

**Category:** FEATURE
**Review ref:** App strategy discussion
**Affected files:**
- New: `src/lib/SubscriptionContext.jsx`
- `src/pages/ParentDashboard.jsx` (gate child limit)
- `src/pages/Rewards.jsx` (gate reward limit)
- `src/pages/Summary.jsx` (gate behind paywall)

**Problem:**
No monetization exists. For sustainability, the app needs a freemium model.

**Acceptance criteria:**
- [ ] Free tier: 1 child, 3 rewards, basic dashboard
- [ ] Family tier ($3.99/mo or $29.99/yr): Unlimited children, unlimited rewards, analytics
- [ ] Family+ tier ($6.99/mo or $49.99/yr): Everything + push notifications, badges, reward library, family goals
- [ ] RevenueCat integration for cross-platform subscription management
- [ ] Graceful upgrade prompts (not aggressive paywalls)
- [ ] "Upgrade" card shown when free tier limit is reached

---

### ENH-006: Child name sync in denormalized records

**Category:** ENHANCEMENT
**Review ref:** Technical Code Review -- Data Integrity Issues
**Affected files:**
- `server/routes.js` (children UPDATE handler)

**Problem:**
`child_name` is stored in both `point_events` and `redemptions`. When a parent renames a child, historical records still show the old name.

**Acceptance criteria:**
- [ ] When a child's name is updated, cascade the change to `point_events.child_name` and `redemptions.child_name`
- [ ] Or: remove `child_name` from these tables and JOIN on `child_id` when fetching

**Implementation (cascade approach):**
In the children UPDATE handler, after the main update, run:
```sql
UPDATE point_events SET child_name = $1 WHERE child_id = $2;
UPDATE redemptions SET child_name = $1 WHERE child_id = $2;
```

---

### ENH-007: Real-time sync via WebSockets

**Category:** ENHANCEMENT / INFRA
**Review ref:** Viral/Engagement Concerns #5
**Affected files:**
- `server/index.js` (add WebSocket server)
- `src/lib/query-client.js` (connect WebSocket, trigger invalidations)

**Problem:**
The app polls every 5 seconds for pending redemptions. This is wasteful and creates a noticeable delay in the "child requests -> parent approves" flow, which is the emotional peak of the app.

**Acceptance criteria:**
- [ ] WebSocket connection established on app load
- [ ] Server broadcasts to family room when: point event created, redemption created, redemption status changed
- [ ] Client invalidates relevant React Query keys on broadcast
- [ ] Remove the 5-second polling interval
- [ ] Graceful fallback to polling if WebSocket fails

**Implementation notes:**
Use `ws` or `socket.io` on the Express server. Create rooms by `family_code`. On any CRUD mutation, emit to the family room. Client listens and calls `queryClient.invalidateQueries()`.

---

### ENH-008: Delete child functionality

**Category:** ENHANCEMENT
**Affected files:**
- `src/components/child/EditChildModal.jsx`
- `src/pages/ParentDashboard.jsx`

**Problem:**
There is no way to remove a child profile. If a child is added by mistake or a family situation changes, the profile persists forever.

**Acceptance criteria:**
- [ ] "Delete" button with confirmation dialog in EditChildModal
- [ ] Deleting a child also removes their point_events and redemptions (cascade)
- [ ] Confirmation dialog warns about data loss
- [ ] Toast confirms deletion

---

### ENH-009: Delete reward functionality

**Category:** ENHANCEMENT
**Affected files:**
- `src/components/rewards/EditRewardModal.jsx`
- `src/pages/Rewards.jsx`

**Problem:**
There is no way to delete a reward. Outdated or incorrect rewards persist forever.

**Acceptance criteria:**
- [ ] "Delete" button with confirmation dialog in EditRewardModal
- [ ] Pending redemptions for that reward are handled (deny or warn)
- [ ] Toast confirms deletion

---

## Summary Table

| ID | Title | Priority | Category | Effort |
|---|---|---|---|---|
| BUG-001 | Points can go negative | P0 | BUG | Small |
| SEC-001 | SQL injection via column names | P0 | SECURITY | Medium |
| SEC-002 | No authorization on entity routes | P0 | SECURITY | Large |
| BUG-002 | Weekly reset in query function | P1 | BUG | Medium |
| BUG-003 | Race condition on points | P1 | BUG | Medium |
| FEAT-001 | Confetti celebrations | P1 | FEATURE | Small |
| FEAT-002 | Positive-to-negative ratio | P1 | FEATURE | Medium |
| FEAT-003 | Reward ideas library | P1 | FEATURE | Small |
| FEAT-004 | Parent onboarding tips | P1 | FEATURE | Small |
| FEAT-005 | Shareable achievement cards | P2 | FEATURE | Medium |
| FEAT-006 | Parent streak tracking | P2 | FEATURE | Medium |
| FEAT-007 | Age field with smart defaults | P2 | FEATURE | Medium |
| FEAT-008 | Family collaborative goals | P2 | FEATURE | Large |
| ENH-001 | Local logo asset | P2 | ENHANCEMENT | Small |
| ENH-002 | Loading and error states | P2 | ENHANCEMENT | Medium |
| ENH-003 | Paginated history | P2 | ENHANCEMENT | Medium |
| ENH-004 | Server-side summary aggregation | P2 | ENHANCEMENT | Medium |
| ENH-005 | Rename "Remove Points" UX | P2 | ENHANCEMENT | Small |
| ENH-010 | Simplify tracker to total points only | P1 | ENHANCEMENT | Medium |
| ENH-011 | Remove reward approval -- direct redemption | P1 | ENHANCEMENT | Medium |
| FEAT-009 | Push notifications (Capacitor) | P3 | FEATURE | Large |
| FEAT-010 | Milestone badges | P3 | FEATURE | Large |
| FEAT-011 | Capacitor native wrapper | P3 | FEATURE | Large |
| FEAT-012 | Freemium subscription gating | P3 | FEATURE | Large |
| ENH-006 | Child name sync | P3 | ENHANCEMENT | Small |
| ENH-007 | Real-time WebSocket sync | P3 | ENHANCEMENT | Large |
| ENH-008 | Delete child functionality | P3 | ENHANCEMENT | Small |
| ENH-009 | Delete reward functionality | P3 | ENHANCEMENT | Small |
