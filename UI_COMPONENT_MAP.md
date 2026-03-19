# UI Component Map — Phase 0 Audit

> Every component relevant to the core loop: earn → stack → confirm → repeat.
> Components marked **REMOVE** are scheduled for deletion in Phases 2–4.

---

## App Header / Nav

| Component | File | Lines | What It Renders |
|-----------|------|-------|-----------------|
| Layout | `src/Layout.jsx` | 1–107 | Top nav bar with logo, 5 nav links (Home, Child View, Activity, Rewards, Settings), logout dialog. Icons: Lucide. Active page gets gradient highlight. Labels hidden on mobile. |

**Note:** No persistent page title. Logo is not the Positive Percy brand mark — it's a generic star icon. Phase 5 replaces this.

---

## HeroCard (Home)

| Component | File | Lines | What It Renders |
|-----------|------|-------|-----------------|
| HeroCard | `src/components/dashboard/HeroCard.jsx` | 1–88 | Star icon title, streak badge (if > 0), per-child status cards (avatar, name, points, next reward progress bar), "Add First Child" button if no children. |

**Props:** `children`, `streak`, `rewards`, `onAddFirstChild`

**Problem for spec:** Shows individual child balances and per-child reward progress. Phase 3 replaces with family-level-only stats (streak, weekly total, stack total).

---

## ChildCard (Home)

| Component | File | Lines | What It Renders |
|-----------|------|-------|-----------------|
| ChildCard | `src/components/child/ChildCard.jsx` | 1–129 | Avatar (edit overlay on hover), name, total points, progress bar toward next reward, quick action buttons (1–4), "+Add" button. Shows **"All rewards unlocked"** when affordable. |

**Props:** `child`, `onAddPoints`, `onEdit`, `onQuickAction`, `quickActions`, `rewards`

**Problem for spec:** Contains the "All rewards unlocked" string (must be removed). Progress bar shows next-reward distance — Phase 3 replaces with "Can take X rewards this weekend" + Confirm Weekend button.

---

## ChildView Page

| Component | File | Lines | What It Renders |
|-----------|------|-------|-----------------|
| ChildView | `src/pages/ChildView.jsx` | 1–389 | Child selector (HTML `<Select>`), hero card (avatar + name + points), MotivationCard, ShareableCard, BadgeDisplay, RewardCard grid, recent activity feed, redemption confirmation dialog. |

**Sub-components rendered (all marked for Phase 2 action):**

| Sub-component | Action | Reason |
|---------------|--------|--------|
| MotivationCard | **REMOVE** | Stats tiles — not in spec |
| ShareableCard | **REMOVE** | Share button — no purpose in core loop |
| BadgeDisplay | **REMOVE** | Badge grid — not in core loop |
| Activity feed section | **REMOVE** | Activity belongs on Activity page only |
| HTML `<Select>` child switcher | **REPLACE** | Swap for tab/avatar selector |
| Redemption confirmation dialog | **REPLACE** | Replace with "Add to Weekend" flow |

---

## RewardCard

| Component | File | Lines | What It Renders |
|-----------|------|-------|-----------------|
| RewardCard | `src/components/rewards/RewardCard.jsx` | 1–137 | Image/emoji header (h-32), title, description, cost badge, assigned children badges (parent view), progress bar (child view), **"Reward unlocked ✓"** text when affordable, "Redeem" button (child view), edit/visibility toggle (parent view). |

**Props:** `reward`, `onRequest`, `isParentView`, `onToggleVisibility`, `onEdit`, `canAfford`, `childPoints`, `assignedChildren`

**Legacy strings to purge (Phase 1.4):**
- Line ~88: `"Reward unlocked"` → replace with `"+ Add to weekend"` / `"✓ Added"` / `"Need X more pts"`
- `canAfford` prop drives green state — keep prop, change label
- `onRequest` prop triggers redeem — rename to `onToggleStack`

---

## Activity Feed

| Component | File | Lines | What It Renders |
|-----------|------|-------|-----------------|
| Activity page | `src/pages/Activity.jsx` | 1–370 | Filter buttons (All/Earned/Spent), child selector, CalendarHeatmap, NarrativeItem list grouped by date (Today/Yesterday/This Week/Earlier), "Load More" pagination. |
| NarrativeItem | `src/pages/Activity.jsx` | 241–281 | Inline sub-component: icon + child name + action verb + points + category/note + timestamp. |
| CalendarHeatmap | `src/pages/Activity.jsx` | 283–370 | Inline sub-component: monthly grid with color intensity per day, month navigation arrows. |

**Phase 4 changes:** CalendarHeatmap → **DELETE entirely**. Add weekly summary as primary view. Raw feed collapsed by default.

---

## Calendar Component

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| CalendarHeatmap | `src/pages/Activity.jsx` | 283–370 | **DELETE in Phase 3** — inline in Activity.jsx, not a separate file. grep for `CalendarHeatmap` and `calendarMonth` to confirm no other references. |

---

## Badge Grid

| Component | File | Lines | What It Renders |
|-----------|------|-------|-----------------|
| BadgeDisplay | `src/components/BadgeDisplay.jsx` | 1–59 | Grid of earned badges (emoji + tooltip), 3 locked badge previews with lock icon. Empty state: "No badges earned yet. Keep going!" |
| Badge definitions | `src/data/badge-definitions.js` | 1–35 | 10 badges: 6 point-threshold, 1 weekly-target, 3 redemption-count. |

**Props:** `earnedBadgeIds`

**Phase 2:** REMOVE from ChildView. Badge system not in core loop scope.

---

## Stats Tiles (MotivationCard)

| Component | File | Lines | What It Renders |
|-----------|------|-------|-----------------|
| MotivationCard | `src/components/child/MotivationCard.jsx` | 1–61 | 3-column grid: Rewards Earned (trophy), Best Streak (flame), Next Unlock ETA or **"All unlocked"** (target icon). |

**Props:** `metrics` (from `GET /api/children/:id/motivation`)

**Phase 2:** **REMOVE entirely** from ChildView. Contains "All unlocked" string that must be purged.

---

## Share Button

| Component | File | Lines | What It Renders |
|-----------|------|-------|-----------------|
| ShareableCard | `src/components/ShareableCard.jsx` | 1–122 | "Share" outline button. Hidden off-screen card captured via html2canvas. Uses native Web Share API with download fallback. |

**Props:** `child`, `message`

**Phase 2:** **REMOVE entirely** from ChildView.

---

## Supporting Components (Referenced But Not Changing)

| Component | File | Lines | Notes |
|-----------|------|-------|-------|
| SectionHeader | `src/components/SectionHeader.jsx` | 1–10 | Utility — keep |
| LoadingSpinner | `src/components/LoadingSpinner.jsx` | 1–10 | Utility — keep |
| ErrorCard | `src/components/ErrorCard.jsx` | 1–22 | Utility — keep |
| PointEventItem | `src/components/history/PointEventItem.jsx` | 1–46 | Activity item — keep for Phase 4 |
| RedemptionCard | `src/components/redemptions/RedemptionCard.jsx` | 1–82 | Shows approve/deny — may adapt for stack confirmation |

---

## Modal Components (Referenced in Phases)

| Component | File | Lines | Notes |
|-----------|------|-------|-------|
| AddChildModal | `src/components/child/AddChildModal.jsx` | 1–223 | Phase 3: move trigger to Settings |
| EditChildModal | `src/components/child/EditChildModal.jsx` | 1–256 | No change |
| AddPointsModal | `src/components/child/AddPointsModal.jsx` | 1–198 | No change |
| AdjustPointsModal | `src/components/child/AdjustPointsModal.jsx` | 1–125 | No change |
| AddRewardModal | `src/components/rewards/AddRewardModal.jsx` | 1–232 | No change |
| EditRewardModal | `src/components/rewards/EditRewardModal.jsx` | 1–228 | No change |

---

## Components to Create (New)

| Component | Phase | Purpose |
|-----------|-------|---------|
| `src/components/weekend/WeekendStack.jsx` | 1.2 | Stack display for child view |
| `src/components/weekend/WeekendStackSummary.jsx` | 1.3 | Compact stack display for parent home child card |

---

## Legacy Strings to Purge (grep targets)

| String | File(s) | Phase |
|--------|---------|-------|
| `"All rewards unlocked"` | `ChildCard.jsx`, `MotivationCard.jsx` | 1.4 / 2 |
| `"Reward unlocked"` | `RewardCard.jsx` | 1.4 |
| `"Redeem"` | `RewardCard.jsx`, `ChildView.jsx` | 1.4 |
| `CalendarHeatmap` | `Activity.jsx` | 3 |
| `calendarMonth` | `Activity.jsx` | 3 |
