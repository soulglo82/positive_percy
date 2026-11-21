# D1 design: savings for bigger goals (allocation ledger) and explicit bigger-goal designation (D7)

| Field | Value |
| --- | --- |
| Version | 1.22 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering. **Approval of the database change: the owner** (D1 needs approval before any migration) |
| Status | **Approved in principle by the owner (2026-11-19, issue #56)**, subject to the data-preservation proof in §11. Step 1 is built: migration 016, its rollback, and the reconciliation proof. The savings endpoints and screens are not built yet |
| Binding inputs | Approved HTML blob `9de1df2`: Home "Saving for something bigger / 120 of 300 points saved / 180 to go"; Children "Saving for something bigger" with Edit, "Saved: 120", "300 points · Bigger achievement"; Child View "90 Ready to use / 120 Saved towards New bike / My next big adventure / 180 points to go"; its own note that the "savings/weekly-pool transfer … is a visual concept until its authorised ledger contract is implemented". Owner direction (2026-11-19): include the real ledger in V1; **D7: bigger goals by explicit designation, never by price**. Plan v1.1 §8.3 (do not reuse `family_goals` or `/contribute`) |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.22 | 2026-11-21 | §21.6: owner wording: success and cancellation kept distinct |
| 1.21 | 2026-11-21 | §21.5: design review adopted, built, tested, mutations |
| 1.20 | 2026-11-21 | §21 (design, before build): the confirmation bound to a snapshot; delete confirmed the same way |
| 1.19 | 2026-11-21 | §20.9: build record of §20; code review fixes (server-side confirmation); #44 findings |
| 1.18 | 2026-11-21 | §20.8: design review of §20; two blocking lock and CLI findings adopted |
| 1.17 | 2026-11-21 | §20 (design, before build): the owner's #64 review: a durable record when a goal's savings end (N2, migration 017), "Fully saved!", the per-child warning, the excess after redemption, evidence |
| 1.16 | 2026-11-21 | §19.9: post-build code review of the screens; 1 Major and 9 Minor fixed |
| 1.15 | 2026-11-21 | §19.8: built: endpoints, screens, tests, mutations, code review fixes, e2e finding; provisional wording list |
| 1.14 | 2026-11-21 | §19.7: design review of §19 adopted (7 should-fix, 3 notes); the N8 reason corrected |
| 1.13 | 2026-11-21 | §19 (design, before build): the savings feature (endpoints, goal redemption, refunds, screens) on branch `claude/percy-v1-i-savings` |
| 1.12 | 2026-11-21 | §18.3: the owner's test conditions; 41 checks; 16 protection mutations, each red |
| 1.11 | 2026-11-21 | §18.2: post-build code review of the restore script; findings fixed; §18 corrected to match the build |
| 1.10 | 2026-11-21 | §18.1: design review adopted (eight findings), and two found in the build; built and tested |
| 1.9 | 2026-11-21 | §18 (design, before build): one command that restores a backup into an isolated PostgreSQL 17 and runs the reconcile CLI against it |
| 1.8 | 2026-11-20 | §17: post-build code review of `8fa4d35`; six findings fixed (pending must be a tail of the V1 migrations, unknown applied records refused, allowlists anchored on names, a copy at 014 tested, temp-dir cleanup, restore after any error) |
| 1.7 | 2026-11-20 | §16: production is at migration 012, so the restored-backup run applies the V1 prerequisites 014 and 015 first; the CLI and its test cover a copy at 012 |
| 1.0 | 2026-11-19 | First draft |
| 1.1 | 2026-11-19 | Peer review: 5 blocking and 7 non-blocking findings, all adopted (§10) |
| 1.6 | 2026-11-19 | Post-build code review of `3722728` (§15): legacy capital assignments compared case-insensitively in the trigger and the reconciliation (Major: savings could revive); Today's Goals sub-router lower-cases ids; reward ids lower-cased; restore flag for the insert trigger; reconciliation pre-flight count |
| 1.5 | 2026-11-19 | Adversarial review of O6 at `392ad16` (§14): one blocking bug fixed (a child id in capitals skipped that child's savings and requests: over-commit reproduced, now canonical). Insert trigger, over-commit finding in the reconciliation, lock order for the save endpoints, restore runbook rule |
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

## 14. Adversarial review of O6 (v1.5, head `392ad16`)

A fresh-context reviewer attacked the generation design on a throwaway database. The design held: the reviewer found no way to make savings from an older generation count again. They found one blocking bug, and it was in how ids are compared, not in generations.

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| R1 | A child id written in capitals in the URL (Postgres accepts it) skipped every one of that child's savings and requests. The JavaScript balance rule compares ids as text. Reproduced: with 100 saved out of a total of 100, an 80-point redeem was refused in lower case and accepted in capitals | Blocking | Fixed. `router.param('id')` lower-cases every `:id` route. `balanceOf`, `goalGeneration` and `spendableFrom` also compare in lower case as a second guard. Test: redeem, `stack/add` and `stack/confirm` with the id in capitals. Mutation (both guards removed): the test fails |
| R2 | The generation trigger ran only on UPDATE. A row re-inserted with a reused id and its old epochs would bring old savings back | Non-blocking (the app cannot write `id` or the epoch columns) | Fixed. A `BEFORE INSERT` trigger always starts a reward at `0:0`. The rollback drops it. Test, plus a mutation check. **Restore runbook rule:** never restore `rewards` without `savings_events`, and never edit with `session_replication_role = replica` |
| R3 | The save endpoints still to be built need a lock order. Without one, a save can race an un-mark and be silently lost (it under-counts) | Design | Adopted for the feature build. Lock the child `FOR UPDATE`, then the reward `FOR SHARE`. Take the generation from that locked row, using the canonical child id, in the same transaction. Lock several children in id order. Paths that edit a reward never lock children. §13.2's rule against writes that span several children stays |
| R4 | `available` is clamped at 0, so comparing before with after could hide a child who has been promised more than they have | Non-blocking | Fixed. The reconciliation reports a child who is newly over-committed (`committed > total`); a child already over-committed in legacy data is not a new finding. Every `agree()` in the tests also asserts `committed ≤ total`. The boundary (equal) is tested |
| R5 | Test gaps: the "concurrent" test does not race real endpoint locks; delete/recreate always gets a new UUID; the ledger helper shares the generation formula with `reconcile.js` | Recorded | The R2 insert test covers reuse of an id. Real lock races are tested with the save endpoints (R3). Against the shared-formula risk, JavaScript `goalGeneration` and SQL are already compared in every `agree()` |
| R6 | `assigned_child_ids` were stored as written (capitals, or another family's ids). A child given in capitals lost the goal and their epoch moved on: savings ended, not revived (safe, but surprising) | Non-blocking | Lower-cased on create and update (test). An id from another family never matches a child, so it has no effect. Rejecting such ids outright is left to the D1 feature's reward form |

**Not covered by any test:** two save requests from two devices racing a real un-mark. These are tested once the save endpoint exists, under the R3 lock order.

## 15. Post-build code review of `3722728` (v1.6)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| C1 | The trigger and the reconciliation still compared assignments in exact case. Rewards written before the app lower-cased assignments can hold capitals. In the reviewer's probe, the app showed saved 60 while the reconciliation showed 0; a reassignment away and back did not move the child's epoch, so the 60 came back (O6 broken) | Major | Both compare `lower(...)` of the stored ids. Test with a legacy capital assignment written straight into the table: the app and the reconciliation agree, and away-and-back expires the savings. Mutations (either side reverted) fail it. The reconciliation CLI reports `rewards_with_mixed_case_assignments` as a pre-flight count. Client-side assignment checks are made case-insensitive in V1-E (top of the stack) |
| C2 | `router.param` does not reach the Today's Goals sub-router | Minor | The sub-router lower-cases its own `:id`. Test: a completion with the id in capitals replays under the lower-case id. Mutation fails it |
| C3 | Reward ids in a body or query were compared in exact case (fail-safe 404/409) | Minor | Lower-cased where read: redeem, `stack/add`, stack remove, `stack/confirm` `expected`. Test (add and confirm in capitals). Mutation fails it |
| C4 | A data-only restore (COPY) fires the insert trigger and would reset every generation, dropping all current savings | Minor | The trigger keeps restored values when the session sets `percy.restoring = 'on'` (the app never does). **Restore runbook:** a data-only restore of `rewards` sets that flag or uses `--disable-triggers`; a full `pg_dump`/`pg_restore` is unaffected. Test. Mutation fails it |
| C5 | The over-commit line adds a label, not a new detection; children that only appear were skipped | Nit | Comment corrected; appearing children are checked too |
| C6 | Each half of the `:id` fix alone passes the capitals test | Nit | Recorded: two layers on purpose (route and rule); the test fails only when both go |

## 16. The restored-backup run on a copy at migration 012 (v1.7)

**Finding (release preparation, 2026-11-20).** Railway's production app service has only ever deployed the default branch. Its live commit, `498e798`, ends at migration 012 (checked through the Railway deployment list and `git ls-tree`). A restored copy of production therefore has 014 (Today's Goals) and 015 (reward icons) pending as well as 016. The CLI refused that case: it required 016 to be the only pending migration. The owner's run would have stopped before proving anything.

**Fix.**
- `scripts/d1-reconcile.mjs` accepts exactly the V1 migrations pending: 014 and 015, each optional and in order, then 016 last. Anything else pending is refused.
- **First step:** the CLI applies the pending prerequisites. It checks that nothing families have changed, and that the only new schema is Today's Goals' tables and indexes plus `rewards.icon_key` with its CHECK.
- **Then:** it runs the existing 016 cycle from that point (apply, roll back, re-apply).
- **Report:** lists `pending` and each step.

**Test.** `server/test/d1-reconcile-cli.test.js` builds a database exactly at 012 (base schema plus 001–012), adds family data including a legacy capital-letter assignment, and marks it as a copy. Then it runs the CLI:
- the steps are `apply 014 and 015 (V1 prerequisites)`, `apply 016`, `roll 016 back` and `apply 016 again`, each with no changes;
- a second run is refused (016 already present).

Both tests fail on the previous script.

**Migration 015 compatibility (owner's precaution, 2026-11-20).** No persistent database has run the earlier 71-id draft of 015:
- production's app deploys only the default branch, which has no 015;
- the Railway design-selector service serves static files and connects to no database;
- there is one environment;
- CI and the test databases are rebuilt on every run.

**Runbook for the owner's run (unchanged otherwise):**
1. Restore the backup to an isolated database.
2. Write the marker token into the copy.
3. Run `node scripts/d1-reconcile.mjs --database-url <copy> --i-confirm-this-is-a-copy --copy-token <token>`.
4. Keep `d1-reconcile-report.json`.

The run passes only if it exits 0 with every step unchanged.

**After any error, restore a fresh copy before running again** (§17). A failed run can leave the copy part-way.

## 17. Post-build code review of `8fa4d35` (v1.8)

A fresh-context reviewer read the §16 change. It found nothing Major and six smaller findings. All six are fixed.

| # | Finding | Fix | Test (red on `8fa4d35` or by mutation) |
| --- | --- | --- | --- |
| 1 | A gap was accepted. With 015 recorded and 014 not, the pending list (014, 016) passed, though production cannot reach that state | `pending` must be exactly a tail of `014, 015, 016` | "refuses a gap in the V1 migrations"; mutation M2 restores the old rule and the test goes red |
| 2 | An applied record with no file on this branch was ignored. A copy with the unmerged 013 would be proved against a schema this branch never built | Any applied record this branch has no file for is refused, and the record is named | "refuses a copy with an applied migration this branch does not have"; mutation M1 |
| 3 | The allowlists were unanchored. `/today_goal/` would have hidden a stray `children.today_goal_flag` column, and the 016 pattern had the same shape | `PREREQ_SCHEMA` and `SAVINGS_SCHEMA` in `server/reconcile.js` match on the object kind and name only | `server/test/reconcile-allowlist.test.js`, 29 cases: each real object allowed, and look-alikes reported. Mutations M3 and M4 restore the old patterns and the tests go red |
| 4 | Only a copy at 012 was tested | A copy built at 014 runs with 015 as its only prerequisite | "applies only 015 as the prerequisite, then proves 016" |
| 5 | The temporary migration folder leaked when a prerequisite failed | Removed in `finally` | Read-only check. A failing prerequisite already ends the run |
| 6 | No guidance after a failed run | The CLI prints "Restore a fresh copy before running again"; runbook note above | Read-only check |

What these tests do not cover: a restored copy whose schema differs from its migration records (for example, a hand-made change on production). The fingerprint compares data and the objects added by each step. It does not compare the copy's whole schema against a freshly built 012. The real backup run is the check for that.

## 18. One-command restored-backup run (design, v1.9)

**Why.** The owner's inspection of 2026-11-21 (#60 comment) confirmed the 20 Nov archive and its `schema_migrations` at 001–012. It also found that the run is blocked because no tool both restores and reconciles. The existing drill `scripts/verify-r2-restore.sh` (unmerged branch `feat/batch-c-pr5-recoverable-account-deletion`) restores into a network-isolated PostgreSQL 17 container, then deletes it on exit. The reconcile CLI is a Node script that needs a URL to the copy. Done by hand, the operator has to keep the container, reach it without a network, write the marker and run the CLI at the right commit. Each of those is a chance for an error.

**Contract.** `scripts/d1-restore-reconcile.sh`, run by the owner on a trusted machine with Docker:
- **Input:** either the drill's R2 variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_ENDPOINT`, `PERCY_R2_BACKUP_KEY`; read-only) or `PERCY_BACKUP_FILE` (an archive already downloaded). It also requires `PERCY_RESTORE_DRILL_ACK=isolated-docker-only`.
- **Preconditions** (each refused with exit 2 before anything is restored):
  - a clean git tree (`git status --porcelain` empty);
  - `PERCY_EXPECT_HEAD` equal to `git rev-parse HEAD`, when it is set;
  - a `node_modules` directory holding `pg` (a symlink is resolved and mounted by its real path);
  - an output directory that is outside the git work tree, so family data cannot be committed;
  - `DATABASE_URL` unset.
- **Steps:**
  1. Download or read the archive, then run `gzip -t` and record its SHA-256.
  2. Start `postgres:17` with `--network none` and no ports. The image's own data volume is removed with the container (`docker rm -v`).
  3. `pg_restore --list`, then restore with the drill's flags.
  4. Check that the core tables are present.
  5. Write `percy_restore_marker` with a random 32-byte token. `restored_from` holds the archive key or file name and its SHA-256.
  6. Run the CLI in a second container, `node:22-bookworm-slim`, with `--network container:<pg>`. It shares only the database container's loopback, so it has no outside network. The repository is mounted read-only at `/app` and the output directory read-write at `/out`. No environment variables are passed through.
  7. Write `d1-reconcile-report.json` plus a `run.json` that records the git head, both image digests, the archive SHA-256 and the UTC start and end times.
- **Cleanup:** removes both containers and the temporary files on exit, interrupt or error.
- **Result:** the CLI's exit code (0 means every step unchanged).
- **Output privacy:** `umask 077`. The terminal shows step names, counts and the outcome. The report, run record and CLI log can quote values from the data (PostgreSQL error text), so they stay private (§18.2).

**Edge cases (input → expected).**
| Input | Expected |
| --- | --- |
| Dirty tree, or the head differs from `PERCY_EXPECT_HEAD` | Exit 2; nothing downloaded |
| Output directory inside the repository | Exit 2 |
| `node_modules` missing `pg` | Exit 2, with "run npm ci" |
| `DATABASE_URL` set in the shell | Exit 2. It is never passed through in any case |
| Corrupt archive (`gzip -t` fails) or not a `pg_restore` archive | Exit 3; containers removed |
| Archive already at 016, at a gap, or holding an unknown 013 | The CLI refuses; exit 1; report kept |
| Archive at 012 (production) or 014 | The CLI runs prerequisites plus the 016 cycle; exit 0 if unchanged |
| Ctrl-C mid-run | Trap removes containers and temporary files; the report directory keeps whatever was written |

**Abuse cases.**
- Pointing it at production is impossible by construction. The only database the CLI can reach is the container's own loopback, and the marker is written by the script into that container alone.
- A malicious archive runs SQL only inside the disposable container, which has no network. This matches the drill's trust note.

**Test plan.** `scripts/test/d1-restore-reconcile.test.sh`, run where Docker exists:
- It builds a synthetic archive with no real family data: the 012 schema plus fixture families, dumped with `pg_dump -Ft` and gzipped. The 012 database is built in a `postgres:17` container, and the dump is taken by that same image.
- Expected outcomes:
  - the 012 archive gives exit 0, four unchanged steps and a `run.json` head equal to HEAD;
  - an archive at 016 gives exit 1 with "already has migration 016";
  - a corrupt archive gives exit 1, with no containers left behind;
  - a dirty tree, an output directory inside the repository and a missing acknowledgement each give exit 2.
- CI: a new step in `build-and-test` runs it (GitHub's Ubuntu runners have Docker).
- Not covered: R2 download (needs credentials; the drill's own code path, unchanged) and a real archive's contents (the owner's run is the check).

**Rollout and reversal.** The script is a new file and changes no app behaviour. Reversal is deleting it. The owner runs it. Engineering reviews `d1-reconcile-report.json` from the owner's private copy, and no family data goes to GitHub.

### 18.1 Design review and build (v1.10)

A fresh-context reviewer found nothing blocking and eight should-fix items. All eight are adopted in the build. Two further problems came up during the build and are fixed too.

| # | Finding | In the build |
| --- | --- | --- |
| 1 | The readiness check over the socket can land on the entrypoint's temporary server | `pg_isready -h 127.0.0.1` |
| 2 | Report files are owned by root and world-readable from inside the container | The CLI container runs as the caller (`--user`), and the files are set to `chmod 600`. Tested |
| 3 | The archive name was spliced into the marker SQL | Values are passed as psql variables (`:'src'`); the token is `openssl rand -hex 32` |
| 4 | One exit code covered both a data change and a broken archive | 0 unchanged; 1 the reconcile found a change or refused the copy; 2 precondition; 3 archive, Docker or restore. Tested |
| 5 | The CLI's output filter was undefined | The CLI's stdout and stderr pass through unchanged (counts and step lines; diffs name ids, not people). PostgreSQL's own restore messages are suppressed, because they can quote rows |
| 6 | The exact-head claim had gaps: ignored files, `.env`, and the tree changing after the check | The CLI runs from a `git archive HEAD` extract, with `node_modules` mounted read-only beside it. `run.json` records the head, the `package-lock.json` SHA-256 and the `pg` version |
| 7 | Images were not pinned | Both are pulled by digest |
| 8 | The CLI container had no name, so Ctrl-C could leave it running | Named, and removed by the trap |
| 9 | Found in build: the postgres image declares a data volume. Removing the container without `-v` would leave an anonymous volume holding the restored family data | `docker rm -f -v`; the test counts volumes before and after |
| 10 | Found in build: a report directory inside the repository was created before it was refused | Checked on the resolved path before anything is created; tested |

**Tests.** `scripts/test/d1-restore-reconcile.test.sh` has 17 checks on synthetic archives, built in pinned `postgres:17` from `scripts/test/d1-fixture.mjs`. All pass. CI runs it in `build-and-test`. The checks:
- Each precondition is refused: acknowledgement, `DATABASE_URL`, report directory in the repository, head mismatch, dirty tree.
- A non-gzip file and a non-pg archive each fail with exit 3.
- A copy at 012 passes with all four steps unchanged.
- A copy at 016 is refused, with the reason in the report.
- Nothing is left after any run: no containers, no volumes, no work directory.
- `run.json` matches the real container settings (`docker inspect`): the database has no network and no published ports; the CLI has a read-only `/app`, read-only `node_modules`, a writable `/out`, and only the image's own environment variables.

**Mutations, each red:**
- M1: the database on the default network.
- M2: `/app` writable.
- M3: an environment variable passed to the CLI.
- M4: removal without `-v`.
- M5: the work directory kept.
- M6: no dirty-tree check.

**Not covered:**
- The R2 download path. It needs credentials, and it is the drill's command unchanged.
- A real archive's contents. The owner's run is the check.
- A SIGKILL. The trap cannot run, so the work directory (decompressed backup) and the containers can remain. On a kill, run `docker ps -a --filter name=percy-d1-` and remove what it lists.

**Owner's run:**
1. On a trusted machine with Docker, check out the PR head and run `npm ci`.
2. Run:
   `PERCY_RESTORE_DRILL_ACK=isolated-docker-only PERCY_EXPECT_HEAD=<head> PERCY_REPORT_DIR=<private dir outside the repo> PERCY_BACKUP_FILE=<archive>` (or the R2 variables) `bash scripts/d1-restore-reconcile.sh`.
3. Keep both JSON files private. Share the step lines, or the report with ids removed if preferred.

### 18.2 Post-build code review of `e108a65`–`0b6f6aa` (v1.11)

A fresh-context reviewer ran the synthetic test (17 passed, tree clean) and found 2 Major, 6 Minor and 4 Nit issues. All are fixed except Nits 9 and 12.

| # | Finding | Fix | Evidence |
| --- | --- | --- | --- |
| 1 (Major) | Exit 1 could be a crash; an old report in a reused directory could pass as this run's | Refuse a report directory that is not empty. Exit 1 only with a report that shows a refusal or a change; no report, or neither, is exit 3. A container pre-check confirms Docker can read the temporary folder (Colima and Rancher Desktop share only `$HOME`) | Test "a report directory that is not empty is refused" |
| 2 (Major) | A remote Docker context or `DOCKER_HOST` would receive the decompressed backup | Refuse unless `DOCKER_HOST` is unset or `unix://` and the current context's endpoint is `unix://` | Test "a remote Docker host is refused" |
| 3 | A second Ctrl-C during cleanup, or a closed terminal, could leave the container and volume | `cleanup` ignores INT, TERM and HUP; HUP is trapped; a loud warning if anything remains | Read-only check |
| 4 | CLI error text can quote data on the terminal | The CLI's output goes to `reconcile.log` (private). The terminal shows step names, counts and the outcome; the docs no longer claim the report holds no row values | Test "the terminal shows step lines, not the CLI output" |
| 5 | The report directory kept its mode | `chmod 700` | Test checks 700 |
| 6 | `stat -c` is GNU only | Portable mode check in Python | Test runs on Linux; the command has no GNU dependency |
| 7 | §18 disagreed with the build | Corrected above | — |
| 8 | Rootless Docker cannot read the private extract | The pre-check fails it with exit 3 and says rootless Docker is not supported | Read-only check |
| 10 (Nit) | The leftover count included other runs | Counts only containers that appeared during the test | — |
| 11 (Nit) | Images were pulled after the backup was decompressed | Pulled before any family data is on disk | — |
| 9, 12 (Nit) | `eval` quoting in the test; `node_modules` not checked against the lock file | Not fixed: the test runs on the project's own temp paths. `run.json` records the lock file's SHA-256 and the `pg` version, which is enough to reproduce the run | — |

The test has 20 checks, all passing.

### 18.3 Owner's test conditions and the protection mutations (v1.12)

The owner's conditions (2026-11-21) were:
- each locality check exercised on its own, including a remote Docker context;
- an unsafe environment refused before any restore or database operation;
- the read-only mount and the other safeguards effective;
- cleanup even on failure;
- tests that catch removal of the protections, not incidental setup changes.

**How the test meets them** (`scripts/test/d1-restore-reconcile.test.sh`, 41 checks, all passing):
- **Refused before any work.** Every precondition case runs against a stand-in `docker` that records each call and does nothing. Each refusal must exit 2, and both of these must hold:
  - the record holds nothing but `docker context inspect`, so no image pull, container, copy or restore happened;
  - the archive was never read.
- **Each locality check alone.** The stand-in can report a local context while `DOCKER_HOST` is remote, which tests the `DOCKER_HOST` check by itself. With the real Docker CLI the two cannot disagree, because `docker context inspect` reflects `DOCKER_HOST`. The stand-in can also report a remote context with no `DOCKER_HOST`, which tests the context check by itself. An `ssh://` context and an unknown (empty) endpoint are covered too. A real remote context created with the Docker CLI is refused as well.
- **Isolation as run.** For a passing run, `run.json` records the containers' real settings from `docker inspect`:
  - the database's network is `none`, with no published ports;
  - the CLI shares only that namespace;
  - `/app` and `node_modules` are read-only and `/out` is writable;
  - the CLI sees no environment variables beyond the image's own.

  The test checks each of these.
- **Cleanup on failure.** Two failures each run with their own `TMPDIR`: a failure after the backup is restored (the copy already has a marker table), and Ctrl-C after the restore. Each must leave no container, no volume and an empty `TMPDIR`, so no decompressed backup remains. Archive failures before the restore also leave no container.

**Mutations.** Each one removes or weakens a protection in the script itself, and each turns a check aimed at that protection red:

| Mutation | Check that went red |
| --- | --- |
| M1 database on the default network | isolation record (network `none`) |
| M2 `/app` writable for the CLI | isolation record (mounts) |
| M3 an environment variable passed to the CLI | isolation record (environment) |
| M4 container removed without its volume | no volume left after a failure and after Ctrl-C |
| M5 work directory (decompressed backup) kept | empty `TMPDIR` after a failure and after Ctrl-C |
| M6 no dirty-tree check | dirty tree refused before any work |
| M7 no empty-report-directory check | non-empty report directory refused before any work |
| M8 no `DOCKER_HOST` check | remote `DOCKER_HOST` with a local context refused |
| M9 no Docker context check | remote context with no `DOCKER_HOST` refused |
| M10 CLI output on the terminal | the private log exists, and the terminal shows only step lines |
| M11 no acknowledgement check | refused before any work |
| M12 no `DATABASE_URL` check | refused before any work |
| M13 no expected-head check | refused before any work |
| M14 report directory inside the repository allowed | refused before any work |
| M15 no Ctrl-C trap | Ctrl-C exits 130 and cleans up |
| M16 report files not made private | modes 600 and 700 |

The M14 run, which allowed a report directory inside the repository, left an empty directory there (synthetic data only). That directory also failed the M15 and M16 runs, alongside the checks those mutations target. It was removed, and the clean test passes.

**Still not covered:**
- **Mapping a CLI crash to exit 3.** No synthetic input makes the CLI crash after the pre-check.
- **SIGKILL.** No trap can run (§18.1).
- **The R2 download.** It needs credentials.
- **A real archive's contents.** The owner's run is the check.

## 19. The savings feature: build design (v1.13)

**Scope** (owner, 2026-11-21): V1 launches with savings. Endpoints, goal redemption and refunds, and the Home, Children, Child View, Rewards and Activity surfaces. Branch `claude/percy-v1-i-savings`: the top of the stack (`e-settings`) with #60 merged in, as its own draft PR. Nothing here changes migration 016. The owner's restored-backup run stays valid at `3ad4332`.

**Already built and unchanged** (#60):
- `balanceOf`, `withBalances` (`goals[]`, `saved_total`, `available_points`), generations and the trigger;
- `stack/add` refuses a bigger goal;
- `redeem` refuses a reward with current savings;
- `stack/confirm` refuses a requested reward with savings;
- `reverseAward` counts savings as committed.

### 19.1 Endpoints

All of these are parent-only (the family token, as every write), family-scoped and idempotent. The `request_id` is required and is claimed in `idempotency_keys` by `priorRequest` and `rememberRequest`; the same id on another endpoint, or with other arguments, gets 409. **Lock order (R3):** the child `FOR UPDATE`, then the reward `FOR SHARE`. The generation is read from that locked reward row.

| Endpoint | Accepts | Refuses |
| --- | --- | --- |
| `POST /api/children/:id/savings/save {reward_id, points, request_id}` | Writes `save +points` in the current generation | 400 when `points` is not a whole number in 1..`MAX_AWARD`. 404 for a child or reward not in the family, or a reward not for this child. 409 when the reward is not a bigger goal (I4). 400 "Not enough points" when `points > available` (I2/I3, write-time rule B4) |
| `POST /api/children/:id/savings/release {reward_id, points, request_id}` | Writes `release −points` | 400 for invalid points. 404 as above. 409 when `points > saved` in the current generation (I1). A goal no longer current has saved = 0, so any release is refused |
| `POST /api/savings-events/:id/undo {request_id}` | Undoes a `save` or `release` written in the last 10 minutes: an `undo` row with the opposite delta, `undoes` = that event, the same generation | 404 for an unknown event, older than 10 minutes, or a kind other than save or release. 409 "Already undone." (also caught by the `UNIQUE (undoes)` race). 409 when the event's generation is no longer current (O6: never revive). 409 `SPENT_ALREADY` when undoing a save would take saved below 0 (I1, after a later release or a goal redemption). 409 when undoing a release would exceed available (I2) |
| `POST /api/children/:id/savings/redeem {reward_id, request_id}` (O7: a parent, from the Children page) | `from_saved = min(saved, cost)`; `from_available = cost − from_saved`. In one transaction: `total_points −cost`, `points_spent +cost`, one `redemptions` row (Completed), and a `spend −from_saved` row linked by `redemption_id` (none when `from_saved` is 0) | 404 as above. 409 when not a bigger goal. 400 "Not enough points" when `from_available > available`. 409 "The requests changed. Check them again." when the goal is also in the stack (it cannot be added any more; this covers legacy rows) |
| Existing `POST /api/redemptions/:id/undo` | Also restores the linked `spend` with an `undo +from_saved` row, **only if** the reward is still a bigger goal for the child in the **same generation** as the spend. Otherwise the points go to available | (unchanged) |
| Existing `POST /api/children/:id/redeem` | Now also refuses **any** bigger goal (409 "Invalid request"), so goals have one redemption path (B1/O7). Today it refuses only goals with savings | |

Every response carries the child through `withBalances`.

### 19.2 Departures from v1.1, with reasons

1. **N8 (release the excess over cost at redemption) is not built.** E12 of §6 is kept instead: the excess stays saved towards the same goal. A derived `release` would be a row the savings undo endpoint could undo, which separates a goal redemption from its own bookkeeping. (Corrected in §19.7: 016's CHECK does not forbid it.) It still counts as committed, so it can never be spent twice, and the parent can move it back. It can only arise when a cost is lowered below what was saved.
2. **B5's `reward_removed` sweep is not built.** §13.2's generations replaced it. Rows of an old generation never count, so there is nothing to sweep. `reward_removed` stays an allowed kind and is never written.

### 19.3 Surfaces

Approved strings are used verbatim. New strings are the owner's proposed O4 wording, or provisional and listed for the owner's screen review.

- **Rewards (V1-D):**
  - The form gets a "Bigger goal" switch with the helper text "Save points towards this reward over time" (O4). `is_bigger_goal` joins the rewards column whitelist.
  - The catalogue gets a "Bigger rewards" section (D7) listing goals, ahead of the other rewards.
  - Home's direct "Spend" list leaves goals out.
- **Children (V1-B):** a "Saving for something bigger" card with Edit (approved). For each current goal: the goal's title, "{saved} of {cost} points saved", "{to_go} to go" and a progress bar.
  - **Edit opens a dialog.** Choose the goal from the child's spendable bigger goals. Then "Save points" or "Move points back" (O4), each with a whole-number amount limited by the server's figures: up to `available_points` to save, up to `saved` to move back. A toast offers Undo. The dialog also shows "Saved: {n}" (approved) and a "Redeem" button (provisional) when `saved + available ≥ cost`.
  - "Weekly treats to choose from" leaves goals out. A goal tile shows "{cost} points · Bigger achievement" (approved).
  - "Next milestone" gains the approved subtitle "Weekly target and bigger goal" and, when there is a goal, its "{to_go} to go".
- **Home (V1-A):** "What you're working towards" shows the selected child's goal with the most saved, under the label "Saving for something bigger", with "{saved} of {cost} points saved", "{to_go} to go" and a bar, as well as the requested rewards (N7).
- **Child View (V1-B):**
  - The second tile "{saved} Saved towards {goal}" (approved).
  - "My next big adventure" with "{to_go} points to go" (approved), for the goal with the most saved, listed only if it is visible to children.
  - "Rewards I can choose" leaves goals out: there is no request button for a goal (B1).
  - Nothing in Child View moves points (D5).
- **Activity (V1-C):** `save` and `release` rows appear in All only, as "Saved {n} points towards {goal}" and "Moved {n} points back from {goal}" (O4). They are not balance changes, so they are never in Earned or Spent. An undone row carries the existing "Undone" marker. Spend and refund rows aren't shown, because the redemption row already says "Reward redeemed".
- **Export:** `savings_events` is included.

### 19.4 Edge cases (input → expected; §6 E1–E14 still apply)

| # | Input | Expected |
| --- | --- | --- |
| F1 | points 0, -1, 1.5, "5", 1001 | 400 |
| F2 | Save more than available, by exactly 1 | 400; nothing written. Saving exactly the available amount succeeds |
| F3 | A release larger than saved by 1 | 409. Releasing exactly what was saved succeeds and leaves 0 |
| F4 | Save with a child id in capitals | The same child and the same goal (R1) |
| F5 | Save, un-mark, re-mark, then undo the save | 409 (generation changed); saved stays 0 |
| F6 | Save 50, release 30, undo the save | 409 (saved 20 < 50) |
| F7 | A goal redeem with saved 120, cost 300 and available 200 | Total −300, spend −120, available −180 (E5) |
| F8 | Undo that redemption | Total +300 and an undo of +120: saved 120, available back (E6) |
| F9 | Undo it after the goal was un-marked | Total +300, no savings undo, all 300 available |
| F10 | A goal redeem replayed with the same request id | One redemption; the replay returns it |
| F11 | Two saves racing for the last points | One succeeds; the other is refused under the child lock |
| F12 | A save racing an un-mark | Either the save is written in the old generation and doesn't count, or the un-mark waits for the reward share lock. It never over-commits |
| F13 | `/redeem` of a goal with 0 saved | 409 |
| F14 | Another family's child, reward or event | 404 |

**Abuse cases:**
- Request ids are forged across endpoints (409, the existing rule).
- Writes to `is_bigger_goal` or the epochs by direct SQL are owned by the trigger.
- A child token: there are no child accounts. Child View has no savings controls, and the API has no child role.

### 19.5 Test plan

- **Server tests** (`server/test/savings-feature.test.js`):
  - F1–F14 and E1–E14 through the endpoints;
  - a property test of random operation sequences (award, save, release, undo, request, confirm, redeem a goal, undo a redemption, un-mark, reassign), after each of which `committed ≤ total` and `total_points` equals the history total;
  - a test that the savings queries stay one per family read;
  - the export includes `savings_events`;
  - the column whitelist.
- **Mutations** (each must go red):
  - the I2 check in save;
  - the I1 check in release;
  - the generation check in savings undo;
  - the same-generation rule in redemption undo;
  - `/redeem` refusing goals;
  - the lock order: the reward is not locked `FOR SHARE`, caught by the F12 race test, which may pass by chance. The race test runs 20 rounds and is recorded as probabilistic.
- **Client tests:** render tests from server figures for Home, Children and Child View; the Edit dialog's limits, Undo and Redeem; the form switch; the Bigger rewards section; the Activity rows.
- **End to end:** a parent marks a goal, saves, moves points back, undoes, and redeems; Child View shows "Saved towards"; axe at 320, 390, 834 and 1280; screenshots.
- **One class not covered:** clock skew on the 10-minute window across app servers (as §7).

### 19.6 Rollout and reversal

- A draft PR; nothing merged or deployed.
- Reversal before launch: revert the branch. 016 and its ledger are unchanged.
- After launch: the §13.3 rule applies (no destructive rollback).

### 19.7 Design review of §19 (adopted before the build)

A fresh-context reviewer read §19 against §2–§14, `routes.js` and 016. They found nothing blocking: no double spend, no revival of an old generation, no deadlock (no path locks a reward and then a child), and every planned insert passes 016's CHECK. Seven should-fix findings and three notes are adopted.

| # | Finding | Adopted rule | Test |
| --- | --- | --- | --- |
| S1 | Saving towards a goal that is also requested costs nothing: `balanceOf` counts `max(stacked, saved)`. Example: total 150, a reward costing 100 requested, then marked; three saves of 50 leave available at 50, 50, 0 and "150 of 100 saved" | Save and goal redeem refuse a goal in the child's stack with "The requests changed. Check them again." | "S1: a goal also requested cannot be saved towards" |
| S2 | §19.2's N8 reason was wrong | Corrected above | — |
| S3 | `savings_events` must never join `TABLE_MAP` (generic DELETE would break append-only) | Kept out; the export reads it directly | "the generic API cannot touch the ledger" |
| S4 | Several responses return a raw child without `available_points` or `goals`: the `/redeem` and `/stack/confirm` replays, `replayAfterRace`, the redeem and confirm successes, redemption undo, `reverseAward` | All go through `withBalances` | "every response carries the balance" |
| S5 | Child View's "Saved towards" tile had no visibility rule | It uses the same filter as "My next big adventure": only goals visible to children | Child View render test |
| S6 | The goal-redeem endpoint's lock order was unstated | The child `FOR UPDATE`, then the reward `FOR SHARE`. Then `balanceFor`, the I4 check and the generation are read under both locks. The same applies to save, release and undo | F12 race (probabilistic) |
| S7 | Request-id details | `reward_id` is lower-cased in `args` (a save sent in capitals is a replay, not 409). In the savings undo endpoint, a 23505 on `savings_events_undoes_once` means "Already undone."; on `idempotency_keys` it means replay | "F4 replay in capitals" |
| N1 | An existing over-committed child | Checks are written unclamped: `total − committed ≥ needed` | (in each write) |
| N2 | Un-marking or reassigning returns saved points to available with no Activity row | **Owner item** for screen review (Activity wording) | — |
| N3 | A goal created with the switch on starts at `0:0`. A re-inserted id would also start at `0:0`, and its old savings would count again (R2 protects only other generations) | The app creates a goal unmarked, then marks it in the same transaction, so its first generation is `1:0`. 016 is unchanged | "a new goal starts after generation 0" |
| N4 | `stack/confirm` still redeems a goal requested before it was marked and with 0 saved: a second path | Kept, documented: it is the way out for legacy rows, and it is safe (no savings to count) | (existing confirm tests) |

### 19.8 Build record (v1.15)

**Commits** on `claude/percy-v1-i-savings`: the merge of #60, §19 and its review, the endpoints, the screens, the backend review fixes and the tests.

**Server** (`server/test/savings-feature.test.js`, 28 tests):
- F1–F14, E5–E9, S1, S3, S4, S7, N3 and F5b/F9b;
- the goal cost cap;
- Activity rows;
- one savings query per family read;
- export;
- a 90-step property test. Its operations are award, save, release, undo, goal redeem, redemption undo, mark and un-mark, reassign, goal cost change, request and confirm, and spend. After every step the app and the SQL reconciliation agree, `committed ≤ total`, and `total = history`, for the child and a sibling.

**Mutations of the server** (each red unless stated):

| Mutation | Result |
| --- | --- |
| M1 save without the I2 check | red (4) |
| M2 release without the I1 check | red (2) |
| M3 savings undo without the generation check | red after F5b was added. Before that, it survived: the I1 check refused the same input |
| M4 redemption undo without the same-generation rule | red (F9b) |
| M5 `/redeem` allowing goals | red |
| M6 save towards a requested goal | red (S1) |
| M7 goal created at generation 0 | red (N3) |
| M8 confirm returning a raw child | red (S4) |
| M9 savings undo without the undo-once check | **Survives:** `UNIQUE (undoes)` refuses the second undo (409 "Already undone."). These are two protections that a test cannot tell apart |
| M10 goal redeem not spending the savings | red (4) |
| M11 undo of a save without the I1 check | red |
| M12 replay arguments not lower-cased | red (S7) |

**Post-build code review of the backend** (fresh context): no Major findings.

| # | Finding | Status |
| --- | --- | --- |
| 1 | A save could exceed the goal's cost ("400 of 100 saved") | Fixed: save and the undo of a release stop at the cost (400 "More than this goal needs" / 409). Tested |
| 2 | Replays took a second pool connection while holding one (pool starvation) | Fixed: they read on their own connection |
| 3 | Activity rows had no server feed | Built: `saving` and `moved_back` rows under All only, with undone marked. Tested |
| 4 | The property test lacked request, confirm, reassign and cost change | Added |
| 5 | Messages | Fixed: an undo in a changed generation gets "This can no longer be undone."; a move back over saved gets 400 "Not enough points saved" |
| Nit 1, Nit 5 | Queries scoped by id only | Family-scoped |
| Nit 2 | The N3 comment overclaimed | Corrected. A reward re-inserted with the same id and then marked reaches `1:0` again. The app cannot write ids, and the restore runbook never restores `rewards` without `savings_events` |
| Nit 3, Nit 4 | A replay after an undone redemption returns the stored Completed row; a post-commit read failure gives 500 | Same as the existing `/redeem`. Recorded, not changed |

**Screens** (`src/pages/V1Savings.test.jsx`, 15 tests):
- the Children card and dialog (limits, save with Undo, refusal message, Redeem with its confirm and its disabled state);
- Child View (figures; the S5 visibility rule; no controls; goals not choosable);
- the Home goal;
- Rewards "Bigger rewards" and the form switch;
- Spend leaving goals out;
- Activity wording.

Each of four screen mutations goes red: no save cap, Spend showing goals, Child View ignoring visibility, goals in weekly treats.

**End to end** (`e2e/v1-savings.spec.js`, all four sizes): the whole journey runs against the real server. The Batch D checks (axe, 44px targets, 12px text, no sideways scroll, named controls) run on:
- Children with savings;
- the savings dialog;
- Child View;
- Rewards;
- the redeem confirm.

The full browser suite gives 46 passed and 14 skipped (the existing skips). Screenshots are in `docs/engineering/evidence/v1-savings/`.

**Found by the end-to-end run, fixed:** a toast's Undo could not be clicked while the savings dialog was open, because a modal dialog blocks the page behind it. The dialog now closes after a save or a move back, as the award dialog does, and a unit test checks this.

**Wording for the owner's screen review** (O4 and new strings; approved strings are not listed):

| Where | String | Status |
| --- | --- | --- |
| Reward form | "Bigger goal", "Save points towards this reward over time" | O4 proposed |
| Savings dialog | "Save points", "Move points back" | O4 proposed |
| Savings toasts / Activity | "Saved {n} points towards {goal}", "Moved {n} points back from {goal}" | O4 proposed (Activity: "{child} saved {n} points towards {goal}", "Savings · {time}") |
| Savings dialog | "Set points aside for {child}'s bigger goal. Saved points stay {child}'s; you can move them back.", "Bigger goal" (legend), "Available now" (approved elsewhere), "Points", "Save up to {n} · Move back up to {n}", "Close", "Redeem" | Provisional |
| Redeem confirm | "Redeem {goal}?", "This will spend {cost} points from {child}'s balance: {n} saved and {n} available.", "{goal} redeemed for {child}" | Provisional |
| Errors | "That didn't work: the figures changed. Check them and try again.", "Couldn't save that. Check your connection and try again.", "Undone." | Provisional |
| Children | "No bigger goals yet.", "Mark a reward as a bigger goal", "Nothing saved yet. Use Edit to save points towards a bigger goal.", "{goal}: {n} to go" | Provisional |
| Server errors | "More than this goal needs", "Not enough points saved" | Provisional (shown only on a stale screen) |
| Activity icon | Phosphor `piggy-bank` (approved icon set, new placement) | For review |
| Owner item (N2) | Un-marking or reassigning returns saved points to available with no Activity row | Owner decision at screen review |

### 19.9 Post-build code review of the screens (v1.16)

A fresh-context reviewer read the screens diff (`9e674c9..f24b981`). It found 1 Major and 9 Minor issues, plus some Nits. All are fixed except where stated.

| # | Finding | Fix | Test (mutation) |
| --- | --- | --- | --- |
| Major | The reward form ended a goal's savings with no warning. Un-ticking "Bigger goal", or taking the goal away from a child, ends what was saved (O6) | A warning appears when the change would end savings, and Save asks to confirm: "End this bigger goal's savings?" with "Keep saving" or "Save reward" (provisional wording) | 2 tests (red without the confirm) |
| 2 | The dialog's limits mixed the rewards query with the server's goal figures | Cost, saved and `to_go` come from `child.goals`. A goal with nothing saved needs its whole cost | Existing limit tests |
| 3 | The default goal differed from Home's | On each opening, and for another child, the dialog starts on `leadingGoal`, the goal Home leads with | "reopening starts on the goal Home leads with" |
| 4 | Requested goals were offered, and the server's message was hidden | A goal in the request stack is left out (S1). A 4xx shows the server's message, else the generic one | Red without the filter |
| 5 | A retry after a lost reply could get a new id if another action ran in between | One id per action for the dialog's life, dropped only on success or refusal | Red when a refusal clears all ids |
| 6 | Double tap | A synchronous `busyRef` guard. **The mutation survives:** in tests the first click disables the button, so the ref is a backstop for two taps within one frame | "a double tap sends one request" |
| 7 | Undo had no retry and repeated existing code | Redemption Undo uses `undoAction('spend')`. Savings Undo is `undoSavingsAction`, with a guard and "Try again" reusing the same id | "the savings Undo offers a retry" |
| 8 | Focus was lost after a redeem | Both dialogs send focus back to the card's Edit button | (manual: keyboard) |
| 9 | Children listed only goals with savings | Every current goal is listed, at 0 saved when it has none, in Home's order | "Children lists a marked goal with nothing saved" |
| 10 | The other rewards had no heading beside "Bigger rewards" | "Other rewards" (provisional), shown only beside the Bigger section | "Rewards names the other rewards" |
| Nit | `pointsWord` was duplicated | Activity imports it from `@/lib/savings` | — |
| Nit | "0 points to go" when a goal is fully saved | Kept: the approved shape. **Owner item** for screen review | — |
| Nit | "Undone." differed from other Undo toasts | It now names the child and the available points, from the server | Retry test |

## 20. Owner review of #64 (21 Nov): build design (v1.17)

The owner reviewed head `cde97eb`. The copy is kept as built: "Bigger goal", "Save points", "Move points back", the Activity lines and the piggy-bank icon. The owner still has to confirm the final wording. They asked for the five changes below. The release gate in #44 stays separate (§20.6).

### 20.1 N2: a durable, attributable record when a goal's savings end

**The owner's rule.** Savings must not silently become available with no identifiable explanation. When un-marking or reassigning makes savings stop counting, record:
- the child;
- the goal;
- the amount;
- the cause.

The ledger stays append-only. Keep O6 (no resurrection) and the child-to-reward lock order. Do not relabel an old allocation as a new save or invent earnings.

**Representation.**
- One `reward_removed` row per affected child, written in the same transaction as the reward change that ended the savings.
- `delta` is minus the child's saved amount in the **ended** generation, and `generation` is that ended generation.
- `reward_title` holds the title at the time.
- A new column, `ended_by`, holds the cause: `unmarked`, `reassigned` or `deleted`.

`reward_removed` is already an allowed kind in 016, with no request id. The row sits in a generation that no longer counts (O6), so it changes no balance: the points were already available by the read-time rule. It records why and how many, and it is neither a save nor an earning.

**Migration 017** (`017_savings_ended_by.sql`). It is additive and changes no row:
- `ALTER TABLE savings_events ADD COLUMN IF NOT EXISTS ended_by TEXT NULL`;
- a CHECK limiting `ended_by` to those three values;
- `CONSTRAINT savings_events_ended_shape CHECK ((kind = 'reward_removed') = (ended_by IS NOT NULL))`. This is valid on all existing data, because no `reward_removed` row has ever been written;
- a post-check that nothing changed.

Its rollback drops the constraint and the column, and refuses once any `reward_removed` row exists (§13.3).

**Writers.**
- **Reward edit** (`PUT /api/rewards/:id`):
  1. Lock the reward `FOR UPDATE` and read it (before).
  2. Run the UPDATE; the trigger moves the generations (after).
  3. In one query, read each child's positive sums for this reward by generation.
  4. For each child of the family for whom the reward **was** a current goal before: if its generation changed, or it is no longer the child's goal, and the child had a positive sum in the old generation, insert the row.
  
  The cause is `unmarked` when `is_bigger_goal` went from true to false, and `reassigned` otherwise.
- **Reward delete:** before the DELETE, the same rows for every child with a positive sum in the current generation, with cause `deleted`.
- **Cost edits and other edits** end no savings and write nothing.

**Locks (the owner: no multi-child deadlocks).** The editor holds the reward lock, then inserts rows whose foreign key takes `FOR KEY SHARE` on each child. A savings writer holds its child `FOR UPDATE` and waits for the reward `FOR SHARE`. That would be a cycle.

**Fix:** every path that locks a child and then a reward uses `FOR NO KEY UPDATE` on the child. Those paths are save, release, savings undo, goal redeem, and redemption undo through `lockChildOf`. `FOR NO KEY UPDATE` does not conflict with `FOR KEY SHARE`, so the editor never waits on a child. Writers still exclude each other: `NO KEY UPDATE` conflicts with itself and with the `FOR UPDATE` that other child writers use. Paths that lock a child `FOR UPDATE` and never a reward can only make the editor wait, not deadlock.

The child-to-reward order is unchanged for every writer, and the editor touches children only through key-share.

**Concurrency.**
- A save that committed before the edit's reward lock is in the edit's sum.
- A save waiting for the reward share lock re-reads the updated row when it proceeds. It then writes in the new generation, or is refused because the reward is no longer a goal. So the edit's sum is final.

**Activity.** `reward_removed` rows appear under All as "{Child}'s savings for {goal} ended", with the sub-line "{n} points available again · {cause}". The cause reads "Bigger goal turned off", "No longer for {Child}" or "Reward deleted" (provisional wording). They are not balance rows, and they do not appear in Earned, Spent or Goals.

**Export.** Includes `ended_by`.

**Reconcile CLI.** The V1 migrations become 014, 015, 016 and 017. The savings cycle applies 016 and 017, rolls back 017 then 016, and applies both again. 017's column and constraint fall within the savings allowlist. **The owner's drill must then run at the #64 head**, not `3ad4332`. The command is the same; only the branch and the expected head change.

### 20.2 "Fully saved!"

- While `to_go > 0`: "{n} to go" (parent) and "{n} points to go" (Child View).
- At 0: "Fully saved!" in both. The parent's dialog adds "Ready to redeem" when the goal is fully saved.
- Nothing suggests that points were spent or the reward redeemed.

### 20.3 The warning before un-marking or reassigning, per child

The reward form already receives the children, with their server `goals`. The warning names each affected child who has savings in this goal: "{Child}: {n} saved points will become available again." It is followed by "Past savings won't be restored if you re-enable the goal."

An affected child is one who loses the goal: all assigned children when un-marking, or a child removed from the assignment. No child with savings means no warning and no confirmation, because nothing is lost. The confirmation keeps "Keep saving" as the safe cancel.

### 20.4 The excess over a lowered cost (E12), after redemption

The owner asked to verify that the parent can still see the excess after redemption and move it back, that it is never lost and never counted twice. Server test: save 100 → lower the cost to 60 → redeem. The expected result:
- spend −60;
- 40 still saved, shown as "40 of 60 points saved · Fully saved!";
- 40 can be moved back;
- `committed ≤ total` throughout.

The redeem confirm says so when the excess is greater than 0: "{n} saved points are more than this goal needs. They stay saved for {goal}, and you can move them back." (provisional wording).

### 20.5 Evidence

- The savings card itself on phone sizes: scrolled into view before the screenshot.
- The un-mark warning with its confirmation.
- A fully saved goal.
- 320 px legibility of the long fixture names: checked on the screenshots.

### 20.6 The #44 gate (separate)

The archive shrank from 8.68 MB to 646 kB between 10 and 11 November, and families fell from 9 to 2. Engineering reads the `db-backup` service's deployment logs around those dates through the read-only Railway connector, to find what changed in the backup job or the data. Engineering does not read production rows. Authoritative production counts need a read of production, which the owner runs or authorises. The run must not print family data.

### 20.7 Test plan

- **017:** applies cleanly and changes nothing; its rollback refuses once a `reward_removed` row exists.
- **Writers:**
  - un-mark with two children saved, then reassign away from one child, then delete: one row each, with the right amount, ended generation and cause;
  - no row for a child with nothing saved, or for a cost edit;
  - a balance unchanged by the record (`agree()`).
- **A deadlock race:** 20 rounds of a save racing an un-mark of the same goal. There is no deadlock error, and the outcome agrees with the reconciliation. The mutation that puts `FOR UPDATE` back must show a deadlock or failure; this is probabilistic, and recorded as such.
- **Activity:** the ended rows under All only, with the cause text.
- **E12 after redemption** (§20.4).
- **Screens:** "Fully saved!" in three places; the per-child warning shown only when a child has savings.
- **CLI:** a copy at 012 runs prerequisites and then the 016+017 cycle.
- **One class not covered:** a reward edited by direct SQL writes no ended record. The app is the only writer; the trigger still moves the generation, so nothing revives.

### 20.8 Design review of §20 (adopted before the build)

| # | Finding | Adopted rule | Test |
| --- | --- | --- | --- |
| B1 (blocking) | An award deadlocks with the editor through `families`. The award holds the child `FOR UPDATE`, and `recordStreak` then takes the family `FOR UPDATE`. The editor's insert holds the family `KEY SHARE` and waits for the child | `recordStreak` and the timezone write lock `families` with `FOR NO KEY UPDATE`, which is compatible with `KEY SHARE` and still excludes other family writers | An award racing an un-mark with two saved children, 20 rounds (probabilistic) |
| B1 (found while adopting B1) | `stack/confirm` holds a child `FOR UPDATE`, then inserts a redemption whose foreign key needs `KEY SHARE` on the reward. A reward requested before it was marked can be confirmed with 0 saved (§19.7 N4). If the editor waited on that child, there would be a cycle | The editor locks **only the children with savings in this goal** (`FOR KEY SHARE`, in id order). Such a child cannot have the goal in its stack (S1 and B1 of §10), so its confirm never needs this reward | Covered by the rule; the race test is below |
| Safety net | Postgres resolves any remaining cycle by aborting one transaction (40P01) | The reward edit and delete retry once on 40P01. Savings writers do not: the client's request id makes them safe to retry | — |
| B2 (blocking) | The CLI ran 017 as a prerequisite, before 016 | Prerequisites are pending migrations other than 016 and 017. A copy with 016 or 017 already applied is refused. The cycle applies 016+017, rolls back 017 then 016 with both records in one transaction, applies again, and checks `ended_by` | CLI test: a copy at 012 |
| S1 | A child deleted during the edit made the edit fail (foreign key) | The `FOR KEY SHARE` read skips a child deleted while it waited | Child delete racing an un-mark |
| S2 | "The #64 head" moves with every push | The handback names the exact commit for the drill | — |
| S3 | "Which children" | Worked out in JavaScript with `spendableFrom` and `goalGeneration` on the before row and the `RETURNING` row | Writer tests |
| S4 | Activity type | `reward_removed` gets its own type, `savings_ended`, under All only, never in Goals or as a move back | Activity test |
| Wording | "available again" is untrue while available is held at 0 | "{n} saved points released" (provisional) | — |

### 20.9 Build record, code review and the #44 findings (v1.19)

**Built** (commits `ca5298d`, `addfe54` and the review fixes):
- migration 017 and its refusing rollback;
- `recordEndedSavings` on reward edit and delete;
- the lock modes (§20.8);
- the edit retried once on deadlock;
- the Activity type `savings_ended`;
- export `ended_by`;
- the CLI's 016+017 cycle;
- "Fully saved!";
- the per-child warning;
- the excess note;
- the E12 test;
- evidence: the card itself on phone sizes, the warning and confirmation, a fully saved goal, and 320 px legibility.

**Tests.** 38 savings server tests, 27 screen tests and the full suite (1,015) pass. So do the restore helper (41/41) and the browser suite (46 passed, 14 skipped as before).

**Mutations:**

| Mutation | Result |
| --- | --- |
| Cause always "reassigned" | Red (2) |
| No `KEY SHARE` pre-read | Red (child delete race) |
| Records an already-ended generation again | Red |
| `FOR UPDATE` back on the child (savings paths) | Red (F12) |
| No server confirmation | Red |
| Families back to `FOR UPDATE` | **Survives:** the editor takes every child's lock before its first write, so it never holds the family lock while waiting. That ordering already prevents the cycle; `NO KEY UPDATE` on families is a second protection. The deterministic test goes red only when both are removed |
| No 40P01 retry | **Survives:** no known cycle is left to trigger it. It is a safety net, for example for the cycle in Nit 4 below |

**Post-build code review** (fresh context): no Major findings.

| # | Finding | Status |
| --- | --- | --- |
| Minor 1 | The confirmation relied on the page's cached `goals`. A stale page could end savings without asking | **Fixed on the server:** an edit that would end savings returns 409 `ENDS_SAVINGS` with nothing changed, unless the request carries `confirm_end_savings: true`. The form sends that flag only after the parent confirms the per-child warning. On a 409 the client refreshes the children, so the warning shows the current figures. Tested (red without it) |
| Minor 2 | The Activity line read "Lara savings ended for Bike" | Now "Lara's savings for Bike ended", with "{n} saved points released · {cause}" |
| Nit 3 | §20.8 B1's premises | Corrected here: `redemptions` has no foreign key to `rewards`, and the editor's lock ordering is what prevents the family cycle |
| Nit 4 | A rare cycle through a shared photo upload | Covered by the 40P01 retry |
| Nit 5–7 | The retry comment, a stale CLI comment, React keys | Fixed |
| Nit 8 | A legacy child with `total_points` NULL has no `goals`, so it gets no warning | Recorded: legacy only; the server confirmation still applies |

**#44 findings** (read-only; no production rows read):
- **Railway deployments:**
  - The app service only ever deployed the default branch.
  - Between the 10 and 11 November backups it deployed 10 releases (A2 PR1 to Batch C PR1, migrations 002–012).
  - The `db-backup` service was last deployed on 10 November at 02:33 UTC (template update "Update aws sdk") and has not changed since.
- **No code that ran in production deletes families or users.**
  - On the default branch, no endpoint, migration or boot step deletes from `families` or `users` (searched).
  - The only code that does is on `claude/debug-missing-deployed-changes-dA7zP` (March 2026). It is not in the default branch, and Railway never deployed it.
  - Child deletes cascade only that child's history.
- **The Railway logs for `db-backup` and `Postgres` hold nothing for 10–11 November**, beyond retention.
- **Conclusion:** the drop from 9 families to 2 and from 10 users to 2 was not made by the app. It came from outside the app (direct database access, a reset or a restore), or the 11 November archive and everything after it is incomplete. Only the owner can establish which.
- **Needed for the gate:**
  - the owner's account of any manual change on 10–11 November;
  - authoritative production counts of families, children and users, from a read the owner runs or authorises, printing counts only;
  - the restored copy's counts from the drill, compared with production.

## 21. Owner follow-up on #64: confirmation bound to what the parent saw (design, v1.20)

The owner reviewed head `7100b78` and approved the wording and visual direction: "Lara's savings for Bike ended", "40 saved points released · Bigger goal turned off", "Fully saved!", "Ready to redeem", and the warning with "Keep saving". Final sign-off stays with the owner. Two integrity fixes are required.

### 21.1 A confirmation is a snapshot, not a boolean

**The race.** The warning showed Lara's 40 points. Another parent then saved 30 more. A boolean confirmation would have released 70. Equally, a child not in the warning could have become affected.

**Contract.** `confirm_end_savings` is the **snapshot** the parent was shown:
- `goal_epoch`, and the `goal_child_epochs` of the reward row;
- `children: [{ child_id, saved }]`.

The server works out what the edit would end, under the reward's `FOR UPDATE` lock, before writing anything (a dry run of `recordEndedSavings`). It proceeds only if all three of these hold:
1. the snapshot's epochs equal the locked row's;
2. the snapshot's children are exactly the affected children;
3. each child's `saved` is exactly the amount that would be released.

Otherwise it returns 409 `ENDS_SAVINGS` and changes nothing. The 409 carries the server's current `ending` (`[{ child_id, name, saved }]`) and its `snapshot`. The form shows that list as the refreshed per-child warning, and the parent must confirm again; the form then sends the server's snapshot. A boolean `true` is no longer accepted.

The check runs under the reward lock, and every savings writer takes the reward `FOR SHARE` first (§19.7 S6). So nothing can change between the check and the write.

### 21.2 Deleting a reward is confirmed the same way

`DELETE /api/rewards/:id` takes the same snapshot in its JSON body, with the same dry run under the reward lock (cause `deleted`), and the same 409 with `ending` and `snapshot`.

The form's Delete confirmation lists each affected child: "{Child}: {n} saved points will become available again." It does this from the form's figures first, then from the server's on a 409. A reward with no savings needs no snapshot. The append-only record and the rollback rules are unchanged.

### 21.3 Client

- `Reward.update` and `Reward.delete` keep the 409's `code`, `ending` and `snapshot`.
- The form keeps a `serverEnding` state. On a 409 it shows that list, both in the warning and in the confirmation, and sends that snapshot when confirmed.
- The pages pass the form the **latest** reward row (looked up by id in the refreshed list), so the epochs the form sends are current.

### 21.4 Tests

**Server:**
- a matching snapshot goes through;
- a save between the warning and the confirmation gets 409, nothing changed, and the refreshed snapshot then goes through;
- a second child becoming affected gets 409;
- un-mark and re-mark by another parent, with equal amounts re-saved, gets 409 (the epochs differ);
- the boolean `true` gets 409;
- two concurrent confirmed edits produce one record per child;
- delete:
  - without a snapshot: 409, reward kept;
  - stale: 409;
  - correct: 200, with a `deleted` record per child;
  - a reward without savings needs no snapshot.

**Screens:**
- the delete confirmation lists each child;
- a 409 shows the server's list;
- the next confirmation sends the server's snapshot.

**Mutations:**
- comparing only the child ids;
- ignoring the epochs;
- accepting a boolean;
- delete without the guard.

### 21.5 Design review, build and tests (v1.21)

**Design review** (fresh context). It found lock coverage sound: the dry run and the write run under the same reward lock, which every savings writer shares, and the 40P01 retry re-checks the same snapshot. It found one blocking gap and some should-fixes, all adopted:

| # | Finding | In the build |
| --- | --- | --- |
| B1 | Which row's epochs? | Both the check and the 409's snapshot use the reward **as it was before the edit** (the row locked `FOR UPDATE`), never the trigger-advanced row. A re-confirm with the server's snapshot succeeds (tested) |
| 1 | Epoch comparison | Normalised: lower-case keys, missing treated as 0, numbers, sorted, then compared |
| 2 | Compute once | The check's list is the list written (`recordEndedSavings(..., { ended })`) |
| 3 | Delete order | The check runs straight after the reward lock, before pending redemptions are denied; 409 rolls back |
| 4 | DELETE body | `Reward.delete(id, body)` sends JSON with its content type. Errors keep `code`, `ending` and `snapshot` (shared `entityError`) |
| 5 | Empty ending | Proceeds with or without a snapshot. A non-empty ending needs a matching snapshot |
| 6 | 409 loop on a stale page | A 409's list (`serverEnding`) forces the warning and the confirmation even when this page saw no savings. It is cleared when the goal switch or the children change, and when the form opens. `save` and `remove` return `{ needsConfirm }` instead of swallowing the error |
| 7 | Latest row | The pages pass the latest row by id, and fall back to the held row; saves use the held id, so a reward deleted meanwhile is never re-created |

**Tests.**
- Server: 43 savings tests, including:
  - a save after the warning;
  - a new child becoming affected;
  - un-mark and re-mark with equal amounts;
  - a child reassigned away and back with an equal amount;
  - a boolean refused;
  - concurrent confirmed edits;
  - delete: no snapshot, stale, boolean, correct, and a reward without savings.
- Screens: 30 tests, including a 409 list shown when the page saw nothing, the list dropped on change, and delete per child and on 409.
- Full suite: 1,024 pass.
- Browser suite: 46 passed and 14 skipped, as before.

**Mutations** (each red):
- amounts ignored;
- goal epoch ignored;
- child epochs ignored (red after the reassign-away-and-back test was added);
- boolean accepted;
- delete without the guard.

**Note.** On delete, denying pending redemptions can still meet a redeem in a lock cycle (child, then reward `FOR SHARE`); the 40P01 retry covers it.

### 21.6 Owner wording, 21 November: success and cancellation kept distinct (v1.22)

The owner gave this as product-copy direction, not merge authorisation.

| Event (server's real type) | Where | Wording |
| --- | --- | --- |
| A goal funded (`to_go` = 0) | Parent goal rows (Home, Children card and milestone) | "Saved!" (was "Fully saved!") |
| A goal funded | Child View "My next big adventure"; Home under the goal | "{Child} has saved enough for {goal}!", a celebration and not a redemption. A parent redeems a bigger goal (O7), so nothing child-facing says choose or redeem |
| A goal funded | Parent's savings dialog | "Ready to redeem": a parent action, shown only to the parent |
| `savings_ended` (un-marked) | Activity | "{Child}'s {goal} savings are back in {Child}'s points" · "{n} points returned · Bigger goal removed" |
| `savings_ended` (reassigned) | Activity | the same line · "Goal no longer for {Child}" |
| `savings_ended` (deleted) | Activity | the same line · "Reward deleted" |

- Singular throughout ("1 point returned").
- No cancellation line says the points were earned or the reward redeemed, and none uses success wording (tested).
- **Pronouns:** the owner's example said "her points". No pronouns are stored, so the line repeats the child's name. **Owner to confirm.**
- **"Ready to choose your reward!"** is for a place where a child genuinely selects a reward. Today Child View's rewards a child can afford carry the approved caption "Ask a parent", and goals are not choosable. So there is no screen to apply it to yet. **Owner to confirm** whether it should replace an existing caption.

