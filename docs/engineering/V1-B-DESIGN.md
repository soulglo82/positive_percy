# V1-B design note: Children page and Child View

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-b-children`, stacked on V1-D `claude/percy-v1-d-rewards`) |
| Status | Draft, for fresh-context peer review |
| Binding inputs | Approved HTML blob `9de1df2`, screens `children` and `childview`; plan v1.1 §2 (Children and Child View rows), §8.2 (D5), §8.4 (D8), §8.7. Owner directions 2026-11-19: D5 (the child requests, the parent confirms), D8 (no parent Edit controls in Child View). D1 savings is **not** in V1-B (its gate is open) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-19 | First draft |

## 1. Scope

- **New `pages/Children.jsx`.** The nav item "Child" becomes **"Children"** and opens it.
- **`pages/ChildView.jsx` rewritten.** It is reached from "View as child" (Children) and from "View all goals and rewards" (Home), and is no longer in the nav.
- **No server change:** every figure already exists. `available_points` comes from V1-A/V1-D. "Goals completed today" is counted from `GET /api/todays-goals`, whose goals already carry `completion_id` for today.
- **No migration.**

## 2. Children page (approved strings verbatim)

- "Children" and "See what every child has achieved and what they're saving for.", then the family strip (shared `FamilyStrip`, oldest first, the `?child=` hand-off as in Child View).
- **"{Name}'s page"** with "{week} of {target} weekly points · {available} available", and **"View as child"**, a link to Child View for that child.
- **"{Name}'s weekly target"** with **Edit**, which opens the existing `EditChildModal` (it edits the target, among other fields).
  - The panel shows "{week} / {target}" with "Earned this week", "{available}" with "Available now", a progress bar, and "{n} to reach this week's target".
  - The line is hidden once the target is reached; the approved HTML has no reached state.
- **"Weekly treats to choose from"**, with "All rewards" (a link to Rewards).
  - The rewards this child can see, as V1-D catalogue tiles (icon, title, points, visibility tag, **Edit**, which opens the V1-D `RewardForm`).
  - No subtitles (plan §8.4).
  - The design-only note "Multiple rewards can be shown…" never ships (§8.6).
- **"{Name}'s goals"**, with **"New goal"** and one row per goal ("Category · schedule · +N point(s)", Edit), and **"Manage all goals"**.
  - These open the V1-F `ManageGoalsDialog`: New goal opens it on the form; Edit opens the form for that goal; Manage all goals opens the list.
  - A new `start` prop on the dialog does this (`{ view: 'form' }` or `{ goalId }`).
- **"Achievements"**:
  - "Goals completed", "Recognise effort over time", "{n} today": today's goals for the child with a completion.
  - "Next milestone", "{n} weekly points to go", **without** the approved subtitle "Weekly target and bigger goal" until D1 (owner item B1). Hidden once the target is reached.
- **Not built until D1** (its gate): "Saving for something bigger" with Edit, "120 of 300 points saved", "Saved: 120", "180 to go", and the "300 points · Bigger achievement" tile subtitle.
- **Retained elsewhere:** adding, editing and deleting a child, and photos, stay in Settings (V1-A, plan §8.7).

## 3. Child View (approved strings verbatim)

- "← Back to Home", "My Percy adventure", "A child-friendly view of goals, points and rewards. No independent child account.", then the family strip.
- **"You're doing great, {Name}!"** with "{available}" and "Ready to use".
  - The approved second tile ("{saved} Saved towards {goal}") and the "My next big adventure" card wait for D1.
- **"Rewards I can choose"**: the rewards visible to the child (`visible_to_child`, assignment), cheapest first, each with its icon, title and a status.
  - **Requested** (in the child's stack, from the server's `reward_stack_priced`): "{cost} points · Ready when a parent agrees".
  - **Not requested, and affordable** (`available_points ≥ cost`): "{cost} points" and a button **"Ask a parent"** (the approved wording). Tapping it is the request: `POST /stack/add`. The row then shows "Ready when a parent agrees".
  - **Not affordable:** the existing shipped "Need {n} more" (disabled).
  - **No "Spend"**: direct spending is removed from Child View (D5). **No Edit or visibility controls** (D8).
- The footer line "Choosing a reward is a request. Only a parent-authorised confirmation can spend points." (approved).
- **Errors:**
  - a refused request (not enough points, or the reward is gone) uses the existing toast wording "Not enough points" or the server's message;
  - a double tap sends one request (in-flight lock per reward).

## 4. Contracts and code paths

| Contract | Paths |
| --- | --- |
| Request | Child View "Ask a parent" → `stack/add` (server: spendable, committed ≤ total, bigger goals refused). The parent confirms in the Home Rewards dialog (V1-D) |
| No direct spend from Child View | `spendReward` is no longer imported by ChildView.jsx (test) |
| Nav | `Layout.jsx` nav and `PAGE_TITLES`; `pages.config` registers `Children` |
| Reward edit from Children | V1-D `RewardForm` (same payload rules, F1–F4) |
| Goal edit from Children | V1-F `ManageGoalsDialog` with `start` (E05 rules unchanged) |

## 5. Edge cases (input → expected)

| # | Input | Expected |
| --- | --- | --- |
| E1 | No children | Children: the Welcome card (V1-F). Child View: the existing "Welcome! Add a child on the Home screen to get started." |
| E2 | `?child=` of another family or an unknown id | The first child (oldest) |
| E3 | Week target reached (25/25 or above) | No "to reach" line; no "Next milestone" line |
| E4 | Reward requested twice (double tap) | One `stack/add` |
| E5 | `available_points` 20, reward 25 | "Need 5 more", disabled |
| E6 | Reward hidden from children | Not in Child View; still shown, as "Hidden from children", in Children's treats |
| E7 | Reward assigned to a sibling only | Not shown for this child, in either page |
| E8 | A request whose reward was deleted | Not shown (the priced stack drops it) |
| E9 | Long names at 320 px | Wrap; no sideways scroll |

## 6. Test plan

- **Render:**
  - Children: copy, figures from the server, the target line hidden at the target, View as child link, goal-dialog start modes, reward Edit opening RewardForm, achievements count.
  - Child View: the three request states, "Ask a parent" calling `stack/add` once, no Spend or Edit, the footer copy.
  - Nav: "Children".
- **Guard:** ChildView.jsx does not import `spendReward` or `redeem` (a static scan, with a fixture that fails).
- **E2E:**
  - the Children page, and the Child View request, with axe and 44 px checks at 4 sizes;
  - the existing "child view" test is updated;
  - the nav label.
- **Evidence:** reference vs React at 390/834/1280 for `children` and `childview`.
- **One class not covered:** two parents requesting on two devices at the same moment for the same child. The server serialises it under the child row lock, but the UI is not tested for it.

## 7. Owner items

| # | Item |
| --- | --- |
| B1 | "Next milestone" ships without its approved subtitle "Weekly target and bigger goal" until D1 (no bigger goal yet) |
| B2 | No "reached" wording for the weekly target or the next milestone: the lines are hidden |
