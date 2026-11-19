# V1-B design note: Children page and Child View

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-b-children`, stacked on V1-D `claude/percy-v1-d-rewards`) |
| Status | Reviewed (§8); build may start. Owner items in §7 |
| Binding inputs | Approved HTML blob `9de1df2`, screens `children` and `childview`; plan v1.1 §2 (Children and Child View rows), §8.2 (D5), §8.4 (D8), §8.7. Owner directions 2026-11-19: D5 (the child requests, the parent confirms), D8 (no parent Edit controls in Child View). D1 savings is **not** in V1-B (its gate is open) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.1 | 2026-11-19 | Fresh-context peer review (§8): 3 blocking and 7 non-blocking findings adopted. The request button label becomes an owner item; the lock is held until fresh data arrives; contract corrected; requested rewards win over affordability; reached state kept as approved ("0 to reach") |
| 1.0 | 2026-11-19 | First draft |

## 1. Scope

- **New `pages/Children.jsx`.** The nav item "Child" becomes **"Children"** and opens it.
- **`pages/ChildView.jsx` rewritten.** It is reached from "View as child" (Children) and from "View all goals and rewards" (Home), and is no longer in the nav.
- **No server change:** every figure already exists. `available_points` comes from V1-A/V1-D (fallback `?? total_points`, as on Home; the server's 400 catches an overstatement). The goal list and the "{n} today" count come from one query, `GET /api/todays-goals?manage=true` (key `['todaysGoals','manage']`), whose rows carry today's `completion_id`.
- `GET /api/children/:id/motivation` (plan §8.7 assigned it to V1-B) is **retained unchanged and unused**: no approved V1-B element shows its figures.
- **No migration.**

## 2. Children page (approved strings verbatim)

- "Children" and "See what every child has achieved and what they're saving for.", then the family strip (shared `FamilyStrip`, oldest first, the `?child=` hand-off as in Child View).
- **"{Name}'s page"** with "{week} of {target} weekly points · {available} available", and **"View as child"**, a link to Child View for that child.
- **"{Name}'s weekly target"** with **Edit**, which opens the existing `EditChildModal` **without `onDelete`** (so no "Delete Child" on this page; deleting stays in Settings). Its shipped title "Edit Child" is unchanged.
  - The panel shows "{week} / {target}" with "Earned this week", "{available}" with "Available now", a progress bar, and "{n} to reach this week's target" with n = max(0, target − week), exactly as the approved code computes it (so "0 to reach this week's target" once reached).
- **"Weekly treats to choose from"**, with "All rewards" (a link to Rewards).
  - The rewards this child can see (assignment), including hidden ones tagged "Hidden from children", as V1-D catalogue tiles (`RewardTile`: icon, title, "{cost} point(s)", visibility tag, **Edit**, which opens the V1-D `RewardForm`).
  - The save and delete mutations move from Rewards.jsx into a shared hook (`useRewardMutations`), used by both pages, so the F1–F4 payload rules have one home.
  - Empty: the shipped "No rewards created yet.".
  - Bigger goals (D7) do not exist until D1, so nothing is filtered on that yet.
  - No subtitles (plan §8.4).
  - The design-only note "Multiple rewards can be shown…" never ships (§8.6).
- **"{Name}'s goals"**, with **"New goal"** and one row per goal ("Category · schedule · +N point(s)", Edit), and **"Manage all goals"**.
  - These open the V1-F `ManageGoalsDialog`: New goal opens it on the form; Edit opens the form for that goal; Manage all goals opens the list.
  - A new `start` prop on the dialog does this: `{ view: 'form' }` or `{ goal }` (the goal object from the same query, so the form is filled synchronously). It is read in the dialog's open effect. When the dialog was opened on the form, Back returns to the list (the shipped behaviour), not out of the dialog.
- **"Achievements"**:
  - "Goals completed", "Recognise effort over time", "{n} today": today's goals for the child with a completion.
  - "Next milestone", "{n} weekly points to go" (n = max(0, target − week), as approved), **without** the approved subtitle "Weekly target and bigger goal" until D1 (owner item B1).
- **Not built until D1** (its gate): "Saving for something bigger" with Edit, "120 of 300 points saved", "Saved: 120", "180 to go", and the "300 points · Bigger achievement" tile subtitle.
- **Retained elsewhere:** adding, editing and deleting a child, and photos, stay in Settings (V1-A, plan §8.7).

## 3. Child View (approved strings verbatim)

- "← Back to Home", "My Percy adventure", "A child-friendly view of goals, points and rewards. No independent child account.", then the family strip.
- **"You're doing great, {Name}!"** with "{available}" and "Ready to use".
  - The approved second tile ("{saved} Saved towards {goal}") and the "My next big adventure" card wait for D1.
- **"Rewards I can choose"**: the rewards visible to the child (`visible_to_child`, assignment), cheapest first, each with its icon, title and a status. **Precedence, first match wins:**
  1. **Requested** (its `rewardId` is in the child's `reward_stack_priced`): "{cost} point(s) · Ready when a parent agrees". A requested reward is shown **even if it was hidden afterwards**, because its cost is still set aside and the child must see why "Ready to use" is lower.
  2. **Affordable** (`available_points ≥ cost`): "{cost} point(s) · Ask a parent" (the approved caption, verbatim), and a request button. Its label is provisionally "Ask a parent" (**owner item B3**: in the approved HTML "Ask a parent" is a caption with no control; D5 needs a control, so its label is new copy).
  3. **Not affordable:** the existing shipped "Need {n} more" (disabled).
- **The request:** the button calls `POST /stack/add` with no retry. A lock keyed `childId:rewardId` is held **until the refetch of `['children']` settles** (not only until the POST returns), so a second tap in the gap cannot add a duplicate. Toasts use the child captured at tap time.
  - **No "Spend"**: direct spending is removed from Child View (D5). **No Edit or visibility controls** (D8).
- The footer line "Choosing a reward is a request. Only a parent-authorised confirmation can spend points." (approved).
- **Errors:** a 400 shows the server's "Not enough points"; any other failure, including a 404 ("Reward not found" is never shown raw), shows the shipped "Couldn't update points. Please try again." (SpendRewardsModal). Data is refetched either way.
- **Empty:** the shipped "No rewards created yet.".

## 4. Contracts and code paths

| Contract | Paths |
| --- | --- |
| Request | Child View request button → `stack/add`. Server, as read on this base: the reward exists in the family and is assigned to the child, and committed + cost ≤ total. It does **not** check `visible_to_child` (a hidden reward can be requested through the API; Child View never offers one). Bigger goals are refused only once D1 lands (PR #60). The parent confirms in the Home Rewards dialog (V1-D) |
| No direct spend from Child View | ChildView.jsx imports neither `spendReward`/`redeem` nor `SpendRewardsModal` (static scan test, with a failing fixture) |
| Nav | `Layout.jsx` nav ("Children" → `Children`) and `PAGE_TITLES` (`Children: 'Children'`; `ChildView` keeps 'My Rewards', shipped). On Child View the "Children" item is shown active. `pages.config` registers `Children` |
| Links to Child View | Children "View as child" (`?child=`), Home "View all goals and rewards", Rewards "View child reward choices" (unchanged, no `?child=`: first child) |
| Reward edit from Children | V1-D `RewardForm` (same payload rules, F1–F4) |
| Goal edit from Children | V1-F `ManageGoalsDialog` with `start` (E05 rules unchanged) |

## 5. Edge cases (input → expected)

| # | Input | Expected |
| --- | --- | --- |
| E1 | No children | Children: the Welcome card (V1-F). Child View: the existing "Welcome! Add a child on the Home screen to get started." |
| E2 | `?child=` of another family or an unknown id | The first child (oldest) |
| E3 | Week target reached (25/25 or above) | "0 to reach this week's target", "0 weekly points to go" (as approved) |
| E4 | Two taps while the POST is in flight, **and** a tap after it resolves but before the refetch | One `stack/add` in both |
| E4b | Switching child while a request is in flight | The sibling's same reward is not locked; the toast names the right child |
| E4c | Requested reward then hidden by a parent | Still shown as requested in Child View |
| E4d | `available_points` missing on the row | Falls back to `total_points` |
| E5 | `available_points` 20, reward 25 | "Need 5 more", disabled |
| E5b | Requested reward 25, `available_points` now 0 | "Ready when a parent agrees" (requested wins), not "Need 25 more" |
| E5c | Cost 1 | "1 point" |
| E6 | Reward hidden from children | Not in Child View; still shown, as "Hidden from children", in Children's treats |
| E7 | Reward assigned to a sibling only | Not shown for this child, in either page |
| E8 | A request whose reward was deleted | Not shown (the priced stack drops it) |
| E9 | Long names at 320 px | Wrap; no sideways scroll |

## 6. Test plan

- **Render:**
  - Children: copy, figures from the server, the target line hidden at the target, View as child link, goal-dialog start modes, reward Edit opening RewardForm, achievements count.
  - Child View: the three request states, "Ask a parent" calling `stack/add` once, no Spend or Edit, the footer copy.
  - Nav: "Children".
- **Guard:** ChildView.jsx imports none of `spendReward`, `redeem`, `SpendRewardsModal` (a static scan, with a fixture that fails). Input it does not cover: a spend reached through a new, differently named helper.
- **E2E:**
  - the Children page, and the Child View request, with axe and 44 px checks at 4 sizes;
  - the existing "child view" test is updated;
  - the nav label.
- **Evidence:** reference vs React at 390/834/1280 for `children` and `childview`.
- **E2E today:** the "child view" test is screenshot-only; it gains assertions.
- **One class not covered:** two parents requesting on two devices at the same moment for the same child. The server serialises it under the child row lock, but the UI is not tested for it.

## 7. Owner items

| # | Item |
| --- | --- |
| B1 | "Next milestone" ships without its approved subtitle "Weekly target and bigger goal" until D1 (no bigger goal yet) |
| B2 | (Withdrawn in v1.1: the approved code already shows "0 to reach…", which is kept) |
| B3 | Request button label "Ask a parent" (new copy: the approved design has the caption but no control). Layout differs from the reference tile by that one button |

## 8. Peer review (fresh context, v1.0)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | "Ask a parent" is a static caption in the approved `rewardTile` calls, not a control (confirmed: both notes are hardcoded strings) | Blocking | Caption kept verbatim; button label is owner item B3 (§3, §7) |
| 2 | `stack/add` returns only the stored stack; releasing the lock when the POST resolves leaves a gap for a duplicate; no idempotency | Blocking | Lock held until the refetch settles; no retry; E4 tests both gaps (§3, §5) |
| 3 | §4 claimed "bigger goals refused" and implied visibility checks; neither exists on this base (confirmed in `spendableFrom`) | Blocking | Contract corrected; requested-but-hidden rewards stay visible (§3, §4, E4c) |
| N1 | Missed callers and titles (Rewards link, `PAGE_TITLES`, active nav) | Non-blocking | Added to §4 |
| N2 | Precedence of states; `available_points` fallback | Non-blocking | Precedence list; fallback (§1, §3, E4d, E5b) |
| N3 | Lock keyed by reward only blocks a sibling | Non-blocking | `childId:rewardId`, tap-time child (E4b) |
| N4 | Copy: network fallback, raw server messages, empty state, "1 point", Delete Child on Edit | Non-blocking | Shipped strings reused; `onDelete` not passed (§2, §3) |
| N5 | `start` prop must sit in the open effect; `{goalId}` needs async data | Non-blocking | `{ goal }`, in the effect; Back goes to the list (§2) |
| N6 | Reward mutations live in Rewards.jsx | Non-blocking | Shared `useRewardMutations` hook (§2) |
| N7 | Approved code shows a reached state (`Math.max(0, …)`); motivation endpoint unmentioned | Non-blocking | Kept as approved; B2 withdrawn; endpoint retained unused (§1, §2) |
| D5/D8 | Guard should also cover `SpendRewardsModal` | Non-blocking | Added (§4, §6) |

