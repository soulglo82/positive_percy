# V1 release-candidate checklist

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-20 |
| Owner | Percy V1 engineering |
| Status | Preparation. No merge or deployment is authorised by this document |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-20 | First checklist: Railway correction done, migration path established, gates listed |

## 1. What a release changes in production (checked 2026-11-20)

| Fact | Evidence |
| --- | --- |
| Railway has one environment, `production`, with four services: the app (`compassionate-growth`), `percy-stage1-design-selector`, `Postgres` and `db-backup` | Railway project "Positive Percy", service list (read only) |
| The app service has only ever deployed the default branch, `claude/migrate-base64-percy-code-PNAym`. Its live commit is `498e798` | Railway deployment list (read only) |
| Production's database is at migration **012**. The V1 release adds **014** (Today's Goals) and **015** (reward icons), plus **016** (savings ledger) if D1 ships | `git ls-tree` of the default branch and the V1 branches |
| 013 is reserved by the unmerged recoverable-deletion branch (`feat/batch-c-pr5-recoverable-account-deletion`). Migrations run in name order and are skipped once recorded, so a later 013 still runs once | `server/migrate.js` |
| The app's build and start settings live in the Railway service, not in a file (#30, `0236cfc`) | Default branch has no `railway.json` |

## 2. Done

| Item | Where |
| --- | --- |
| **Railway correction.** The V1 line had inherited the design preview's `railway.json` (`ad6e628`), which builds nothing and starts the static Stage 1 selector. Merging it would have switched production to the selector. Removed on the integration base (`c792a37`) and merged through #57, #58, #59, #61, #62 and #63 | `claude/percy-v1-integration` and the stack |
| **Migration 015 compatibility.** No persistent database has run the earlier 71-id draft. Production deploys only the default branch (no 015); the selector service has no database; CI and test databases are rebuilt each run | D1 design §16 |
| **The restored-backup run works on a copy at 012.** The CLI applies 014 and 015 first and proves they change nothing, then runs the 016 cycle. Tested on a database built exactly at 012 | #60, `scripts/d1-reconcile.mjs`, D1 design §16 |
| CI green on #59–#63; combined review pack v2.3 (910 unit/server tests, 42 browser tests, journeys) | Review pack v2.3 |
| Every PR has had a design review before the build and a code review after it | Design notes §§ "Peer review" and "Post-build code review" |

## 3. Gates before any production release

| Gate | Owner | State |
| --- | --- | --- |
| Restored-backup reconciliation (014, 015 and 016) on a verified, isolated copy, exit 0 with every step unchanged | Owner runs; engineering reviews the report | **Open** |
| D1 savings features (save, release, goal redeem) and their screens, then a complete UI review | Engineering after the reconciliation; owner review | **Open** |
| Final visual sign-off of the integrated app | Owner | Main-tab layout supported, artwork accepted; complete sign-off open |
| Final points-star artwork | Owner or designer | **Open** (placeholder in use) |
| Fox 1A live-app fidelity sign-off | Owner | **Open** (`RUNTIME_ASSETS.json` notes "live-app fidelity sign-off pending") |
| Goals empty-state Freepik map: licence evidence | Owner | **Open**; the map stays hidden behind its gate |
| Privacy and account controls, shared carers | Owner (legal and restore gates) | Shown as "Review" and "Planned"; not features |

## 4. Release order (when the gates pass)

1. **Choose the scope** (owner decision):
   - (a) V1 with D1 savings: #57, #58, #59, #61, #62, #63 and #60, with the savings features;
   - (b) V1 first without 016, then D1 as its own release once it passes.

   Recommendation: **(b)**. 014 and 015 are additive and proved by the same restored-backup run; 016 and the savings features follow once complete.
2. Merge the stack in order into `claude/percy-v1-integration`: #57, #58, #59, #61, #62, #63, then #60 if in scope. Then open one release-candidate PR from the integration branch into the default branch, with CI green at its head.
3. Before merging the release candidate:
   - a fresh backup;
   - confirm the Railway app service's build and start settings are unchanged (`vite build`, `node server/index.js`);
   - confirm `railway.json` is absent at the head.
4. After deploy:
   - `GET /api/health` returns 200;
   - `schema_migrations` lists 014 and 015 (and 016 if in scope);
   - a parent journey on production: sign in, award, approve a request, open Activity;
   - the design-selector service is unaffected.
5. **Reversal:**
   - Railway rollback to `498e798`. The app at 012 ignores the new tables and the `icon_key` column, which are additive.
   - 016 has its own rollback (`server/rollbacks/016_savings_ledger_down.sql`), but only before any savings exist. After launch, the savings ledger is preserved and not rolled back (owner, D1 §13).
