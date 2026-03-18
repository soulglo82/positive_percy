# Positive Percy — Monetization-Ready Redesign Spec

> **Purpose:** Convert the working app into a sellable product.
> **Audience:** Claude Code (implementation agent).
> **Branch:** Create new feature branch per phase.
> **Rule:** Every recommendation below references actual code. No guessing.

---

## Current State Summary

| Layer | Status | Key Files |
|-------|--------|-----------|
| Auth | Family-code only, no roles | `src/lib/AuthContext.jsx` |
| Data | 10 PostgreSQL tables, generic CRUD | `server/db.js`, `server/routes.js` |
| Frontend | React 18 + Vite + TailwindCSS + Shadcn/ui | `src/App.jsx` |
| State | TanStack React Query (server state) | `src/lib/queryClient.js` |
| Payments | **None** | — |
| Limits | **None** | — |
| Roles | `isParentView` prop only (UI flag, not auth) | `src/components/rewards/RewardCard.jsx:9` |

---

## Phase 1 — Entitlement Schema + Feature Gating (Backend)

### 1.1 Add `plans` and `entitlements` tables

**File:** `server/db.js` — add after `behavior_categories` table (line 122)

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT NOT NULL REFERENCES families(family_code),
  plan TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'family' | 'family_plus'
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'past_due' | 'cancelled'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (family_code)
);
```

### 1.2 Add plan limits constant

**New file:** `server/plan-limits.js`

```js
export const PLAN_LIMITS = {
  free:        { children: 1, rewards: 3,  history_days: 30, categories: 6,  has_analytics: false, has_badges: false, has_goals: false },
  family:      { children: 10, rewards: 50, history_days: 365, categories: 20, has_analytics: true,  has_badges: true,  has_goals: true },
  family_plus: { children: 10, rewards: 50, history_days: null, categories: 50, has_analytics: true,  has_badges: true,  has_goals: true },
};
```

### 1.3 Add entitlement middleware

**File:** `server/routes.js` — add after `authMiddleware` (line 29)

New middleware: `planMiddleware` that attaches `req.plan` and `req.limits` to every authenticated request by querying the `subscriptions` table.

### 1.4 Enforce limits on existing endpoints

| Endpoint | Limit | File:Line |
|----------|-------|-----------|
| `POST /api/children` | `PLAN_LIMITS[plan].children` | `server/routes.js:838` (generic CREATE) |
| `POST /api/rewards` | `PLAN_LIMITS[plan].rewards` | `server/routes.js:838` (generic CREATE) |
| `POST /api/behavior-categories` | `PLAN_LIMITS[plan].categories` | `server/routes.js:617` |
| `GET /api/activity-feed` | Truncate to `history_days` | `server/routes.js:689` |
| `GET /api/summary` | Gate behind `has_analytics` | `server/routes.js:487` |
| `POST /api/children/:id/check-badges` | Gate behind `has_badges` | `server/routes.js:542` |
| `POST /api/family-goals/:id/contribute` | Gate behind `has_goals` | `server/routes.js:742` |

**Return format on limit hit:** `{ error: "...", upgrade_required: true, current_plan: "free", limit: "children", max: 1 }`

### 1.5 Expose plan to frontend

**New endpoint:** `GET /api/subscription` — returns current plan, limits, and usage counts.

**File:** `src/lib/AuthContext.jsx` — extend the `useAuth` hook to include `plan`, `limits`, and `usage` from a new `useQuery(['subscription'])`.

---

## Phase 2 — Stripe Integration

### 2.1 Dependencies

```bash
npm install stripe
```

### 2.2 Stripe webhook handler

**New file:** `server/stripe.js`

Handles events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

Updates `subscriptions` table accordingly.

### 2.3 Checkout endpoints

**File:** `server/routes.js` — add before generic entity routes

| Endpoint | Purpose |
|----------|---------|
| `POST /api/subscription/checkout` | Create Stripe Checkout Session |
| `POST /api/subscription/portal` | Create Stripe Customer Portal session |
| `POST /api/subscription/webhook` | Stripe webhook handler (raw body) |
| `GET /api/subscription` | Current plan + usage |

### 2.4 Products to create in Stripe Dashboard

| Product | Price ID pattern | Amount |
|---------|-----------------|--------|
| Percy Family Monthly | `price_family_monthly` | $4.99/mo |
| Percy Family Annual | `price_family_annual` | $39.99/yr |
| Percy Family+ Monthly | `price_family_plus_monthly` | $6.99/mo |
| Percy Family+ Annual | `price_family_plus_annual` | $49.99/yr |

### 2.5 Environment variables

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_FAMILY_MONTHLY=price_...
STRIPE_PRICE_FAMILY_ANNUAL=price_...
STRIPE_PRICE_FAMILY_PLUS_MONTHLY=price_...
STRIPE_PRICE_FAMILY_PLUS_ANNUAL=price_...
```

---

## Phase 3 — Frontend Gating + Upgrade UX

### 3.1 Plan context

**New file:** `src/lib/PlanContext.jsx`

Provides `usePlan()` hook returning `{ plan, limits, usage, canUse(feature), isAtLimit(resource), checkoutUrl(plan) }`.

### 3.2 Upgrade prompts (contextual, not aggressive)

Add inline upgrade triggers at these exact points:

| Trigger | File:Line | UX |
|---------|-----------|-----|
| Adding 2nd child | `src/pages/ParentDashboard.jsx:112` (createChildMutation) | Show `<UpgradeBanner>` before modal opens |
| Adding 4th reward | `src/pages/Rewards.jsx:36` (createRewardMutation) | Show `<UpgradeBanner>` before modal opens |
| Viewing summary | `src/pages/History.jsx` (entire page) | Blurred preview + overlay |
| Viewing badges | `src/components/BadgeDisplay.jsx:1` | Show locked state with "Upgrade" badge |
| Creating family goal | `src/components/FamilyGoals.jsx:86` | Show `<UpgradeBanner>` |
| Adding 7th category | `src/components/settings/BehaviorCategoryManager.jsx:49` | Toast with upgrade link |

### 3.3 New components

| Component | Purpose |
|-----------|---------|
| `src/components/billing/UpgradeBanner.jsx` | Inline banner: "{feature} is a Family plan feature. Upgrade to unlock." with CTA button |
| `src/components/billing/PricingCard.jsx` | Plan comparison card (free vs family vs family+) |
| `src/components/billing/PlanBadge.jsx` | Small badge showing current plan in header/settings |
| `src/pages/Pricing.jsx` | Full pricing page with plan comparison table |

### 3.4 Settings integration

**File:** `src/pages/ParentProfile.jsx` — add after Invite Parent section (~line 267)

New section: "Your Plan" showing current plan, usage bars (children: 1/1, rewards: 2/3), and "Manage Subscription" button linking to Stripe Customer Portal.

---

## Phase 4 — UI Redesign for Perceived Value

These changes make the free tier feel complete while making paid features feel desirable.

### 4.1 Onboarding overhaul

**File:** `src/components/OnboardingTips.jsx` (lines 1-118)

Current: 4 generic parenting tips.
Replace with: 3-step setup wizard.

| Step | Content |
|------|---------|
| 1 | "Add your first child" (name + avatar) |
| 2 | "Pick your first reward" (select from `src/data/reward-templates.js`) |
| 3 | "Award your first points" (guided quick action) |

Completion triggers confetti (library already installed: `canvas-confetti`).

### 4.2 Child view engagement loop

**File:** `src/pages/ChildView.jsx`

| Change | Line | Detail |
|--------|------|--------|
| Add "You can afford X rewards" count | After line 234 (MotivationCard) | Count rewards where `cost_points <= total_points` |
| Sort rewards by affordability | Line 280 (already done) | Verify sort puts affordable first ✓ |
| Add "Next up" highlight | Line 280 | First unaffordable reward gets a "Almost there!" badge |

### 4.3 Badge system overhaul

**File:** `src/data/badge-definitions.js` (lines 1-35)

Current: 10 badges, all point-threshold based.
Add 5 engagement badges (requires `has_badges` entitlement):

| Badge | Trigger | Tier |
|-------|---------|------|
| `category_explorer` | Points in 4+ different categories | Family |
| `weekly_warrior` | Hit weekly target 4 weeks running | Family |
| `goal_contributor` | Contribute to a family goal | Family+ |
| `custom_creator` | Create a custom category | Family |
| `streak_master` | 30-day parent streak | Family+ |

**File:** `server/routes.js:562` — extend badge evaluation to check these.

### 4.4 Weekly summary (paid feature)

**New file:** `src/components/insights/WeeklySummary.jsx`

Shows: top categories, per-child point breakdown, week-over-week trend.
Data source: existing `GET /api/summary` endpoint (`server/routes.js:487`).
Gate: `has_analytics` entitlement. Free users see blurred preview.

### 4.5 Celebration moments

**File:** `src/pages/ChildView.jsx:114` (confirmRedemption)

Current: `confetti()` call exists but only on redemption.
Add celebrations for:
- First points ever (check `total_points` was 0 before)
- Badge unlock (already exists at line 77)
- Weekly target hit (already exists in `ParentDashboard.jsx:224`)

### 4.6 Percy character voice

**File:** `src/constants/terminology.js` — extend with microcopy:

```js
export const PERCY_SAYS = {
  FIRST_CHILD: "Let's get started! Add your first child.",
  FIRST_REWARD: "Now give them something to work toward!",
  FIRST_POINTS: "You just awarded your first Percy Points!",
  ALMOST_THERE: "Almost there! Keep it up!",
  ALL_UNLOCKED: "Amazing! All rewards unlocked!",
  EMPTY_ACTIVITY: "No activity yet. Award some points to get started!",
  UPGRADE_TEASE: "Want more? Unlock unlimited with Percy Family.",
};
```

Use these in empty states across:
- `src/pages/ParentDashboard.jsx:319` (no children)
- `src/pages/Rewards.jsx:121` (no rewards)
- `src/pages/Activity.jsx` (no activity)
- `src/components/BadgeDisplay.jsx:14` (no badges)

---

## Phase 5 — Compliance (Required Before Charging)

### 5.1 COPPA parental consent gate

**New file:** `src/components/legal/ConsentGate.jsx`

Before any child data is created, require parent to acknowledge:
- Child's data will be stored
- No direct communication with children
- Data can be deleted on request

Store consent in `families` table: `ADD COLUMN coppa_consent_date TIMESTAMPTZ`.

### 5.2 Data export/delete

**New endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/family/export` | Export all family data as JSON |
| `DELETE /api/family/delete-all` | Delete all family data (cascading) |

**UI:** Add to `src/pages/ParentProfile.jsx` at bottom of settings.

### 5.3 Privacy policy

**New file:** `public/privacy.html` — static page linked from footer and onboarding.

---

## Implementation Order

| # | Phase | Estimated Effort | Blocks |
|---|-------|-----------------|--------|
| 1 | Entitlement schema + limits | 1-2 days | Nothing |
| 2 | Stripe integration | 2-3 days | Phase 1 |
| 3 | Frontend gating + upgrade UX | 2-3 days | Phase 1 |
| 4 | UI redesign for perceived value | 2-3 days | Phase 3 (for gating) |
| 5 | Compliance (COPPA/GDPR) | 1-2 days | Phase 1 |

**Total: ~8-13 days of implementation.**

---

## Clarifying Questions (Blocking Decisions)

1. **Stripe vs RevenueCat?** — DEEP_DIVE recommends Stripe, REMEDIATION mentions RevenueCat. For web-only (current state), Stripe is simpler. RevenueCat only needed if shipping native iOS/Android via Capacitor. **Recommend: Stripe now, add RevenueCat if/when native app ships.**

2. **Free trial?** — Not mentioned in any doc. Options:
   - (a) No trial — free tier is the trial
   - (b) 7-day Family trial on signup
   - (c) 14-day trial when user hits first limit

3. **Existing user migration?** — All current users are on "free" (no subscription table exists). On migration:
   - (a) All existing users stay free, see upgrade prompts
   - (b) Existing users get 30-day grace period with full features
   - (c) Existing users grandfathered at current usage level

4. **Child separate login?** — Current system uses family code for everyone. The BACKLOG mentions "child device experience" but no auth separation. **For monetization, this is P2 — not blocking.**

5. **Annual pricing?** — Docs show two different prices:
   - BACKLOG: $29.99/yr Family, $49.99/yr Family+
   - DEEP_DIVE: $39.99/yr Family (single tier)
   - **Need final decision before Stripe product creation.**

---

## Files That Will Be Created

| File | Purpose |
|------|---------|
| `server/plan-limits.js` | Plan limit constants |
| `server/stripe.js` | Stripe webhook handler |
| `src/lib/PlanContext.jsx` | Plan state provider |
| `src/components/billing/UpgradeBanner.jsx` | Inline upgrade prompt |
| `src/components/billing/PricingCard.jsx` | Plan comparison card |
| `src/components/billing/PlanBadge.jsx` | Current plan indicator |
| `src/pages/Pricing.jsx` | Full pricing page |
| `src/components/insights/WeeklySummary.jsx` | Paid analytics view |
| `src/components/legal/ConsentGate.jsx` | COPPA consent gate |
| `public/privacy.html` | Privacy policy |

## Files That Will Be Modified

| File | Changes |
|------|---------|
| `server/db.js` | Add `subscriptions` table, `coppa_consent_date` column |
| `server/routes.js` | Add plan middleware, limit enforcement, Stripe endpoints, export/delete |
| `src/lib/AuthContext.jsx` | Expose plan/limits in auth context |
| `src/App.jsx` | Add PlanProvider, Pricing route |
| `src/pages/ParentDashboard.jsx` | Child limit check, upgrade banner |
| `src/pages/Rewards.jsx` | Reward limit check, upgrade banner |
| `src/pages/ParentProfile.jsx` | Plan management section, data export/delete |
| `src/pages/ChildView.jsx` | "You can afford X" count, celebration triggers |
| `src/components/OnboardingTips.jsx` | Replace with 3-step wizard |
| `src/components/BadgeDisplay.jsx` | Entitlement gating, 5 new badges |
| `src/components/FamilyGoals.jsx` | Entitlement gating |
| `src/components/settings/BehaviorCategoryManager.jsx` | Category limit check |
| `src/constants/terminology.js` | Add PERCY_SAYS microcopy |
| `src/data/badge-definitions.js` | Add 5 engagement badges |
| `package.json` | Add `stripe` dependency |
