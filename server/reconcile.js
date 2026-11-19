// D1 data-preservation proof (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md
// §11). A fingerprint of everything families already have, taken before and
// after a migration (or a rollback) and compared:
//
//   * every table in every non-system schema that existed before: row count
//     and a hash of every row over the columns that existed before (columns a
//     migration adds are not in the hash, so they cannot hide a change). Each
//     row is hashed first and the row hashes are combined, so very large rows
//     (uploads) never build one huge string;
//   * the schema itself: every constraint, index, trigger, column type,
//     default and nullability, and the schema_migrations records. A migration
//     may ADD objects; it may not remove or change any that existed;
//   * every child: total_points, points_spent, the stored reward stack, the
//     history total (point_events minus completed redemptions, the A2 C4
//     rule), points set aside for requests, savings, committed and available.
//
// Points set aside, savings and available are computed here in SQL from the
// rows themselves, independently of the app's JavaScript, with the same
// written rule (design §3, §11, §13): only savings of the goal's current
// generation, towards a reward that is still a bigger goal for the child, count, only positive sums, and a goal that is
// also requested counts once (max of the two). The app and this check are
// compared after every ledger change in the tests.

const q = (db, text, params) => db.query(text, params).then((r) => r.rows);
const SYSTEM = "('pg_catalog', 'information_schema', 'pg_toast')";

async function tableColumns(db) {
  const rows = await q(db, `
    SELECT table_schema, table_name, column_name FROM information_schema.columns
    WHERE table_schema NOT IN ${SYSTEM} AND table_schema NOT LIKE 'pg_temp%' AND table_schema NOT LIKE 'pg_toast_temp%'
    ORDER BY table_schema, table_name, ordinal_position`);
  const out = {};
  for (const r of rows) (out[`${r.table_schema}.${r.table_name}`] ||= []).push(r.column_name);
  return out;
}

const ident = (qualified) => qualified.split('.').map((p) => `"${p.replace(/"/g, '""')}"`).join('.');

async function tableHash(db, table, cols) {
  const list = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ');
  const [row] = await q(db, `
    SELECT count(*)::int AS n, COALESCE(md5(string_agg(h, '' ORDER BY h)), '') AS h
    FROM (SELECT md5(t::text) AS h FROM (SELECT ${list} FROM ${ident(table)}) t) x`);
  return { count: row.n, hash: row.h };
}

// The structure: one string per object, so a removed or changed object is
// named, and added objects are listed.
async function schemaObjects(db) {
  const rows = await q(db, `
    SELECT 'column ' || table_schema || '.' || table_name || '.' || column_name || ' ' || data_type
           || ' null=' || is_nullable || ' default=' || COALESCE(column_default, '-') AS o
    FROM information_schema.columns WHERE table_schema NOT IN ${SYSTEM} AND table_schema NOT LIKE 'pg_temp%'
    UNION ALL
    SELECT 'constraint ' || n.nspname || '.' || c.conname || ' ' || pg_get_constraintdef(c.oid)
    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname NOT IN ${SYSTEM}
    UNION ALL
    SELECT 'index ' || schemaname || '.' || indexname || ' ' || indexdef FROM pg_indexes WHERE schemaname NOT IN ${SYSTEM}
    UNION ALL
    SELECT 'trigger ' || n.nspname || '.' || cl.relname || '.' || t.tgname || ' ' || pg_get_triggerdef(t.oid)
    FROM pg_trigger t JOIN pg_class cl ON cl.oid = t.tgrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname NOT IN ${SYSTEM}
    ORDER BY 1`);
  return rows.map((r) => r.o);
}

async function migrationRecords(db) {
  const rows = await q(db, 'SELECT name FROM schema_migrations ORDER BY name').catch(() => []);
  return rows.map((r) => r.name);
}

async function hasTable(db, name) {
  const [r] = await q(db, "SELECT to_regclass($1) IS NOT NULL AS ok", [`public.${name}`]);
  return r.ok;
}

async function hasColumn(db, table, column) {
  const [r] = await q(db, "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2", [table, column]);
  return r.n > 0;
}

// Per child, from the database alone.
async function childFacts(db) {
  const savings = await hasTable(db, 'savings_events');
  const goalCol = await hasColumn(db, 'rewards', 'is_bigger_goal');
  const spendable = `r.family_code IS NOT DISTINCT FROM c.family_code
        AND (COALESCE(cardinality(r.assigned_child_ids), 0) = 0 OR c.id::text = ANY (r.assigned_child_ids::text[]))`;
  const rows = await q(db, `
    WITH items AS (
      SELECT c.id AS child_id, r.id AS reward_id, r.cost_points AS cost
      FROM children c
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.reward_stack) = 'array' THEN c.reward_stack ELSE '[]'::jsonb END) AS item
      JOIN rewards r ON r.id::text = item->>'rewardId' AND ${spendable}
    ),
    stacked AS (SELECT child_id, reward_id, SUM(cost)::int AS cost FROM items GROUP BY child_id, reward_id),
    stack AS (SELECT child_id, SUM(cost)::int AS reserved FROM stacked GROUP BY child_id),
    saved AS (
      ${savings && goalCol ? `
      SELECT v.child_id, v.reward_id, SUM(v.delta)::int AS saved
      FROM savings_events v
      JOIN children c ON c.id = v.child_id
      JOIN rewards r ON r.id = v.reward_id AND r.is_bigger_goal AND ${spendable}
      WHERE v.family_code IS NOT DISTINCT FROM c.family_code
        -- only the goal's current generation for this child (O6)
        AND v.generation = r.goal_epoch::text || ':' || COALESCE(r.goal_child_epochs->>c.id::text, '0')
      GROUP BY v.child_id, v.reward_id HAVING SUM(v.delta) > 0` : 'SELECT NULL::uuid AS child_id, NULL::uuid AS reward_id, 0 AS saved WHERE false'}
    ),
    goals AS (
      SELECT s.child_id, SUM(s.saved)::int AS saved, SUM(GREATEST(0, s.saved - COALESCE(k.cost, 0)))::int AS counted
      FROM saved s LEFT JOIN stacked k ON k.child_id = s.child_id AND k.reward_id = s.reward_id
      GROUP BY s.child_id
    )
    SELECT c.id, c.family_code, c.total_points, c.points_spent,
           COALESCE(c.reward_stack::text, 'null') AS stack_json,
           (COALESCE((SELECT SUM(points) FROM point_events e WHERE e.child_id = c.id), 0)
            - COALESCE((SELECT SUM(reward_cost) FROM redemptions d WHERE d.child_id = c.id AND d.status = 'Completed'), 0))::int AS history,
           COALESCE(st.reserved, 0) AS reserved, COALESCE(g.saved, 0) AS saved, COALESCE(g.counted, 0) AS counted
    FROM children c LEFT JOIN stack st ON st.child_id = c.id LEFT JOIN goals g ON g.child_id = c.id
    ORDER BY c.id`);
  const out = {};
  for (const r of rows) {
    const total = r.total_points == null ? null : Number(r.total_points);
    const committed = Number(r.reserved) + Number(r.counted);
    out[r.id] = {
      family_code: r.family_code, total_points: total,
      points_spent: r.points_spent == null ? null : Number(r.points_spent),
      stack: r.stack_json, history: Number(r.history), reserved: Number(r.reserved), saved: Number(r.saved),
      committed, available: total == null ? null : Math.max(0, total - committed),
    };
  }
  return out;
}

// Take a fingerprint. With `like`, hash only the tables and columns `like`
// had, so a later fingerprint compares like with like.
export async function fingerprint(db, like = null) {
  const now = await tableColumns(db);
  const tables = {};
  const cols = like ? Object.fromEntries(Object.entries(like.tables).map(([t, v]) => [t, v.cols])) : now;
  for (const [t, c] of Object.entries(cols)) {
    if (t === 'public.schema_migrations') continue; // compared as records below
    if (!now[t]) { tables[t] = { cols: c, missing: true }; continue; }
    const absent = c.filter((x) => !now[t].includes(x));
    tables[t] = absent.length ? { cols: c, missingColumns: absent } : { cols: c, ...(await tableHash(db, t, c)) };
  }
  const added = Object.keys(now).filter((t) => !cols[t] && t !== 'public.schema_migrations').map((t) => t.replace(/^public\./, ''));
  return { tables, added, schema: await schemaObjects(db), migrations: await migrationRecords(db), children: await childFacts(db) };
}

// Everything that differs between two fingerprints. An empty list means
// nothing families had was changed. `allowMigrations` names records the step
// was meant to add (e.g. '016_savings_ledger.sql').
export function differences(before, after, { allowMigrations = [] } = {}) {
  const out = [];
  for (const [t, b] of Object.entries(before.tables)) {
    const a = after.tables[t];
    if (!a || a.missing) { out.push(`table ${t} is gone`); continue; }
    if (a.missingColumns) { out.push(`table ${t} lost columns ${a.missingColumns.join(', ')}`); continue; }
    if (a.count !== b.count) out.push(`table ${t}: ${b.count} rows before, ${a.count} after`);
    else if (a.hash !== b.hash) out.push(`table ${t}: row contents changed`);
  }
  const afterSchema = new Set(after.schema || []);
  for (const o of before.schema || []) if (!afterSchema.has(o)) out.push(`schema object removed or changed: ${o}`);
  const afterMig = new Set(after.migrations || []);
  for (const m of before.migrations || []) if (!afterMig.has(m)) out.push(`migration record removed: ${m}`);
  for (const m of after.migrations || []) {
    if (!(before.migrations || []).includes(m) && !allowMigrations.includes(m)) out.push(`unexpected migration record: ${m}`);
  }
  for (const [id, b] of Object.entries(before.children)) {
    const a = after.children[id];
    if (!a) { out.push(`child ${id} is gone`); continue; }
    for (const k of ['total_points', 'points_spent', 'stack', 'history', 'reserved', 'saved', 'committed', 'available']) {
      if (a[k] !== b[k]) out.push(`child ${id}: ${k} ${b[k]} -> ${a[k]}`);
    }
    // available is clamped at 0, so a comparison alone would not show points
    // promised twice (O6 review #4): a child newly over-committed is a finding.
    if (overCommitted(a) && !overCommitted(b)) out.push(`child ${id}: committed ${a.committed} is more than total ${a.total_points}`);
  }
  for (const id of Object.keys(after.children)) if (!before.children[id]) out.push(`child ${id} appeared`);
  return out;
}

// True when more is set aside (requests and counted savings) than the child has.
export function overCommitted(c) {
  return c != null && c.total_points != null && Number(c.committed) > Number(c.total_points);
}

// Schema objects present in `after` but not in `before` (what a migration added).
export function addedSchema(before, after) {
  const b = new Set(before.schema || []);
  return (after.schema || []).filter((o) => !b.has(o));
}

// What the legacy family_goals hold (they are family counters, not child
// savings: neither the old contribute endpoint nor generic family_goals
// create/update ever moved any child's points).
export async function legacyFamilyGoals(db) {
  if (!(await hasTable(db, 'family_goals'))) return { goals: 0 };
  const [r] = await q(db, `
    SELECT count(*)::int AS goals,
           count(*) FILTER (WHERE COALESCE(current_points, 0) > 0)::int AS with_contributions,
           COALESCE(SUM(current_points), 0)::int AS contributed_total,
           count(DISTINCT family_code)::int AS families
    FROM family_goals`);
  return r;
}
