# D1 design: savings for bigger goals (allocation ledger) and explicit bigger-goal designation (D7)

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering. **Approval of the database change: the owner** (D1 needs approval before any migration) |
| Status | Draft, for fresh-context peer review, then owner approval. **Nothing in this note is built** |
| Binding inputs | Approved HTML blob `9de1df2`: Home "Saving for something bigger / 120 of 300 points saved / 180 to go"; Children "Saving for something bigger" with Edit, "Saved: 120", "300 points · Bigger achievement"; Child View "90 Ready to use / 120 Saved towards New bike / My next big adventure / 180 points to go"; its own note that the "savings/weekly-pool transfer … is a visual concept until its authorised ledger contract is implemented". Owner direction (2026-11-19): include the real ledger in V1; **D7: bigger goals by explicit designation, never by price**. Plan v1.1 §8.3 (do not reuse `family_goals` or `/contribute`) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-19 | First draft |

## 1. What it must do

- **Three pools per child,** all derived from `children.total_points`:
  - **Available now**, the weekly pool: free to spend or request.
  - **Set aside for requests**: the reward stack (exists today, D5).
  - **Saved towards each bigger goal**: new.
- A point is in exactly one pool, and the three always add up to `total_points`.
- **Moving points never creates or destroys them.** It changes the pool, not the total.
- A parent marks a reward as a **bigger goal**. Points are saved towards that reward for a given child.
- When the goal is redeemed (parent-confirmed, D5), its saved points pay for it first.
- Every move is recorded, can be explained, and survives a lost reply (it is idempotent).

## 2. Data (migration 016, after 015)

```sql
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS is_bigger_goal BOOLEAN NOT NULL DEFAULT false;  -- D7

CREATE TABLE savings_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT NOT NULL,
  child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  reward_id    UUID NOT NULL,          -- no FK: history outlives a deleted reward
  reward_title TEXT NOT NULL,          -- as it was, for history
  delta        INTEGER NOT NULL CHECK (delta <> 0),
  kind         TEXT NOT NULL CHECK (kind IN ('save','release','spend','reward_removed','undo')),
  request_id   UUID NOT NULL,
  undoes       UUID NULL REFERENCES savings_events(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_code, request_id),
  UNIQUE (undoes)                     -- an event is undone at most once
);
CREATE INDEX savings_events_child ON savings_events (family_code, child_id, reward_id);
```

- **Append-only:** no UPDATE or DELETE except the cascade when a child is deleted, which matches `point_events`.
- **Saved towards a goal:** `saved(child, reward) = SUM(delta)` for that pair. **Saved in total:** `saved_total(child) = SUM(delta)` for the child.
- **No cached balance column.** The sums are read under the child row lock, as `pricedStack` is today. One indexed query covers a family (the V1-A one-query rule).
- **Existing data:** no rewards become bigger goals and no savings exist. Nothing is backfilled or inferred (D3/D7).

## 3. Invariants (enforced in one server function, `savingsCheck`, under `SELECT … FOR UPDATE` on the child)

| # | Invariant |
| --- | --- |
| I1 | `saved(child, reward) ≥ 0` for every pair |
| I2 | `stack_reserved + saved_total ≤ total_points` |
| I3 | `available_points = total_points − stack_reserved − saved_total`, so `≥ 0` by I2 (V1-A's `available_points` gains `− saved_total`) |
| I4 | A `save` is accepted only when the reward is a bigger goal and is spendable for this child (same family; assigned to all or to this child) |
| I5 | `total_points` changes only through awards, spends, redemptions and their undos, never through `save`, `release` or `reward_removed` |

## 4. Operations (all parent-operated, idempotent `request_id`, family-scoped, child-locked)

| Endpoint | Effect | Refused when |
| --- | --- | --- |
| `POST /api/children/:id/savings/save {reward_id, points, request_id}` | `save +points` | points not a whole number in 1..available (I2/I3); I4 fails |
| `POST /api/children/:id/savings/release {reward_id, points, request_id}` | `release −points` | points > saved(child, reward) (I1) |
| `POST /api/savings-events/:id/undo {request_id}` | the opposite delta, `kind 'undo'` | older than 10 minutes (as other undos); already undone; the result would break I1 or I2 |
| Redeem a bigger goal (existing `redeem` and `stack/confirm`) | pays `min(saved, cost)` from savings (`spend −min`) and the rest from available, in the same transaction as the redemption | `saved + available < cost` |
| Undo of that redemption (existing) | restores points, and writes `undo +min` so the savings come back | (the existing rules) |
| Reward deleted, un-designated or no longer assigned to the child | `reward_removed −saved` per child, in the same transaction, so the points return to available | (never refused) |
| Award undo (existing `reverseAward`) | the existing reservation check counts `stack_reserved + saved_total` | it would break I2 (the existing `SPENT_ALREADY` 409) |

- **Who may move points.** In V1 only a parent (the Children page "Saving for something bigger" Edit).
- **Child View shows savings but moves nothing.** That matches D5 ("only a parent-authorised confirmation can spend points") and the approved Child View, which has no transfer control.
- Whether a child may *ask* to save is an owner question (O3), the same shape as a reward request.

## 5. Surfaces

- **Home "What you're working towards".** For each bigger goal the child is saving for: "Saving for something bigger", the goal, "{saved} of {cost} points saved", "{cost − saved} to go", and a progress bar. Requested rewards stay listed as in V1-A.
- **Children page "Saving for something bigger" Edit.** Choose a bigger goal, then "Save N points" or "Move N back" with the amounts limited by I1–I3, an Undo toast, and "Saved: N".
- **Child View.** "Ready to use" is `available_points`. "Saved towards {goal}", "My next big adventure" and "{n} points to go".
- **Rewards catalogue: "Bigger rewards" section (D7).** It lists rewards with `is_bigger_goal`. The reward form gets a "Bigger goal" switch.
- **Activity.** Savings moves are shown as non-balance rows: total points don't change. Shape and copy are an owner item.
- **Export** includes `savings_events`.
- **Copy.** Every new string is an owner item (O4). The approved strings above ship verbatim.

## 6. Edge cases (input → expected)

| # | Input | Expected |
| --- | --- | --- |
| E1 | total 100, stack 20, save 81 | 409; nothing saved (I2) |
| E2 | save 80, then a reward request costing 1 | `stack/add` refused "Not enough points" (I2 counts savings) |
| E3 | saved 50 towards a 300 goal; the parent deletes the reward | `reward_removed −50`; available +50; the history keeps the title |
| E4 | the reward is reassigned to a sibling only | the same as E3, for the child who lost access |
| E5 | goal costs 300; saved 120; available 200; redeem | savings −120, available −180, one redemption of 300 |
| E6 | undo that redemption | total +300, savings `undo +120`, available +180 |
| E7 | an award of 50, then save 50, then undo the award | 409 `SPENT_ALREADY` (I2); the parent first moves the points back |
| E8 | the same `request_id` twice (lost reply) | one event; the replay returns the original |
| E9 | the same `request_id` on another endpoint or child | 409 (the existing `idempotency_keys` claim rule) |
| E10 | two saves race for the last points | one wins; the other is refused under the row lock |
| E11 | a cost later raised above `saved + available` | the goal shows "{n} to go"; nothing is lost |
| E12 | the cost lowered below saved | "to go" shows 0. Redeem uses only `cost`; the excess stays saved until moved back (never auto-moved) |
| E13 | the child is deleted | events cascade with the child, like `point_events` |
| E14 | another family's child or reward | 404 |

## 7. Test plan

- **Server:**
  - E1–E14;
  - I1–I5 as a property test: random sequences of award, save, release, request, confirm, redeem, undo and delete reward, after which the invariants hold and `total_points` equals the history total;
  - concurrency (parallel saves, save racing confirm);
  - replay (lost reply);
  - cross-family checks;
  - the migration on legacy data (nothing changed, no savings, no goals).
- **Client:** render tests for Home, Children and Child View figures (from the server only), and the Edit flow's limits.
- **E2E:** save, move back and Undo on the Children page; a redeemed bigger goal; axe.
- **One class not covered:** clock skew around the 10-minute undo window between app servers (the undo window is server-time based, as today).

## 8. Rollout and reversal

- 016 is additive.
- **Reversal:** drop `savings_events` and the column. The only loss is savings moves made after release. Points are never lost, because `total_points` is untouched by savings, so dropping the table returns every saved point to available.
- **Delivery:** its own PR, "V1-H Savings", after V1-D. It touches V1-A (Home figures), V1-B (Children, Child View) and V1-D (the Bigger rewards section and the form switch).

## 9. Owner questions

| # | Question | Engineering recommendation |
| --- | --- | --- |
| O1 | Approve migration 016 (`rewards.is_bigger_goal`, `savings_events`) | Yes: additive, append-only, reversible without point loss |
| O2 | Only a parent moves points in V1 | Yes (D5) |
| O3 | May a child ask to save (a request a parent approves)? | After launch |
| O4 | Copy for: "Save N points", "Move N back", the "Bigger goal" switch, the Activity rows, the error messages | Engineering proposes; the owner approves |
| O5 | Can a child save towards more than one bigger goal at once? | Yes. The design supports several; Home shows the one with the most saved |
