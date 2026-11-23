# Positive Percy V1: implementation plan (issue #56)

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-18 |
| Owner | Percy V1 engineering, integration branch `claude/percy-v1-integration` |
| Status | Reviewed plan (v1.1); Step 0 done; V1-A next |
| Binding inputs | Handover `docs/engineering/PERCY_V1_DESIGN_APPROVAL_IMPLEMENTATION_HANDOVER_2026-11-18.md` at `133ae59`; issue #56; approved HTML `design/previews/PERCY_V1_COMPLETE_REVIEW.html` at `18769f7` (blob `9de1df2…`, verified) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-18 | First plan |
| 1.1 | 2026-11-18 | Peer review adopted (4 blocking, 5 non-blocking). Section 8 supersedes the parts of sections 2, 4 and 5 that it names |

## 1. Step 0: baseline (done)

- **Integration branch** `claude/percy-v1-integration` at `7ab7d49`. It contains:
  - the full draft stack: #45 → #46 → #47 → #48 → #49 → handover #50 → E01/E02 #51 → E03 #52 → E04 #53 → E05 #54;
  - the production branch, which had one docs-only commit since the stack's base (`498e798`, the Fox 1A pose library).
- **Merge check.** The merge used the repo's connected-history check, after deepening the history to 1000 commits.
- **Other branch.** `claude/percy-child-creation-bug-8n6bcg` is already fully contained in production, so there is nothing to integrate from it.
- **Baseline:** `vitest` with Postgres gives 31 files and 681/681 passing. The build passes.
- **Superseded.** #46's layout and the E05 panel layout are superseded by the approved HTML. Their server, data and test work is kept.
- **Reference renders.** The approved HTML was rendered for all 12 screens at 390, 834 and 1280 px: 0 console errors, 0 failed requests. These are the visual reference.

## 2. Screens → React, data and server status

**Status key:**
- **B** = backed by an existing API;
- **S** = needs a small additive server change;
- **X** = not backed; needs a new contract or migration (owner decision, §4).

| Approved screen | React target | Elements and data | Status |
| --- | --- | --- | --- |
| **Home** | `pages/ParentDashboard.jsx` (rewritten) | Streak strip: `GET /api/family/streak` (consecutive family-local days with ≥1 award, longest, milestones; goal completions count) | B. Needs tests proving consecutive-day behaviour across a missed day and the timezone (Step 2) |
| | | Family strip: children, `week_points` / `weekly_target`, selected child | B |
| | | Today's Goals in V1 style. The E05 server rules are kept. Copy and visuals follow the HTML ("Daily", "Today", "Mon, Wed, Fri", Done pill, outlined "Complete") | B |
| | | "This week" `week_points / weekly_target`; "Available now" = `total_points − reserved stack` | B (reserved-stack maths exists in the spend routes) |
| | | Larger-goal card "Saving for X: 120 of 300 saved, 180 to go" | **X**: the server can only reserve a reward's *full* cost (`reward_stack`), and only when the balance covers it. Partial saving needs an allocation ledger (§4 D1) |
| | | Quick Points (category buttons → award) | B |
| | | Recent Activity and the Movie-night teaser removed | (none) |
| **Children** | new `pages/Children.jsx`; the nav "Child" tab becomes "Children" | Per-child weekly target with Edit; available; reward choices with visibility and Edit; the child's goals with Edit; "View as child" | B, except the savings rows (X, D1) and "Achievements: goals completed" (S: count from `today_goal_completions`) |
| **Child View** | `pages/ChildView.jsx` (rewritten) | "Ready to use", "Saved towards", rewards I can choose (request only; a parent confirms) | B, except "Saved towards" (X, D1) |
| **Activity** | `pages/Activity.jsx` (restyled) | Weekly totals; filters All / Earned / Goals / Spent; date groups; correction and Undo history kept | S: the Goals filter needs events tagged as goal completions (join `today_goal_completions.point_event_id`), additive to the activity API |
| **Rewards** | `pages/Rewards.jsx` | Catalogue with Edit per reward, visibility, assignment; bigger rewards | B. Streamline example art goes only on the 12 register reward contexts (E06; mapping in §3) |
| **Reward form and picker** | `components/rewards/RewardForm.jsx` (replaces the Add/Edit modals) | 71 icons, 12 categories (84 placements), local search with synonyms, deduplication, container grid 3/5/6; no uploads; existing emoji and images preserved | S: the reward needs a stored icon key. A new nullable column means a migration (§4 D2) |
| **Settings** | `pages/ParentProfile.jsx` (restructured) | Groups as approved, Edit rows; Family Report PDF; JSON export tile **removed** but the endpoint is kept; Shared carers "Planned"; Privacy "Review" | B |
| **Welcome / Goals empty** | `HeroCard` no-children state; goals empty state | Exact treasure-map PNG. This is a **distribution licence gate before deploy**; it is already in the design library | B (asset) |
| **Onboarding** | `OnboardingTips` (rewritten) | Three modes, approved copy | B |
| **Award Points** | `AddPointsModal` → V1 form | Child select, behaviour, note, "Award N point(s)" | B |
| **Manage Goals / Goal form** | `ManageGoalsDialog` → V1 manage plus form | V1 layout. E05 rules kept (start-date safeguard, R1/B2 409s) | B |

## 3. Assets

- Phosphor UI icons come from the E03 generated module, extended with the 71 picker ids, which are present in `design/assets/phosphor/duotone`.
- Streamline reward example art (11 Plump Duo assets plus book-bookmark) goes on reward cards **only** where the reward is one of the register's example contexts, or a parent picks it. This is display art, not part of the selectable picker.
- **Open:** how a stored reward maps to example art. The design shows them on sample rewards. For real rewards there is no mapping data, so we show the reward's own emoji or image, or its picker icon, and never auto-assign Streamline art (W5: "never migrate/replace"). Recorded as **D3**.

## 4. Owner decisions (blocking the named items only)

| # | Decision | Why it needs the owner | Proposal |
| --- | --- | --- | --- |
| D1 | Savings allocation ledger (partial "120 of 300 saved", separate "Available now", moving points between pools) | It needs a new table and migration. The design approval explicitly excludes migrations, and #56 says "flag and block, do not fabricate" | Design migration 015 `savings_allocations` (child, reward, allocated points, idempotent allocate/unallocate events in `point_events` or its own ledger) with full lifecycle review. **Interim if declined:** the card shows "Saving for X: you have N of 300 points", from the real balance, with no allocation and no transfer UI |
| D2 | Reward icon key column (`rewards.icon_key`, nullable) | New column, so a migration | Additive, nullable, no backfill. Existing rewards keep their emoji or image |
| D3 | Streamline example art on real rewards | Assigning art to existing data | Only when a parent picks it; no automatic mapping |
| D4 | Streak strip when the streak is 0 | No approved copy for zero | Hide the strip at 0. No new copy |
| (open gates) | Points-star master; Freepik and Streamline licences; legal/privacy; backups and restore; shared carers | Release gates (Step 4) | Tracked; not resolved by engineering |

## 5. Delivery sequence

Each part is its own draft PR into `claude/percy-v1-integration`. The release-candidate PR into production comes last and stops before merge.

| PR | Contents |
| --- | --- |
| V1-A | Shell and shared primitives (Edit action, section/row/card, form field pattern), nav label "Children", Home |
| V1-B | Children and Child View |
| V1-C | Activity (+ server: goal tag on events) |
| V1-D | Rewards, reward form and full picker (E06; D2-dependent parts behind the decision) |
| V1-E | Settings |
| V1-F | Welcome, onboarding, Award Points, Manage Goals and Goal form |
| V1-G | Step 2 contract tests (streak, goals, ledger, permissions), Step 3 QA pack (screens vs reference, axe, restore drill plan), release-candidate PR |

**Every PR includes:**
- a design note (short, peer-reviewed);
- unit, render, server and E2E tests;
- `check:tokens`, lint and build;
- reference-vs-React screenshots at 390, 834 and 1280 px for its screens.

## 6. Visual comparison method

- **Reference:** renders of the approved HTML's phone content at each width.
- **React side:** the same states from the built app with fixture data shaped like the sample data.
- **Comparison:** side by side per state, reviewed against a checklist of layout, order, components, copy, icons, spacing class and colours. Pixel diffs are not meaningful, because fonts, data and frames differ.
- **Recording:** each deviation goes in the PR as "intended (reason)" or "defect".

## 7. Guards (programme-wide)

- E01/E03 asset tests extend to the picker ids and any new runtime art.
- No point mutation without the existing idempotency and child-lock path. New server endpoints get the E04 test pattern: failing-first, cross-family, parallel, replay.
- No feature marked X is shown as working. If it appears at all, it is labelled as not yet available, using copy taken from the approved HTML's own design-only notes or the owner's decision.

## 8. Amendments in v1.1 (these supersede §2, §4 and §5 where they conflict)

### 8.1 Corrected status claims

| Item | Corrected status |
| --- | --- |
| "Available now" | **S.** The server does not expose it. `withWeekPoints` gains `available_points = total − reserved`, priced on the server through `pricedStack`. The client never computes it from stored stack costs |
| Streak | `GET /api/family/streak` returns `{streak, longest}`. Milestones come only in award and goal-complete responses. Streak contract tests ship **in V1-A**, together with the strip |
| Children "Achievements: goals completed today" | B: from `/api/todays-goals?child_id=` `completion_id` |
| Activity "Goals completed this week" | S, in V1-C |
| Activity filters | Goals: join `today_goal_completions.point_event_id`. Do not rely on the note prefix. The `earned` and `spent` filters must also return the `undone` flag (S, V1-C), or Undo state is lost |
| "Load earlier activity" | B: `/api/activity-feed` supports `limit` and `offset` |
| Settings "Family name — Edit" | **S:** there is no update route today; only creation writes `family_name`. Add an authenticated `PUT /api/family/name` with validation and cross-family tests |
| Settings "Point defaults — Edit" | **D6:** an editable default needs a new family column, so a migration. Until decided, the row is shown **read-only, with no Edit**. That is a deviation from the HTML, flagged for owner sign-off |
| Settings "Quick Points", "Family timezone", "Invite parent" | B: `PUT /api/behavior-categories/:id` `is_quick_action`; `FamilyTimezone.jsx`; family-code copy and share are kept |

### 8.2 Child request and parent confirmation (was unmapped)

- **D5 (design-backed, recorded).** In Child View, "choose" means **add to the existing reward stack** (`POST /api/children/:id/stack/add`). That reserves the full cost and is refused if the balance doesn't cover it. A parent then confirms through `stack/confirm`, and only that confirmation spends points.
- **Direct spend removed from Child View.** Child View currently calls `/redeem` directly (`ChildView.jsx:55-70`), which contradicts the approved "Choosing a reward is a request" rule. The parent-side direct redeem stays: it is parent-operated and has Undo.
- **Owning PRs.** The parent Redeem/confirm screen and "Add to stack" belong to **V1-D** (Rewards) and **V1-B** (Children and Child View).

### 8.3 Larger goal and savings (D1, clarified)

- **The "which reward" problem.** The interim card also needs to know which reward the child is saving for, and no field holds that. Target selection therefore belongs in D1. Until D1 is decided, Home and Children show **no savings figures**: only "What you're working towards" and the child's stacked or next reward, from real stack data.
- **No "saved" wording.** No copy says "saved" until there is an allocation ledger. "Available now" next to "N of 300" would count the same points twice.
- **Do not reuse the legacy family goals endpoint.** The `family_goals` table and `/api/family-goals/:id/contribute` are explicitly **not** reused: the endpoint is non-idempotent, keeps no ledger, applies to the whole family and moves no child points.
- **Migration numbers.** D1 takes the next free number after the D2 decision. 013 stays reserved for Batch C deletion.

### 8.4 Other decisions added

| # | Decision | Proposal |
| --- | --- | --- |
| D7 | "Bigger rewards" section: no field classifies a reward as bigger, and subtitles such as "Weekly treat" or "Family activity" have no column | Rule: a reward is "bigger" when its cost is more than the family's largest weekly target. No new subtitles; show the cost and visibility only |
| D8 | Child View shows "Visible to children / Edit" on reward rows | Recorded as an intended deviation: **no parent Edit controls in Child View** |

The migration-dependent decisions are D1 and D2 (D6 also, if an editable default is wanted).

### 8.5 Delivery order (replaces the §5 order)

1. **V1-A:** primitives; Home; `available_points`; streak tests.
2. **V1-F:** Award Points; Manage Goals and Goal form; Welcome; onboarding.
3. **V1-D:** Rewards; RewardForm and picker; parent confirm/redeem.
4. **V1-B:** Children; Child View request flow.
5. **V1-C:** Activity.
6. **V1-E:** Settings, including the family-name endpoint.
7. **V1-G:** QA pack and release-candidate PR.
8. **D1** savings ledger: a placeholder PR, only if the owner approves it.

Until its PR lands, an entry point that opens a later form keeps opening the existing modal. For example, Home's "Award points" opens today's `AddPointsModal` until V1-F.

### 8.6 Copy rule

Design-only notes in the approved HTML never ship as UI copy. Examples: "Streak figure is sample content…", "This preview does not change a real ledger", "No points are actually awarded in this design preview", "…is a visual concept until…".

### 8.7 Retained capabilities

| Capability | Kept in |
| --- | --- |
| Badges (`/check-badges` after awards and goal completion) | V1-A (Home award paths), V1-F |
| `/api/children/:id/motivation` | V1-B (Children); reviewed per screen |
| Child photo/avatar upload (`EditChildModal`) | V1-B and V1-E. Letter avatars only when there is no photo |
| Reward `image_url` display. "No uploads" applies to **new** reward uploads only | V1-D |
| Reward stack: add, remove, confirm | V1-D, V1-B |
| Parent direct spend with the Undo toast | V1-D |
| Behaviour category manager (names, points, icons, reorder, `assigned_children`) | V1-E |
| Award Undo toast (formerly reachable from Home Recent Activity) | V1-A (toast after each award) |
| JSON export endpoint (Settings tile removed) | V1-E. A test keeps `GET /api/family/export` live |
| Family code copy/share; timezone | V1-E |
| Today's Goals E04/E05 server rules | Unchanged |

### 8.8 D2 details

- `icon_key` is added to `COLUMN_WHITELIST.rewards`, validated on the server against the **71 picker ids**, which are a different set from `iconKeys.js`.
- Storing the icon in `rewards.emoji` to avoid a migration was considered and **rejected**: it would mix two kinds of value in one column, and other clients read that field.

## Peer review record (v1.0 → v1.1)

| # | Finding | Disposition |
| --- | --- | --- |
| B1 | Request and confirm flow unmapped; Child View spends directly | Adopted: §8.2, D5; direct spend removed from Child View |
| B2 | `available_points` and target meaning; family-goals endpoint | Adopted: §8.1, §8.3 |
| B3 | Family name and point defaults are not B | Adopted: S endpoint; D6 read-only |
| B4 | PR dependency inversions; streak tests late | Adopted: §8.5 |
| N1 | Missing elements | Adopted: §8.1, §8.7, D7. Remaining Home items ("Welcome back!", the banner, the "What you're working towards" header, the "View all goals and rewards", "Award points" and "Rewards" buttons, and the "Manage goals" link) are in V1-A scope |
| N2 | Status corrections | Adopted: §8.1 |
| N3 | Edit controls in Child View | Adopted: D8 |
| N4 | D2 details | Adopted: §8.8 |
| N5 | Retained capabilities | Adopted: §8.7 |
