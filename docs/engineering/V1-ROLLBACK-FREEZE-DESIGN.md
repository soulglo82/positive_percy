# V1 rollback with a write freeze: design

| Field | Value |
| --- | --- |
| Version | 1.3 |
| Issued | 2026-11-22 |
| Owner | Percy V1 engineering. Running it on production is the owner's action only |
| Status | Reviewed (§9), built and rehearsed on disposable databases (§10). Nothing here has touched production |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.3 | 2026-11-22 | Post-build review (§11): the savings check is compared with a baseline taken when the freeze goes on, not required to be clean in absolute terms; only a trigger that fires for the app counts as frozen; rehearsal tightened (166 checks). States plainly that this rehearsal does not replace the restore and reconciliation of a real production backup |
| 1.2 | 2026-11-22 | Built and rehearsed (§10). Four statements of v1.1 were wrong and are corrected: condition 4, the pre-release run of the savings check, "the only read that writes", and what the lock time-out waits for |
| 1.1 | 2026-11-22 | Independent review adopted (§9): the freeze is never lifted before the fixed V1 is serving; the savings check covers reassignment, undo and deletion by the old app; sign-in for a family with no user row; a fixed error code; lock time-out; disabled triggers count as not frozen |
| 1.0 | 2026-11-22 | First design, from the owner's review of the release candidate (#65) |

> **What this is not.** This design and its rehearsal are about one risk: an app rollback after V1 has been used. They run on synthetic data. They do **not** replace the restore of a real production backup into an isolated database and its reconciliation (gate G3), which only the owner can run and which has not been run.

## 1. The problem (owner's review of #65, 22 November)

"A successful old-app rollback rehearsal is NOT a safe rollback while writes remain enabled." Once V1 has been used to save points, the production app at `498e798` running on the same database:

- treats saved points as spendable, so a redemption can spend points that are set aside;
- deletes a bigger-goal reward with no "savings ended" record, leaving its savings rows pointing at nothing useful;
- knows nothing of the confirmation that protects savings.

The release checklist said to "keep a rollback short". That is not a control. The owner asked for writes to be suspended for the whole rollback window, allocations reconciled before writes resume on V1, and the freeze and the way forward tested on a disposable database.

**Prior decisions found.** D1 design §13 (after launch the savings ledger is never rolled back; database rollback scripts are for scratch databases only). Release checklist §5 (app-only rollback; rehearsed without a freeze). Nothing earlier on a maintenance or read-only mode: neither app version has one.

## 2. Contract

1. **While the freeze is on, no row in any application table can be inserted, changed or deleted, by either app version or by hand.** Reads work. The app starts.
2. **The freeze is in the database, not in the app**, because the app being rolled back to (`498e798`) cannot be changed and has no read-only mode.
3. **It covers every application table by rule, not by a list**: every base table in the `public` schema except `schema_migrations`. A table added later is covered without anyone remembering it.
4. **Turning it on and off is one script each, safe to run twice**, and a third script reports the state.
5. **Writes resume only on V1, and only after a read-only check of every child's balance and savings passes.**
6. Nothing is installed in production until a rollback is actually needed. There is no migration and no change to the release candidate's schema.

## 3. Mechanism

`scripts/ops/write-freeze-on.sql` (one transaction):

- sets a five-second `lock_timeout`. Any open transaction on a table, a read as well as a write, makes it wait; if it times out nothing has changed and it is run again;
- creates the function `percy_write_freeze()`, which raises `Positive Percy is paused for maintenance: no changes are being saved` with error code `25006` (read-only). Not a unique-violation or deadlock code: the apps retry on those;
- prints how many families have no row in `users`. Signing in creates that row on first use, so under the freeze such a family would be signed out; the owner decides whether to wait for them (production had two families and two users on 20 November);
- for every base table in `public` except `schema_migrations`: a row-level trigger `percy_write_freeze` `BEFORE INSERT OR UPDATE OR DELETE … FOR EACH ROW`, and a statement-level trigger `percy_write_freeze_truncate` `BEFORE TRUNCATE`;
- row-level, so a statement that touches no row still succeeds. The production app's start-up runs `INSERT … WHERE NOT EXISTS` for default behaviours, which normally inserts nothing.

`scripts/ops/write-freeze-off.sql`: drops those triggers and the function.

`scripts/ops/write-freeze-status.sql`: lists every base table with whether it carries the trigger, **the trigger fires for the app (enabled, not replica-only) and it calls the freeze function**, and one line `FROZEN` (all do), `NOT FROZEN` (none do) or `PARTLY FROZEN` (a mix, or any disabled trigger: treat as an error).

`scripts/ops/savings-check.sql` (read-only, counts and child ids only, no names): the conditions that must hold before writes resume. Each is something the production app can break with writes on.

| # | Condition | What breaks it on the old app |
| --- | --- | --- |
| 1 | No child's saved total, and no (child, goal) saved amount, is negative | – (a sanity check) |
| 2 | No child has more committed than they own: `committed > total`, exactly as the reconcile tool computes it (saved, plus points held for requested rewards, by the same rule as the app) | A redemption that spends saved points |
| 3 | No (child, goal, generation) group whose raw ledger sum is above zero is left uncounted by V1's rule (the goal still exists, is still a bigger goal, and the generation is current) unless a "savings ended" row closes it | Deleting a goal reward; reassigning a goal away from a child (the old app writes no "savings ended" row; migration 016's trigger moves the generation on) |
| 4 | No redemption that was paid from savings, **for a goal that is still the child's current goal**, is reversed without the matching savings "undo" row | Undoing a V1 goal redemption on the old app: the total comes back, the savings do not. (Without the words in bold the check failed on correct V1 data: redeem a goal, delete the goal, undo the redemption rightly writes no undo row) |
| 5 | Every child's stored total equals the sum of its history, as the reconcile tool checks | Any partial write |

It prints one line per condition with a count and up to 20 child ids, and `SAVINGS CHECK: PASS` only when every count is zero.

**How its result is used.** Not as an absolute pass mark. Correct V1 data can trip it: a parent may raise the price of a reward a child has already asked for, so that child has more committed than they own (condition 2); and any difference already in a family's history trips condition 5. So the owner **keeps the output taken when the freeze goes on (the baseline), and the output before the freeze comes off must be identical to it.** Under a freeze nothing can change, so a difference means the freeze did not hold. It needs the V1 schema (migration 017): on today's production database, at 012, it stops because the savings columns do not exist. So it is **run once, read-only, straight after the V1 deploy**, as one of the post-deploy checks. Conditions 1 to 4 must be zero then (no savings exist yet, unless condition 2 shows a requested reward whose price was raised). A count under condition 5 would be a difference already in a family's history: not caused by the deploy, and to be looked at with the reconciliation of the real backup. The on, off and status scripts work at 012 and at 017.

### What a parent sees during the freeze

Reading works. Any change (an award, a redemption, an edit) fails with the app's ordinary "couldn't save" message. No in-app banner: neither app version has one, and adding one to V1 would not help while the old app is serving.

## 4. Procedure (replaces "keep a rollback short")

| Step | Who | Action |
| --- | --- | --- |
| 1 | Owner | Decide to roll back. Run `write-freeze-on.sql` on the production database, then `write-freeze-status.sql`: it must say `FROZEN`. Then run `savings-check.sql` and **keep its output: the baseline**. The database has no public address, so the scripts are run through Railway's own database console or connection for the Postgres service, by pasting the file's contents; the app's container is not used (after step 2 it no longer holds these files). **The owner's access to do this is to be confirmed and tried once, read-only, with the status script before release** |
| 2 | Owner | Railway: redeploy `498e798`. It serves reads only |
| 3 | Engineering | Fix forward on a new commit; CI green |
| 4 | Owner | Deploy the fixed V1 **with the freeze still on**. A fix deployed under the freeze must not carry a migration that changes rows (it would fail and the app would not start). A data correction ships in a later deploy, after step 6. **The freeze is never lifted while `498e798` is serving** |
| 5 | Owner | Run `savings-check.sql`. Its output must be **identical to the baseline from step 1**. If it differs, stop: writes stay off, and engineering investigates on a restored copy |
| 6 | Owner | Run `write-freeze-off.sql`, then the status script (`NOT FROZEN`), then one award and its undo on production |

If the rollback happened **without** the freeze (a mistake, or an automatic platform rollback): turn the freeze on as soon as it is noticed, then continue from step 3. There is no baseline in that case, so `savings-check.sql` is read in absolute terms: it shows what the old app did, child by child, for a manual correction agreed with the owner (anything it lists that was already so before the rollback has to be told apart by hand).

A failed migration at deploy time needs none of this: V1 never served, so no savings exist, and Railway keeps the old deployment.

## 5. Code paths and what could defeat it

| Path | Covered by |
| --- | --- |
| Any `INSERT`, `UPDATE`, `DELETE` from either app version, including rows removed by a cascading delete | Row triggers on every table |
| `TRUNCATE` | Statement trigger |
| A table created after the freeze was turned on | Not covered until the script is run again; the status script reports it as `PARTLY FROZEN` |
| A superuser disabling triggers (`ALTER TABLE … DISABLE TRIGGER`, `session_replication_role = replica`) | Not prevented. Only the owner holds that access |
| The app's own migrations at start | Schema changes are not blocked; a migration that changes rows fails, so the app does not start (step 4) |
| `INSERT … ON CONFLICT DO NOTHING` that would insert nothing | The row trigger still fires and refuses it. No start-up path in either version depends on one (review) |
| Signing in as a family that has no row in `users` | `GET /api/auth/me` inserts that row, so it fails under the freeze and the browser signs the family out. Counted by the on and status scripts before the freeze |
| Creating a new family | Refused (intended) |
| Page loads that also write | Three, found by the rehearsal. `GET /api/auth/me` for a family with no user row (above): the family is signed out. The page-load `PUT /api/family/timezone` for a family with no timezone: refused, and both apps' pages ignore the reply. The badge check after an award: the award itself is refused first. Every other read on both versions returned 200 under the freeze (§10) |

## 6. Edge cases (input → expected)

| Input | Expected |
| --- | --- |
| `write-freeze-on.sql` run twice | Same state; no error |
| `write-freeze-off.sql` run when not frozen | No error |
| Old app, frozen: redeem a reward when points are saved | Refused; no row changes |
| Old app, frozen: delete a bigger goal that has savings | Refused; the goal and its savings rows remain |
| Old app, frozen: delete a child (cascades) | Refused; nothing removed |
| V1, frozen: save towards a goal | Refused |
| Old app started while frozen | Starts; health check passes |
| V1 started while frozen (no new migration) | Starts; health check passes |
| Old app, **not** frozen: redeem with saved points (the control) | Succeeds and leaves the child's saved total above the child's total: `savings-check.sql` reports it. This proves the hazard is real and that the check sees it |

## 7. Test plan (disposable database, synthetic data)

One script, `docs/engineering/evidence/v1-integrated/tools/rollback-freeze-rehearsal.cjs`, in the style of the existing rehearsal:

1. V1 on a new database: migrate to 017; a family, two children, a bigger goal with savings, an ordinary reward, a requested reward.
2. Record a checksum of every table (row count and a hash of all rows).
3. Freeze on. Status says `FROZEN`. Run it again: still `FROZEN`.
4. Start `498e798`. Health passes. Every read endpoint the app uses is called: all succeed.
5. Every kind of write is attempted (award, redeem, reward edit, reward reassign, reward delete, child delete, behaviour edit, goal completion, undo of a redemption): all refused **with a 500 carrying the freeze, reached by a request that would otherwise succeed**. A 400, 404 or 409 does not count: it would mean the request never reached the database.
6. The checksums are unchanged.
7. Start V1. Reads succeed; a save is refused; `savings-check.sql` says `PASS`.
8. Freeze off. Status `NOT FROZEN`. A save succeeds on V1.
9. **Controls**, each on its own database with no freeze, each a thing the old app does: (a) redeem while points are saved; (b) delete a goal that has savings; (c) reassign a goal away from a child with savings; (d) undo a redemption V1 paid from savings. After each, `savings-check.sql` must **not** say `PASS`, and must name the condition in the table above.
10. A family with no `users` row: the on script reports the count as 1.

It exits non-zero on any miss. It is run by hand before each release and its output kept in the release assessment; it is not in CI, because CI has only the current commit's app (the production commit is a second checkout).

**Not covered:** Railway's own behaviour during a redeploy; a parent's browser holding an open page across the switch (their next change is simply refused); the owner's access to run SQL against production (the same access as for the counts query).

## 8. Rollout and reversal

Three SQL files and one rehearsal script in the repository. Nothing runs in production unless the owner runs it during a rollback. Reversal of the freeze is `write-freeze-off.sql`.

## 9. Design review (independent, before the build)

Two blocking findings, both adopted.

| # | Finding | Change |
| --- | --- | --- |
| B1 | The procedure let the freeze be lifted before a fix with a row-changing migration was deployed. The old app would then serve with writes on for the whole build, or for ever if the deploy failed | The exception is removed: the freeze is never lifted while `498e798` serves; a fix under the freeze is schema-only (§4 step 4) |
| B2 | The check passed after three things the old app can do: reassign a goal away from a child, undo a goal redemption, delete a goal (the saved amount reads as zero once the reward is gone) | Conditions 3 and 4 rewritten against the raw ledger; each is a control in the rehearsal (§3, §7 step 9) |

Also adopted: a fixed, non-retried error code; the count of families with no user row; "a disabled trigger is not frozen"; a lock time-out; the access channel named and to be tried before release; "refused" in the rehearsal means a 500 from the trigger; the check run read-only on production before release.

Confirmed by the review from the code of both versions: both apps start under the freeze (their start-up changes no row on a healthy database); the only read that writes is `GET /api/auth/me`, for a family with no user row; cascades fire the row triggers; every transaction is rolled back and the connection released on the error; the browser retries once, not in a loop. A database-wide read-only setting was rejected: both apps run schema statements at start and would not boot.

**Not verified (owner):** that Railway keeps the old deployment serving when a new one fails its health check; the owner's access to run SQL on the production database.

## 10. Build and rehearsal (22 November, disposable databases, synthetic data)

Files: `scripts/ops/write-freeze-on.sql`, `write-freeze-off.sql`, `write-freeze-status.sql`, `savings-check.sql`, `README.md`; rehearsal `docs/engineering/evidence/v1-integrated/tools/rollback-freeze-rehearsal.cjs`.

**Result: 166 checks, 0 failed** on the final scripts (the first build's 164 passed twice, by the builder and again independently; three checks were added and one removed after the post-build review, §11).

| Step | Result |
| --- | --- |
| Freeze on | 14 of 14 tables frozen; status `FROZEN`; a second run leaves it `FROZEN` |
| `498e798` started while frozen | Starts; health check passes |
| Ten kinds of write on `498e798` (award, redeem, reward edit, reassign, behaviour edit, legacy goal contribution, undo, badge check, reward delete, child delete) | Each refused with a 500 and the freeze message in the server log. The same ten requests all succeed on an unfrozen database, so each really reached the trigger |
| Changes by hand (`UPDATE`, `INSERT`, `DELETE`, `TRUNCATE`) | Refused |
| Every table after the refused writes | Unchanged: row counts and hashes equal |
| V1 started while frozen | Starts; a save and a Today's Goal completion are refused |
| `savings-check.sql` under the freeze | `PASS` (all five counts zero) |
| Freeze off | Status `NOT FROZEN`; the same save and completion succeed |
| A trigger disabled, or a table added after the freeze | Status `PARTLY FROZEN` |
| A family with no user row | The on script reports the count as 1 |

**Controls: what the old app does with writes on, each on its own database.** Before the old app acted the check said `PASS`; after, `FAIL` on exactly the named condition.

| Control | Old-app action | Condition tripped |
| --- | --- | --- |
| a | Redeem while points are saved | 2 |
| b | Delete a goal that has savings | 3 |
| c | Reassign a goal away from a child with savings | 3 |
| d | Undo a redemption V1 paid from savings | 4 |

So the hazard in §1 is real, and the check sees each form of it.

**Reads under the freeze (all 200 on both versions):** health, family join and lookup, `auth/me`, timezone, streak, children and their filters, rewards, point events, redemptions, family goals, behaviours, quick actions, summary, the activity feed and its filters, the export, uploads; on V1 also Today's Goals.

**The rehearsal did not run:** Railway; the owner's database console; a browser left open across the switch.

## 11. Post-build review (independent)

No blocking defect. Adopted:

| # | Finding | Change |
| --- | --- | --- |
| 1 | The savings check can say `FAIL` on correct V1 data (a requested reward's price raised; a difference already in a family's history), which would have kept writes off for ever | The result is compared with a baseline taken when the freeze goes on (§3, §4 steps 1 and 5). The rehearsal asserts the two are equal row for row |
| 2 | The status script accepted a trigger enabled for replica sessions only, which never fires for the app, and did not check which function the trigger calls | Only a trigger that fires normally and calls `percy_write_freeze` counts. The rehearsal sets one trigger replica-only and expects `PARTLY FROZEN` |
| 3 | One rehearsal check compared a function's output with itself; the controls did not assert that only the named condition tripped | The first is removed; the second now asserts exactly the named condition |

Confirmed sound by the review: the on and off scripts are idempotent and cannot commit a partial freeze; the savings check is one read-only statement whose rules match the app's and the reconcile tool's.

