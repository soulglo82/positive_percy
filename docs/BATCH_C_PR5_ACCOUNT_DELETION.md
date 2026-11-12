# Batch C — Seven-day recoverable account deletion

**Engineering status:** tested feature branch; **disabled by default**. No irreversible data deletion should be enabled in production until the four release gates below and independent review.

## User behaviour

1. A grown-up who knows the family code chooses **Settings → Delete family account** and enters the exact code.
2. A single database update marks the whole family as pending deletion for seven days and increments its authentication generation. All existing bearer tokens are revoked, and connected WebSocket clients receive an immediate revocation.
3. API routes reject pending families; joining with the family code shows the recovery option.
4. During the seven-day window, someone with that code can restore the account. Restoration preserves children, photos, point history and reward configuration, but only new JWTs work.
5. Once the deadline passes, restoration is refused. A separately controlled maintenance job can purge all family-scoped records and owned uploads atomically. Deletion is irreversible from the live database after a successful purge. Backup erasure remains subject to documented lifecycle and recovery controls.

## Four independent production flags

The feature is **invisible and cannot be invoked** until all four flags are set to exactly `true` in the application's Railway service:

- `PERCY_FAMILY_DELETION_ENABLED` — operator has approved the feature and legal text.
- `PERCY_FAMILY_PURGE_ENABLED` — destructive purger operator approval.
- `PERCY_RESTORE_DRILL_VERIFIED` — a recent R2 archive was actually restored into an isolated Postgres and verified; document the evidence, date, and responsible person.
- `PERCY_DELETION_CRON_VERIFIED` — scheduled maintenance has been deployed to Railway and its logs and alerting were demonstrated.

The dedicated `npm run maintenance:purge-families` job **also** requires `PERCY_FAMILY_PURGE_ENABLED=true` and `PERCY_RESTORE_DRILL_VERIFIED=true`. **Do not set any flags in this PR.**

## Operational restore and purge runbook (required before enablement)

1. Obtain R2 bucket object inventory and lifecycle/retention rules from the authorised owner, including legal holds and object-lock status. The existing backup service source uploads to S3 but **does not implement retention**. Railway cron reports successful uploads; this alone does not demonstrate retention or restorability.
2. On a trusted operator machine with read-only R2 credentials, run `scripts/verify-r2-restore.sh` against a selected recent archive. It retrieves the R2 object and restores into a **disposable, network-isolated Postgres 17 Docker container**, with no production DB connection. Confirm the reported result and then perform application-specific row-count/constraint checks without exposing personal data. This is a prepared script; a genuine R2 drill has **not** yet been carried out.
3. Implement and test the **backup-safe erasure registry** in `docs/BATCH_C_ERASURE_REGISTRY_DESIGN.md`. A restored older snapshot can resurrect a deleted family unless the restore is kept offline and external tombstones are replayed. No registry currently exists; this is a hard release blocker, not merely an audit note.
4. Establish a dedicated Railway cron/maintenance service executing `npm run maintenance:purge-families` against production, configured once daily, with operator alerting on failure and proof of a canary dry-run. Do not run this script from application startup or rely on a browser request to trigger it.
5. Run the CI integration suite against disposable PostgreSQL, including request+restore, expired recovery refusal, cross-family isolation, stopped WebSockets and image access, token revocation and disabled-by-default behaviour.
6. Perform reviewed dry-run/enablement with a test family only; confirm zero operational backlog for the scheduled job and that a family cannot resume access after expiry or when partially purged.
7. Publish **approved** Privacy Policy and Terms, including the real controller, contact, applicable rights, exact backup retention, timelines and user-facing deletion language. See docs/legal. Confirm children's DPIA signoff.
8. Enable flags only after documenting restore evidence, scheduled task and legal signoff. Keep rollback procedures: disabling flags stops new requests and purge job; **it does not undo already purged families**.

## Persistence model

Migration 013 adds `families.deletion_requested_at`, `deletion_due_at`, `auth_version` and a partial expiry index. No existing rows are changed. The old JWT version (missing claim) is equivalent to version 0 for existing families, so existing customer sessions remain valid until they request deletion. Requesting deletion increments the version; recovery does **not** reduce it, preventing old bearer tokens from regaining access.

Purge explicitly deletes modern and legacy child-linked point/reward history, reward configurations, profiles, family goals, quick actions, category settings, idempotency keys, and family-owned uploads, then the family row. It does not touch a different family. A second sweeper cannot purge the same family concurrently, due to row locking.

## Known limitations and important open risks

- The family code is a shared credential, not an individually authenticated identity. Deleting a family is permitted for any code holder until grown-up role management (item #9); the code must be kept private.
- Uploaded photos currently use public random-UUID URLs. This branch stops serving a family-owned photo while its family is pending deletion, and changes browser caching to no-store, but cannot retract historic browser/CDN caches. An authenticated image proxy is future security work.
- Existing requests that started immediately before the deletion state update may complete; no new request is authorised once pending. Consider DB-enforced foreign keys or a family-lock invariant before allowing concurrent multi-instance purging at scale.
- A full backup restore from before deletion could resurrect data without a separate **external erasure suppression mechanism**. This is an absolute release blocker.
- Backups, log retention, legal holds and operator privacy contact are not validated as of 12 November 2026.
- The current source code includes no dedicated production purge Railway service. **Do not claim account deletion is complete or live until that service is deployed and checked.**

## Acceptance/QA

- Disabled-by-default: capability off, request/restore endpoints 404, no user-facing delete button.
- Wrong confirmation cannot schedule deletion.
- Successful request disables all family API/WS access; another family remains unaffected; family-owned image URLs stop serving.
- Seven-day restore returns a new token, preserves data, and never revives a prior JWT.
- Recovery after deadline returns 404, even if a purge has not run.
- Dry-run never deletes. Gated purge completely removes only the due family.
- Errors fail closed; future scheduled-run alerts and external erasure suppression remain required.
