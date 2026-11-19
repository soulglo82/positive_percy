# V1-D design note: Rewards, reward form and icon picker, reward icon column (D2), parent confirmation

| Field | Value |
| --- | --- |
| Version | 1.3 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-d-rewards`, stacked on V1-F `claude/percy-v1-f-forms`) |
| Status | Reviewed (fresh-context peer review adopted, v1.1; §10 supersedes earlier sections where they conflict) |
| Binding inputs | Approved HTML blob `9de1df2` (screens `rewards`, `rewardform`; picker data `APPROVED_PICKER_CATEGORIES`, `APPROVED_PICKER_ICON_ALIASES`, `pickerItems`, `pickerLabel`); `design/stage1/APPROVAL_REGISTER.json` `picker` (12 categories, 84 placements, 71 icons, 10 owner-approved UX choices); plan v1.1 §2 Rewards rows, §8.2, §8.7, §8.8; **owner decision D2 (2026-11-19, issue #56)**; owner directions D3, D5, D7 (2026-11-19) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.3 | 2026-11-19 | Owner approved the wording C1–C6 (recorded on PR #59); applied and tested (§12) |
| 1.0 | 2026-11-19 | First draft |
| 1.1 | 2026-11-19 | Peer review: 5 blocking and 6 non-blocking findings; all blocking adopted, non-blocking adopted or answered (§10) |
| 1.2 | 2026-11-19 | Code review of PR #59: 3 actionable fixed, 7 nitpicks fixed or answered (§11) |

## 1. Owner decisions this note implements

- **D2 (approved).** Add a nullable `rewards.icon_key` column using the next free migration number. Validate saved values against exactly the 71 approved Phosphor Duotone icons. Preserve existing images, emoji, costs, assignments and redemption history. Never auto-assign an icon. Parents choose or change one in Add/Edit. The column is not mandatory, and `emoji` is not repurposed.
- **D3.** No automatic replacement of existing reward artwork.
- **D5.** A child's choice is a request (the reward stack); only a parent's confirmation spends points.
- **D7 (price threshold rejected).** A reward is never a "bigger reward" because of its cost. Explicit designation needs a stored field, and that belongs with the savings design (D1). **The "Bigger rewards" section is therefore not built in V1-D.** It arrives with the approved D1 design.

## 2. Data contract (migration 015)

- **Number.** 015. 013 is reserved by the unmerged `feat/batch-c-pr5-recoverable-account-deletion` (`013_recoverable_family_deletion.sql`), and 014 is Today's Goals.
- **`015_reward_icon_key.sql`:**
  - `ALTER TABLE rewards ADD COLUMN IF NOT EXISTS icon_key TEXT NULL`.
  - Then `CHECK (icon_key IS NULL OR icon_key IN (<the 71 asset ids>))`, under the named constraint `rewards_icon_key_approved`.
  - **No UPDATE** of any row. The schema itself enforces the set, so a bypass of the route (a bug, a hand-written SQL fix) cannot store an unapproved value.
- **Stored value.** The register's canonical asset id, for example `phosphor:game-controller:duotone`. "Canonical identity: asset_id" is an owner-approved UX choice.
- **Server.**
  - `icon_key` joins `COLUMN_WHITELIST.rewards`.
  - `validateCreatePayload('rewards')` accepts `undefined` (no change), `null` (clear) or one of the 71 ids.
  - Anything else gets **400 "Choose an icon from the list."**. That is new error copy, owner item C4.
  - The set lives in `server/rewardIcons.js`.
- **One source, three copies, one test.**
  - The register's `picker.categories`;
  - `server/rewardIcons.js` (the Set);
  - `src/lib/rewardPicker.js` (categories, labels, aliases, accents);
  - the SQL CHECK list.
  - `src/test/rewardPicker.test.js` asserts that all four are equal: the same 71 ids and the same 84 placements in the same order.
- **Legacy rows.** `icon_key` stays NULL, and every existing field is unchanged. Display precedence everywhere is `image_url`, then `icon_key`, then `emoji`, then the gift icon (`RewardIcon`).
- **Priced stack.** `reward_stack_priced` items gain `icon_key`, `emoji` and `image_url`, so Home's Working towards draws the reward's own icon instead of a generic gift.

## 3. Icon assets

- The generator `scripts/brand/build-approved-icons.mjs` gains a `picker` context, so `APPROVED_CONTEXTS.picker` holds the 84 placements.
- The 63 icons without an upstream record are fetched from the pinned Phosphor commit `2b75f3a…` and compared by SHA-256. They are appended to `design/brand/UPSTREAM_VERIFICATION.json` (version bump). The existing E03 test, "every icon equals its source file, which equals the recorded upstream fetch", then covers all 71.
- Phosphor is MIT. No Streamline art goes in the picker (register `parent_picker_launch_source_policy`).

## 4. UI

### 4.1 Reward catalogue (`pages/Rewards.jsx`)
- "Rewards" and "Choose little treats and bigger adventures together.".
- The card "Your reward catalogue" holds the "New reward" button, "For the whole family or selected children. You control what children can see." and the filter chips "All rewards" / "Visible" / "Hidden" (`aria-pressed`).
- The tile grid has 2 columns on phones.
- Each tile shows:
  - the `RewardIcon`;
  - the title;
  - "{N} point(s)". **No subtitles** ("Weekly treat" and the like have no column; plan §8.4);
  - the tag "Visible to children" / "Hidden from children";
  - "Edit" (accessible name "Edit {title}").
- The card ends with "View child reward choices", a link to Child View.
- **Not built:** "Bigger rewards" (D7, waiting for D1). The design-only note "The catalogue uses original approved Streamline…" never ships (§8.6).
- **Retained:**
  - The empty state, "Start with screen time" (first-run E2E).
  - The visibility switch, moved into the form: the approved tag is not a control.
  - Assignment to children.
  - Description (optional, existing copy).
  - Delete with its confirmation (existing).

### 4.2 Reward form (`components/rewards/RewardForm.jsx`, replaces `AddRewardModal` and `EditRewardModal`)
- **Title:** "Create or edit reward" (approved, verbatim) and "Name the reward, choose its points cost and select an icon from the approved library.". Both are owner item C1 (wording check), because they read as review text.
- **Section 1, "The reward" ("Set the name and point cost."):**
  - "Reward name" with the placeholder "e.g. Choose a movie";
  - "Points needed";
  - the selected-icon row: icon, label, "Selected reward icon", and "Hide"/"Change", which toggles section 2.
- **Retained fields after these:**
  - "Description (optional)";
  - "Visible to children" as a switch;
  - "Assign to Children" with "Leave unchecked to make available to all children" (existing copy).
- **Section 2, "Choose an icon":**
  - The approved subtitle "Approved Phosphor icons · 12 categories · 71 unique choices" is treated as a design-review note and **not shipped**. Owner item C2.
  - "Find an icon" (search, with the placeholder "Search (e.g. movie, cake, games)").
  - 12 category chips, scrollable, `aria-pressed`.
  - The count: "{n} icons in {category}" or "{n} icons match your search".
  - The grid of tiles: each has the icon and the label, `aria-pressed`, and an accessible name equal to the label.
  - With no results: "No matching icons. Try a different word.".
- **Footer:** Cancel / "Save reward".
- **Search (approved code `pickerItems`):**
  - The term is lowercased and trimmed.
  - An icon matches when `id.replace(/-/g,' ') + ' ' + aliases[id]` contains the term.
  - The 12 categories are walked in approved order, and each icon is listed once (de-duplicated by asset id).
  - An empty term shows the current category.
- **Labels:** `pickerLabel` title-cases the id ("Game Controller").
- **Grid columns** follow the container width, not the viewport: below 520 px, 3; from 520 to 759 px, 5; from 760 px, 6 (`columnsForWidth`, a `ResizeObserver` on the grid's container). Each tile is at least 44 px.
- **Category accent:** the owner-approved mapping (purple / orange / sunshine) as a 4 px decorative bar on each tile (`bg-primary` / `bg-sunrise` / `bg-star`). The icon itself is always `text-primary` on white, so the meaning never depends on colour.
- **Defaults:**
  - New reward: the gift icon (`phosphor:gift:duotone`) is preselected, matching today's default 🎁. The emoji is still sent, so legacy clients keep working.
  - Starter template: title, cost and description as today; icon gift.
  - Editing a legacy reward: no icon selected. The selected-icon row shows the reward's current emoji or image with the label "Current icon" (new copy, owner item C3), until the parent picks one.
- **Payload:** `icon_key` is sent only when the parent picked or changed an icon. Saving a legacy reward without touching the picker leaves `icon_key` NULL (test F4).
- **Image uploads:** none at launch (owner UX choice). Existing `image_url` values are shown and kept, never removed.

### 4.3 Parent confirmation of requests (D5)
- **Where:** the Home "Rewards" dialog (`SpendRewardsModal`, per child). A new top section lists the child's pending requests (their reward stack, priced by the server).
- **Each row:** the icon, the title, the cost, and "Not now" (removes the item: `DELETE /stack/:index`, with the index taken from the server's stack order).
- **One primary button:** "Agree to {n} reward(s)" (`POST /stack/confirm`, idempotent `request_id`). It is the only path that spends requested points. Then comes the toast, with Undo through the existing redemption undo.
- **The existing parent direct-redeem list** stays below, unchanged (plan §8.7).
- **Copy (owner item C5, none of it exists in the approved HTML):**
  - the section heading "{Name} asked for";
  - the button "Not now";
  - the primary button "Agree to {n} reward(s)";
  - the empty state: none (the section is hidden when there are no requests);
  - the success toast "{Name} can enjoy {n} reward(s)." with Undo.
  - **The strings live in one module (`src/lib/rewardCopy.js`) so the owner's wording can replace them in one place.**
- **Child-side "Add to stack"** is V1-B (Child View). Until then, requests reach the stack only through the existing API, and the parent section is tested with seeded stacks.

## 5. Code paths touched (enumeration)

| Contract | Paths |
| --- | --- |
| Reward create/update | Generic `POST/PUT /api/:entity` (`validateCreatePayload`, `pickAllowedColumns`); export (`server/export.js`: is `icon_key` included? It must be, and is tested); family report PDF (reward title only, unaffected) |
| Reward display | `RewardCard` (parent and child), `SpendRewardsModal`, `ChildView`, Home `WorkingTowards`, Activity (title only) |
| Stack | `stack/add`, `stack/:index`, `stack/confirm`, `pricedStack` (shape gains the icon fields), `withBalances` |
| Delete reward | Pending redemptions are denied (unchanged). A stacked deleted reward drops from the priced stack (V1-A) |

## 6. Edge cases (input → expected)

| # | Input | Expected |
| --- | --- | --- |
| S1 | `POST /api/rewards` with `icon_key: "phosphor:gift:duotone"` | 201; stored; returned |
| S2 | `icon_key: "phosphor:gear:duotone"` (an approved UI icon, not in the picker) | 400; nothing stored |
| S3 | `icon_key: "gift"` (the bare id), `""`, `42`, `["phosphor:gift:duotone"]` | 400 each |
| S4 | `PUT` with `icon_key: null` | Clears it; the emoji fallback renders |
| S5 | `PUT` without `icon_key` on a legacy row | `icon_key` stays NULL; emoji, image, cost and assignment unchanged |
| S6 | A direct SQL `UPDATE rewards SET icon_key='x'` | Rejected by `rewards_icon_key_approved` |
| S7 | Migration on a database holding legacy rewards and redemptions | Row counts and every existing column value identical before and after; `icon_key` NULL |
| S8 | Another family's reward id in `PUT` | 404 (unchanged ownership check) |
| S9 | `icon_key` on `/api/children` or `/api/point_events` payloads | Dropped by the whitelist |
| P1 | Search "bike" | Bicycle, once (alias), although it sits in two categories |
| P2 | Search "movie" | Film Slate (alias) and Ticket (alias "outing show cinema day out" has no "movie"; so **Film Slate only**) |
| P3 | Search "  CAKE " | Cake, once |
| P4 | Search "zzz" | "No matching icons. Try a different word." |
| P5 | Category "Tech & media" | 4 icons, "4 icons in Tech & media" |
| P6 | Grid container 519 / 520 / 759 / 760 px | 3 / 5 / 5 / 6 columns |
| F1 | Create with the default icon | `icon_key` gift, emoji 🎁 |
| F2 | Edit legacy 🍕, pick Pizza | `icon_key` pizza; emoji 🍕 kept |
| F3 | Edit a reward with an `image_url`, pick an icon | `icon_key` set; `image_url` kept and still shown first (precedence) |
| F4 | Edit legacy, change only the title | Payload has no `icon_key` |
| C1 | A child stacks 2 rewards; the parent presses "Not now" on one, then "Agree to 1 reward" | One redemption; points deducted once; the stack is empty |
| C2 | "Agree" double-tapped | One confirm (the same `request_id` is replayed) |
| C3 | Balance below the stack total (points spent elsewhere) | The server refuses ("Not enough points for stacked rewards"); shown inline; nothing spent |

**Abuse cases.**
- An arbitrary `icon_key` is blocked twice: by the route and by the CHECK.
- No SVG markup is accepted from clients. Icons render only from the generated module by id, so `icon_key` can never inject markup.
- Confirmation keeps the existing family ownership check, row lock and idempotency.

## 7. Test plan

- **Server (`server/test/v1-rewards.test.js`):**
  - S1–S9;
  - S6 by direct SQL;
  - S7 by a migration test: a legacy fixture is inserted, the migration is re-run, and a snapshot is compared;
  - C1–C3 through the stack routes;
  - the priced stack carries the icon fields;
  - the export includes `icon_key`.
- **Shared (`src/test/rewardPicker.test.js`):**
  - the register, the server Set, the client module and the migration CHECK list agree (71 ids, 84 placements);
  - every picker id has an icon in the generated module;
  - the upstream record covers all 71.
- **Client render:**
  - picker P1–P6 (`columnsForWidth` as a pure function);
  - RewardForm F1–F4 and copy;
  - the catalogue filters and tiles;
  - the confirm section C1/C2 with the API mocked;
  - `RewardIcon` precedence.
- **Copy rule:** the §8.6 scan gains "Approved Phosphor icons" and "The catalogue uses original approved Streamline".
- **E2E:**
  - rewards page and dialogs: create with an icon, edit legacy, filters;
  - axe and 44 px at 4 projects;
  - a request confirmed from the Home Rewards dialog, with a seeded stack.
- **Evidence:** reference vs React at 390/834/1280 for `rewards` and `rewardform`.
- **One class not covered:** keyboard arrow-key navigation inside the icon grid (Tab works; a roving tabindex is not built). The 71 tiles plus 12 chips mean many Tab stops; recorded as a known limitation.

## 8. Rollout and reversal

- Migration 015 is additive. Reversal is `ALTER TABLE rewards DROP COLUMN icon_key` (a down script is kept in the note, not run automatically). The only data lost would be icons parents chose after release.
- The UI change reverts with the PR. The emoji fallback keeps legacy rendering at every step.

## 9. Owner items raised by this note

| # | Item |
| --- | --- |
| C1 | The approved form title "Create or edit reward" and its subtitle are shipped verbatim; confirm, or give a wording |
| C2 | The picker subtitle "Approved Phosphor icons · 12 categories · 71 unique choices" is not shipped (it reads as review text); confirm |
| C3 | "Current icon" for a legacy reward's existing emoji or image in the form |
| C4 | Error: "Choose an icon from the list." |
| C5 | Parent confirmation strings (§4.3) |
| D1/D7 | The savings ledger with explicit bigger-goal designation: a separate design, to be brought for approval |

## 10. Amendments in v1.1 (peer review; these supersede §2, §4 and §6 where they conflict)

| # | Finding | Ruling |
| --- | --- | --- |
| R1 | **Blocking.** Preselecting the gift icon is an automatic assignment (D2) and would hide template emoji | **Adopted.** New and template rewards start with `icon_key` NULL. The selected-icon row shows the emoji fallback with "Current icon" (C3). Only a tile tap sets `icon_key`. F1 becomes: `icon_key` null, with the default or template emoji |
| R2 | **Blocking.** The precedence in the note and the code disagreed; under `image_url` first, a parent's choice on an image reward would be invisible | **Adopted.** Display is `icon_key`, then `image_url`, then `emoji`, then gift. The image stays stored and shows whenever `icon_key` is NULL. F3: the icon shows; the image is kept |
| R3 | **Blocking.** Undo after "Agree" had no ids | **Adopted in part.** `stack/confirm` returns `redemption_ids`, and the replay returns the same ids. The toast after "Agree" has **no Undo**; each redemption is undone one at a time in Activity (the existing per-redemption undo), so a partial batch failure cannot arise. Owner item C5's toast loses its Undo |
| R4 | **Blocking.** Confirm charged the stack as stored at commit, not what the parent saw | **Adopted.** `stack/confirm` requires `expected: [{reward_id, stack_index}]`: the priced items in stack order, at least one. It is part of the idempotency arguments. Any difference gives 409 and nothing is charged (test C5). The toast count comes from the server's `confirmed_count` |
| R5 | **Blocking.** The "Not now" contract was undocumented and its guard optional | **Adopted.** `DELETE /stack/:index?reward_id=<uuid>` is **required** (400 without it; 409 when the stored item differs). Priced items carry `stackIndex`, their position in the stored stack. `stack/add` answers with the stored stack, so its positions are the stack indexes. Test C4: [deleted, Keep, Drop] gives `stackIndex` 1 and 2; a stale remove gives 409 |
| R6 | Migration 015 was not re-runnable | **Adopted.** `DROP CONSTRAINT IF EXISTS` comes before `ADD`. Test: running 015 twice leaves exactly one constraint |
| R7 | Missed callers | **Adopted.** First-run and ui E2E selectors are updated. The template browser ("Browse Reward Ideas") is **not** in the approved form and is removed; the first-run "Start with screen time" prefill stays. `SpendRewardsModal` decides affordability from `available_points`. Child View still redeems directly until V1-B (D5); recorded, not changed here |
| R8 | Copy | **Adopted.** Invalid icons get the shipped "Choose one of the icons shown" with 422, the same as behaviour icons (C4 withdrawn). The count is singular for 1 ("1 icon matches your search" / "1 icon in Outings"), a grammar variant of approved copy (owner item C6). A blank search shows the category. Disclosure defaults as approved: a new reward opens the picker; editing starts closed ("Change") |
| R9 | Tests | **Adopted.** The CHECK list is compared with the register, not with `REWARD_ICON_KEYS`. P2 expects Film Slate only |
| R10 | Accent in search results | **Adopted.** In a category, that category's accent; in search results, the icon's first category in approved order (fish: sunshine, from Nature & outdoors) |
| R11 | Simpler options | **Container query adopted.** The approved CSS `container-type: inline-size` with `@container` 520/760 goes in `index.css`; `ResizeObserver` and `columnsForWidth` are dropped, and E2E measures the columns. **Generator kept:** `APPROVED_CONTEXTS.picker` holds arrays per category, so the 84 placements with duplicates fit |

**Server-side changes landed with this amendment:**
- the generic create/update routes now pass a validation 422 through (they passed only 400);
- the stack and confirm contracts above;
- 202/202 server tests pass.

## 11. Code review record (PR #59, v1.2)

| # | Finding | Ruling |
| --- | --- | --- |
| A1 | **Major.** Confirm checked ids and positions, not prices. A reward repriced while the dialog was open was charged at the new price (the reviewer's probe: shown 5, charged 60) | **Fixed.** `expected` items carry `cost`, which is in the idempotency arguments and the comparison. A repriced reward gives 409 and nothing is charged. Test C6, mutation-checked |
| A2 | A failed reward delete was silent, with an unhandled rejection | **Fixed.** Caught; toast "Couldn't delete the reward." (existing wording pattern); the form stays open |
| A3 | The out-of-range 400 branch on stack remove could not be reached | **Fixed.** Out of range or a different reward gives one 409 (a stale view); the dead branch is removed. Test in C6 |
| N1 | A 409 on Agree changed the list without a word | **Fixed.** Toast "The requests changed. Check them again.", added to owner item C5 |
| N2 | "Not now" errors said "redeem" | **Fixed.** Uses the shipped "Couldn't update points. Please try again." |
| N3 | A stack holding only deleted rewards cannot be cleared by confirm | **Answered.** Harmless: those items are never shown or charged, and available points ignore them. `stack/add` compacts them away. A sweep on reward delete belongs with D1's reward-removal handling |
| N4 | Visible/Hidden filters with no matches show an empty grid | **Answered.** An empty-state line needs new copy; listed for the owner with C1–C6 |
| N5 | Assigned-children badges are gone from the catalogue | **Answered.** The approved tile has none; assignment is visible and editable in the form |
| N6 | Dead code | **Fixed.** `RewardCard` removed (its axe check now covers the catalogue tile and the picker); `isPickerIcon` removed. The `book-open-text` alias is kept verbatim from the approved HTML (it matches nothing and is harmless) |
| N7 | The picker opened on Fun & games when editing an icon from another category; Hide/Change had no `aria-controls` | **Fixed.** It opens on the chosen icon's category (test); `aria-controls` added. The one-frame reset flash on reopen is not fixed (cosmetic) |

## 12. Owner-approved wording (2026-11-19)

**This section supersedes every earlier wording in this note** (§4 and §10–§11 mention "Create or edit reward", the library description, "Not now" and "Agree to {n} reward(s)"; they are history).

Post-build code review of the wording commit: C4's full stop added; the total is the Approve button's description (`aria-describedby`) and is announced when it changes; C3 follows RewardIcon's precedence for an unknown icon key; a template still says "Add reward" (test).

| Item | Approved wording | Where |
| --- | --- | --- |
| C1 | "Add reward" (new, including from a template) / "Edit reward" (existing); description "Name the reward, set its points cost and choose an icon." | `RewardForm` |
| C2 | No technical Phosphor / 71-icon subtitle (the old description naming the "approved library" is replaced by C1) | `RewardForm` |
| C3 | "Current image" for a reward with a photo and no picker icon; otherwise "Current icon" (icon, emoji or the gift) | `currentArtLabel` |
| C4 | "Choose one of the icons shown." (full stop added, as approved; shared with behaviour icons) | server 422 |
| C5 | "{Name} asked for"; "Not this time" (removes the request, spends nothing); "Approve 1 reward" / "Approve N rewards"; total "This will spend {total} point(s) from {Name}'s balance."; "The requests changed. Check them again." | `REQUEST_COPY`, `SpendRewardsModal` |
| C6 | "1 icon matches your search" (unchanged); "No rewards match this filter." | `RewardPicker`, `Rewards` |

The total is the sum of the same priced items the confirmation sends (`expected` with each reward's id, position and cost). A change in price or requests gets a 409 and the parent sees them again; nothing is charged at a different amount (test C6, unchanged since PR #59's review).

