# Batch C PR2 — Family data export

## Scope
- Settings includes **Download family data** for authenticated grown-ups.
- The exported JSON contains family settings, parent-entered profile details, children, behaviour configuration, rewards, award/correction history, redemptions, goals and legacy quick-action records.
- Photos stored by Percy are embedded only when referenced by the requesting family **and** owned by that family. External links and unowned legacy photos are not embedded; their URL references remain in the children's/rewards' records.
- Export deliberately excludes the family access code, JWTs, internal synthetic email, idempotency keys and system metadata.
- A consistent read-only PostgreSQL snapshot prevents partial-history downloads. The API is authenticated, rate-limited (10 per hour per IP), has no caching and returns a download attachment.
- If the JSON exceeds 25 MiB, the UI retries once without embedded photos and shows a warning.

## Test and release gates
- Unit/integration: export authentication, own-family data only, no credentials, history, configurable categories, owned photo bytes, exclusion of cross-family photos even when older rows point at them, no-photo mode.
- Existing lint, build, a11y and mobile browser checks must pass.
- No new database migration.
- PR remains separate from privacy/terms legal copy and seven-day deletion. No deletion endpoint is touched.

## Privacy limitations requiring later follow-up
- Legacy external Base44 photos cannot be bundled without a verified provider export.
- The JSON file is sensitive family data; users should store it securely.
- The export cap can omit photo bytes but never returns a partial malformed file; it retries in explicit no-photo mode.
- The family code itself grants access and must not be included in the export.

## Work remaining within backlog item #5
Reviewed UK Children's Code DPIA, Privacy and Terms copy; seven-day account deletion with session revocation, expiry purge, backup-retention validation and restore drill. Keep backlog delivery order unchanged.
