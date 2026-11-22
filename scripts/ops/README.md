# Operations scripts: the rollback write freeze

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Date | 2026-11-22 |
| Owner | Percy V1 engineering. Running any of these on production is the owner's action only |
| Status | Built and rehearsed on disposable local databases. Never run on production |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.1 | 2026-11-22 | Post-build review: the savings check is compared with a baseline taken when the freeze goes on; a trigger counts as frozen only if it fires for the app and calls the freeze function |
| 1.0 | 2026-11-22 | First issue: the four scripts of the rollback write freeze |

## What these are

The design, the procedure and the reasons are in
[`docs/engineering/V1-ROLLBACK-FREEZE-DESIGN.md`](../../docs/engineering/V1-ROLLBACK-FREEZE-DESIGN.md).
Read §4 (the procedure) before running anything here.

| Script | What it is for | Changes anything? |
| --- | --- | --- |
| `write-freeze-on.sql` | Turns the freeze on: no row in any application table can be inserted, changed, deleted or truncated. Reads work; the app starts. Its last result gives the number of tables frozen and the number of families with no row in `users` (they would be signed out) | Adds one function and two triggers per table. No row changes |
| `write-freeze-off.sql` | Turns the freeze off: drops those triggers and the function | Removes only what the on script added |
| `write-freeze-status.sql` | Lists every table with whether each trigger is there and enabled, then one verdict: `FROZEN`, `NOT FROZEN` or `PARTLY FROZEN` (treat as an error: run the on script again) | No. Read-only |
| `savings-check.sql` | The five conditions that must hold before writes resume (design §3): one row each with a count and child ids, then `SAVINGS CHECK: PASS` or `SAVINGS CHECK: FAIL`. Needs a database at migration 017 | No. Read-only |

## Who runs them, and when

- **Only the owner runs them.** Nothing in the app, in CI or in a deploy runs them.
- **`write-freeze-on.sql` and `write-freeze-off.sql` are run only during a rollback**, in the order the design's §4 gives: on, status (`FROZEN`), redeploy the old app, fix forward, deploy the fixed V1 with the freeze still on, savings check (`PASS`), off, status (`NOT FROZEN`). The freeze is never lifted while the old app is serving.
- **`write-freeze-status.sql` and `savings-check.sql` are read-only and may be run at any time.**
- Each on and off script is one transaction and is safe to run twice. If one stops with a lock time-out, nothing was changed: run it again.

## How to run one

Paste the whole file into the database console for the Postgres service, or run it with `psql`. The files are plain SQL: no `psql` commands. Each file starts with a header that says what it does and how to check the result; the result to read is always the **last** one.

## Rehearsal

`docs/engineering/evidence/v1-integrated/tools/rollback-freeze-rehearsal.cjs` runs these scripts, as they are, against both app versions on new local databases with synthetic data (design §7):

```
node docs/engineering/evidence/v1-integrated/tools/rollback-freeze-rehearsal.cjs <v1 dir> <production commit dir> postgres://postgres:postgres@localhost:5432
```

It is run by hand before each release. It is not in CI.

## Two things to keep in mind

- **The savings check is compared, not passed.** Run `savings-check.sql` straight after the freeze goes on and keep its output. Before the freeze comes off, its output must be identical. Correct data can show a count (for example a requested reward whose price a parent raised), so an absolute `PASS` is not the test.
- **This is not the backup test.** These scripts and their rehearsal cover an app rollback, on synthetic data. They do not replace restoring a real production backup into an isolated database and reconciling it (`scripts/d1-restore-reconcile.sh`, release gate G3).

