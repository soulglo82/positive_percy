// D1 data-preservation proof (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md
// §11). A fingerprint of everything families already have, taken before and
// after a migration (or a rollback) and compared:
//
//   * every table that existed before: row count and a hash of every row,
//     over the columns that existed before (columns a migration adds are not
//     in the hash, so they cannot hide a changed value);
//   * every child: total_points, points_spent, the stored reward stack, the
//     history total (point_events minus completed redemptions, the A2 C4
//     rule), points set aside for requests, savings, and available points.
//
// Points set aside and available are computed here in SQL, independently of
// the app's code, so the app and this check can catch each other.

const q = (db, text, params) => db.query(text, params).then((r) => r.rows);

async function tableColumns(db) {
  const rows = await q(db, `
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> 'schema_migrations'
    ORDER BY table_name, ordinal_position`);
  const out = {};
  for (const r of rows) (out[r.table_name] ||= []).push(r.column_name);
  return out;
}

async function tableHash(db, table, cols) {
  const list = cols.map((c) => `"${c}"`).join(', ');
  const [row] = await q(db, `
    SELECT count(*)::int AS n, COALESCE(md5(string_agg(t::text, '|' ORDER BY t::text)), '') AS h
    FROM (SELECT ${list} FROM "${table}") t`);
  return { count: row.n, hash: row.h };
}

async function hasTable(db, name) {
  const [r] = await q(db, "SELECT to_regclass($1) IS NOT NULL AS ok", [`public.${name}`]);
  return r.ok;
}

// Per child, from the database alone. `saved` is the raw ledger sum (every
// savings row), stricter than the app's view, which only counts savings
// towards rewards that are still bigger goals for the child.
async function childFacts(db) {
  const savings = await hasTable(db, 'savings_events');
  const rows = await q(db, `
    WITH stack AS (
      SELECT c.id AS child_id, COALESCE(SUM(r.cost_points), 0)::int AS reserved
      FROM children c
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(c.reward_stack, '[]'::jsonb)) AS item ON true
      LEFT JOIN rewards r ON r.id::text = item->>'rewardId' AND r.family_code IS NOT DISTINCT FROM c.family_code
        AND (COALESCE(cardinality(r.assigned_child_ids), 0) = 0 OR c.id::text = ANY (r.assigned_child_ids::text[]))
      GROUP BY c.id
    ),
    hist AS (
      SELECT c.id AS child_id,
        COALESCE((SELECT SUM(points) FROM point_events e WHERE e.child_id = c.id), 0)
        - COALESCE((SELECT SUM(reward_cost) FROM redemptions d WHERE d.child_id = c.id AND d.status = 'Completed'), 0) AS history
      FROM children c
    )
    SELECT c.id, c.family_code, c.total_points, COALESCE(c.points_spent, 0) AS points_spent,
           COALESCE(c.reward_stack, '[]'::jsonb)::text AS stack_json,
           h.history::int AS history, s.reserved,
           ${savings ? '(SELECT COALESCE(SUM(delta), 0) FROM savings_events v WHERE v.child_id = c.id)::int' : '0'} AS saved
    FROM children c JOIN hist h ON h.child_id = c.id JOIN stack s ON s.child_id = c.id
    ORDER BY c.id`);
  const out = {};
  for (const r of rows) {
    out[r.id] = {
      family_code: r.family_code, total_points: r.total_points, points_spent: r.points_spent,
      stack: r.stack_json, history: r.history, reserved: r.reserved, saved: r.saved,
      available: Math.max(0, r.total_points - r.reserved - r.saved),
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
    if (!now[t]) { tables[t] = { cols: c, missing: true }; continue; }
    const absent = c.filter((x) => !now[t].includes(x));
    tables[t] = absent.length ? { cols: c, missingColumns: absent } : { cols: c, ...(await tableHash(db, t, c)) };
  }
  const added = Object.keys(now).filter((t) => !cols[t]);
  return { tables, added, children: await childFacts(db) };
}

// Everything that differs between two fingerprints. An empty list means
// nothing families had was changed.
export function differences(before, after) {
  const out = [];
  for (const [t, b] of Object.entries(before.tables)) {
    const a = after.tables[t];
    if (!a || a.missing) { out.push(`table ${t} is gone`); continue; }
    if (a.missingColumns) { out.push(`table ${t} lost columns ${a.missingColumns.join(', ')}`); continue; }
    if (a.count !== b.count) out.push(`table ${t}: ${b.count} rows before, ${a.count} after`);
    else if (a.hash !== b.hash) out.push(`table ${t}: row contents changed`);
  }
  for (const [id, b] of Object.entries(before.children)) {
    const a = after.children[id];
    if (!a) { out.push(`child ${id} is gone`); continue; }
    for (const k of ['total_points', 'points_spent', 'stack', 'history', 'reserved', 'saved', 'available']) {
      if (a[k] !== b[k]) out.push(`child ${id}: ${k} ${b[k]} -> ${a[k]}`);
    }
  }
  for (const id of Object.keys(after.children)) if (!before.children[id]) out.push(`child ${id} appeared`);
  return out;
}

// What the legacy family_goals hold (they are family counters, not child
// savings: the old contribute endpoint never moved any child's points).
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
