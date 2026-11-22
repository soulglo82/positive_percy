# V1 release-candidate checklist

| Field | Value |
| --- | --- |
| Version | 1.3 |
| Issued | 2026-11-20 |
| Owner | Percy V1 engineering |
| Status | Release candidate prepared. No merge or deployment is authorised by this document |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.3 | 2026-11-22 | Owner's review of #65: rollback now requires a write freeze (§5, rehearsed); G7 split into technical security and legal/privacy; the savings check joins the post-deploy steps |
| 1.2 | 2026-11-22 | Final validation. Savings is built (#64), so the release adds migrations 014–017. Gates restated as G1–G8 with owner and state. The release order is now one release-candidate pull request. Rollback rehearsed and its limits recorded (§5). Backup and retention items point to `V1-OPERATIONS-BACKUP.md` |
| 1.1 | 2026-11-21 | Owner decision: V1 launches with all three core features, savings included; the reduced first release is removed. Restored-backup run now one command (#60, D1 §18) |
| 1.0 | 2026-11-20 | First checklist: Railway correction done, migration path established, gates listed |

## 1. What a release changes in production (checked 2026-11-22)

| Fact | Evidence |
| --- | --- |
| Railway has one environment, `production`, with four services: the app (`compassionate-growth`), `percy-stage1-design-selector`, `Postgres` and `db-backup` | Railway project "Positive Percy", service list (read only) |
| The app service has only ever deployed the default branch, `claude/migrate-base64-percy-code-PNAym`. Its head and live commit is `498e798` | Railway deployment list (read only); `git fetch` of the default branch, 22 November |
| **Merging into the default branch is the deployment.** Railway builds and starts the app from that branch on every push, and does not wait for CI | Railway service settings, read 22 November: source branch is the default branch, `checkSuites` is off |
| The app service builds with `npm install && npm run build`, starts with `npm start`, and has a health check on `/api/health` with a 120-second limit | The same settings (read only) |
| Production's database is at migration **012**. The V1 release adds **014** (Today's Goals), **015** (reward icons), **016** (savings ledger) and **017** (the reason savings ended) | `server/migrations/` on the default branch and on the release candidate |
| Migrations run when the app starts, in name order, each once and each in its own transaction. A failure stops the start, so the health check never passes | `server/db.js` (`runMigrations`), `server/migrate.js` |
| With a health check set, Railway switches traffic to a new deployment only after the check passes | Railway's documented behaviour; **not tested here**, so §5 does not rely on it |
| 013 is reserved by the unmerged recoverable-deletion branch (`feat/batch-c-pr5-recoverable-account-deletion`). A later 013 still runs once | `server/migrate.js` |
| The app's build and start settings live in the Railway service, not in a file (#30, `0236cfc`) | Neither the default branch nor the release candidate tracks a `railway.json` or `railway.toml` (`git ls-files`) |
| The default branch is an ancestor of the release candidate, so the release candidate adds commits and removes none | `git merge-base --is-ancestor 498e798 <RC head>` |

## 2. Done

| Item | Where |
| --- | --- |
| **Railway correction.** The V1 line had inherited the design preview's `railway.json` (`ad6e628`), which builds nothing and starts the static Stage 1 selector. Removed on the integration base (`c792a37`) and carried through the stack | `claude/percy-v1-integration` and the stack |
| **Migration 015 compatibility.** No persistent database has run the earlier 71-id draft | D1 design §16 |
| **The restored-backup tool** restores into an isolated PostgreSQL 17, applies 014 and 015, then cycles 016 and 017, and compares every table and balance at each step. 41 checks in CI, on synthetic data | #60 and #64, `scripts/d1-restore-reconcile.sh`, D1 design §18 |
| **Savings built** (save, move back, undo, redeem a bigger goal, ending savings with a figure-bound confirmation) with its screens at four sizes | #64, D1 design §19–§21 |
| **Final integrated validation** of #57–#64 against issue #56: functional review, visual review at 320, 390, 834 and 1280, brand check, rollback rehearsal | `V1-RELEASE-ASSESSMENT.md` |
| Every PR has had a design review before the build and a code review after it | Design notes §§ "Peer review" and "Post-build code review" |

## 3. Gates before any production release

| Gate | What passes it | Owner | State (22 November) |
| --- | --- | --- | --- |
| **G1 Functional** | Every V1 journey works on the combined build; no critical or major defect open | Engineering | **Passed** on the release candidate (assessment §3) |
| **G2 Visual** | The owner accepts the integrated pack at the four sizes | Owner | Engineering review done and defects fixed. Owner asked for two changes on 22 November (assessment §3.1); **open** |
| **G3 Data preservation** | The drill on a real production archive exits 0 with every step unchanged, at the release-candidate commit | Owner runs it (`V1-OPERATIONS-BACKUP.md` §4); engineering reads the counts | **Open.** Synthetic proof only |
| **G4 Backup safety** | A fresh backup exists, is whole, and the 10–11 November change (#44) is explained | Owner | **Open.** Cause inferred, not confirmed (`V1-OPERATIONS-BACKUP.md` §1) |
| **G5 Operational** | Railway settings unchanged; `railway.json` absent; health check known; rollback with a write freeze rehearsed; the owner can run SQL on the production database | Engineering; owner for the database access and the Railway settings | Freeze rehearsed on synthetic data (§5). **Open:** the owner's database access, tried once read-only |
| **G6 Assets** | Runtime assets match the register; gated artwork stays out; no AI-generated replacement | Engineering; owner for the open artwork items | Register and gate **passed**. Fox 1A live fidelity sign-off and the final points-star are **open with the owner** and do not change code |
| **G7a Security (technical)** | Family isolation holds; no secrets or family data in the repository, logs or evidence; permanent deletion stays off | Engineering | **Passed** (assessment §3 and §6). Privacy wording and shared carers stay "Review" and "Planned" |
| **G7b Legal and privacy for a public launch** | Privacy policy, data-processor list, rights and contact wording, and the privacy-request procedure while permanent deletion is off | Owner, with legal advice | **Not reviewed.** Separate from G7a; no engineering check covers it (assessment §5) |
| **G8 Release** | The owner approves the exact tested release-candidate commit | Owner | **Open** |

**Not gates for V1.** Backup hardening (soulglo82/postgres-s3-backups PR #1) and the R2 expiry rule are separate changes (`V1-OPERATIONS-BACKUP.md` §2–§3). They must be done before permanent family deletion is ever enabled; V1 needs only one fresh, whole backup taken before the deploy. The Freepik map needs its licence before it is shown; V1 ships without it.

## 4. Release order (when the gates pass)

1. **Scope (owner decision, 2026-11-21):** V1 launches with all three core features, including saving points towards bigger goals.
2. **One release-candidate pull request** from `claude/percy-v1-rc` into the default branch. It contains #57, #58, #59, #60, #61, #62, #63 and #64. The stacked PRs stay open as the review record and close when the release candidate merges. The exact commit, and CI at that commit, are in the assessment §7.
3. **Before merging** (the merge deploys):
   - G3: the drill has passed at this exact commit;
   - a fresh backup: wait for the 19:02 UTC run or trigger one, then confirm in the R2 dashboard that the new object exists and its size is in line with the last days (about 655 kB on 21 November). Download it and keep it privately until the release has settled;
   - the Railway app service's settings are as in §1 (build `npm install && npm run build`, start `npm start`, health check `/api/health`);
   - no `railway.json` or `railway.toml` at the head. This is checked once for the approved commit (assessment §7); it cannot change without changing the commit;
   - CI (`build-and-test`, `ui`) is green at the head being merged, read from GitHub;
   - pick a quiet time. Each start applies four migrations; on a database this size they take seconds.
4. **Deploy:** the owner merges the release-candidate PR. Railway builds, starts the app, and the app applies 014–017.
5. **After deploy:**
   - Railway shows the new deployment as active, at the release-candidate commit;
   - `GET /api/health` returns 200;
   - the deploy log shows migrations 014, 015, 016 and 017 applied, with no error;
   - the counts of families, children and users are unchanged (`V1-OPERATIONS-BACKUP.md` §5), and each child's points are the same as before the deploy;
   - `scripts/ops/savings-check.sql` (read-only): conditions 1 to 4 are zero; a count under condition 5 is a difference already in a family's history, to be looked at with the real-backup reconciliation. `write-freeze-status.sql` says `NOT FROZEN`;
   - a parent journey on production: sign in, award a point, undo it, open Rewards, open Activity, open Child View;
   - the design-selector service is unaffected;
   - the next 19:02 UTC backup runs and its size is in line.
6. **If a step in 5 fails,** follow §5.

## 5. Rollback and recovery

**This section does not replace gate G3.** The write-freeze rehearsal ran on synthetic data and covers one risk, an app rollback after V1 has been used. The restore of a real production backup and its reconciliation are separate, are the owner's to run, and have not been run.

**An app rollback is safe only with writes frozen** (owner's review of #65). Once V1 has been used to save points, the production app at `498e798` treats saved points as spendable, deletes or reassigns a bigger goal with no "savings ended" record, and undoes a goal redemption without returning its savings. The rehearsal showed each of these on a database with writes on. "Keep a rollback short" is not a control and is withdrawn.

**The control is a write freeze in the database**, turned on before the old app serves and off only after the fixed V1 is serving and the savings check passes. Design, review and rehearsal: `V1-ROLLBACK-FREEZE-DESIGN.md`. Scripts: `scripts/ops/`.

| Situation | Action |
| --- | --- |
| A migration fails at start | The new deployment never becomes healthy and V1 has not served, so no savings exist and no freeze is needed. Each migration runs in one transaction, so the failed one leaves nothing behind; any that ran before it stay, and `498e798` works with them. If Railway is not still serving `498e798`, redeploy it. Then fix forward |
| The app is up but wrong | 1. Owner runs `write-freeze-on.sql`; the status script must say `FROZEN`; owner runs `savings-check.sql` and keeps its output (the baseline). 2. Railway: redeploy `498e798`; it serves reads only. 3. Engineering fixes forward. 4. Owner deploys the fixed V1 with the freeze still on (the fix must not carry a migration that changes rows). 5. Owner runs `savings-check.sql`: its output must be identical to the baseline. 6. Owner runs `write-freeze-off.sql`, then one award and its undo. **The freeze is never lifted while `498e798` is serving. The database is never rolled back** |
| A rollback happened with writes on | Freeze at once, then continue from step 3. `savings-check.sql` shows what the old app did, child by child, for a correction agreed with the owner |
| Data is damaged | Restore the pre-deploy backup into a new database and compare before switching. This loses everything written since that backup, so it is the last resort and the owner's decision |

**During the freeze** parents can read everything; any change fails with the app's ordinary "couldn't save" message. A family with no user row would be signed out (the freeze script counts them first).

**Rehearsed on 22 November** (disposable databases, synthetic data): 166 checks, none failed; four controls proved the hazard and that the check catches it (`V1-ROLLBACK-FREEZE-DESIGN.md` §10). An earlier rehearsal without the freeze showed only that the old app runs on the V1 database.

**To confirm before release (owner):**
- access to run SQL on the production database through Railway, tried once with the read-only status script (it should say `NOT FROZEN`);
- that Railway keeps the old deployment serving when a new one fails its health check (documented behaviour; not tested here).

**Other limits.**
- Rewards that carry a V1 icon show the old app's default artwork during a rollback; nothing is lost.
- `server/rollbacks/016_…` and `017_…` are for scratch databases before launch only. After launch the savings ledger is never rolled back (owner, D1 §13).

## 6. Backups and retention

`V1-OPERATIONS-BACKUP.md` holds the 10–11 November finding, the retention proposal (not applied), the review of the backup hardening PR (not merged; one blocking finding) and the drill command.
