#!/usr/bin/env bash
# Read-only R2 retrieval + isolated disposable Postgres 17 restore drill.
# Never run in public CI: the backup contains private children's data.
set -euo pipefail
umask 077

for cmd in aws docker gzip sha256sum python3; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 2; }
done
for key in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_S3_BUCKET AWS_S3_ENDPOINT PERCY_R2_BACKUP_KEY; do
  [[ -n "$(printenv "$key" || true)" ]] || { echo "Missing required environment variable: $key" >&2; exit 2; }
done
[[ "${PERCY_RESTORE_DRILL_ACK:-}" == 'isolated-docker-only' ]] || { echo 'Set PERCY_RESTORE_DRILL_ACK=isolated-docker-only after confirming isolation' >&2; exit 2; }

work="$(mktemp -d)"
container="percy-restore-$$-$RANDOM"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf -- "$work"
}
trap cleanup EXIT INT TERM

echo 'Checking R2 lifecycle (read-only)...'
if aws --endpoint-url "$AWS_S3_ENDPOINT" s3api get-bucket-lifecycle-configuration --bucket "$AWS_S3_BUCKET" > "$work/lifecycle.json" 2> "$work/lifecycle.err"; then
  python3 - "$work/lifecycle.json" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf8') as f: rules=json.load(f).get('Rules',[])
enabled=[r for r in rules if r.get('Status')=='Enabled']
expiring=[r for r in enabled if r.get('Expiration',{}).get('Days') is not None]
print('Lifecycle: %d enabled rules, %d day-based expiration rules' % (len(enabled),len(expiring)))
print('Operator must independently verify prefix coverage, object lock and max retention.')
PY
else
  echo 'R2 lifecycle UNVERIFIED (missing permission or rule)'
fi

aws --endpoint-url "$AWS_S3_ENDPOINT" s3api head-object --bucket "$AWS_S3_BUCKET" --key "$PERCY_R2_BACKUP_KEY" --query '{LastModified:LastModified,ContentLength:ContentLength,Expiration:Expiration}' --output json > "$work/head.json"
python3 - "$work/head.json" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf8') as f: d=json.load(f)
print('Selected backup last modified:',d.get('LastModified'),'size (bytes):',d.get('ContentLength'))
print('Reported expiry:',d.get('Expiration') or 'not reported')
PY

echo 'Downloading selected backup to private temporary storage (read-only)...'
aws --endpoint-url "$AWS_S3_ENDPOINT" s3api get-object --bucket "$AWS_S3_BUCKET" --key "$PERCY_R2_BACKUP_KEY" "$work/backup.tar.gz" >/dev/null
gzip -t "$work/backup.tar.gz"
gzip -dc "$work/backup.tar.gz" > "$work/backup.tar"
echo 'Archive SHA-256 for private operator audit:'
sha256sum "$work/backup.tar.gz" | cut -d' ' -f1

# No network, volumes, production DB env or exposed ports. All writes are inside
# this disposable container. The operator MUST trust the backup's contents.
docker run -d --rm --network none --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
ready=0
for _ in $(seq 1 40); do
  if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Disposable PostgreSQL did not start' >&2; exit 1; }
docker cp "$work/backup.tar" "$container:/tmp/percy-restore.tar"
docker exec "$container" pg_restore --list /tmp/percy-restore.tar > "$work/catalog.txt" || { echo 'Invalid pg_restore archive' >&2; exit 1; }
echo 'Restoring exclusively into disposable network-isolated PostgreSQL 17...'
if ! docker exec "$container" pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error -U postgres -d postgres /tmp/percy-restore.tar > "$work/restore.stdout" 2> "$work/restore.stderr"; then
  echo 'Restore failed; private Postgres log details intentionally suppressed' >&2; exit 1
fi
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -qAtc "SELECT CASE WHEN to_regclass('public.families') IS NOT NULL AND to_regclass('public.children') IS NOT NULL AND to_regclass('public.point_events') IS NOT NULL AND to_regclass('public.rewards') IS NOT NULL AND to_regclass('public.uploads') IS NOT NULL THEN 'core-tables-present' ELSE 'core-tables-missing' END;" > "$work/schema-check"
[[ "$(cat "$work/schema-check")" == core-tables-present ]] || { echo 'Core schema not restored' >&2; exit 1; }

echo 'PASS: R2 backup restored into isolated, disposable PostgreSQL 17.'
echo 'Still requires retention, erasure-suppression, legal and operational review. Do not enable deletion yet.'
