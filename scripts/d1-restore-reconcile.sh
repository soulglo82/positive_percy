#!/usr/bin/env bash
# D1 restored-backup run in one command (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §18).
# Restores a backup into a network-isolated, disposable PostgreSQL 17 and runs
# scripts/d1-reconcile.mjs against it, at this checkout's exact git head.
#
# For the owner, on a trusted machine with Docker. The backup holds private
# children's data: never run this in public CI on a real backup, and keep the
# report directory private. Nothing here can reach production: the only
# database the reconcile CLI can see is the container's own loopback.
#
#   PERCY_RESTORE_DRILL_ACK=isolated-docker-only \
#   PERCY_BACKUP_FILE=/private/percy-prod-....tar.gz \      # or the R2 variables below
#   PERCY_EXPECT_HEAD=<PR head sha> PERCY_REPORT_DIR=/private/d1-report \
#   bash scripts/d1-restore-reconcile.sh
#
# R2 instead of a file (read-only keys, as scripts/verify-r2-restore.sh):
#   AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_S3_BUCKET AWS_S3_ENDPOINT PERCY_R2_BACKUP_KEY
#
# Exit: 0 every step unchanged; 1 the reconcile found a change or refused the
# copy (see the report); 2 a precondition failed, nothing restored; 3 the
# archive, Docker, the restore or the CLI itself failed (no valid report).
#
# The report directory must be new or empty. The report, the run record and
# the CLI's log can quote values from the data (PostgreSQL error text): keep
# them private. The terminal shows only step names, counts and exit codes.
set -euo pipefail
umask 077

# Pinned by digest (design review of §18): the run records exactly what it used.
PG_IMAGE='postgres:17@sha256:b60e90042aa6b8dbecd58e224b3e36114dbf8ad754465264c2476ad58a86e45c'
NODE_IMAGE='node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee'

refuse() { echo "Refused: $1" >&2; exit 2; }
broken() { echo "Failed: $1" >&2; exit 3; }
now() { python3 -c 'import datetime;print(datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00","Z"))'; }

for cmd in docker git gzip tar python3 openssl; do command -v "$cmd" >/dev/null || refuse "missing $cmd"; done
[[ "${PERCY_RESTORE_DRILL_ACK:-}" == 'isolated-docker-only' ]] || refuse 'set PERCY_RESTORE_DRILL_ACK=isolated-docker-only after confirming isolation'
# The Docker daemon must be this machine's: a remote context would receive the
# decompressed backup (code review of e108a65).
if [[ -n "${DOCKER_HOST:-}" && "$DOCKER_HOST" != unix://* ]]; then refuse "DOCKER_HOST is $DOCKER_HOST; use the local Docker daemon"; fi
docker_host="$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)"
[[ "$docker_host" == unix://* ]] || refuse "the Docker context is not local (${docker_host:-unknown}); use the local daemon"
[[ -z "${DATABASE_URL:-}" ]] || refuse 'DATABASE_URL is set in this shell; unset it (it is never passed on, but its presence suggests the wrong shell)'

repo="$(git rev-parse --show-toplevel 2>/dev/null)" || refuse 'run this from inside the positive_percy checkout'
cd "$repo"
[[ -z "$(git status --porcelain)" ]] || refuse 'the git tree has changes; the report must match a commit exactly'
head="$(git rev-parse HEAD)"
[[ -z "${PERCY_EXPECT_HEAD:-}" || "$PERCY_EXPECT_HEAD" == "$head" ]] || refuse "HEAD is $head, expected $PERCY_EXPECT_HEAD"
[[ -f node_modules/pg/package.json ]] || refuse 'node_modules has no pg; run npm ci first'
modules="$(cd node_modules && pwd -P)"

repo_real="$(pwd -P)"
out="${PERCY_REPORT_DIR:-}"
if [[ -n "$out" ]]; then
  # Checked before anything is created, so a refused run leaves nothing.
  out="$(python3 -c 'import os,sys;print(os.path.realpath(sys.argv[1]))' "$out")"
  case "$out/" in "$repo_real/"*) refuse "the report directory $out is inside the repository; family data must not be committable";; esac
  if [[ -d "$out" && -n "$(ls -A "$out")" ]]; then refuse "the report directory $out is not empty; an old report could be mistaken for this run's"; fi
  mkdir -p "$out"
else
  out="$(mktemp -d "${TMPDIR:-/tmp}/percy-d1-report-XXXXXX")"
  out="$(cd "$out" && pwd -P)"
  case "$out/" in "$repo_real/"*) refuse "TMPDIR is inside the repository; set PERCY_REPORT_DIR";; esac
fi
chmod 700 "$out"

if [[ -n "${PERCY_BACKUP_FILE:-}" ]]; then
  [[ -f "$PERCY_BACKUP_FILE" ]] || refuse "no file at PERCY_BACKUP_FILE"
  source_name="file:$(basename "$PERCY_BACKUP_FILE")"
else
  command -v aws >/dev/null || refuse 'missing aws (or set PERCY_BACKUP_FILE)'
  for key in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_S3_BUCKET AWS_S3_ENDPOINT PERCY_R2_BACKUP_KEY; do
    [[ -n "$(printenv "$key" || true)" ]] || refuse "missing $key (or set PERCY_BACKUP_FILE)"
  done
  source_name="r2:$PERCY_R2_BACKUP_KEY"
fi

work="$(mktemp -d)"
pg="percy-d1-pg-$$-$RANDOM"
runner="percy-d1-cli-$$-$RANDOM"
cleanup() {
  trap '' INT TERM HUP # a second Ctrl-C must not interrupt the removal
  # -v: the postgres image declares a data volume; without it the anonymous
  # volume, holding the restored family data, would outlive the run.
  docker rm -f -v "$pg" "$runner" >/dev/null 2>&1 || true
  rm -rf -- "$work"
  if [[ -n "$(docker ps -aq --filter "name=^$pg\$" 2>/dev/null)" || -e "$work" ]]; then
    echo "WARNING: restored family data may remain. Remove container $pg (docker rm -f -v $pg) and $work by hand." >&2
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP
started="$(now)"

# Before any family data is on disk: the images, this commit's code, and a
# check that Docker can see this machine's temporary folder (Colima and
# Rancher Desktop share only $HOME by default).
docker pull -q "$PG_IMAGE" >/dev/null && docker pull -q "$NODE_IMAGE" >/dev/null || broken 'could not pull the pinned images'
mkdir "$work/app"
git archive HEAD | tar -x -C "$work/app"
mkdir "$work/app/node_modules"
docker run --rm --network none --user "$(id -u):$(id -g)" -v "$work/app:/app:ro" -v "$modules:/app/node_modules:ro" "$NODE_IMAGE" \
  test -r /app/scripts/d1-reconcile.mjs -a -r /app/node_modules/pg/package.json >/dev/null 2>&1 \
  || broken "Docker cannot read $work (share this folder with Docker, or set TMPDIR under \$HOME); rootless Docker is not supported"

echo 'Reading the archive...'
if [[ -n "${PERCY_BACKUP_FILE:-}" ]]; then
  cp -- "$PERCY_BACKUP_FILE" "$work/backup.tar.gz"
else
  aws --endpoint-url "$AWS_S3_ENDPOINT" s3api get-object --bucket "$AWS_S3_BUCKET" --key "$PERCY_R2_BACKUP_KEY" "$work/backup.tar.gz" >/dev/null || broken 'could not download the backup (read-only R2)'
fi
gzip -t "$work/backup.tar.gz" 2>/dev/null || broken 'the archive is not valid gzip'
gzip -dc "$work/backup.tar.gz" > "$work/backup.tar"
sha="$(python3 -c 'import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$work/backup.tar.gz")"
rm -f -- "$work/backup.tar.gz"
echo "Archive SHA-256: $sha"

# The code that runs (extracted above) is exactly HEAD (nothing ignored, no
# .env), plus the installed dependencies, both read-only.
docker run -d --network none --name "$pg" -e POSTGRES_HOST_AUTH_METHOD=trust "$PG_IMAGE" >/dev/null || broken 'could not start PostgreSQL 17'
# TCP, not the socket: the image's entrypoint first runs a socket-only
# temporary server, then restarts (design review of §18).
ready=0
for _ in $(seq 1 60); do
  if docker exec "$pg" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || broken 'the disposable PostgreSQL did not start'
docker cp "$work/backup.tar" "$pg:/tmp/percy-restore.tar" >/dev/null
rm -f -- "$work/backup.tar"
docker exec "$pg" pg_restore --list /tmp/percy-restore.tar >/dev/null 2>&1 || broken 'not an archive PostgreSQL 17 can restore (a dump from a newer pg_dump is refused)'
echo 'Restoring into the disposable, network-isolated PostgreSQL 17...'
docker exec "$pg" pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error -h 127.0.0.1 -U postgres -d postgres /tmp/percy-restore.tar >/dev/null 2>&1 \
  || broken 'the restore failed (PostgreSQL details suppressed: they can quote family data)'
docker exec "$pg" rm -f /tmp/percy-restore.tar
core="$(docker exec "$pg" psql -h 127.0.0.1 -U postgres -d postgres -qAtc "SELECT to_regclass('public.families') IS NOT NULL AND to_regclass('public.children') IS NOT NULL AND to_regclass('public.point_events') IS NOT NULL AND to_regclass('public.rewards') IS NOT NULL AND to_regclass('public.schema_migrations') IS NOT NULL")"
[[ "$core" == t ]] || broken 'the core tables are not in the restored copy'

# The copy marker. Values are passed as psql variables, never spliced into SQL.
token="$(openssl rand -hex 32)"
docker exec -i "$pg" psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres -q \
  -v token="$token" -v src="$source_name sha256:$sha" >/dev/null <<'SQL' || broken 'could not write the copy marker'
CREATE TABLE percy_restore_marker (token text NOT NULL, restored_from text, restored_at timestamptz DEFAULT now());
INSERT INTO percy_restore_marker (token, restored_from) VALUES (:'token', :'src');
SQL

# The CLI shares only the database container's network namespace (loopback;
# no outside network) and gets no environment from this shell.
docker create --name "$runner" --network "container:$pg" --user "$(id -u):$(id -g)" \
  -v "$work/app:/app:ro" -v "$modules:/app/node_modules:ro" -v "$out:/out" -w /out \
  "$NODE_IMAGE" node /app/scripts/d1-reconcile.mjs \
  --database-url postgres://postgres@localhost:5432/postgres --i-confirm-this-is-a-copy --copy-token "$token" >/dev/null \
  || broken 'could not create the reconcile container'
docker inspect "$pg" > "$work/pg.json"
docker inspect "$runner" > "$work/runner.json"
echo 'Running the D1 reconciliation...'
set +e
docker start -a "$runner" > "$out/reconcile.log" 2>&1
code=$?
set -e
finished="$(now)"

python3 - "$work" "$out/run.json" "$head" "$sha" "$source_name" "$started" "$finished" "$code" "$PG_IMAGE" "$NODE_IMAGE" "$repo_real" <<'PY'
import hashlib, json, os, sys
work, dest, head, sha, src, started, finished, code, pg_image, node_image, repo = sys.argv[1:]
pg = json.load(open(os.path.join(work, 'pg.json')))[0]
runner = json.load(open(os.path.join(work, 'runner.json')))[0]
def ports(c): return {k: v for k, v in (c['HostConfig'].get('PortBindings') or {}).items() if v}
lock = os.path.join(repo, 'package-lock.json')
run = {
  'git_head': head,
  'package_lock_sha256': hashlib.sha256(open(lock, 'rb').read()).hexdigest() if os.path.exists(lock) else None,
  'pg_version': json.load(open(os.path.join(repo, 'node_modules/pg/package.json')))['version'],
  'archive': src, 'archive_sha256': sha,
  'images': {'postgres': pg_image, 'node': node_image},
  'started_at': started, 'finished_at': finished, 'reconcile_exit': int(code),
  'isolation': {
    'postgres_network': pg['HostConfig']['NetworkMode'],
    'postgres_published_ports': ports(pg),
    'postgres_mounts': [m['Destination'] for m in pg.get('Mounts', [])],
    'reconcile_network': runner['HostConfig']['NetworkMode'].split(':')[0],
    'reconcile_mounts': sorted(({'path': m['Destination'], 'writable': m['RW']} for m in runner.get('Mounts', [])), key=lambda m: m['path']),
    'reconcile_env_names': sorted(e.split('=', 1)[0] for e in runner['Config'].get('Env') or []),
  },
  'work_dir': work,
}
json.dump(run, open(dest, 'w'), indent=2)
open(dest, 'a').write('\n')
PY
chmod 600 "$out"/* 2>/dev/null || true
# Only names, counts and the outcome on the terminal. Exit 1 must come with a
# report showing a refusal or a change; a crash (no report, or neither) is 3.
verdict="$(python3 - "$out/d1-reconcile-report.json" "$code" <<'PY'
import json, os, sys
path, code = sys.argv[1], int(sys.argv[2])
if not os.path.exists(path):
    print('crash'); sys.exit()
rep = json.load(open(path))
for st in rep.get('steps', []):
    print(('FAIL' if st['changed'] else 'ok  ') + ' ' + st['name'] + (f" ({len(st['changed'])} changes)" if st['changed'] else ''), file=sys.stderr)
print(f"families {rep.get('families')}, children {rep.get('children')}", file=sys.stderr)
if 'error' in rep: print('The reconcile refused or stopped; the reason is in the private report and log.', file=sys.stderr)
changed = any(st['changed'] for st in rep.get('steps', []))
if code == 0 and not changed and 'error' not in rep: print('pass')
elif code == 1 and (changed or 'error' in rep): print('fail')
else: print('crash')
PY
)"
echo "Report: $out (d1-reconcile-report.json, run.json, reconcile.log; private, may quote family data)"
case "$verdict" in
  pass) exit 0 ;;
  fail) exit 1 ;;
  *) broken "the reconcile CLI exited $code without a valid report; see $out/reconcile.log" ;;
esac
