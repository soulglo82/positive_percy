# Positive Percy: Deep Dive Product & UX Assessment Plan

## Document purpose

This assessment is based on direct inspection of the current React frontend and Express/Postgres backend. It consolidates all findings into a single prioritized plan with a unified phased roadmap, full Definition of Done (DoD), and comprehensive test plan.

---

## Executive summary

Positive Percy has a strong behavioral core and low-friction execution loop, but the current UX hierarchy reads like an internal utility instead of a packaged consumer product. The biggest gaps are:

1. **Product framing on first glance** — home starts at actions, not meaning.
2. **Inconsistent language system** — `pts`, `points`, `points available` used interchangeably.
3. **Ambiguous progress presentation** — reward state copy and percentages confuse users.
4. **High-value surfaces under-leveraged** — child page value narrative, activity readability.
5. **No commercialization rails** — no plans/tiers/limits in schema or UI.
6. **No privacy/compliance foundation** — children's behavioral data requires COPPA-aligned controls before monetization.
7. **No accessibility baseline** — a children's product needs explicit a11y standards.

The good news: most improvements are copy, hierarchy, and lightweight component changes — not a deep architecture rewrite.

---

## Findings

### 1. Home page feels unfinished

**Current state:** Main route lands on `ParentDashboard` and jumps straight into streak badge and "Add Points." No top-level value card exists.

**Problem:** Optimizes for returning users; new-user orientation is absent.

**Solution:**
- Add a fixed hero summary card above actions:
  - Product statement: "Build habits with Percy Points."
  - Child-level snapshot: points, next reward, streak.
  - Single CTA for first-time families.
- Hero card collapses to a compact bar after onboarding checklist is complete.

---

### 2. Floating streak badge lacks context

**Current state:** Streak is rendered as a centered standalone badge above all content.

**Problem:** Weak information hierarchy; reads disconnected from child progress.

**Solution:**
- Move streak into each child progress block (or into a "Family Momentum" card if streak is family-level).
- Keep standalone placement only if tied to a broader section (e.g., weekly family challenge).

---

### 3. "Points available" language is inconsistent

**Current state:** Child cards display `pts available`. Several places use compact `pts` shorthand.

**Problem:** Weakens brand identity and sounds transactional.

**Solution:**
- Standardize product lexicon globally:
  - Primary noun: **Percy Points**.
  - Secondary compact format: `Points` only where space-constrained (never `pts` or `PP`).
- Create a shared constants file (`src/constants/terminology.js`) as the single source of truth for all user-facing strings.
- Audit and replace every instance of `pts`, `points available`, and bare `points`.

---

### 4. "Ready to redeem … 100%" copy is confusing

**Current state:** Reward line combines "Ready to redeem" + emoji + title + percent. At 100%, semantics are muddy.

**Problem:** Mathematically valid but semantically unclear, especially for children.

**Solution:** Split into three explicit states:
1. **In progress:** `Weekly Treat — 33 / 50 Percy Points`
2. **Unlocked:** `Reward unlocked: Weekly Treat ✓`
3. **All unlocked:** `All current rewards unlocked!`

Avoid percentages as primary copy for children; use counts first, optional progress bar second.

---

### 5. Parent editability of awarding categories is partial

**Current state:** Parent can manage Quick Actions labels/points/icons in Settings, but the Add Points modal uses a hardcoded category list.

**Problem:** Two disconnected category systems create inconsistency.

**Solution:**
- Introduce a unified `behavior_categories` table (family-scoped) used by:
  - Add Points modal dropdown
  - Quick Actions presets
  - Activity filters and badge rules
- Migrate existing hardcoded list into seed data for the new table.
- Add CRUD UI in Family Settings under a "Behavior Categories" section.

---

### 6. Child page "Points Spent on Rewards" metric is low-value

**Current state:** Child hero includes total points and `Points Spent on Rewards`. Backend stores and backfills `points_spent`.

**Problem:** Technically valid but emotionally low-value for child motivation.

**Solution:**
- Demote `points_spent` to parent analytics view only.
- Replace visible child metric with one of:
  - **Rewards Earned** (lifetime count)
  - **Best Streak** (personal record)
  - **Next Unlock ETA** (projected based on recent earning rate)

---

### 7. Child page lacks value narrative beyond snapshot

**Current state:** Child page offers points hero, rewards list, badges (if earned), recent activity, share card.

**Problem:** Foundation is decent but does not tell a motivational story.

**Solution:**
- Add "Why this matters" modules:
  - Habit streak timeline (visual continuity)
  - Personal bests card
  - Weekly mission card (1 target behavior, parent-set)
- Keep surface simple — avoid full chore-manager complexity.

---

### 8. Activity page is functional but visually blunt

**Current state:** Functional feed with filters and pagination. Entries are compact and data-forward.

**Problem:** Utility is high; delight and readability are moderate.

**Solution:**
- Rephrase events as narrative lines:
  - `⭐ Joud earned +5 Percy Points`
  - Subline: category/note
- Increase spacing and typography contrast.
- De-emphasize low-value fields where no note exists.
- Add date group headers (Today, Yesterday, This Week).

---

### 9. Family settings quick-action helper text is vague

**Current state:** Copy reads: `Using defaults — add your own to customise.`

**Problem:** Serviceable but not actionable.

**Solution:** Replace with: `Default behaviours are active. Edit or add your own below.`

---

### 10. No product guide or onboarding flow

**Current state:** Onboarding tips modal exists (persisted in localStorage). Also available from Settings as "Parenting Tips."

**Problem:** Behaves as tips, not a product guide. Does not drive activation.

**Solution:**
- Build a "Quick Start (60 seconds)" checklist flow:
  1. Add child
  2. Add 3 rewards
  3. Give first Percy Points
  4. Explain weekly rhythm
- Display contextual checklist on dashboard until all steps completed.
- Persist completion state in user profile (not just localStorage) so it works across devices.

---

### 11. Stickiness mechanics are under-leveraged

**Current capability:** Streaks, badges, rewards, confetti already exist.

**Solution — high-impact additions (minimal complexity):**
1. **Weekly family challenge** — single objective, family-wide.
2. **Unlock moments** — full-screen celebration once per reward unlock.
3. **Progress visibility** — reward progress as counts first, bar second.
4. **Parent consistency nudges** — gentle reminder if no events logged by evening.

Principle: one reinforcement mechanic per layer (daily, weekly, milestone) — not dozens.

---

### 12. Competitor features to borrow selectively

Keep only what supports Positive Percy's simplicity advantage:

- **Adopt:**
  - Smart defaults templates by child age
  - Streak/milestone celebrations
  - Family summary digest (weekly email)
- **Skip for now:**
  - Complex chore scheduling engines
  - Multi-role task workflows
  - In-app marketplace ecosystems

---

### 13. Monetization and pricing model

**Current state:** No plan/tier/subscription schema or entitlement checks exist.

**Competitive context:**

| Product | Free tier | Paid tier | Price |
|---|---|---|---|
| GoHenry | None (trial only) | Full access | £3.99/child/mo |
| Greenlight | None (trial only) | Full access | $4.99/mo |
| ChoreMonster | Full (ad-supported) | Ad-free + extras | $4.99/mo |
| S'moresUp | Limited features | Premium | $2.99/mo |

**Recommended model:**
- **Free:** 1 child, up to 3 active rewards, core point tracking, 30-day activity history.
- **Family ($4.99/mo):** Multiple children, unlimited rewards, unlimited history, custom categories, badges, insights, nudges.
- **Annual ($39.99/yr):** ~33% discount on Family plan.

**Why this fits:** Preserves "simple and useful" at free tier. Paid tier unlocks depth for committed families, not basic use. No points cap — capping core utility kills adoption.

---

### 14. Brand voice: use "Percy Points" everywhere

**Solution — naming standard:**

| Concept | Standard term |
|---|---|
| Points | Percy Points |
| Rewards | Percy Rewards |
| Streak | Percy Streak |
| Badges | Percy Badges |

A product with consistent character feels like a product, not a spreadsheet. This is one of the fastest polish upgrades available.

---

### 15. Share-to-child view needs a dedicated safe mode

**Current state:** Child page exposes broad content (avatar hero, rewards grid, activity feed, badges, share card trigger). Share action is generic — no locked "child-safe snapshot format."

**Solution — Child Snapshot Mode:**

This replaces the existing generic share flow (not a parallel mode). Only surfaces:
1. Percy Points earned (current total)
2. Current streak
3. Best streak
4. Available rewards + distance-to-unlock
5. Short motivational text
6. Celebration iconography for achievements

**Implementation:**
- New `ChildSnapshotView` component, rendered when `?mode=snapshot` query param is present.
- Existing share card triggers this mode instead of the full child page.
- Snapshot is read-only, no interactive controls exposed.

---

### 16. Device widget option for quick add and quick view

**Solution — phased widget strategy:**

- **Phase A (Web fallback):** PWA manifest with Add-to-Home-Screen prompt. Pinned "Quick Add Percy Points" shortcut card on dashboard.
- **Phase B (Native wrapper):** Home screen widgets for parent quick actions and child progress glance.

**Widget surface design (minimal):**
- Parent widget: top 4 quick actions + recent streak.
- Child widget: total Percy Points, next reward distance, current streak.

---

### 17. Nudges (child and parent)

**Current state:** No reminder engine exists; nudges are manual/in-app only.

**Solution — Duolingo-style but gentle:**

- **Parent nudges:**
  - "No points logged today yet — 30 seconds to keep Percy Streak alive."
  - Delivery: push notification (if PWA/native) or email digest.
  - Limit: max 1 push per day per parent.
- **Child nudges:**
  - "You're 4 Percy Points from Weekly Treat — you can do it!"
  - Delivery: shown in-app on child page, never push-to-device without parent opt-in.
  - Limit: max 1 per day per child.

**Guardrails:**
- Quiet hours configurable per family (default 8pm–8am).
- Opt-out per nudge type in Family Settings.
- Positive framing only — no shame language, no negative reinforcement.
- All child-facing nudge copy reviewed by parent before first delivery.

---

### 18. Historical calendar view

**Current state:** Timeline/feed exists; calendar heatmap view does not.

**Solution:**
- Add a weekly/monthly Percy Points calendar:
  - **Parent view:** all children filterable, total per day, color-coded intensity.
  - **Child view:** personal trend, streak continuity markers.
- Converts abstract "consistency" into visible pattern memory.
- Strong stickiness driver without adding workflow complexity.

---

### 19. AI insights in calendar view

**Solution — parent-mediated model:**

- AI insight is generated for the parent first (never directly to the child).
- Parent can choose to share a child-safe encouragement message.

**Do:**
- Use supportive prompts: "Looks like this week was lighter than usual. Want to set one small goal for tomorrow?"
- Offer parent-side reflective prompts before any child-facing messages.

**Do NOT:**
- Ask emotionally loaded questions directly to children ("Is everything ok? What happened?") without parental mediation.
- Generate unsolicited behavioral analysis visible to the child.

**Privacy:** AI insights are processed server-side. No child behavioral data is sent to third-party AI APIs without explicit parent consent (see Finding 22).

---

### 20. Accessibility baseline

**Current state:** No explicit accessibility standards documented or enforced.

**Problem:** A product used by children and families must meet baseline a11y requirements — both for legal compliance and inclusive design.

**Solution:**
- Target **WCAG 2.1 AA** compliance across all user-facing surfaces.
- Key requirements:
  - **Color contrast:** minimum 4.5:1 for normal text, 3:1 for large text. Validate all Percy brand colors.
  - **Font sizes:** minimum 16px base for body text; child-facing surfaces minimum 18px.
  - **Touch targets:** minimum 44×44px for all interactive elements.
  - **Screen reader support:** semantic HTML, ARIA labels on icons/badges/progress bars, live regions for point awards and celebrations.
  - **Keyboard navigation:** full tab-order support on all interactive flows.
  - **Motion sensitivity:** respect `prefers-reduced-motion` for confetti, celebrations, and transitions.
- Add axe-core to CI pipeline for automated a11y regression checks.

---

### 21. Privacy, data protection, and COPPA compliance

**Current state:** No privacy controls, data retention policies, or age-gating exist in the codebase.

**Problem:** A product collecting children's behavioral data must address COPPA (US), GDPR-K (EU), and equivalent regulations before monetization or broader launch.

**Solution:**
- **Parental consent gate:** Require verified parent account before any child profile is created. No child can self-register.
- **Data minimization:** Only collect data necessary for core features. No third-party analytics SDKs that track children.
- **Retention policy:** Define and enforce data retention windows (e.g., free tier: 30 days activity history; paid: unlimited but exportable).
- **Data export/delete:** Parent can export all family data (JSON/CSV) and request full deletion from Family Settings.
- **Privacy policy:** Draft child-specific privacy policy before any paid tier launch.
- **Third-party AI:** If AI insights (Finding 19) use external APIs, require explicit parent opt-in per child with clear disclosure of what data is shared.

**Note:** Full legal review is required before launch. This plan covers technical implementation — not legal sufficiency.

---

### 22. Success metrics and KPIs

**Current state:** No measurement framework for any feature.

**Problem:** Without defined metrics, there is no way to evaluate whether changes are working.

**Solution — key metrics by area:**

| Area | Metric | Target | Measurement |
|---|---|---|---|
| Activation | Onboarding checklist completion rate | >60% of new signups within 7 days | Backend event tracking |
| Engagement | Points logged per active family per week | ≥5 events/week | Database query |
| Retention | 7-day retention (return visit) | >50% | Session tracking |
| Retention | 30-day retention | >30% | Session tracking |
| Streaks | Families maintaining 7+ day streak | >25% of active families | Database query |
| Monetization | Free-to-paid conversion rate | >5% of 30-day active families | Billing events |
| Satisfaction | Parent NPS | >40 | In-app survey (quarterly) |
| Accessibility | axe-core violations in CI | 0 critical/serious | CI pipeline |

Instrument lightweight event tracking (privacy-respecting, no child PII in analytics) from Phase 1.

---

### 23. Technical debt inventory

**Current state:** Several items will block or complicate phased delivery if not addressed.

**Items to resolve:**

| Debt item | Impact | Resolution phase |
|---|---|---|
| Hardcoded category list in Add Points modal | Blocks unified categories (Finding 5) | Phase 2 |
| Onboarding state in localStorage only | Lost on device switch; blocks cross-device onboarding | Phase 1 |
| No shared terminology constants file | Every string change requires multi-file grep | Phase 1 |
| No entitlement/plan schema in database | Blocks all monetization work | Phase 4 |
| No automated a11y checks in CI | Regressions go undetected | Phase 1 |
| Share card triggers generic child page | Blocks Child Snapshot Mode (Finding 15) | Phase 2 |

---

## Unified phased roadmap

### Phase 1 — Product polish, accessibility, and measurement foundation

**Scope:**
- Add dashboard hero framing card with product statement and child snapshot.
- Reposition streak into child/family context card.
- Create `src/constants/terminology.js` — replace all `pts`/`points available` strings with Percy terminology.
- Rewrite reward progress state copy (three explicit states).
- Update family settings helper text.
- Migrate onboarding state from localStorage to user profile.
- Add axe-core to CI pipeline.
- WCAG 2.1 AA audit and remediation of existing surfaces.
- Instrument baseline event tracking for success metrics.

**Duration estimate:** 1 sprint (2 weeks)

---

### Phase 2 — Child experience and motivational layer

**Scope:**
- Replace/de-emphasize `points_spent` metric on child surface with motivational metrics.
- Build Child Snapshot Mode (`ChildSnapshotView` component) — replace generic share flow.
- Add motivational module: best streak, distance-to-next-reward, personal bests card.
- Introduce unified `behavior_categories` table; migrate hardcoded category list; add CRUD UI.
- Improve activity feed: narrative phrasing, date group headers, spacing, typography.
- Build Quick Start checklist onboarding flow (4 steps, persistent in user profile).

**Duration estimate:** 1 sprint (2 weeks)

---

### Phase 3 — Retention and engagement systems

**Scope:**
- Parent and child nudge engine with guardrails (quiet hours, opt-out, positive framing only, per-role limits).
- Calendar trend/history view (parent: multi-child filterable; child: personal trend).
- Weekly family challenge feature (single objective, family-wide).
- Unlock celebration moments (full-screen, respects `prefers-reduced-motion`).
- Weekly parent digest (email or in-app summary).

**Duration estimate:** 1 sprint (2 weeks)

---

### Phase 4 — Platform expansion

**Scope:**
- PWA manifest and Add-to-Home-Screen prompt with quick-action shortcut card.
- AI insights for calendar view (parent-mediated model, explicit consent gate).
- Smart defaults templates by child age for quick actions and rewards.
- "Repeat yesterday" one-tap action for routine behaviors.

**Duration estimate:** 1 sprint (2 weeks)

---

### Phase 5 — Monetization and compliance

**Scope:**
- Design and implement `plans` and `entitlements` schema in database.
- Enforce free tier limits: 1 child, 3 active rewards, 30-day activity history.
- Build upgrade prompts at natural limit edges (not interstitials).
- Implement billing integration (Stripe recommended).
- COPPA/GDPR-K technical controls: parental consent gate, data export/delete, retention enforcement.
- Draft and publish child-specific privacy policy.
- In-app upgrade flow: Family plan ($4.99/mo) and Annual ($39.99/yr).

**Duration estimate:** 2 sprints (4 weeks)

---

## Priority stack (top 7)

1. Home framing card + Percy naming consistency + terminology constants
2. Reward progress state copy cleanup
3. Accessibility baseline (WCAG 2.1 AA) + axe-core in CI
4. Child Snapshot Mode (share-safe layout, replaces generic share)
5. Replace child `points_spent` with motivation metrics
6. Activity feed + calendar readability improvements
7. Parent/child nudges with guardrails + privacy controls

---

## Definition of Done (DoD)

Every item in the roadmap must meet ALL of the following criteria before it is considered complete:

### Code quality
- [ ] Code is written, reviewed, and merged to the target branch.
- [ ] No new linting errors or warnings introduced.
- [ ] No `console.log` or debug statements left in production code.
- [ ] Shared terminology uses constants from `src/constants/terminology.js` — no hardcoded user-facing strings for Percy concepts.
- [ ] New components follow existing project structure and naming conventions.

### Functionality
- [ ] Feature works as described in the finding's Solution section.
- [ ] All happy-path user flows verified manually.
- [ ] Edge cases identified and handled (empty states, max values, missing data).
- [ ] No regressions in existing features — verified by regression test suite.

### Accessibility
- [ ] Meets WCAG 2.1 AA standards.
- [ ] axe-core CI check passes with 0 critical/serious violations.
- [ ] Keyboard navigation works for all new interactive elements.
- [ ] Screen reader tested on at least one reader (VoiceOver or NVDA).
- [ ] Touch targets meet 44×44px minimum.
- [ ] `prefers-reduced-motion` respected for any animations.

### Privacy and compliance
- [ ] No child PII exposed in analytics, logs, or error tracking.
- [ ] Any new data collection reviewed against COPPA requirements.
- [ ] Parent consent required before any new child-facing data flow.
- [ ] Data retention policies respected in any new queries/views.

### Testing
- [ ] Unit tests written and passing (see Test Plan).
- [ ] Integration tests written and passing (see Test Plan).
- [ ] E2E tests written and passing for critical user flows (see Test Plan).
- [ ] Test coverage for new code meets or exceeds project baseline.

### Performance
- [ ] No measurable performance regression (page load, API response times).
- [ ] New API endpoints respond within 200ms at expected load.
- [ ] No N+1 query patterns introduced.

### Documentation
- [ ] User-facing copy reviewed for Percy terminology consistency.
- [ ] Any new API endpoints documented in API docs.
- [ ] Database migrations include rollback scripts.
- [ ] This assessment plan updated if scope changes during implementation.

### Deployment
- [ ] Feature flag (where applicable) allows gradual rollout.
- [ ] Deployment verified in staging environment before production.
- [ ] Rollback plan documented for any destructive schema changes.

---

## Test plan

### Testing strategy overview

All testing follows a pyramid approach: high volume of unit tests, moderate integration tests, focused E2E tests for critical flows. Every phase includes its own test requirements that must pass before the phase is considered complete.

---

### Phase 1 tests — Product polish, accessibility, and measurement

#### Unit tests

| Test ID | Component / Module | Test description | Expected result |
|---|---|---|---|
| P1-U01 | `terminology.js` | All exported constants are non-empty strings | Pass |
| P1-U02 | `terminology.js` | No constant contains `pts` or `points available` | Pass |
| P1-U03 | `HeroCard` | Renders product statement, child snapshot, and CTA | Correct DOM output |
| P1-U04 | `HeroCard` | Collapses to compact bar when onboarding complete | Compact variant rendered |
| P1-U05 | `StreakBadge` | Renders inside child progress block, not standalone | Correct parent container |
| P1-U06 | `RewardProgress` | Displays "In progress" state with counts | `33 / 50 Percy Points` |
| P1-U07 | `RewardProgress` | Displays "Unlocked" state | `Reward unlocked: Weekly Treat ✓` |
| P1-U08 | `RewardProgress` | Displays "All unlocked" state | `All current rewards unlocked!` |
| P1-U09 | `RewardProgress` | Handles zero points edge case | `0 / 50 Percy Points` |
| P1-U10 | `RewardProgress` | Handles reward with zero cost | Immediately shows unlocked |
| P1-U11 | `QuickActionHelper` | Renders updated helper text | Exact string match |

#### Integration tests

| Test ID | Scope | Test description | Expected result |
|---|---|---|---|
| P1-I01 | Dashboard render | Dashboard loads with hero card, streak in context, and reward progress | All components present and correctly ordered |
| P1-I02 | Onboarding state | Onboarding state persists to user profile API, not just localStorage | State survives localStorage clear |
| P1-I03 | Terminology audit | Grep all rendered output for legacy terms (`pts`, `points available`) | Zero matches |

#### Accessibility tests

| Test ID | Scope | Test description | Expected result |
|---|---|---|---|
| P1-A01 | Full app | axe-core automated scan | 0 critical/serious violations |
| P1-A02 | HeroCard | Color contrast ratio check | ≥4.5:1 for all text |
| P1-A03 | RewardProgress | Progress bar has ARIA labels | `aria-valuenow`, `aria-valuemin`, `aria-valuemax` present |
| P1-A04 | All interactive elements | Tab order test | Logical sequential order, no traps |
| P1-A05 | Dashboard | Screen reader announcement on point award | Live region announces point change |

#### Event tracking tests

| Test ID | Scope | Test description | Expected result |
|---|---|---|---|
| P1-E01 | Analytics module | Events fire for key actions (page view, point award, reward unlock) | Events captured with correct payload |
| P1-E02 | Analytics module | No child PII included in any event payload | All payloads pass PII filter |

---

### Phase 2 tests — Child experience and motivational layer

#### Unit tests

| Test ID | Component / Module | Test description | Expected result |
|---|---|---|---|
| P2-U01 | `ChildSnapshotView` | Renders only allowed fields (points, streaks, rewards, motivation text) | No unauthorized data exposed |
| P2-U02 | `ChildSnapshotView` | Does not render interactive controls | No buttons, links, or forms |
| P2-U03 | `ChildSnapshotView` | Activated by `?mode=snapshot` query param | Correct component mounted |
| P2-U04 | `MotivationCard` | Shows "Rewards Earned" count correctly | Matches backend value |
| P2-U05 | `MotivationCard` | Shows "Best Streak" correctly | Matches backend value |
| P2-U06 | `MotivationCard` | Shows "Next Unlock ETA" with zero earning rate | Graceful fallback message |
| P2-U07 | `ActivityFeedItem` | Renders narrative format with emoji | `⭐ Joud earned +5 Percy Points` |
| P2-U08 | `ActivityFeedItem` | Hides subline when no note exists | Subline element absent |
| P2-U09 | `ActivityFeed` | Groups entries by date headers | Today/Yesterday/This Week headers present |
| P2-U10 | `OnboardingChecklist` | Shows 4 steps with correct completion state | Steps reflect profile data |
| P2-U11 | `OnboardingChecklist` | Hides when all steps complete | Component not rendered |
| P2-U12 | `BehaviorCategoryForm` | CRUD operations render correctly | Create, edit, delete UI states work |

#### Integration tests

| Test ID | Scope | Test description | Expected result |
|---|---|---|---|
| P2-I01 | `behavior_categories` API | Create, read, update, delete categories | All CRUD operations succeed with correct responses |
| P2-I02 | `behavior_categories` API | Categories scoped to family | Family A cannot see Family B's categories |
| P2-I03 | Add Points modal | Modal dropdown uses categories from API, not hardcoded list | Dynamic list matches database |
| P2-I04 | Child Snapshot Mode | Share card triggers snapshot mode URL | Navigation to `?mode=snapshot` |
| P2-I05 | Child page | `points_spent` not visible on child-facing view | Element absent from DOM |
| P2-I06 | Child page | `points_spent` visible on parent analytics view | Element present in analytics |
| P2-I07 | Onboarding checklist | Completing all steps persists to API and hides checklist on reload | State persists across sessions |

#### Database tests

| Test ID | Scope | Test description | Expected result |
|---|---|---|---|
| P2-D01 | `behavior_categories` migration | Table creates with correct schema | All columns and constraints present |
| P2-D02 | `behavior_categories` migration | Rollback drops table cleanly | No orphaned references |
| P2-D03 | `behavior_categories` seed | Default categories seeded for existing families | All families have defaults |

---

### Phase 3 tests — Retention and engagement systems

#### Unit tests

| Test ID | Component / Module | Test description | Expected result |
|---|---|---|---|
| P3-U01 | `NudgeEngine` | Parent nudge fires if no events logged today | Nudge generated |
| P3-U02 | `NudgeEngine` | Parent nudge does NOT fire if events exist today | No nudge |
| P3-U03 | `NudgeEngine` | Child nudge includes correct reward distance | `4 Percy Points from Weekly Treat` |
| P3-U04 | `NudgeEngine` | Quiet hours respected (no nudge during configured window) | Nudge suppressed |
| P3-U05 | `NudgeEngine` | Max 1 nudge per day per role enforced | Second nudge blocked |
| P3-U06 | `NudgeEngine` | Opted-out nudge types not sent | Nudge suppressed |
| P3-U07 | `NudgeEngine` | All nudge copy uses positive framing (no shame words) | Copy validation passes |
| P3-U08 | `CalendarView` | Parent view shows all children with correct daily totals | Data matches database |
| P3-U09 | `CalendarView` | Child view shows only personal data | No sibling data visible |
| P3-U10 | `CalendarView` | Empty days render correctly | No crash, shows zero state |
| P3-U11 | `WeeklyChallenge` | Renders active challenge with progress | Correct progress display |
| P3-U12 | `UnlockCelebration` | Full-screen celebration renders on reward unlock | Celebration displayed |
| P3-U13 | `UnlockCelebration` | Respects `prefers-reduced-motion` | No animation when preference set |

#### Integration tests

| Test ID | Scope | Test description | Expected result |
|---|---|---|---|
| P3-I01 | Nudge delivery | End-to-end nudge: trigger condition → generation → delivery | Nudge reaches target |
| P3-I02 | Nudge settings | Parent toggles nudge type off → nudge no longer fires | Setting persists and is enforced |
| P3-I03 | Calendar API | Returns correct daily aggregations for date range | Data matches raw events |
| P3-I04 | Calendar API | Respects family scoping | Cross-family data not returned |
| P3-I05 | Weekly digest | Generates correct summary content | All metrics accurate |
| P3-I06 | Weekly challenge | Challenge lifecycle: create → progress → complete | All states transition correctly |

---

### Phase 4 tests — Platform expansion

#### Unit tests

| Test ID | Component / Module | Test description | Expected result |
|---|---|---|---|
| P4-U01 | PWA manifest | Manifest includes correct app name, icons, start_url | Valid manifest |
| P4-U02 | Quick-action shortcut | Renders top 4 actions on dashboard | Correct actions displayed |
| P4-U03 | `AIInsight` | Generates parent-facing insight from calendar data | Insight text returned |
| P4-U04 | `AIInsight` | Does NOT generate child-facing content without parent approval | No child content |
| P4-U05 | `AIInsight` | Consent gate blocks API call when consent not granted | No external API call made |
| P4-U06 | `SmartDefaults` | Returns age-appropriate categories for given age | Correct category set |
| P4-U07 | `RepeatYesterday` | Copies previous day's events correctly | All events duplicated with today's date |
| P4-U08 | `RepeatYesterday` | Handles empty previous day | Graceful empty state message |

#### Integration tests

| Test ID | Scope | Test description | Expected result |
|---|---|---|---|
| P4-I01 | PWA install | Add-to-home-screen prompt appears on eligible devices | Prompt displayed |
| P4-I02 | AI consent flow | Parent grants consent → insights appear; revokes → insights disappear | Consent state enforced |
| P4-I03 | Smart defaults | New family signup seeds age-appropriate categories | Categories match child age |

---

### Phase 5 tests — Monetization and compliance

#### Unit tests

| Test ID | Component / Module | Test description | Expected result |
|---|---|---|---|
| P5-U01 | `EntitlementCheck` | Free tier: blocks adding 2nd child | Error with upgrade prompt |
| P5-U02 | `EntitlementCheck` | Free tier: blocks adding 4th reward | Error with upgrade prompt |
| P5-U03 | `EntitlementCheck` | Free tier: limits activity history to 30 days | Older events not returned |
| P5-U04 | `EntitlementCheck` | Paid tier: allows multiple children | No blocking |
| P5-U05 | `EntitlementCheck` | Paid tier: allows unlimited rewards and history | No blocking |
| P5-U06 | `UpgradePrompt` | Renders at natural limit edges, not as interstitials | Contextual placement only |
| P5-U07 | `DataExport` | Exports all family data as JSON | Complete data in export |
| P5-U08 | `DataExport` | Exports all family data as CSV | Complete data in export |
| P5-U09 | `DataDeletion` | Marks account for deletion | Deletion flag set |
| P5-U10 | `ParentalConsent` | Blocks child profile creation without verified parent | Creation rejected |
| P5-U11 | `PrivacyPolicy` | Policy page renders and is accessible | Page loads, a11y passes |

#### Integration tests

| Test ID | Scope | Test description | Expected result |
|---|---|---|---|
| P5-I01 | Stripe billing | Subscription create, upgrade, downgrade, cancel flows | All billing states correct |
| P5-I02 | Stripe webhook | Payment success → entitlements activated | Immediate access |
| P5-I03 | Stripe webhook | Payment failure → grace period → downgrade | Entitlements revoked after grace |
| P5-I04 | Free-to-paid upgrade | User hits limit → upgrades → limit removed | Seamless transition |
| P5-I05 | Data export API | Full family export generates valid JSON/CSV | File downloads, data complete |
| P5-I06 | Data deletion API | Deletion request removes all family data within retention SLA | Data verified absent |
| P5-I07 | Retention enforcement | Free tier activity older than 30 days not queryable | API returns only recent data |

#### E2E tests (critical flows, all phases)

| Test ID | Flow | Test description | Expected result |
|---|---|---|---|
| E2E-01 | New user activation | Signup → add child → add reward → award first points → checklist completes | Full flow succeeds, checklist dismissed |
| E2E-02 | Daily parent loop | Login → quick-add points → view child progress → view activity | All screens load, data consistent |
| E2E-03 | Child snapshot share | Parent opens child page → taps share → snapshot mode loads with safe content only | No unauthorized data exposed |
| E2E-04 | Reward lifecycle | Create reward → earn points → unlock → redeem → reward resets | All states transition correctly |
| E2E-05 | Free tier limits | Free user adds 1 child, 3 rewards → attempts 4th reward → upgrade prompt shown | Limit enforced, prompt contextual |
| E2E-06 | Paid upgrade | Free user → selects Family plan → completes Stripe checkout → limits removed | Entitlements active immediately |
| E2E-07 | Data deletion | Parent requests deletion → confirms → all data removed → account inaccessible | Full deletion verified |
| E2E-08 | Accessibility | Full app navigation via keyboard only | All features reachable, no traps |
| E2E-09 | Nudge suppression | Parent opts out of nudges → no nudges delivered for 48 hours | Zero nudges sent |
| E2E-10 | Cross-device onboarding | Complete 2 of 4 checklist items on device A → login on device B → checklist shows 2/4 complete | State synchronized |

---

### Test environment requirements

- **Unit/Integration:** Jest + React Testing Library (frontend), Jest/Supertest (backend API).
- **E2E:** Playwright or Cypress, running against staging environment.
- **Accessibility:** axe-core (automated CI), manual screen reader testing (VoiceOver + NVDA) per phase.
- **Performance:** Lighthouse CI for page load benchmarks; API response time assertions in integration tests.
- **Privacy:** Custom PII scanner lint rule that fails CI if child identifiers appear in analytics payloads.

---

## Appendix: Competitor pricing reference

| Product | Free tier | Paid tier | Price | Notes |
|---|---|---|---|---|
| GoHenry | None (30-day trial) | Full access | £3.99/child/mo | Primarily financial literacy |
| Greenlight | None (30-day trial) | Full access | $4.99/mo (1 child) | Debit card + chores |
| ChoreMonster | Full (ad-supported) | Ad-free + extras | $4.99/mo | Gamified chores |
| S'moresUp | Limited features | Premium | $2.99/mo | Behavior + chores |
| **Positive Percy** | **1 child, 3 rewards, 30d history** | **Multi-child, unlimited** | **$4.99/mo or $39.99/yr** | **Behavior-first, simplicity focus** |
