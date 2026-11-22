#!/usr/bin/env bash
# Rebuilds the review pack from the repository root, after `npm run build`:
#   bash docs/engineering/evidence/v1-integrated/tools/run.sh
# Needs a local Postgres. Uses a NEW throwaway database named by PACK_DB
# (default percy_pack_<time>), a local server on port 3311, and the approved
# design read from git (blob 9de1df2). Synthetic data only.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
pack="$(dirname "$here")"
db="${PACK_DB:-percy_pack_$(date +%s)}"
pg="${PACK_PG:-postgres://postgres:postgres@localhost:5432}"
work="$(mktemp -d)"
createdb -h localhost -U postgres "$db"
DATABASE_URL="$pg/$db" JWT_SECRET=pack-secret-0123456789abcdef0123456789abcdef PORT=3311 node server/index.js > "$work/server.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf http://localhost:3311/api/health >/dev/null && break; sleep 1; done
mkdir -p "$work/built" "$work/ref"
node "$here/capture.cjs" "$work/built"
git show 9de1df2 > "$work/approved.html"
node "$here/reference.cjs" "$work/approved.html" "$work/ref"
mkdir -p "$pack/built" "$pack/compare"
cp "$work"/built/*.png "$pack/built/"
python3 "$here/compose.py" "$work/ref" "$work/built" "$pack/compare"
echo "Pack rebuilt: $(ls "$pack/built" | wc -l) built, $(ls "$pack/compare" | wc -l) compared. Work files: $work"
