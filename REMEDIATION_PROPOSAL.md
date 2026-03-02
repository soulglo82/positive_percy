# Positive Percy -- Remediation Proposal

> This document proposes the implementation plan, effort estimates, and technical approach for every item in `BACKLOG.md`. It is structured as a phased delivery plan with dependencies mapped and risks identified.

---

## Executive Summary

Positive Percy is a functional MVP with a sound psychological foundation, but it has **3 critical security/data bugs**, **7 high-priority fixes**, and **18 feature/enhancement opportunities** that will determine whether the product retains users and can be monetized.

This proposal organizes all 28 backlog items into 6 delivery phases spanning approximately 8 weeks. The first two phases (weeks 1-2) address all security vulnerabilities, data bugs, and core UX simplification. The remaining phases build the engagement, celebration, and monetization features that will drive retention and revenue.

**Total estimated effort:** ~175-215 developer hours across 6 phases.

---

## Phase 1: Critical Fixes (Week 1)

> Goal: Eliminate all security vulnerabilities and data-loss bugs before any new user growth.

### 1.1 -- BUG-001: Points can go negative

**Effort:** 2 hours
**Risk:** Low (isolated change, no side effects)

**Current code** (`src/pages/ParentDashboard.jsx:134-140`):
```js
total_points: selectedChild.total_points + data.points,
weekly_points: selectedChild.weekly_points + data.points,
```

**Proposed change:**
```js
total_points: Math.max(0, selectedChild.total_points + data.points),
weekly_points: Math.max(0, selectedChild.weekly_points + data.points),
```

**Scope:**
- `src/pages/ParentDashboard.jsx` -- `handlePointsSubmit` (line ~137-138)
- `src/pages/ParentDashboard.jsx` -- `handleApproveRedemption` (line ~166, add guard on `total_points`)
- Add a warning toast when subtraction would exceed current balance: "This will reduce [child]'s points to 0"

**Testing:** Award 5 points to a child. Subtract 10 points. Verify total is 0, not -5. Approve a reward that costs more than weekly_points. Verify weekly_points is 0.

---

### 1.2 -- SEC-001: SQL injection via unvalidated column names

**Effort:** 4 hours
**Risk:** Medium (touches all CRUD routes, needs thorough testing)

**Proposed approach:**

Add column whitelist and validation in `server/routes.js`:

```js
const COLUMN_WHITELIST = {
  children: new Set(['name', 'avatar_url', 'total_points', 'weekly_points',
    'weekly_target', 'last_reset_date', 'parent_email', 'family_code']),
  point_events: new Set(['child_id', 'points', 'category', 'note',
    'child_name', 'family_code']),
  redemptions: new Set(['child_id', 'child_name', 'reward_id', 'reward_title',
    'reward_cost', 'status', 'family_code']),
  rewards: new Set(['title', 'description', 'cost_points', 'image_url',
    'emoji', 'visible_to_child', 'assigned_child_ids', 'family_code']),
};

const SORT_WHITELIST = new Set(['created_date', 'name', 'title', 'points',
  'total_points', 'weekly_points', 'cost_points', 'status']);

function validateColumns(table, keys) {
  const allowed = COLUMN_WHITELIST[table];
  if (!allowed) return;
  const invalid = keys.filter(k => !allowed.has(k));
  if (invalid.length > 0) {
    const err = new Error(`Invalid columns: ${invalid.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

function buildSort(sortField) {
  if (!sortField) return 'created_date DESC';
  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;
  if (!SORT_WHITELIST.has(field)) return 'created_date DESC';
  return `${field} ${desc ? 'DESC' : 'ASC'}`;
}
```

**Files to modify:**
- `server/routes.js` -- Add `COLUMN_WHITELIST`, `SORT_WHITELIST`, `validateColumns`
- `server/routes.js` -- Call `validateColumns(table, keys)` at top of CREATE (line 264), UPDATE (line 287), FILTER (line 238)
- `server/routes.js` -- Update `buildSort` to validate against whitelist (line 8-13)
- `server/routes.js` -- Apply same validation to `PUT /api/auth/me` (line 180)

**Testing:** Send a POST to `/api/children` with body `{"name; DROP TABLE children--": "test"}`. Verify 400 response. Test all normal CRUD operations still work.

---

### 1.3 -- SEC-002: Session-based authorization

**Effort:** 12 hours
**Risk:** High (changes auth model for entire app, all API calls affected)
**Dependency:** None

**Proposed approach:**

Add `jsonwebtoken` dependency. Issue JWT on family create/join. Require JWT on all entity routes.

**Server changes (`server/routes.js`):**

```js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'positive-percy-secret-change-in-prod';
const JWT_EXPIRY = '30d';

function signToken(familyCode) {
  return jwt.sign({ family_code: familyCode }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.familyCode = decoded.family_code;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

**Changes:**
1. `POST /api/family/create` -- Return `{ ...family, token: signToken(family_code) }`
2. `POST /api/family/join` -- Return `{ ...family, token: signToken(family_code) }`
3. Add `authMiddleware` to all entity routes: `router.get('/api/:entity', authMiddleware, ...)`
4. Entity routes use `req.familyCode` instead of `req.query.family_code`
5. `GET /api/auth/me` uses `req.familyCode` from middleware

**Client changes:**
1. `src/lib/AuthContext.jsx` -- Store token in localStorage alongside family_code
2. `src/api/entities.js` -- Send `Authorization: Bearer <token>` on all requests
3. `src/lib/AuthContext.jsx` -- Include token in `createFamily`, `joinFamily`, `loadUser` flows

**Migration:** Existing users (with only a family_code in localStorage) need to re-authenticate once. On first load, if token is missing but family_code exists, redirect to login with a message: "We've upgraded security. Please re-enter your family code."

**Environment variable:** Add `JWT_SECRET` to Railway environment configuration.

**Testing:** Attempt API calls without token -- verify 401. Create family, use token -- verify 200. Use expired token -- verify 401. Use token from family A to access family B's data -- verify empty results.

---

## Phase 2: Data Integrity (Week 2)

> Goal: Fix race conditions and misplaced side effects that corrupt point data.

### 2.1 -- BUG-002: Move weekly reset to server-side

**Effort:** 4 hours
**Risk:** Medium (changes reset timing behavior, needs careful testing around Monday boundary)
**Dependency:** SEC-001 (column validation should be in place first)

**Proposed approach:**

Add a dedicated server endpoint and remove client-side reset logic.

**New endpoint in `server/routes.js`:**
```js
router.post('/api/children/weekly-reset', authMiddleware, async (req, res) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek !== 1) return res.json({ reset: false, reason: 'Not Monday' });

  const todayStr = today.toISOString().split('T')[0];
  const { rowCount } = await pool.query(
    `UPDATE children
     SET weekly_points = 0, last_reset_date = $1
     WHERE family_code = $2
       AND weekly_points > 0
       AND (last_reset_date IS NULL OR last_reset_date != $1)`,
    [todayStr, req.familyCode]
  );
  res.json({ reset: true, children_reset: rowCount });
});
```

**Client changes (`src/pages/ParentDashboard.jsx`):**
- Remove lines 31-51 (the reset logic inside `queryFn`)
- Add a `useEffect` that calls `POST /api/children/weekly-reset` once on mount
- The children list query becomes a pure read: `queryFn: () => Child.list()`

**Testing:** Set system clock to Monday. Load dashboard. Verify children with weekly_points > 0 are reset. Reload page. Verify no duplicate reset. Open two tabs. Verify only one reset occurs.

---

### 2.2 -- BUG-003: Server-side atomic point operations

**Effort:** 6 hours
**Risk:** Medium (changes how points are calculated across all award/deduct/approve flows)
**Dependency:** SEC-001 (whitelist needs to allow the new endpoint)

**Proposed approach:**

New endpoint in `server/routes.js`:
```js
router.post('/api/children/:id/adjust-points', authMiddleware, async (req, res) => {
  const { points } = req.body;
  if (typeof points !== 'number') {
    return res.status(400).json({ error: 'points must be a number' });
  }

  const { rows } = await pool.query(
    `UPDATE children
     SET total_points = GREATEST(0, total_points + $1),
         weekly_points = GREATEST(0, weekly_points + $1)
     WHERE id = $2 AND family_code = $3
     RETURNING *`,
    [points, req.params.id, req.familyCode]
  );

  if (rows.length === 0) return res.status(404).json({ error: 'Child not found' });
  res.json(rows[0]);
});
```

**Client changes (`src/pages/ParentDashboard.jsx`):**

Replace `handlePointsSubmit` (~line 125-141):
```js
const handlePointsSubmit = async (data) => {
  await createPointEventMutation.mutateAsync({
    child_id: selectedChild.id,
    child_name: selectedChild.name,
    points: data.points,
    category: data.category,
    note: data.note,
  });

  // Server-side atomic increment (replaces client-side arithmetic)
  await fetch(`/api/children/${selectedChild.id}/adjust-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ points: data.points }),
  });

  queryClient.invalidateQueries(['children']);
};
```

Replace `handleApproveRedemption` (~line 154-172) similarly, calling `adjust-points` with negative `reward_cost`.

**Testing:** Open dashboard on two devices for the same family. Simultaneously award +10 on device A and +5 on device B. Verify child ends up with +15 total (not +10 or +5). Deduct points that exceed balance. Verify floor at 0.

---

### 2.3 -- ENH-010: Simplify tracker to total points only

**Effort:** 6 hours
**Risk:** Medium (touches multiple components, changes core display model)
**Dependency:** None

**Problem:**
The ChildCard currently shows three overlapping numbers:
1. "Total: 24 points" (text under name)
2. "2 / 50" (weekly badge in corner)
3. "Weekly Progress 4%" (progress bar)

Parents -- the only real users -- find this confusing. They just want to see how many points a child has.

**Proposed approach:**

**ChildCard.jsx -- simplify to total points as the hero number:**
```jsx
export default function ChildCard({ child, onAddPoints, onSubtractPoints, onEdit }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="overflow-hidden border-2 hover:shadow-xl transition-all duration-300">
        <div className="h-2 bg-gradient-to-r from-purple-200 via-pink-200 to-blue-200" />
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* Avatar (unchanged) */}
              <div>
                <h3 className="text-xl font-bold text-slate-800">{child.name}</h3>
              </div>
            </div>
            {/* Single hero number replaces weekly badge */}
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">{child.total_points}</div>
              <div className="text-xs text-slate-500">points</div>
            </div>
          </div>

          {/* Remove: Weekly Progress bar entirely */}
          {/* Remove: progressPercent calculation */}
          {/* Remove: isOnTrack logic */}

          {/* Action Buttons (unchanged) */}
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

**ChildView.jsx -- single points display:**
- Replace the 2-column grid (Total Points / This Week) with a single large points card
- Remove or collapse the "Weekly Goal" progress bar into an optional "This Week" expandable section
- Remove the `isWeekend()` restriction (addressed in ENH-011)

**AddChildModal.jsx / EditChildModal.jsx:**
- Make `weekly_target` field hidden or collapsed under "Advanced Settings"
- Default it to a reasonable value (50) without requiring parent input during onboarding

**Summary.jsx:**
- Weekly breakdown remains here (this is the right place for detailed analytics)
- No changes needed -- the Summary page is where weekly data belongs

**Testing:** Create a child. Verify the card shows only the total points as a single clear number. Award points. Verify the number updates. No weekly badge or progress bar visible on the main dashboard.

---

### 2.4 -- ENH-011: Remove reward approval -- direct redemption

**Effort:** 6 hours
**Risk:** Low (simplifies code, removes complexity)
**Dependency:** BUG-003 (server-side point adjustment should be in place first)

**Problem:**
The reward request/approval flow serves no purpose because only parents use the system. A parent navigates to Child View, taps "Request" on behalf of the child, then switches back to the Dashboard to approve their own request. Five steps for what should be one action.

**Proposed approach:**

**ChildView.jsx -- replace request with direct redemption:**
```jsx
const handleRedeemReward = async (reward) => {
  if (!selectedChild) return;

  if (selectedChild.total_points < reward.cost_points) {
    toast.error("Not enough points yet!");
    return;
  }

  // Show confirmation dialog
  setRedeemConfirm({ reward, child: selectedChild });
};

const confirmRedemption = async () => {
  const { reward, child } = redeemConfirm;

  // Deduct points immediately (server-side atomic)
  await fetch(`/api/children/${child.id}/adjust-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ points: -reward.cost_points }),
  });

  // Log the redemption as completed (for history)
  await Redemption.create({
    child_id: child.id,
    child_name: child.name,
    reward_id: reward.id,
    reward_title: reward.title,
    reward_cost: reward.cost_points,
    status: 'Completed',
  });

  queryClient.invalidateQueries(['children']);
  toast.success(`${child.name} redeemed ${reward.title}!`);
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); // if FEAT-001 is done
  setRedeemConfirm(null);
};
```

Add a confirmation dialog (using existing Shadcn `AlertDialog`):
```
"[Child] will spend [X] points on [Reward]. Continue?"
[Cancel] [Redeem]
```

**ParentDashboard.jsx -- remove pending redemptions:**
- Remove the `pendingRedemptions` query (lines 58-62)
- Remove the `handleApproveRedemption` and `handleDenyRedemption` functions (lines 154-180)
- Remove the "Pending Reward Requests" card (lines 196-215)
- Remove the `RedemptionCard` import
- This eliminates the 5-second polling, improving performance

**RewardCard.jsx:**
- Change button label from "Request" to "Redeem" (or "Use Reward")
- Remove the `isWeekend()` gating -- parents can redeem any time

**Files no longer needed (or repurposed):**
- `src/components/redemptions/RedemptionCard.jsx` -- can be kept for a future "Redemption History" view but is no longer used on the dashboard

**Testing:** Navigate to Child View. Tap "Redeem" on a reward. Confirm in dialog. Verify points deducted immediately. Verify no pending request appears on Dashboard. Verify redemption logged in history. Try to redeem when points are insufficient -- verify error toast.

---

## Phase 3: Child Psychology & Safety (Week 3)

> Goal: Add the guardrails and guidance that protect the positive reinforcement framework.

### 3.1 -- FEAT-002: Positive-to-negative ratio indicator

**Effort:** 6 hours
**Risk:** Low
**Dependency:** None

**Implementation plan:**

**Summary page (`src/pages/Summary.jsx`):**
- Add a new "Positivity Health" card after the existing 4-stat grid
- Per child, calculate: `positiveCount / negativeCount` from weekly events
- Display as `X:1` ratio with color coding:
  - Green (5:1+): "Great balance!"
  - Amber (3:1 to 4:1): "Could use more positives"
  - Red (<3:1): "Research shows 5+ positives per correction works best"

**AddPointsModal (`src/components/child/AddPointsModal.jsx`):**
- When `isSubtract=true`, query recent events for this child
- Show current ratio in the modal header as context
- If ratio is below 4:1, show a gentle amber banner

**New component:** `src/components/PositivityRatioBadge.jsx`
- Reusable badge that takes `positiveCount` and `negativeCount` as props
- Renders colored ratio with tooltip explanation

---

### 3.2 -- ENH-005: Rename "Remove Points" UX

**Effort:** 2 hours
**Risk:** Low
**Dependency:** None

**Changes:**

| File | Current | Proposed |
|---|---|---|
| `src/components/child/ChildCard.jsx:96` | "Remove" | "Adjust" |
| `src/components/child/AddPointsModal.jsx:57` | "Remove Points" | "Adjust Points" |
| `src/components/child/AddPointsModal.jsx:28` | "Misbehavior" category | "Learning Moment" |
| `src/components/child/AddPointsModal.jsx:150` | "Remove Points" button text | "Adjust Points" |

**Add to the Adjust Points modal:**
A small helper text below the title:
```
"Tip: Try to keep adjustments rare. Research shows 5 positives for every 1 correction works best."
```

---

### 3.3 -- FEAT-004: Parent onboarding tips

**Effort:** 4 hours
**Risk:** Low
**Dependency:** None

**New file:** `src/components/OnboardingTips.jsx`

**Implementation:**
- Use existing Shadcn `Dialog` component
- 4-step carousel with Next/Back/Done buttons
- Tips content:
  1. **"Start small"** -- "Set weekly targets your child can hit about 80% of the time. It's better to raise the bar later than to start too high."
  2. **"Be specific"** -- "'Great job sharing your toy with your sister!' works much better than 'Good job'. Specific praise teaches children exactly what behavior to repeat."
  3. **"Stay positive"** -- "Aim for at least 5 point awards for every 1 adjustment. The app works best when the focus is on catching good behavior, not punishing bad."
  4. **"Be consistent"** -- "Even 2 minutes each evening to log the day's highlights builds the habit. Your children will start looking for ways to earn points!"
- Check `localStorage.getItem('percy_onboarding_done')` on `ParentDashboard` mount
- Show dialog if flag is not set
- On dismiss, set `localStorage.setItem('percy_onboarding_done', 'true')`
- Add "Tips" link in `ParentProfile.jsx` to re-show the dialog

---

### 3.4 -- FEAT-007: Age field with smart defaults

**Effort:** 6 hours
**Risk:** Low
**Dependency:** None

**Database change (`server/db.js`):**
```sql
ALTER TABLE children ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
```

**UI changes:**
- `src/components/child/AddChildModal.jsx` -- Add optional "Age" number input (or DOB date picker using existing `react-day-picker`)
- When age is entered, auto-suggest `weeklyTarget`:
  - Ages 3-5: 20
  - Ages 6-8: 35
  - Ages 9-12: 50
  - Ages 13+: 75
- `src/components/child/AddPointsModal.jsx` -- Filter `CATEGORIES` by age:
  - Ages 3-5: Remove "Homework", add "Sharing", "Listening"
  - Ages 6+: All current categories
  - Ages 9+: Add "Independence", "Self-Care"
- Parent can always override suggestions

---

## Phase 4: Engagement & Delight (Weeks 4-5)

> Goal: Add the celebration and habit mechanics that drive retention.

### 4.1 -- FEAT-001: Confetti celebrations

**Effort:** 3 hours
**Risk:** Low (library already installed)
**Dependency:** None

**Implementation plan:**

```js
import confetti from 'canvas-confetti';

const percyConfetti = () => {
  confetti({
    particleCount: 150,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b'],
  });
};
```

**Trigger points:**

1. **ChildView (`src/pages/ChildView.jsx`)** -- When `progressPercent` transitions to >= 100
   - Use `useRef` to track `previousPercent`
   - Fire confetti only when crossing the threshold, not on every re-render
   - Replace the text-only "Goal achieved!" with confetti + animated text

2. **ParentDashboard (`src/pages/ParentDashboard.jsx`)** -- After awarding points
   - Check if the updated `weekly_points` now >= `weekly_target`
   - If yes, fire confetti and show toast: "[Child] hit their weekly goal!"

3. **ParentDashboard** -- After approving a redemption
   - Small confetti burst to celebrate the reward being granted

---

### 4.2 -- FEAT-003: Pre-populated reward ideas library

**Effort:** 4 hours
**Risk:** Low
**Dependency:** None

**New file:** `src/data/reward-templates.js`

```js
export const REWARD_TEMPLATES = [
  // Quick Wins (5-15 points)
  { title: "Extra Bedtime Story", emoji: "📚", cost_points: 5, category: "quick",
    description: "One extra story at bedtime" },
  { title: "Choose Breakfast", emoji: "🥞", cost_points: 10, category: "quick",
    description: "Pick what's for breakfast tomorrow" },
  { title: "10 Extra Minutes of Play", emoji: "⏰", cost_points: 10, category: "quick",
    description: "Stay up 10 minutes past bedtime for play" },
  { title: "Pick the Music", emoji: "🎵", cost_points: 5, category: "quick",
    description: "Choose the music in the car" },

  // Medium (20-50 points)
  { title: "Movie Night Pick", emoji: "🎬", cost_points: 25, category: "medium",
    description: "Choose the family movie" },
  { title: "Extra Screen Time", emoji: "🎮", cost_points: 30, category: "medium",
    description: "30 minutes of extra tablet or TV time" },
  { title: "Friend Sleepover", emoji: "🏠", cost_points: 50, category: "medium",
    description: "Have a friend sleep over this weekend" },
  { title: "Choose Dinner", emoji: "🍕", cost_points: 20, category: "medium",
    description: "Pick what's for dinner" },
  { title: "Baking Together", emoji: "🧁", cost_points: 25, category: "medium",
    description: "Bake cookies or a cake with Mum or Dad" },
  { title: "Park Trip", emoji: "🌳", cost_points: 20, category: "medium",
    description: "Special trip to the park" },

  // Big Goals (75-200 points)
  { title: "Toy Store Trip", emoji: "🧸", cost_points: 100, category: "big",
    description: "Pick a toy up to $15" },
  { title: "Day Out", emoji: "🎡", cost_points: 150, category: "big",
    description: "Special day out -- zoo, aquarium, or museum" },
  { title: "New Game", emoji: "🎮", cost_points: 120, category: "big",
    description: "A new video game or board game" },
  { title: "Bike Ride Adventure", emoji: "🚲", cost_points: 75, category: "big",
    description: "Special bike ride to a new place" },
  { title: "Ice Cream Outing", emoji: "🍦", cost_points: 40, category: "big",
    description: "Trip to the ice cream shop" },
  { title: "Cinema Trip", emoji: "🍿", cost_points: 80, category: "big",
    description: "See a movie at the cinema" },
  { title: "Craft Supplies", emoji: "🎨", cost_points: 60, category: "big",
    description: "New art or craft supplies" },
  { title: "Sports Equipment", emoji: "⚽", cost_points: 100, category: "big",
    description: "New ball, racket, or sports gear" },
  { title: "Book of Choice", emoji: "📖", cost_points: 50, category: "big",
    description: "Pick any book from the bookshop" },
  { title: "Special Breakfast Out", emoji: "🥐", cost_points: 75, category: "big",
    description: "Breakfast at a cafe with Mum or Dad" },
];
```

**UI changes (`src/components/rewards/AddRewardModal.jsx`):**
- Add "Browse Ideas" button at the top of the modal
- Clicking it shows a scrollable list grouped by category (Quick Wins / Medium / Big Goals)
- Tapping an idea pre-fills `title`, `emoji`, `cost_points`, `description`
- Parent can edit all fields before saving
- The ideas list remains visible (not consumed on selection)

---

### 4.3 -- FEAT-006: Parent streak tracking

**Effort:** 6 hours
**Risk:** Low
**Dependency:** BUG-003 (server-side point adjustment should be in place)

**Database change (`server/db.js`):**
```sql
ALTER TABLE families ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE families ADD COLUMN IF NOT EXISTS last_active_date TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
```

**New endpoint (`server/routes.js`):**
```js
router.post('/api/family/check-streak', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const { rows } = await pool.query(
    'SELECT current_streak, last_active_date, longest_streak FROM families WHERE family_code = $1',
    [req.familyCode]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Family not found' });

  const family = rows[0];
  let newStreak = family.current_streak || 0;

  if (family.last_active_date === today) {
    return res.json({ streak: newStreak, updated: false });
  } else if (family.last_active_date === yesterday) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  const longestStreak = Math.max(newStreak, family.longest_streak || 0);

  await pool.query(
    'UPDATE families SET current_streak = $1, last_active_date = $2, longest_streak = $3 WHERE family_code = $4',
    [newStreak, today, longestStreak, req.familyCode]
  );

  res.json({ streak: newStreak, longest: longestStreak, updated: true });
});
```

**UI (`src/pages/ParentDashboard.jsx`):**
- Call `POST /api/family/check-streak` after every successful point award
- Display streak in dashboard header: flame icon + "5-day streak!"
- Fire confetti at milestones: 7, 14, 30, 60, 100 days

---

### 4.4 -- FEAT-005: Shareable achievement cards

**Effort:** 8 hours
**Risk:** Medium (image generation can be finicky across browsers)
**Dependency:** FEAT-001 (confetti should ship first so the celebration moment exists)

**Implementation plan:**

1. Create `src/components/ShareableCard.jsx` -- a styled hidden div that renders:
   - Child avatar, name, points
   - "Weekly Goal Achieved!" or "100 Points Club!" message
   - Purple/pink gradient background
   - "positivepercy.app" watermark at bottom

2. Use `html2canvas` (already installed) to capture the div as a PNG:
   ```js
   import html2canvas from 'html2canvas';

   const captureCard = async (elementRef) => {
     const canvas = await html2canvas(elementRef.current, { scale: 2 });
     return canvas.toDataURL('image/png');
   };
   ```

3. Share via Web Share API (mobile) or download (desktop):
   ```js
   const shareImage = async (dataUrl, text) => {
     const blob = await (await fetch(dataUrl)).blob();
     const file = new File([blob], 'percy-achievement.png', { type: 'image/png' });

     if (navigator.share && navigator.canShare?.({ files: [file] })) {
       await navigator.share({ text, files: [file] });
     } else {
       // Fallback: download
       const a = document.createElement('a');
       a.href = dataUrl;
       a.download = 'percy-achievement.png';
       a.click();
     }
   };
   ```

4. Add "Share" button in:
   - `ChildView.jsx` (when goal achieved)
   - `Summary.jsx` (per-child card, when on track)

---

## Phase 5: UX & Performance (Week 6)

> Goal: Polish the user experience and fix performance bottlenecks.

### 5.1 -- ENH-001: Local logo asset

**Effort:** 1 hour
**Risk:** None

**Steps:**
1. Download the current logo from the Supabase URL
2. Save as `public/logo.png`
3. Update `src/pages/ParentDashboard.jsx:188` and `src/Layout.jsx:28` to use `/logo.png`

---

### 5.2 -- ENH-002: Loading and error states

**Effort:** 6 hours
**Risk:** Low

**Approach:**
- Create `src/components/LoadingSpinner.jsx` (consistent spinner component)
- Create `src/components/ErrorCard.jsx` (error message + retry button)
- Update all 5 page components to destructure `isLoading` and `isError` from `useQuery`
- Show `<LoadingSpinner />` when loading, `<ErrorCard onRetry={refetch} />` on error

**Files to modify:** `ParentDashboard.jsx`, `Summary.jsx`, `Rewards.jsx`, `History.jsx`, `ChildView.jsx`

---

### 5.3 -- ENH-003: Paginated history

**Effort:** 4 hours
**Risk:** Low
**Dependency:** None

**Server change (`server/routes.js`):**
Add offset support to the LIST endpoint:
```js
const offset = req.query.offset ? `OFFSET ${parseInt(req.query.offset)}` : '';
// ...
`SELECT * FROM ${table} ${where} ORDER BY ${sort} ${limit} ${offset}`
```

**Client change (`src/pages/History.jsx`):**
- Replace hardcoded `limit=100` with page-based loading
- Add "Load More" button at the bottom
- Track current offset in state; each click fetches next 50 events
- Append results to existing list
- Disable button when returned count < limit (no more results)

---

### 5.4 -- ENH-004: Server-side summary aggregation

**Effort:** 6 hours
**Risk:** Medium (SQL aggregation logic must match current client-side calculations exactly)
**Dependency:** None

**New endpoint (`server/routes.js`):**
```js
router.get('/api/summary', authMiddleware, async (req, res) => {
  const weekStart = req.query.week_start; // ISO date string
  const familyCode = req.familyCode;

  // Per-child weekly stats
  const { rows: childStats } = await pool.query(`
    SELECT
      c.id, c.name, c.avatar_url, c.weekly_points, c.weekly_target,
      COALESCE(SUM(CASE WHEN pe.points > 0 THEN pe.points ELSE 0 END), 0) as positive_points,
      COALESCE(SUM(CASE WHEN pe.points < 0 THEN ABS(pe.points) ELSE 0 END), 0) as negative_points,
      COUNT(pe.id) as total_events
    FROM children c
    LEFT JOIN point_events pe ON pe.child_id = c.id
      AND pe.created_date >= $1
      AND pe.family_code = $2
    WHERE c.family_code = $2
    GROUP BY c.id
  `, [weekStart, familyCode]);

  // Top categories
  const { rows: topCategories } = await pool.query(`
    SELECT category, SUM(points) as total_points
    FROM point_events
    WHERE family_code = $1 AND created_date >= $2 AND points > 0
    GROUP BY category
    ORDER BY total_points DESC
    LIMIT 5
  `, [familyCode, weekStart]);

  res.json({ childStats, topCategories });
});
```

**Client change (`src/pages/Summary.jsx`):**
- Replace the two separate queries (children + 200 events) with a single call to `GET /api/summary`
- Remove all client-side aggregation functions (`getTotalWeeklyPoints`, `getChildWeeklyStats`, `getTopCategories`)
- Map the server response directly to the UI

---

### 5.5 -- ENH-006: Child name sync on rename

**Effort:** 2 hours
**Risk:** Low
**Dependency:** None

**Server change (`server/routes.js`):**
In the children UPDATE handler (or as a new dedicated endpoint), after updating a child's name, cascade:

```js
if (data.name) {
  await pool.query('UPDATE point_events SET child_name = $1 WHERE child_id = $2', [data.name, req.params.id]);
  await pool.query('UPDATE redemptions SET child_name = $1 WHERE child_id = $2', [data.name, req.params.id]);
}
```

---

### 5.6 -- ENH-008 & ENH-009: Delete child and delete reward

**Effort:** 4 hours (combined)
**Risk:** Medium (destructive operations need confirmation dialogs)
**Dependency:** None

**Delete child:**
- Add "Delete" button with red styling in `EditChildModal.jsx`
- Confirmation dialog: "This will permanently delete [child] and all their point history. This cannot be undone."
- Server: `DELETE FROM point_events WHERE child_id = $1` then `DELETE FROM redemptions WHERE child_id = $1` then `DELETE FROM children WHERE id = $1`

**Delete reward:**
- Add "Delete" button in `EditRewardModal.jsx`
- Confirmation dialog: "This will remove the reward. Any pending requests for it will be denied."
- Server: `UPDATE redemptions SET status = 'Denied' WHERE reward_id = $1 AND status = 'Pending'` then `DELETE FROM rewards WHERE id = $1`

---

## Phase 6: Platform & Monetization (Weeks 7-8)

> Goal: Prepare for App Store distribution and revenue generation.

### 6.1 -- FEAT-011: Capacitor native wrapper

**Effort:** 16 hours
**Risk:** High (first native build, signing, platform-specific issues)
**Dependency:** All P0 and P1 items should be complete

**Steps:**
1. Install Capacitor: `npm install @capacitor/core @capacitor/cli`
2. Initialize: `npx cap init "Positive Percy" com.positivepercy.app --web-dir dist`
3. Add platforms: `npx cap add ios && npx cap add android`
4. Install plugins:
   - `@capacitor/splash-screen`
   - `@capacitor/haptics`
   - `@capacitor/share`
   - `@capacitor/badge`
5. Configure `capacitor.config.ts` with server URL for live reload during dev
6. Generate app icons (1024x1024 master → all sizes via Capacitor asset tools)
7. Generate splash screens
8. Build and test on iOS Simulator and Android Emulator
9. Build signed IPA/AAB for store submission

**Deliverables:** Working iOS and Android builds that wrap the existing web app.

---

### 6.2 -- FEAT-009: Push notifications

**Effort:** 12 hours
**Risk:** Medium
**Dependency:** FEAT-011 (Capacitor must be set up)

**Implementation:**
1. Install `@capacitor/push-notifications` and `@capacitor/local-notifications`
2. **Local notifications** (no server required):
   - Daily reminder at 7:30 PM: "How did the kids do today?"
   - Monday morning: "New week! Points have been reset."
   - User can configure time or disable in settings
3. **Push notifications** (requires server):
   - New table `push_tokens`: `id, family_code, token, platform, created_date`
   - On app launch, register push token and save to server
   - When a child creates a redemption, server sends push to family's registered tokens
   - Use Firebase Cloud Messaging (free tier) as the push delivery service

---

### 6.3 -- FEAT-012: Freemium subscription gating

**Effort:** 16 hours
**Risk:** High (payment integration, store compliance, entitlement logic)
**Dependency:** FEAT-011 (Capacitor must be in place for in-app purchases)

**Implementation:**
1. Install `@revenuecat/purchases-capacitor`
2. Set up RevenueCat project with App Store Connect and Google Play Console
3. Define products:
   - `percy_family_monthly` ($3.99/month)
   - `percy_family_annual` ($29.99/year)
   - `percy_family_plus_monthly` ($6.99/month)
   - `percy_family_plus_annual` ($49.99/year)

4. Create `src/lib/SubscriptionContext.jsx`:
   ```js
   // Check entitlements on app load
   // Expose: { tier: 'free' | 'family' | 'family_plus', isLoading }
   ```

5. Gate features:
   | Feature | Free | Family | Family+ |
   |---|---|---|---|
   | Children | 1 | Unlimited | Unlimited |
   | Rewards | 3 | Unlimited | Unlimited |
   | Dashboard | Yes | Yes | Yes |
   | Summary analytics | No | Yes | Yes |
   | History filters | No | Yes | Yes |
   | Push notifications | No | No | Yes |
   | Milestone badges | No | No | Yes |
   | Reward idea library | No | No | Yes |
   | Shareable cards | No | Yes | Yes |

6. Add "Upgrade" prompts:
   - When adding a 2nd child on free tier: "Upgrade to Family to add more children"
   - When adding a 4th reward on free tier: "Upgrade to unlock unlimited rewards"
   - Summary page: blurred preview with "Upgrade to see analytics"

---

### 6.4 -- FEAT-008: Family collaborative goals

**Effort:** 10 hours
**Risk:** Low
**Dependency:** None (but pairs well with FEAT-001 confetti)

**Database (`server/db.js`):**
```sql
CREATE TABLE IF NOT EXISTS family_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  condition_type TEXT NOT NULL,  -- 'all_hit_percent' or 'total_family_points'
  condition_value INTEGER NOT NULL,  -- e.g., 80 (percent) or 200 (points)
  reward_text TEXT,  -- e.g., "Pizza night!"
  is_active BOOLEAN DEFAULT true,
  is_achieved BOOLEAN DEFAULT false,
  family_code TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);
```

**Condition evaluation (server-side):**
```js
// 'all_hit_percent': All children at or above X% of weekly target
// 'total_family_points': Sum of all children's weekly_points >= N
```

**UI:**
- `ParentDashboard.jsx` -- "Family Goal" card at top (above child grid)
- Shows progress: "3/4 children at 80%+ -- Almost there!"
- Create/edit goal in `ParentProfile.jsx` or via a dedicated modal
- `ChildView.jsx` -- Show family goal progress as a shared card
- On achievement: confetti + celebratory toast for entire family

---

### 6.5 -- FEAT-010: Milestone badges

**Effort:** 10 hours
**Risk:** Low
**Dependency:** FEAT-001 (confetti should exist for badge celebration)

**New file:** `src/data/badge-definitions.js`
```js
export const BADGES = [
  { id: 'first_points', title: 'First Points!', emoji: '🌟',
    description: 'Earned your very first points', check: (child) => child.total_points > 0 },
  { id: 'century_club', title: '100 Club', emoji: '💯',
    description: 'Reached 100 total points', check: (child) => child.total_points >= 100 },
  { id: 'high_five', title: 'High Five Hundred', emoji: '🖐️',
    description: 'Reached 500 total points', check: (child) => child.total_points >= 500 },
  { id: 'thousand', title: 'Superstar', emoji: '⭐',
    description: 'Reached 1000 total points', check: (child) => child.total_points >= 1000 },
  { id: 'week_warrior', title: 'Week Warrior', emoji: '🏆',
    description: 'Hit your weekly goal', check: (child) => child.weekly_points >= child.weekly_target },
  // Category-based badges checked via event counts (server-side)
  { id: 'kind_kid', title: 'Kind Kid', emoji: '💝', description: '10 Kindness events' },
  { id: 'homework_hero', title: 'Homework Hero', emoji: '📝', description: '10 Homework events' },
  { id: 'helper', title: 'Super Helper', emoji: '🧹', description: '10 Chores events' },
];
```

**Database:** `ALTER TABLE children ADD COLUMN IF NOT EXISTS badges_earned TEXT[] DEFAULT '{}'`

**Badge evaluation:** After each point event, server checks badge conditions. If a new badge is earned, append to `badges_earned` array and return `{ new_badge: { ... } }` in the response.

**UI:** Display earned badges as a row of emoji circles on `ChildView.jsx`. Fire confetti + special toast on new badge earned.

---

### 6.6 -- ENH-007: WebSocket real-time sync

**Effort:** 8 hours
**Risk:** Medium (WebSocket connection management, reconnection logic)
**Dependency:** None (but most impactful after push notifications exist)

**Server (`server/index.js`):**
```js
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ noServer: true });
const familyRooms = new Map(); // family_code -> Set<ws>

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, request) => {
  const familyCode = new URL(request.url, 'http://localhost').searchParams.get('family_code');
  if (!familyRooms.has(familyCode)) familyRooms.set(familyCode, new Set());
  familyRooms.get(familyCode).add(ws);
  ws.on('close', () => familyRooms.get(familyCode)?.delete(ws));
});

export function broadcast(familyCode, event) {
  familyRooms.get(familyCode)?.forEach(ws => {
    if (ws.readyState === 1) ws.send(JSON.stringify(event));
  });
}
```

After each CRUD mutation in `routes.js`, call `broadcast(familyCode, { type: 'invalidate', keys: ['children'] })`.

**Client:** Connect on app load. On message, call `queryClient.invalidateQueries(event.keys)`. Remove the 5-second `refetchInterval` on `pendingRedemptions`.

---

## Effort Summary

| Phase | Items | Estimated Hours | Timeline |
|---|---|---|---|
| **Phase 1: Critical Fixes** | BUG-001, SEC-001, SEC-002 | 18 hours | Week 1 |
| **Phase 2: Data Integrity & UX Simplification** | BUG-002, BUG-003, ENH-010, ENH-011 | 22 hours | Week 2 |
| **Phase 3: Psychology & Safety** | FEAT-002, ENH-005, FEAT-004, FEAT-007 | 18 hours | Week 3 |
| **Phase 4: Engagement & Delight** | FEAT-001, FEAT-003, FEAT-006, FEAT-005 | 21 hours | Weeks 4-5 |
| **Phase 5: UX & Performance** | ENH-001 through ENH-009 | 23 hours | Week 6 |
| **Phase 6: Platform & Monetization** | FEAT-008 through FEAT-012, ENH-007 | 72 hours | Weeks 7-8 |
| **Total** | **28 items** | **~174 hours** | **~8 weeks** |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SEC-002 JWT migration breaks existing users | Medium | High | Show re-auth message, not hard error. Keep family code join flow working. |
| Capacitor build fails on iOS due to signing | High | Medium | Enroll in Apple Developer Program early. Use Xcode auto-signing. |
| RevenueCat integration delays due to store review | Medium | High | Submit app without paywall first. Add subscription in v1.1 update. |
| html2canvas renders differently across browsers | Medium | Low | Test on Safari iOS, Chrome Android, desktop Chrome. Use fixed dimensions. |
| WebSocket connections drop on mobile sleep/resume | High | Low | Implement reconnection with exponential backoff. Keep polling as fallback. |
| Weekly reset endpoint called before midnight timezone differences | Medium | Medium | Use server timezone consistently. Document that reset time is server-local Monday. |

---

## Dependencies Graph

```
Phase 1 (Critical)
  ├── BUG-001 (no dependencies)
  ├── SEC-001 (no dependencies)
  └── SEC-002 (no dependencies)
          │
Phase 2 (Integrity & UX Simplification)
  ├── BUG-002 (depends on SEC-001)
  ├── BUG-003 (depends on SEC-001)
  ├── ENH-010 Simplify to total points (no dependencies)
  └── ENH-011 Direct redemption (depends on BUG-003)
          │
Phase 3 (Psychology)
  ├── FEAT-002 (no dependencies)
  ├── ENH-005 (no dependencies)
  ├── FEAT-004 (no dependencies)
  └── FEAT-007 (no dependencies)
          │
Phase 4 (Engagement)
  ├── FEAT-001 (no dependencies)
  ├── FEAT-003 (no dependencies)
  ├── FEAT-006 (depends on BUG-003)
  └── FEAT-005 (depends on FEAT-001)
          │
Phase 5 (UX/Perf)
  ├── ENH-001 through ENH-009 (all independent)
          │
Phase 6 (Platform)
  ├── FEAT-011 Capacitor (depends on all P0/P1)
  ├── FEAT-009 Push (depends on FEAT-011)
  ├── FEAT-012 Subscriptions (depends on FEAT-011)
  ├── FEAT-008 Family Goals (independent)
  ├── FEAT-010 Badges (depends on FEAT-001)
  └── ENH-007 WebSockets (independent)
```
