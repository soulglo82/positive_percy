# V1 operations: backups, retention and recovery

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-22 |
| Owner | Percy V1 engineering. Every change to the live bucket or the backup service is the owner's decision |
| Status | Findings and proposals. Nothing here has been changed in production |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.1 | 2026-11-22 | Owner's review of #65: the cause of the 10–11 November change is not called deliberate or confirmed; the 10 November archive is held under restricted storage until its status is decided; no expiry before that decision and the backup-job hardening; no indefinite unreviewed retention afterwards |
| 1.0 | 2026-11-22 | First issue: the 10–11 November archive-size change, the retention proposal, the review of the backup hardening PR and its deployment plan |

## 1. The archive-size change of 10–11 November (issue #44)

**Recorded sizes** (Railway `db-backup` logs; owner's reading, and engineering's own read of the 20 and 21 November runs):

| Run (19:01–19:02 UTC) | Archive |
| --- | --- |
| 10 November | 8.68 MB |
| 11 November | 646.44 kB |
| 18 November | 653.76 kB |
| 19 November | 654.41 kB |
| 20 November | 655.44 kB |
| 21 November | 655.45 kB |

**What the evidence supports.** The contents of the database changed between the two runs. The archives since are not shown to be truncated.

| Evidence | Source | What it shows |
| --- | --- | --- |
| Between the 10 and 11 November archives: families 9 → 2, children 12 → 6, users 10 → 2, uploads 14 → 3; point events 1,167 → 1,211 and redemptions 248 → 302 by 20 November | Owner's read-only inspection of the archives (#60 comment, 21 November) | Rows were removed for some families while activity for the remaining ones continued. A truncated dump would not raise later counts |
| The 20 November archive passes its gzip check, its tar structure reads, and its `schema_migrations` lists 001–012 | The same inspection | That archive is structurally whole |
| Photos are stored in the database as base64 text (`uploads.data`), up to 2 MB each before encoding | `server/db.js` | Removing 11 photos accounts for megabytes; base64 of a photo barely compresses. This fits 8.68 MB → 0.65 MB |
| Sizes since 11 November rise by 0.01–7 kB a day | Railway logs | A small database growing slowly. A dump cut short would vary |
| No code that ran in production deletes a family or a user. Deleting a child removes that child's history and photo only | Search of the default branch and of every deployed commit (D1 design §20.9) | The app did not remove the families |
| On 11 November (15:50 UTC) PR #39 added a guard that rejects sessions "for removed families … preventing old tokens from writing orphan rows" | `docs/BATCH_C_PR1_IMPLEMENTATION.md` on the default branch | Families had been removed outside the app by then, and it was known at the time |
| Railway keeps no deploy or request logs for 10–11 November | Railway log queries, 21 and 22 November | Nothing more can be read from the platform |

**Conclusion.** The evidence is consistent with the records of seven families (with their children, users and photos) having been removed directly in the database on 11 November. **Who removed them, and why, is unproven.** Whether those families were real or test data is not known. Nothing engineering can read settles either point, so this item is not closed.

**What closes the item** (owner):
1. Establish who removed the seven families on 11 November and why, and whether they were real families or test data.
2. Give the live counts of families, children and users (a counts-only query, §5), to compare with the restored copy's counts from the drill.
3. Decide what happens to the 10 November archive. **Until then, keep it under restricted storage** (access limited to the owner; not copied to GitHub, CI, logs or chat). It is the only copy of the removed families' data. If the removal was a clean-up of test data, the archive can expire. If any of it was a real family's data removed at their request, it should not be kept; if removed by mistake, it is the only way back. **A retention rule (§2) would delete it 35 days after 10 November.**
4. Once its status is decided, do not leave the archive, or the bucket, on indefinite unreviewed retention: apply the expiry rule (§2) or delete the archive deliberately.

## 2. R2 retention

**Verified** (owner's Cloudflare inspection, 21–22 November): bucket `positive-percy-db-backups` has no object-expiration rule, only the default seven-day clean-up of incomplete multipart uploads, and no bucket-lock rule. So the 35-day retention discussed earlier is **not enforced**: every archive is kept for ever.

**Proposal** (not applied):

| Setting | Value | Reason |
| --- | --- | --- |
| Object expiration | Delete objects 35 days after creation, for the backup prefix only | Matches the period already discussed. It bounds how long a removed family's data stays in backups, which the privacy drafts must state exactly |
| Incomplete multipart uploads | Keep the seven-day abort rule | Unchanged |
| Bucket lock | None | A lock would stop an archive being deleted early when a family's data must go |
| Order | Enable expiration only after §1 item 3 is decided, and after the hardened backup job (§3) has run for a few days | With 35-day expiry, a backup job that fails silently for 35 days leaves no backup at all. The hardened job exits non-zero on failure, which Railway shows as a failed run |

**Compatibility.**
- **Recovery:** 35 daily archives. The app has no point-in-time recovery; the newest archive is at most 24 hours old.
- **Privacy:** data removed from the live database is gone from every backup after at most 35 days. Until permanent family deletion is built (Batch C, not in V1), this is the only removal there is.
- **The restore drill:** uses one recent archive; unaffected.

## 3. Backup hardening (soulglo82/postgres-s3-backups PR #1)

Reviewed independently on 22 November at branch tip `5c79d6f` (nine commits ahead of the deployed `5665c7d`), by building it and running it against a throwaway local database. **Not ready to deploy as it stands: one blocking finding.**

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| B1 | Blocking | When validation fails (a `pg_restore` error, a renamed table among the hard-coded required tables, or a size under 1,024 bytes), the job stops before uploading. A backup is then not kept at all. The project's rule is to keep it and alert | Once `pg_dump` exits 0, always upload. On a validation failure, upload under a key marked unverified, then exit non-zero |
| S1 | Should fix | "Validated" claims too much. It proves the gzip checksum and a readable table of contents. A tar cut to 300 kB of 7.7 MB still passed `pg_restore --list`. It cannot prove the archive is complete against the live database | Check the tar structure (every data member and the trailing `restore.sql`), and log each table's member size. That log would also have explained 8.68 MB → 0.65 MB at a glance |
| S2 | Should fix | On a `pg_dump` failure, the error text and exit code are not logged | Log both, with the connection string removed |
| S3 | Should fix | The size check compares only with the previous archive and only warns. It would have warned once on 11 November and has been silent since | Compare with the largest or median of the last 14, add a minimum size, and log as an error |
| S4 | Should fix | No time limits on the read-back or the audit; a hung call leaves the run "running" | Add time limits |
| S5 | Should fix | `SUPPORT_OBJECT_LOCK` is still accepted but no longer does anything | Restore it or refuse it |
| S6 | Should fix | Two settings behave differently: a trailing slash on `BUCKET_SUBFOLDER` is stripped (the key prefix could change), and quoted `BACKUP_OPTIONS` are rejected | Check both production values before deploying |
| S7 | Should fix | The tests cover only the dump step with a fake `pg_dump`. Two mutations survive: treating a killed `pg_dump` as success, and removing the archive check with the read-back off | Add tests for both |
| S8 | Should fix | The workflow has no `permissions`, unpinned actions, and no Docker build | Add them |

**Sound as built:** `pg_dump` failure detection (exit code, signal, spawn error); the read-back (a streamed SHA-256 and the size, not an ETag, so safe for multipart); the audit is read-only and never fails a backup; no secrets or family data in the logs; key names, the schedule and required settings are unchanged.

**Note.** The deployed version prints the failed command, which includes the database URL, if `pg_dump` fails. If any past failed run is found in the logs, rotate the database password.

### Deployment plan for the backup service (after B1 is fixed and the owner approves)

1. Record the current Railway settings of `db-backup`: `BUCKET_SUBFOLDER`, `BACKUP_OPTIONS`, `SUPPORT_OBJECT_LOCK`, `PG_VERSION`, `NODE_VERSION`, `SINGLE_SHOT_MODE`, the current deployment id, and the bucket's key and size listing.
2. Fix B1 (and ideally S1, S2 and S4) on the PR; CI green.
3. Deploy just after a successful 19:02 UTC run, then trigger one manual run.
4. In the logs, expect: `pg_dump (PostgreSQL) 17.x`, the compressed size, "R2 readback SHA-256 and byte length match source", the audit's object count up by one, and exit 0.
5. In the R2 dashboard, expect one new object with the same prefix and that size. No download is needed.
6. **Roll back** by redeploying the recorded deployment (`5665c7d`). No setting needs undoing; key names are the same.

**This is a separate release from V1.** The V1 app release does not depend on it, but a fresh, verified backup before the V1 deploy does (release checklist §4).

## 4. The restore drill on real data

Not run: it needs the archive, read-only R2 keys and a local Docker daemon on a trusted machine, and none of those may come into an engineering session or GitHub. The synthetic tests (41 checks in CI) prove the tool, not the data.

**The owner runs** (at the release-candidate commit named in the release assessment):

```
npm ci
PERCY_RESTORE_DRILL_ACK=isolated-docker-only PERCY_EXPECT_HEAD=<RC commit> PERCY_REPORT_DIR=<new private folder> PERCY_BACKUP_FILE=<archive> bash scripts/d1-restore-reconcile.sh
```

It restores into PostgreSQL 17 with no network, applies migrations 014 and 015, then 016 and 017, rolls 017 and 016 back and applies them again, and compares every table and every child's balance at each step. Exit 0 means every step was unchanged. The terminal shows step names and the family and child counts only. `d1-reconcile-report.json` stays private.

## 5. Counts-only query for production (owner)

Read-only, and it returns three numbers:

```sql
SELECT (SELECT count(*) FROM families) AS families,
       (SELECT count(*) FROM children) AS children,
       (SELECT count(*) FROM users)    AS users;
```

Compare with `families` and `children` printed by the drill, and with the owner's archive inspection (2, 6 and 2 on 20 November).
