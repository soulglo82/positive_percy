# Batch C — Backup-safe erasure registry design (release blocker)

**Status:** Design only. Not implemented, not approved, and not safe to mark as completed. No production deletion flags may be enabled before this has been implemented and tested.

## Why this is necessary

Daily PostgreSQL backup archives uploaded to Cloudflare R2 contain family records at the time the snapshot was taken. A family may be purged from the live database seven days after requesting deletion; restoring a snapshot created **before that purge** could silently restore the family. The app's internal `auth_version` and `deletion_due_at` cannot solve this when both values come from an older snapshot.

ICO erasure guidance requires putting backup data **beyond use** when immediate overwriting is impracticable. The product also needs a disaster-recovery mechanism that never serves restored erased data.

## Trust boundary

An **independent erasure registry** lives outside the ordinary database and its backup retention cycle (for example a dedicated restricted Cloudflare R2 bucket). It must not be copied into the snapshots it protects.

The registry stores only the minimum necessary to suppress restoration:
- `familyKey`: HMAC-SHA256 of the family access code with a dedicated, stable, non-exported erasure secret. **Never plain SHA256**: the six-character family code has low entropy and could be brute-forced.
- `erasedAt`: UTC timestamp when irreversible expiry was confirmed, not request time.
- `schemaVersion` and a tamper-evident receipt identifier.
- No child name, points record, phone, image, token, plaintext family code or family name.

The private HMAC secret must be held separately from R2 and the database backups; maintain a secure key-rotation procedure so older registry entries remain checkable. Strictly limit R2 prefix access (writer used by purger, reader used by restoration gate).

Retention of registry records must cover the **maximum possible lifetime of any older backup snapshot**, including archive locks, legal holds and external copies; then follow the documented legal retention policy.

## Final purge protocol

1. Row-lock a family whose recovery deadline is in the past, in a transaction. Do not use the browser/API to run permanent purge.
2. Derive familyKey using the external erasure key, without logging the code or child data.
3. Durably write an immutable or versioned erasure receipt to the external registry, with a bounded timeout. If the write/verification fails, **abort purge and alert**.
4. Recheck eligibility under the same lock and run the family-scoped database purge.
5. Commit and record only non-identifying audit details. Idempotent retries must be safe if the registry write succeeds but the DB commit fails.
6. Never treat a successful R2 backup upload or a missing error message as proof of tombstone persistence.

An early receipt is permissible only once the recovery deadline has expired and the family is not recoverable. Do not create a permanent receipt during the seven-day undo period.

## Disaster recovery protocol

1. Restore a chosen snapshot **into a network-isolated database**, not a publicly reachable production instance.
2. Block every application endpoint and worker from accessing the restored snapshot.
3. Retrieve and verify the complete external erasure registry using separately provided credentials.
4. Enumerate restored family codes **inside the isolated runtime**, compute each code's HMAC, and match to the registry. For each match, purge that family from the restored dataset **even if this older snapshot shows no deletion_due_at**. The normal expired-purge function is insufficient for this case.
5. Check for orphaned child/history/photo records and apply any newer lifecycle migrations in the correct order.
6. Verify no registry entry can match a still-active restored family after the replay, confirm expected row totals and database constraints, and save non-personal audit evidence.
7. Only then connect the application to the restored database, rotate session secrets as needed and run its health check.
8. Test the entire procedure against a synthetic scenario where a backup was taken *before* an account was permanently deleted. A later backup alone is not a meaningful replay test.

## Failure behavior

- Registry unreachable during purge: **no DB purge**; alert and retry later.
- Registry unavailable during restoration: **no public service**; fail closed.
- Partial replay: **no public service**; reconcile and retry.
- Key rotation or validation mismatch: **no public service**; recover an authorised erasure key.
- Family code collision with a previously erased code: family creation must reject/retry the code; the registry must be checked as part of the creation protocol before launch.

## Open decisions / implementation

- Dedicated registry bucket or equivalent independent durable store, ownership and retention policy.
- R2 permission scope, receipt signing method, read-audit and immutability.
- Production purge cron and retry/alert mechanism.
- HMAC key custody, rotation and recovery.
- Test harness proving fail-closed behavior and backup-before-deletion replay.
- Legal signoff for residual backup retention.

**Do not enable `PERCY_FAMILY_DELETION_ENABLED` or `PERCY_FAMILY_PURGE_ENABLED` until implemented and verified.**

Sources:
- Cloudflare R2 lifecycle: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- ICO right to erasure: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
