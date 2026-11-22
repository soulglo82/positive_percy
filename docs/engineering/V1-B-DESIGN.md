# V1-B design note: Children page and Child View

| Field | Value |
| --- | --- |
| Version | 1.4 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-b-children`, stacked on V1-D `claude/percy-v1-d-rewards`) |
| Status | Reviewed (§8); build may start. Owner items in §7 |
| Binding inputs | Approved HTML blob `9de1df2`, screens `children` and `childview`; plan v1.1 §2 (Children and Child View rows), §8.2 (D5), §8.4 (D8), §8.7. Owner directions 2026-11-19: D5 (the child requests, the parent confirms), D8 (no parent Edit controls in Child View). D1 savings is **not** in V1-B (its gate is open) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.4 | 2026-11-22 | §10: Child View points card reworked at the owner's request (visual review, 22 November). Design for review before the build |
| 1.3 | 2026-11-19 | Post-build code review (§9): New goal used the previous child's behaviour (Major, fixed); focus, refresh, loading and lock fixes |
| 1.2 | 2026-11-19 | Owner decisions: B1 approved for now (full milestone wording restored when D1 lands); B3 approved ("Ask a parent"; after pressing, "Ready when a parent agrees"; nothing charged until a parent confirms) |
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
- **"You're doing great, {Name}!"** with "{available}" and "Ready to use". **Superseded on 22 November by §10:** one figure with a piggy bank; the second tile below is gone and savings show once, in "My next big adventure".
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
| E4b | Switching child while a request is in flight | The sibling's same reward is not locked; an error toast uses the shipped wording (no toast names a child; a success is announced in the status line) |
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
| B1 | **Approved (owner, 2026-11-19).** "Next milestone" ships without "Weekly target and bigger goal" until D1. **When D1 is integrated, the full milestone (weekly target and bigger goal) is restored**: a D1 acceptance item, not a permanent simplification |
| B2 | (Withdrawn in v1.1: the approved code already shows "0 to reach…", which is kept) |
| B3 | **Approved (owner, 2026-11-19).** Request button label "Ask a parent"; once pressed the reward shows "Ready when a parent agrees" and no points are charged until a parent confirms. Was: (new copy: the approved design has the caption but no control). Layout differs from the reference tile by that one button |

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

## 9. Post-build code review (fresh context, PR #61 at `2a868ea`)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | New goal (Children) filled the behaviour of the child the dialog last showed; the server refused the save while the form looked valid (probe) | Major | Fixed: the add path uses the opened child's behaviours, like the edit path. The "Add goal" button also passed its click event as the behaviour list: fixed. Regression test fails on the old code |
| 2 | No test checked the behaviours used by Edit | Minor | Covered by the same test (a goal whose behaviour is not the child's opens unset) |
| 3 | Focus lost after "Ask a parent" (the button is replaced) | Minor | Focus moves to the row's caption; one `role="status"` line announces "{reward}: Ready when a parent agrees" (approved words). Test |
| 4 | Child View never refreshed | Minor | `refetchOnWindowFocus: true` on its children query |
| 5 | A rewards load failure looked like an empty catalogue | Minor | Spinner and the shipped "Couldn't load rewards" error card on both pages. Test |
| 6 | A failed refresh released the lock: window for a duplicate request | Minor | The row stays locked until the next successful load. Test; mutation (check removed) fails it |
| 7 | A live region on every caption | Nit | Removed; one status line (3) |
| 8 | E4b said a toast names the child | Nit | Design corrected (§5) |
| 9 | Raw "Could not request" could reach a toast | Nit | Empty message: callers show the shipped wording |
| 10 | Test hygiene: an empty assertion, no RTL cleanup, e2e cleanup not in `finally` | Nit | Fixed |
| 11 | Children imported `RewardTile` from the Rewards page | Nit | Moved to `components/rewards/RewardTile.jsx` (Rewards re-exports it) |

## 10. Child View points card (owner review, 22 November) (v1.4)

**Owner's finding.** "The box which shows the kids current points tally is very full looking … This section needs rework. Wording and the look is poor. No icon or imagery."

**What is there now.** The card "You're doing great, {Name}!" holds two bordered tiles, "{available} / Ready to use" and "{saved} / Saved towards {goal}", with no picture. This is the approved design (blob `9de1df2`) as drawn; the owner is changing an approved screen and its wording.

**Prior decisions found.** §3 (the strings above are approved verbatim); D1 design §19.3 and S5 (the second tile shows only a goal visible to children); V1-F §"Removed" (the star sticker left the app with the old Home hero and stays in `public/`); the approval register (the star is selected for "Home welcome" and "small decorative sticker"; a dedicated points star is **not yet approved**).

### 10.1 Contract

The card shows **one** figure, the child's available points (`available_points` from the server), with a piggy-bank icon and the label "Ready to use". A child's savings are shown **once**, in "My next big adventure" directly below, which already carries the goal's picture, "{saved} of {cost} points saved", the bar and the points to go. No figure is computed in the browser.

**Owner's decisions (22 November, after the options sheet).** Layout C ("option c is good"). The star is "not appropriate – use a piggy bank". "Alignment is off with the wording and numbers" on the mock-up: fixed in §10.2.

**Wording.** "{n} points" with "Ready to use" beneath. "Ready to use" is the approved string. The mock-up's "points ready to spend" is dropped: the owner's review of the release candidate noted that "Ready to use" is more precise while requests and savings are held, and that wording must not suggest a child spends without a parent.

### 10.2 Build

`src/pages/ChildView.jsx`, the first card only:

- heading unchanged: "You're doing great, {Name}!";
- one row, vertically centred: the icon in a tile (the same tile as a reward's picture: 56 px, warm ground), then one paragraph;
- the paragraph's first line is the figure in the largest text token with "point" or "points" beside it **on the same baseline**; its second line is "Ready to use" in the small muted style. Both lines start at the same left edge;
- the paragraph's text is "{n} points Ready to use" with real spaces (design review: without one the text ran together as "90points");
- the "Saved towards {goal}" tile is removed. `visibleGoals` and "My next big adventure" are unchanged.

Not changed: Home's "Little wins, big adventures!" tiles and the Children page's "Earned this week / Available now" tiles (see the design check in the release assessment).

### 10.3 Artwork

The piggy bank is `phosphor:piggy-bank:duotone`, already one of the 71 approved picker icons (the exact pinned upstream file, MIT, in `approvedIcons.js`). Nothing is drawn or generated, and no new asset is added. The star sticker is not used.

### 10.4 Edge cases (input → expected)

| Input | Expected |
| --- | --- |
| 0 available | "0 points", "Ready to use" |
| 1 available | "1 point", "Ready to use" |
| 12345 available at 320 px | "12345 points" on one line beside the icon; nothing clipped |
| `available_points` missing | Falls back to `total_points`, then 0 (as now) |
| A 100-character child name with no spaces | The heading breaks inside the card (as now) |
| No bigger goal, or a goal hidden from children (S5) | The card alone; nothing about savings on the page (as now) |
| Savings in two goals | "My next big adventure" shows the leading goal (D1 O5), as now |
| A fully saved goal | Unchanged: "{Name} has saved enough for {Goal}!" in the card below |
| Points held for a requested reward | Left out of the figure, as now; the reward row says "Ready when a parent agrees" |

### 10.5 Tests

- Unit (`V1Children.test.jsx`, `V1Savings.test.jsx`): the text for 0, 1 and many points; the piggy-bank icon present and hidden from assistive technology; no "Saved towards" text; the saved figure appears once, in "My next big adventure"; S5 unchanged.
- Browser (`e2e/v1-savings.spec.js`): the figure and label on Child View. `e2e/ui.spec.js` runs the shared screen checks on Child View at four sizes; its fixture child has a four-digit total.
- New shared check: in a figure block (`[data-figure]`), the figure and its unit share a baseline, and the label starts at the figure's left edge (to a pixel). This is the alignment the owner found off.
- Shown red first against the current card.
- **Not covered by a test:** whether it looks right (the owner's sign-off, G2); what a screen reader says (two lines may be read as two phrases; the text itself is correct).

### 10.6 Design review (independent, before the build)

One blocking finding, adopted: no space between the two parts of the sentence. Also adopted: the stated edge cases (missing values, the 100-character name), an honest list of which tests assert what, and the list of documents and comments that the change makes stale (updated in the same commit). Confirmed: no saved figure visible today disappears from the page, because the removed tile and the card below show the same goal.

### 10.7 Rollout and reversal

One commit on the release-candidate branch. Reverting it restores the approved two-tile card. No data, server or migration change.
