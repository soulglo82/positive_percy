# D1 design: savings for bigger goals (allocation ledger) and explicit bigger-goal designation (D7)

| Field | Value |
| --- | --- |
| Version | 1.4 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering. **Approval of the database change: the owner** (D1 needs approval before any migration) |
| Status | **Approved in principle by the owner (2026-11-19, issue #56)**, subject to the data-preservation proof in §11. Step 1 is built: migration 016, its rollback, and the reconciliation proof. The savings endpoints and screens are not built yet |
| Binding inputs | Approved HTML blob `9de1df2`: Home "Saving for something bigger / 120 of 300 points saved / 180 to go"; Children "Saving for something bigger" with Edit, "Saved: 120", "300 points · Bigger achievement"; Child View "90 Ready to use / 120 Saved towards New bike / My next big adventure / 180 points to go"; its own note that the "savings/weekly-pool transfer … is a visual concept until its authorised ledger contract is implemented". Owner direction (2026-11-19): include the real ledger in V1; **D7: bigger goals by explicit designation, never by price**. Plan v1.1 §8.3 (do not reuse `family_goals` or `/contribute`) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-19 | First draft |
| 1.1 | 2026-11-19 | Peer review: 5 blocking and 7 non-blocking findings, all adopted (§10) |
| 1.4 | 2026-11-19 | Owner review of PR #60 (head `a11e890`): synthetic proof accepted as a credible fixture proof, not as sign-off to ship 016. **O6 reversed**: savings never revive (allocation generations, §13). The scratch rollback refuses once savings exist; a marked-copy token proves the target is a copy (§13) |
| 1.3 | 2026-11-19 | Adversarial review of the proof: 2 blocking (read path counted a requested goal twice and let a negative sum add points; write paths ignored savings) and 5 non-blocking, all fixed (§12) |
| 1.2 | 2026-11-19 | Owner's data-preservation requirements; legacy `family_goals` inspected; migration 016, its rollback and the reconciliation proof built and passing (§11) |

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

## 10. Amendments in v1.1 (peer review; these supersede §2–§8 where they conflict)

**Writers that must run the savings check** (listed from the code by the reviewer): `stack/add`, redeem, `stack/confirm`, `reverseAward` (so also Today's Goals undo), and redemption undo. Award, Today's Goals completion and stack remove only add points or free them.

| # | Finding | Ruling |
| --- | --- | --- |
| B1 | **Blocking.** A goal that is both saved for and requested would be counted twice | **A bigger goal cannot be requested through the reward stack.** `stack/add` refuses it. It is redeemed only by a parent, through "Redeem" on the Children page goal, and only when `saved + available ≥ cost`. There is no double reservation and no stack-path savings rule. Child View shows "Saved towards" and "to go" for it, not a request button |
| B2 | **Blocking.** One request id cannot cover several derived events, and nothing links a `spend` to its redemption | `savings_events.request_id` is **nullable**, unique per family only when set. `save`, `release` and their undos carry it, claimed through `idempotency_keys` (the existing `priorRequest`/`rememberRequest`, extended beyond `point_events`). Derived events (`spend`, `undo` of a spend) have no request id and carry `redemption_id UUID REFERENCES redemptions(id)`. Redemption undo finds its `spend` through that |
| B3 | **Blocking.** An undo could restore savings to a goal that no longer qualifies | Redemption undo restores savings **only if** the reward is still a spendable bigger goal for that child; otherwise the points return to available. The savings undo endpoint undoes only `save` and `release`, with the same I4 check; `spend`, `reward_removed` and `undo` cannot be undone |
| B4 | **Blocking.** I2 is not a stored invariant: a cost rise breaks it without any write | I2 is restated as a **write-time rule**: every write that lowers available points checks `stack + saved ≤ total` under the child lock. Reads clamp `available_points` at 0, as today. When the clamp applies, Home and Child View show 0 available; requests stay pending; and confirm re-checks (and refuses with the existing message). A property test asserts the write-time rule, not a stored one |
| B5 | **Blocking.** Lock ordering and deadlock risk from multi-child `reward_removed` writes | **Read-time filtering instead of writes.** A child's *effective* savings count only rewards that still exist, are bigger goals and are spendable for that child (the same filter as `pricedStack`). Deleting, un-designating or reassigning a reward writes **no** savings rows and locks no children. On that child's next locked savings write, the stale savings are swept with a `reward_removed` event (inside the single child lock). `save` locks the child first, then reads the reward. Cost: if a parent re-designates a goal before any sweep, its old savings reappear; that is the owner's call (O6) |
| N6 | Several routes return child rows without `available_points` | Every child response goes through `withBalances`: redeem, confirm, redemption undo, `reverseAward`, replays. It gains `saved_total` and `goals[]` ({reward, saved, cost, to_go}). Still one savings query per family read; a test counts the queries |
| N7 | Gaps against the screens | Home shows the **selected child's** goal with the most saved. Children: "{cost} points · Bigger achievement" for goals (approved wording); "Next milestone: Weekly target and bigger goal" with the weekly points still to go and the goal's "to go". Child View lists a goal only if it is visible to children. `is_bigger_goal` joins the rewards whitelist. **Plan §8.4's D7 price rule is superseded** by the owner's direction (explicit designation) |
| N8 | Cost lowered below saved left an orphan excess | On redeem, the excess over cost is released in the same transaction (`release`, linked to the redemption) |
| N9 | Schema details | `CREATE TABLE IF NOT EXISTS`. Index `(family_code, child_id) INCLUDE (reward_id, delta)`. Family scope for `reward_id` is enforced in code (no FK, so history outlives a deleted reward). Savings go with the child by `ON DELETE CASCADE` (a test proves it). `savings_events` joins the export |
| N10 | No cached balance | Kept. A grouped SUM, tested as one query |
| N11 | The reversal statement was incomplete | Reversal is a **new forward migration (017)**, because `migrate.js` only goes forward. Server code is rolled back first. Bigger-goal designations are lost. No points are lost: savings never change `total_points`, and every `spend` was charged to it. A goal redeemed shortly before rollback and undone after it gets no savings back (harmless: the points go to available) |
| N12 | Simpler option for removal | Adopted as B5 |

**Owner questions added:**

| # | Question | Engineering recommendation |
| --- | --- | --- |
| O6 | If a parent un-marks a bigger goal and marks it again before the child's next savings change, should the old savings reappear? | Yes (the read-time filter gives this). The alternative needs multi-child writes on every reward edit |
| O7 | A bigger goal is redeemed by a parent from the Children page, not requested by the child (B1) | Yes |

## 11. Existing family data: what it holds, and the proof that 016 preserves it (v1.2)

### 11.1 Owner requirements (2026-11-19, issue #56) and their evidence

| Requirement | How it is met | Evidence |
| --- | --- | --- |
| Keep every child's points balance unchanged | 016 writes no row. It adds a column with a constant default and an empty table | `server/test/d1-migration.test.js` "016 changes nothing…": every child's `total_points`, `points_spent`, stored requests and history total are identical |
| Preserve rewards, requests, redemptions and activity | The same check covers every table that existed before 016: each row's every pre-existing column, by hash, plus row counts | The same test; `server/reconcile.js` |
| Preserve existing savings where they can be verified from records | **No verifiable child savings exist.** The only earlier "goal contribution" data is the legacy `family_goals` counter, which is not child savings (§11.2). It is left exactly as it is | The test "legacy family goals are left exactly as they were…" |
| New allocations without duplicating points | Savings are a separate pool inside `total_points`: available = total − set aside for requests − saved. Saving moves points between pools and never changes the total | The test "the key rule": +50 saved gives available −50; total, history and spent are unchanged; the database and the API agree |
| Never assume existing points are newly earned or allocated to a goal | 016 creates no savings rows and marks no goal; its own post-check refuses to finish otherwise | 016's `DO $$` post-check; the test asserts 0 savings and 0 goals |
| Test migration and rollback against a realistic copy | A realistic fixture (§11.3), plus a tool for a restored copy of real data (§11.4) | The test "rollback restores the exact pre-016 state; 016 then applies again cleanly"; the tool run in §11.4 |
| The key rule: moving 50 into a goal lowers available by 50, never the total | Read path: `withBalances` subtracts verified savings (towards rewards that are still goals for the child) | The test "the key rule". Un-marking the goal returns the 50 to available |

### 11.2 What legacy `family_goals` actually represent (inspected, not assumed)

- **The data.** A family-level counter: `title`, `target_points`, `current_points` and `status`, with **no `child_id`** (`server/db.js`, the `family_goals` table).
- **How it changed.** Two ways:
  - `POST /api/family-goals/:id/contribute` raises `current_points` by any number the parent typed, capped at the target, and marks the goal completed.
  - The generic create and update routes for `family_goals` can also set `current_points` and `status` (correction in v1.3: they are whitelisted in `server/columns.js`).
  - Neither touches a child.
  - It **never deducted any child's points**, wrote no `point_events` row, and recorded no child.
  - The removed screen (introduced in commit `9bf766e`, removed in `a746bb6`) offered a free number box, default 10.
- **Conclusion.** These counters are *not* points anyone saved: no child's balance went down when they rose. They **cannot be migrated as child savings without inventing them**.
- **What happens to them.** 016 leaves them untouched. They stay in the database, in the family export, and in the reconciliation fingerprint. Whether to show them as history, or offer a parent a way to start a real goal from one, is an owner decision (O8). No points move either way.
- **Plan §8.3 still holds:** the contribute endpoint is never reused.

### 11.3 The realistic fixture (`server/test/fixtures/legacyFamilies.js`)

Three families, built through the real API, plus direct SQL for shapes only older releases could write:
- several children, including one at 0 points and one with over 1,000;
- awards, an undone award and a same-week correction;
- a Today's Goal completion;
- spends that were completed, undone (Reversed), and legacy Pending and Denied;
- pending requests, including one for a reward since deleted and one for a reward reassigned to a sibling;
- rewards with an emoji, an image, a picker icon, hidden, and assigned to one child;
- legacy history and redemptions with no `family_code`;
- legacy family goals with contributions (active, completed, and a family that only ever used them).

The first test asserts that these shapes are really present, and that every child's history adds up to their balance (rule A2 C4) before 016.

### 11.4 Running the same proof on a copy of real data

- **The command:** `node scripts/d1-reconcile.mjs --database-url <restored copy> --i-confirm-this-is-a-copy`.
- **What it does:** fingerprint, apply 016, compare, roll back, compare, apply again, compare. It writes `d1-reconcile-report.json` and exits 1 on any change.
- **Guard rails:** it refuses to run without the copy flag, and refuses a copy that already has 016.
- **Engineering run (2026-11-19), on a pre-016 copy built from the fixture:**
  - "apply 016", "roll 016 back" and "apply 016 again" all ok;
  - 3 families, 4 children, 0 children with history drift;
  - legacy family goals: 3, all with contributions, 230 contributed in total, across 2 families.
- **Owner action (D2 item: production data access):** run it on a restored backup of production before 016 ships, or provide an anonymised copy for engineering to run it on.

### 11.5 The check can fail (counter-examples, each in a rolled-back transaction)

The test "the check catches: …" proves the reconciliation reports each of these:
- a changed balance;
- points auto-allocated to a goal;
- a reset family-goal contribution;
- a deleted history row;
- a dropped request;
- a rewritten redemption status.

### 11.6 Rollback

- **The script:** `server/rollbacks/016_savings_ledger_down.sql` drops only what 016 added. In production it is applied as the next forward migration, after the server code is rolled back. The new code reads the savings table, so it fails without it; the test hit exactly this and seeds before rolling back.
- **The proof:** after rollback, the fingerprint equals the pre-016 state exactly. Re-applying 016 is clean, and a second boot changes nothing.

### 11.7 What is built and what is not

- **Built:**
  - migration 016;
  - the rollback;
  - the reconciliation module, its tests and the copy tool;
  - the read path (`available_points` subtracts verified savings; children responses carry `saved_total` and `goals[]`).
- **Not built until the owner confirms this proof:** the savings endpoints (save, move back, undo), redeeming a goal from savings, the "Bigger goal" switch, and the Home, Children and Child View screens.

| # | Owner question (added) | Engineering recommendation |
| --- | --- | --- |
| O8 | Legacy family goals: leave them as stored data only, show them read-only as history, or offer "start a real goal from this"? | Leave them stored and exported only for V1; revisit after launch. They never held child points |

## 12. Adversarial review of the proof (v1.3)

- **The reviewer could not make the migration proof lie about data.** 016 writes no rows, and every change made to existing rows was caught.
- **The read path that ships with 016** (no write endpoint behind it yet) had two real bugs, and the write paths ignored savings. All are fixed, with one balance rule in one place (`balanceOf` / `balanceFor` in `server/routes.js`).

| # | Finding | Fix | Test |
| --- | --- | --- | --- |
| 1 | **Blocking.** A goal that was also requested was counted twice: shown 610, where 660 was right. A negative ledger sum *raised* available (shown 690) | Savings count only positive sums, and only towards a reward that is still a goal for the child. A goal that is also requested commits `max(stacked, saved)`, never the sum | "review: a goal that is also requested is counted once, and a negative sum never adds points"; the app and the SQL reconciliation compared after every ledger change |
| 2 | **Blocking.** The write paths ignored savings, so saved points could be spent twice | Request (`stack/add`), spend (`redeem`), award undo (`reverseAward`) and confirm all use the same committed figure as the read path. A bigger goal cannot be requested (B1). A reward that has savings cannot be spent or confirmed directly: it is redeemed through its goal (that flow comes with the feature) | "review: every write path respects savings" |
| 3 | The fingerprint did not cover the schema, or schemas other than `public`, or `schema_migrations`; `string_agg` over large uploads could reach Postgres's 1 GB limit | It now covers every non-system schema; every constraint, index, trigger, column type, default and nullability; and the migration records (016 the only allowed addition). Rows are hashed one by one, then combined | The rollback leaves no object behind. The rolled-back schema equals a database built from 001–015 that **never had 016** |
| 4 | Fixture gaps | Added: a NULL stack, an object-shaped stack, stack ids that are not UUIDs or are upper-case or belong to another family, NULL `points_spent`, a reward with no family code, an upload and a user. The app now treats a non-array stack as empty instead of failing | The fixture test asserts each shape is present |
| 5 | The copy tool's safety | It refuses Railway URLs and the app's own `DATABASE_URL`, and requires that 016 is the only pending migration. Rollback and record removal run in one transaction. It checks that 016's objects exist after re-apply and reports anything left behind | Run 2026-11-19 on the richer copy: every step ok; Railway URL refused (exit 2) |
| 6 | Tests compared values with their own source | The reconciliation now applies the same written savings rule in SQL (independently of the JavaScript), and the tests compare app and SQL after every ledger change. The fixture's hand-set starting points are a deliberate legacy shape (imported balances), not a check | (above) |
| 7 | The note said only contribute changed `family_goals` | Corrected in §11.2; the conclusion is unchanged | (none) |

## 13. Owner review of PR #60 and the O6 correction (v1.4)

### 13.1 Decisions as given (owner's recommendations; not each separately approved by the owner)

| # | Recommendation | Status in engineering |
| --- | --- | --- |
| O2 | Only parents move points in V1 | Planned |
| O4 | Wording: "Save points", "Move points back", "Bigger goal" (helper text "Save points towards this reward over time"); Activity "Saved N points towards X" / "Moved N points back from X" | Used as the proposed strings; the owner approves the final wording at screen review |
| **O6** | **Reversed: savings never revive.** Un-marking a goal, or taking it away from a child, ends that allocation for good. History is kept, and a re-marked goal starts at 0 | **Built** (§13.2) |
| O7 | Parents redeem bigger goals from the Children page | Planned |
| O8 | Legacy family goals stay stored and exported, never shown as child savings | As built (016 leaves them untouched) |

### 13.2 Allocation generations (replaces v1.1 B5's "savings reappear")

- **The generation.** A goal's generation for a child is `goal_epoch:child_epoch`.
  - `rewards.goal_epoch` and `rewards.goal_child_epochs` (a JSON map from child id to epoch) are new in 016, starting at 0.
  - A database trigger, `rewards_goal_generation` (`BEFORE UPDATE ON rewards`), owns them:
    - `goal_epoch` goes up by 1 whenever `is_bigger_goal` changes, in either direction;
    - a child's epoch goes up by 1 whenever an assignment change takes the reward away from that child.
  - Whatever an UPDATE writes to those columns is replaced, so generations only move forward, whichever code path or direct SQL changes the reward.
- **Savings rows** carry the `generation` they were written in. **Only rows of the current generation count**, in the app (`balanceOf`) and in the independent SQL reconciliation alike. Rows of earlier generations stay as history and never count again.
- **Delete and recreate** gives a new reward id, so nothing carries over.
- **No multi-child writes or locks.** Un-marking or reassigning updates one reward row. A save racing a goal edit can only be written in a generation that is no longer current, so it under-counts and returns points to available; it can never over-commit.
- **Refunds** (when the feature is built): undoing a goal redemption restores savings only as a row of the **current** generation, and only if the reward is still a goal for the child. Otherwise the points return to available.

**Tests** (`server/test/d1-migration.test.js`; removing the generation rule fails six of them):

| Test | What it shows |
| --- | --- |
| "O6, the owner's example" | 100 saved → un-mark → spend 80 → re-mark gives total 20, saved 0, available 20, and committed ≤ total |
| "reassigning away and back, and delete/recreate" | A child's savings don't come back. A sibling who kept access keeps theirs. A direct write cannot roll a generation back |
| "concurrent goal edits and saves never over-commit" | 10 rounds of a goal toggle racing a save |
| The key rule | Re-marking starts at 0, and the history row is kept |

### 13.3 Rollback after launch

- `server/rollbacks/016_savings_ledger_down.sql` is **scratch and pre-launch only**. It now **refuses to run once any savings exist** (tested).
- Reversing D1 after families have used savings needs a **separately approved archived or compensated reversal with audit evidence**: the ledger is kept, or exported and archived, and every allocation is compensated so points return to available, with a report. That procedure will be designed if ever needed. It is not this file.

### 13.4 Proving the target is a copy

- The owner noted that a URL check cannot prove the target is a copy, because a live database can have any hostname. So the tool (`scripts/d1-reconcile.mjs`) now requires `--copy-token <token>`.
- After restoring the backup, the operator writes that token into the **copy**, in a `percy_restore_marker` table along with the backup id. Production never has this table, so a mistaken connection is refused whatever its address.
- The Railway and `DATABASE_URL` refusals remain as extra guards. The report records `restored_from`.
- **Run 2026-11-19 on the synthetic copy:** refused without the marker (exit 1); with the marker, every step ok.

### 13.5 Next gate (owner)

1. Run the tool on a verified, isolated restoration of the production backup, with restricted credentials, and inspect its report: apply, rollback and re-apply, plus the history-drift baseline.
2. An independent review of the corrected O6 design (in progress).
3. Then the savings feature: endpoints, goal redemption, refunds, and the Home, Children and Child View screens.
