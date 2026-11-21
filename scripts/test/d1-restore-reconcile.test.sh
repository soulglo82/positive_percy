#!/usr/bin/env bash
# Tests scripts/d1-restore-reconcile.sh (D1 design §18) on SYNTHETIC archives
# built here from the fixture in scripts/test/d1-fixture.mjs. No real data.
# Needs Docker and a clean checkout with node_modules (npm ci).
set -euo pipefail
repo="$(git rev-parse --show-toplevel)"
cd "$repo"
script=scripts/d1-restore-reconcile.sh
PG_IMAGE="$(sed -n "s/^PG_IMAGE='\(.*\)'$/\1/p" "$script")"
NODE_IMAGE="$(sed -n "s/^NODE_IMAGE='\(.*\)'$/\1/p" "$script")"
modules="$(cd node_modules && pwd -P)"
tmp="$(mktemp -d)"
fx=''
trap '[[ -n "$fx" ]] && docker rm -f -v "$fx" >/dev/null 2>&1; rm -rf "$tmp" "$repo/.d1-dirty-test"' EXIT
passed=0; failed=0
check() { if eval "$2"; then echo "ok   $1"; passed=$((passed + 1)); else echo "FAIL $1"; failed=$((failed + 1)); fi; }

# A synthetic copy at migration N, dumped as production's backups are (pg_dump -Ft, gzipped).
make_archive() {
  local n="$1" dest="$2"
  mkdir -p "$tmp/app-$n/node_modules"
  git archive HEAD | tar -x -C "$tmp/app-$n"
  fx="percy-fixture-$$-$RANDOM"
  docker run -d --network none --name "$fx" -e POSTGRES_HOST_AUTH_METHOD=trust "$PG_IMAGE" >/dev/null
  for _ in $(seq 1 60); do docker exec "$fx" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break; sleep 1; done
  docker run --rm --network "container:$fx" --user "$(id -u):$(id -g)" -v "$tmp/app-$n:/app" -v "$modules:/app/node_modules:ro" \
    -e DATABASE_URL=postgres://postgres@localhost:5432/postgres "$NODE_IMAGE" node /app/scripts/test/d1-fixture.mjs "$n" >/dev/null
  docker exec "$fx" pg_dump -Ft -h 127.0.0.1 -U postgres postgres | gzip > "$dest"
  docker rm -f -v "$fx" >/dev/null
  fx=''
}

run() { # run <expected exit> <label> [VAR=value ...]
  local want="$1" label="$2"; shift 2
  set +e
  env -u DATABASE_URL PERCY_RESTORE_DRILL_ACK=isolated-docker-only "$@" bash "$script" > "$tmp/out.txt" 2>&1
  local got=$?
  set -e
  check "$label (exit $want)" "[[ $got == $want ]] || { cat '$tmp/out.txt'; false; }"
}
leftovers() { docker ps -aq --filter name=percy-d1- | wc -l | tr -d ' '; }

echo 'Building synthetic archives at 012 and 016...'
make_archive 12 "$tmp/at-012.tar.gz"
make_archive 16 "$tmp/at-016.tar.gz"
printf 'not gzip' > "$tmp/not-gzip.tar.gz"
echo 'hello' | gzip > "$tmp/not-pg.tar.gz"

# Preconditions: refused, nothing restored.
set +e; env -u DATABASE_URL -u PERCY_RESTORE_DRILL_ACK PERCY_BACKUP_FILE="$tmp/at-012.tar.gz" bash "$script" >/dev/null 2>&1; code=$?; set -e
check 'no acknowledgement is refused (exit 2)' "[[ $code == 2 ]]"
run 2 'DATABASE_URL in the shell is refused' DATABASE_URL=postgres://x PERCY_BACKUP_FILE="$tmp/at-012.tar.gz"
run 2 'a report directory inside the repository is refused' PERCY_BACKUP_FILE="$tmp/at-012.tar.gz" PERCY_REPORT_DIR="$repo/d1-report-test"
check '... and nothing was created in the repository' "[[ ! -e '$repo/d1-report-test' ]]"
run 2 'a head other than PERCY_EXPECT_HEAD is refused' PERCY_BACKUP_FILE="$tmp/at-012.tar.gz" PERCY_EXPECT_HEAD=0000000000000000000000000000000000000000
touch "$repo/.d1-dirty-test"
run 2 'a dirty tree is refused' PERCY_BACKUP_FILE="$tmp/at-012.tar.gz"
rm -f "$repo/.d1-dirty-test"

# Broken archives: exit 3, nothing left behind.
run 3 'an archive that is not gzip fails' PERCY_BACKUP_FILE="$tmp/not-gzip.tar.gz" PERCY_REPORT_DIR="$tmp/r-bad1"
run 3 'a gzip that is not a pg_dump archive fails' PERCY_BACKUP_FILE="$tmp/not-pg.tar.gz" PERCY_REPORT_DIR="$tmp/r-bad2"
check 'no containers left after failures' "[[ $(leftovers) == 0 ]]"

# A copy at 012 (production): the full proof.
volumes_before="$(docker volume ls -q | wc -l | tr -d ' ')"
run 0 'a copy at 012 passes' PERCY_BACKUP_FILE="$tmp/at-012.tar.gz" PERCY_REPORT_DIR="$tmp/r-012" PERCY_EXPECT_HEAD="$(git rev-parse HEAD)"
check 'no containers left after the run' "[[ $(leftovers) == 0 ]]"
check 'no volumes left after the run (restored data)' "[[ $(docker volume ls -q | wc -l | tr -d ' ') == $volumes_before ]]"
check 'report and run record are private (600)' "[[ \$(stat -c %a '$tmp/r-012/d1-reconcile-report.json') == 600 && \$(stat -c %a '$tmp/r-012/run.json') == 600 ]]"
check 'report and run record are what the run claims' "python3 - '$tmp/r-012' '$(git rev-parse HEAD)' <<'PY'
import json, os, sys
d, head = sys.argv[1:]
rep = json.load(open(os.path.join(d, 'd1-reconcile-report.json')))
run = json.load(open(os.path.join(d, 'run.json')))
iso = run['isolation']
assert 'error' not in rep, rep.get('error')
assert rep['pending'] == ['014_todays_goals.sql', '015_reward_icon_key.sql', '016_savings_ledger.sql'], rep['pending']
assert [s['name'] for s in rep['steps']] == ['apply 014 and 015 (V1 prerequisites)', 'apply 016', 'roll 016 back', 'apply 016 again'], rep['steps']
assert all(s['changed'] == [] for s in rep['steps']), rep['steps']
assert rep['families'] == 1 and rep['children'] == 1, (rep['families'], rep['children'])
assert run['git_head'] == head and run['reconcile_exit'] == 0, run
assert run['archive'] == 'file:at-012.tar.gz' and len(run['archive_sha256']) == 64
assert iso['postgres_network'] == 'none' and iso['postgres_published_ports'] == {}, iso
assert iso['reconcile_network'] == 'container', iso
assert iso['reconcile_mounts'] == [{'path': '/app', 'writable': False}, {'path': '/app/node_modules', 'writable': False}, {'path': '/out', 'writable': True}], iso['reconcile_mounts']
assert set(iso['reconcile_env_names']) <= {'PATH', 'NODE_VERSION', 'YARN_VERSION'}, iso['reconcile_env_names']
assert not os.path.exists(run['work_dir']), run['work_dir']
PY"

# A copy that already has 016: the CLI refuses it.
run 1 'a copy already at 016 is refused by the reconcile' PERCY_BACKUP_FILE="$tmp/at-016.tar.gz" PERCY_REPORT_DIR="$tmp/r-016"
check '... with the reason in the report' "grep -q 'already has migration 016' '$tmp/r-016/d1-reconcile-report.json'"
check 'no containers left' "[[ $(leftovers) == 0 ]]"

echo "$passed passed, $failed failed"
[[ $failed == 0 ]]
