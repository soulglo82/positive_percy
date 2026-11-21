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
  local n="$1" dest="$2" extra="${3:-}"
  mkdir -p "$tmp/app-$n/node_modules"
  git archive HEAD | tar -x -C "$tmp/app-$n"
  fx="percy-fixture-$$-$RANDOM"
  docker run -d --network none --name "$fx" -e POSTGRES_HOST_AUTH_METHOD=trust "$PG_IMAGE" >/dev/null
  for _ in $(seq 1 60); do docker exec "$fx" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break; sleep 1; done
  docker run --rm --network "container:$fx" --user "$(id -u):$(id -g)" -v "$tmp/app-$n:/app" -v "$modules:/app/node_modules:ro" \
    -e DATABASE_URL=postgres://postgres@localhost:5432/postgres "$NODE_IMAGE" node /app/scripts/test/d1-fixture.mjs "$n" >/dev/null
  [[ -z "$extra" ]] || docker exec "$fx" psql -q -h 127.0.0.1 -U postgres -d postgres -c "$extra" >/dev/null
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
mode() { python3 -c 'import os,sys;print(oct(os.stat(sys.argv[1]).st_mode & 0o777)[2:])' "$1"; }
# Containers this test's runs left (others' runs are not counted).
before_ids="$(docker ps -aq --filter name=percy-d1- | sort)"
leftovers() { comm -13 <(echo "$before_ids") <(docker ps -aq --filter name=percy-d1- | sort) | grep -c . || true; }
volumes() { docker volume ls -q | wc -l | tr -d ' '; }

# A stand-in docker that records every call and does nothing else. Refusals run
# against it, so a test proves the refusal came before ANY Docker work (no
# image pull, container, copy or restore), not merely that it ended in exit 2.
mkdir -p "$tmp/shim"
cat > "$tmp/shim/docker" <<'SHIM'
#!/usr/bin/env bash
echo "$*" >> "$SHIM_LOG"
if [[ "${1:-} ${2:-}" == 'context inspect' ]]; then echo "${SHIM_CONTEXT_HOST-unix:///var/run/docker.sock}"; exit 0; fi
exit 97
SHIM
chmod +x "$tmp/shim/docker"
refused_before_work() { # refused_before_work <label> [VAR=value ...]
  local label="$1"; shift
  : > "$tmp/shim.log"
  set +e
  env -u DATABASE_URL PERCY_RESTORE_DRILL_ACK=isolated-docker-only PATH="$tmp/shim:$PATH" SHIM_LOG="$tmp/shim.log" "$@" bash "$script" > "$tmp/out.txt" 2>&1
  local got=$?
  set -e
  check "$label: refused (exit 2)" "[[ $got == 2 ]] || { cat '$tmp/out.txt'; false; }"
  check "$label: before any Docker work or archive read" "! grep -qv '^context inspect' '$tmp/shim.log' && ! grep -q 'Reading the archive' '$tmp/out.txt'"
}

echo 'Building synthetic archives at 012 and 016...'
make_archive 12 "$tmp/at-012.tar.gz"
make_archive 16 "$tmp/at-016.tar.gz"
make_archive 12 "$tmp/with-marker.tar.gz" 'CREATE TABLE percy_restore_marker (token text)'
printf 'not gzip' > "$tmp/not-gzip.tar.gz"
echo 'hello' | gzip > "$tmp/not-pg.tar.gz"

# Preconditions: each refused before any Docker work or archive read.
A="$tmp/at-012.tar.gz"
refused_before_work 'no acknowledgement' PERCY_RESTORE_DRILL_ACK= PERCY_BACKUP_FILE="$A"
refused_before_work 'DATABASE_URL in the shell' DATABASE_URL=postgres://x PERCY_BACKUP_FILE="$A"
# The two locality checks, each on its own: DOCKER_HOST remote while the
# context reports local, and the context remote with no DOCKER_HOST.
refused_before_work 'a remote DOCKER_HOST (context local)' DOCKER_HOST=tcp://192.0.2.1:2375 PERCY_BACKUP_FILE="$A"
refused_before_work 'a remote Docker context (no DOCKER_HOST)' SHIM_CONTEXT_HOST=tcp://192.0.2.1:2375 PERCY_BACKUP_FILE="$A"
refused_before_work 'an ssh Docker context' SHIM_CONTEXT_HOST=ssh://someone@example.invalid PERCY_BACKUP_FILE="$A"
refused_before_work 'an unknown Docker context' SHIM_CONTEXT_HOST= PERCY_BACKUP_FILE="$A"
refused_before_work 'a report directory inside the repository' PERCY_BACKUP_FILE="$A" PERCY_REPORT_DIR="$repo/d1-report-test"
check '... and nothing was created in the repository' "[[ ! -e '$repo/d1-report-test' ]]"
refused_before_work 'a head other than PERCY_EXPECT_HEAD' PERCY_BACKUP_FILE="$A" PERCY_EXPECT_HEAD=0000000000000000000000000000000000000000
mkdir -p "$tmp/not-empty" && echo old > "$tmp/not-empty/d1-reconcile-report.json"
refused_before_work 'a report directory that is not empty' PERCY_BACKUP_FILE="$A" PERCY_REPORT_DIR="$tmp/not-empty"
touch "$repo/.d1-dirty-test"
refused_before_work 'a dirty tree' PERCY_BACKUP_FILE="$A"
rm -f "$repo/.d1-dirty-test"
check 'the tree is clean again' "[[ -z \$(git status --porcelain) ]]"
# The same remote-context refusal with the real Docker CLI.
docker context rm -f percy-d1-test-remote >/dev/null 2>&1 || true
docker context create percy-d1-test-remote --docker host=tcp://192.0.2.1:2375 >/dev/null 2>&1
run 2 'a remote Docker context is refused by the real CLI' DOCKER_CONTEXT=percy-d1-test-remote PERCY_BACKUP_FILE="$A"
docker context rm -f percy-d1-test-remote >/dev/null 2>&1

# Broken archives: exit 3, nothing left behind.
run 3 'an archive that is not gzip fails' PERCY_BACKUP_FILE="$tmp/not-gzip.tar.gz" PERCY_REPORT_DIR="$tmp/r-bad1"
run 3 'a gzip that is not a pg_dump archive fails' PERCY_BACKUP_FILE="$tmp/not-pg.tar.gz" PERCY_REPORT_DIR="$tmp/r-bad2"
check 'no containers left after failures' "[[ $(leftovers) == 0 ]]"

# Cleanup on failure AFTER the backup is restored (the copy already has a
# marker table, so writing the marker fails), and on Ctrl-C mid-run. Each
# run gets its own TMPDIR, which must be empty afterwards (no decompressed
# backup), with no container or volume left.
v0="$(volumes)"
mkdir -p "$tmp/t-after"
run 3 'a failure after the restore' TMPDIR="$tmp/t-after" PERCY_BACKUP_FILE="$tmp/with-marker.tar.gz" PERCY_REPORT_DIR="$tmp/r-after"
check '... got past the restore first' "grep -q 'Restoring into' '$tmp/out.txt'"
check '... left no container, volume or temporary file' "[[ $(leftovers) == 0 && $(volumes) == $v0 && -z \$(ls -A '$tmp/t-after') ]]"
mkdir -p "$tmp/t-int"
# Background jobs start with SIGINT ignored, and bash cannot trap a signal
# ignored on entry, so restore its default first (as a terminal would have it).
env -u DATABASE_URL PERCY_RESTORE_DRILL_ACK=isolated-docker-only TMPDIR="$tmp/t-int" PERCY_BACKUP_FILE="$A" PERCY_REPORT_DIR="$tmp/r-int" \
  python3 -c 'import os,signal,sys;signal.signal(signal.SIGINT,signal.SIG_DFL);os.execvp("bash",["bash",sys.argv[1]])' "$script" > "$tmp/int.txt" 2>&1 &
pid=$!
for _ in $(seq 1 300); do grep -q 'Restoring into' "$tmp/int.txt" && break; sleep 0.2; done
kill -INT "$pid"
set +e; wait "$pid"; code=$?; set -e
check 'Ctrl-C after the restore stops the run (exit 130)' "[[ $code == 130 ]] || { cat '$tmp/int.txt'; false; }"
check '... and left no container, volume or temporary file' "[[ $(leftovers) == 0 && $(volumes) == $v0 && -z \$(ls -A '$tmp/t-int') ]]"

# A copy at 012 (production): the full proof.
volumes_before="$(docker volume ls -q | wc -l | tr -d ' ')"
run 0 'a copy at 012 passes' PERCY_BACKUP_FILE="$tmp/at-012.tar.gz" PERCY_REPORT_DIR="$tmp/r-012" PERCY_EXPECT_HEAD="$(git rev-parse HEAD)"
check 'no containers left after the run' "[[ $(leftovers) == 0 ]]"
check 'no volumes left after the run (restored data)' "[[ $(docker volume ls -q | wc -l | tr -d ' ') == $volumes_before ]]"
check 'report, run record and log are private (600, directory 700)' "[[ \$(mode '$tmp/r-012/d1-reconcile-report.json') == 600 && \$(mode '$tmp/r-012/run.json') == 600 && \$(mode '$tmp/r-012/reconcile.log') == 600 && \$(mode '$tmp/r-012') == 700 ]]"
check 'the terminal shows step lines, not the CLI output' "grep -q '^ok   apply 016 again' '$tmp/out.txt' && ! grep -q 'Sam' '$tmp/out.txt'"
run 2 'a report directory that is not empty is refused' PERCY_BACKUP_FILE="$tmp/at-012.tar.gz" PERCY_REPORT_DIR="$tmp/r-012"
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
