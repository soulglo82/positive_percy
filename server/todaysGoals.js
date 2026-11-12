// Batch E: Today's Goals — per-child, one-off and recurring positive routines.
// All completion dates and weekdays come from Postgres in the family's timezone.
// Points flow through the SAME point_events ledger as manual awards.
import { Router } from 'express';
import crypto from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TITLE_MAX = 100;

const isUuid = v => typeof v === 'string' && UUID.test(v);
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function parseGoal(data) {
  const title = typeof data?.title === 'string' ? data.title.trim() : '';
  if (!title || title.length > TITLE_MAX) return { error: 'Goal title must be 1–100 characters.' };
  if (!isUuid(data?.child_id) || !isUuid(data?.category_id)) {
    return { error: 'Choose a child and a positive behaviour category.' };
  }
  const kind = data?.schedule_kind;
  if (kind !== 'one_off' && kind !== 'weekly') return { error: 'Choose a one-off or weekly routine.' };
  if (kind === 'one_off') {
    if (!validDate(data?.scheduled_date)) return { error: 'Choose a valid calendar date.' };
    return { title, child_id: data.child_id, category_id: data.category_id,
      schedule_kind: kind, scheduled_date: data.scheduled_date,
      start_date: data.scheduled_date, weekdays: [] };
  }
  const weekdays = data?.weekdays;
  if (!Array.isArray(weekdays) || weekdays.length < 1 || weekdays.length > 7 ||
      weekdays.some(d => !Number.isInteger(d) || d < 1 || d > 7) ||
      new Set(weekdays).size !== weekdays.length) {
    return { error: 'Choose at least one unique weekday.' };
  }
  if (data?.start_date !== undefined && !validDate(data.start_date)) {
    return { error: 'Choose a valid start date.' };
  }
  return { title, child_id: data.child_id, category_id: data.category_id,
    schedule_kind: kind, scheduled_date: null, start_date: data.start_date ?? null,
    weekdays: [...weekdays].sort((a, b) => a - b) };
}

function fail(res, err, context) {
  console.error(context, err instanceof Error ? err.message : 'unexpected error');
  return res.status(500).json({ error: 'Unable to save this goal right now.' });
}

async function localToday(db, familyCode) {
  const { rows } = await db.query(`
    SELECT to_char((NOW() AT TIME ZONE COALESCE(timezone, 'UTC'))::date, 'YYYY-MM-DD') AS date,
      EXTRACT(ISODOW FROM (NOW() AT TIME ZONE COALESCE(timezone, 'UTC')))::int AS weekday
    FROM families WHERE family_code = $1
  `, [familyCode]);
  return rows[0];
}

async function ownedChoice(db, code, childId, categoryId) {
  const { rows } = await db.query(`
    SELECT c.id, bc.name AS category_name, bc.points, bc.assigned_children
    FROM children c
    JOIN behavior_categories bc ON bc.id = $3 AND bc.family_code = $1
    WHERE c.id = $2 AND c.family_code = $1
  `, [code, childId, categoryId]);
  const r = rows[0];
  if (!r || (r.assigned_children || []).length &&
    !r.assigned_children.includes(childId)) return null;
  return r;
}

const BASE_SELECT = `
  SELECT g.id, g.family_code, g.child_id, g.category_id, g.title,
    g.schedule_kind, to_char(g.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
    to_char(g.start_date, 'YYYY-MM-DD') AS start_date,
    g.weekdays, g.created_at, g.updated_at, g.archived_at,
    c.name AS child_name, bc.name AS category_name, bc.points AS category_points,
    x.id AS completion_id, x.point_event_id, x.awarded_points, x.created_at AS completed_at
  FROM today_goals g
  JOIN children c ON c.id = g.child_id AND c.family_code = g.family_code
  LEFT JOIN behavior_categories bc ON bc.id = g.category_id AND bc.family_code = g.family_code
  LEFT JOIN today_goal_completions x ON x.goal_id = g.id
    AND x.scheduled_for = $2::date AND x.undone_at IS NULL
  WHERE g.family_code = $1 AND g.archived_at IS NULL
`;

export function createTodaysGoalsRouter({ pool, broadcast, recordStreak, weekPointsFor }) {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const date = await localToday(pool, req.familyCode);
      if (!date) return res.status(404).json({ error: 'Family unavailable.' });
      const manage = req.query.manage === 'true';
      const childId = req.query.child_id;
      if (childId && !isUuid(childId)) return res.status(400).json({ error: 'Invalid child.' });
      const { rows } = await pool.query(`
        ${BASE_SELECT}
        AND ($4::uuid IS NULL OR g.child_id = $4::uuid)
        AND ($3::boolean OR
          (g.schedule_kind = 'one_off' AND g.scheduled_date = $2::date) OR
          (g.schedule_kind = 'weekly' AND g.start_date <= $2::date AND $5::smallint = ANY(g.weekdays)))
        ORDER BY c.created_date, g.created_at, g.id
      `, [req.familyCode, date.date, manage, childId || null, date.weekday]);
      res.set('Cache-Control', 'private, no-store');
      return res.json({ date: date.date, weekday: date.weekday, goals: rows });
    } catch (err) { return fail(res, err, 'List today goals'); }
  });

  router.post('/', async (req, res) => {
    const goal = parseGoal(req.body);
    if (goal.error) return res.status(400).json({ error: goal.error });
    try {
      const choice = await ownedChoice(pool, req.familyCode, goal.child_id, goal.category_id);
      if (!choice) return res.status(404).json({ error: 'Child or category not found.' });
      const today = await localToday(pool, req.familyCode);
      if (goal.schedule_kind === 'one_off' && goal.scheduled_date < today.date) {
        return res.status(400).json({ error: 'Choose today or a future date.' });
      }
      if (goal.schedule_kind === 'weekly') goal.start_date = goal.start_date || today.date;
      if (goal.start_date < today.date) {
        return res.status(400).json({ error: 'Choose today or a future start date.' });
      }
      const { rows } = await pool.query(`
        INSERT INTO today_goals
          (family_code, child_id, category_id, title, schedule_kind,
           scheduled_date, weekdays, start_date)
        VALUES ($1, $2, $3, $4, $5, $6::date, $7::smallint[], $8::date)
        RETURNING id, title, child_id, category_id, schedule_kind,
          to_char(scheduled_date,'YYYY-MM-DD') AS scheduled_date,
          to_char(start_date,'YYYY-MM-DD') AS start_date, weekdays
      `, [req.familyCode, goal.child_id, goal.category_id, goal.title,
        goal.schedule_kind, goal.scheduled_date, goal.weekdays, goal.start_date]);
      broadcast(req.familyCode, { type: 'todays_goals_updated' });
      return res.status(201).json(rows[0]);
    } catch (err) { return fail(res, err, 'Create today goal'); }
  });

  router.put('/:id', async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Goal not found.' });
    const goal = parseGoal(req.body);
    if (goal.error) return res.status(400).json({ error: goal.error });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: existing } = await client.query(
        'SELECT child_id FROM today_goals WHERE id = $1 AND family_code = $2 AND archived_at IS NULL FOR UPDATE',
        [req.params.id, req.familyCode]);
      if (!existing.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Goal not found.' }); }
      // Changes to the child would detach historical completions from their
      // original owner. Create a different goal instead.
      if (existing[0].child_id !== goal.child_id) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Create a separate goal for another child.' });
      }
      const choice = await ownedChoice(client, req.familyCode, goal.child_id, goal.category_id);
      if (!choice) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Child or category not found.' }); }
      const today = await localToday(client, req.familyCode);
      if (goal.schedule_kind === 'weekly') goal.start_date = goal.start_date || today.date;
      if (goal.start_date < today.date) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Choose today or a future date.' });
      }
      const { rows } = await client.query(`
        UPDATE today_goals SET title=$1, category_id=$2, schedule_kind=$3,
          scheduled_date=$4::date, weekdays=$5::smallint[], start_date=$6::date,
          updated_at=NOW()
        WHERE id=$7 AND family_code=$8 RETURNING id, title, child_id,
          category_id, schedule_kind, to_char(scheduled_date,'YYYY-MM-DD') AS scheduled_date,
          to_char(start_date,'YYYY-MM-DD') AS start_date, weekdays
      `, [goal.title, goal.category_id, goal.schedule_kind,
        goal.scheduled_date, goal.weekdays, goal.start_date, req.params.id, req.familyCode]);
      await client.query('COMMIT');
      broadcast(req.familyCode, { type: 'todays_goals_updated' });
      return res.json(rows[0]);
    } catch (err) { await client.query('ROLLBACK').catch(() => {}); return fail(res, err, 'Edit today goal'); }
    finally { client.release(); }
  });

  router.delete('/:id', async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Goal not found.' });
    try {
      const { rows } = await pool.query(`
        UPDATE today_goals SET archived_at=NOW(), updated_at=NOW()
        WHERE id=$1 AND family_code=$2 AND archived_at IS NULL RETURNING id
      `, [req.params.id, req.familyCode]);
      if (!rows.length) return res.status(404).json({ error: 'Goal not found.' });
      broadcast(req.familyCode, { type: 'todays_goals_updated' });
      return res.json({ archived: true, id: rows[0].id });
    } catch (err) { return fail(res, err, 'Archive today goal'); }
  });

  router.post('/:id/complete', async (req, res) => {
    const id = req.params.id, requestId = req.body?.request_id;
    if (!isUuid(id)) return res.status(404).json({ error: 'Goal not found.' });
    if (!isUuid(requestId)) return res.status(400).json({ error: 'Invalid request.' });
    const client = await pool.connect();
    const args = { goal_id: id };
    try {
      await client.query('BEGIN');
      const { rows: initial } = await client.query(
        'SELECT child_id FROM today_goals WHERE id=$1 AND family_code=$2 AND archived_at IS NULL',
        [id, req.familyCode]);
      if (!initial.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Goal not found.' }); }
      const { rows: childRows } = await client.query(
        'SELECT * FROM children WHERE id=$1 AND family_code=$2 FOR UPDATE',
        [initial[0].child_id, req.familyCode]);
      if (!childRows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Child not found.' }); }
      const child = childRows[0];
      const { rows: goals } = await client.query(
        'SELECT * FROM today_goals WHERE id=$1 AND family_code=$2 AND archived_at IS NULL FOR UPDATE',
        [id, req.familyCode]);
      if (!goals.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Goal not found.' }); }
      const g = goals[0];
      const { rows: prior } = await client.query(`
        SELECT result, endpoint, args FROM idempotency_keys
        WHERE family_code=$1 AND request_id=$2
      `, [req.familyCode, requestId]);
      if (prior.length) {
        await client.query('ROLLBACK');
        return prior[0].endpoint === 'today_goal_complete' &&
          JSON.stringify(prior[0].args) === JSON.stringify(args)
          ? res.json({ ...prior[0].result, duplicate: true })
          : res.status(409).json({ error: 'Invalid request.' });
      }
      const { rowCount: reusedEvent } = await client.query(
        'SELECT 1 FROM point_events WHERE family_code=$1 AND request_id=$2',
        [req.familyCode, requestId]);
      if (reusedEvent) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Invalid request.' }); }
      const today = await localToday(client, req.familyCode);
      const due = g.schedule_kind === 'one_off'
        ? g.scheduled_date.toISOString().slice(0,10) === today.date
        : g.start_date.toISOString().slice(0,10) <= today.date && g.weekdays.includes(today.weekday);
      if (!due) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This goal is not scheduled for today.' });
      }
      const choice = await ownedChoice(client, req.familyCode, child.id, g.category_id);
      if (!choice || !Number.isInteger(choice.points) || choice.points < 1 || choice.points > 1000) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Choose an available behaviour category before completing.' });
      }
      const { rowCount: done } = await client.query(`
        SELECT 1 FROM today_goal_completions
        WHERE goal_id=$1 AND scheduled_for=$2::date AND undone_at IS NULL
      `, [id, today.date]);
      if (done) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Goal already completed today.' }); }

      const points = choice.points, category = choice.category_name;
      const { rows: events } = await client.query(`
        INSERT INTO point_events (child_id, points, category, note, child_name,
          family_code, request_id, kind)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'award') RETURNING *
      `, [child.id, points, category, 'Today’s Goal: ' + g.title, child.name, req.familyCode, requestId]);
      const { rows: completions } = await client.query(`
        INSERT INTO today_goal_completions
          (family_code, goal_id, child_id, scheduled_for,
           point_event_id, awarded_points, category_name)
        VALUES ($1,$2,$3,$4::date,$5,$6,$7) RETURNING id
      `, [req.familyCode, id, child.id, today.date, events[0].id, points, category]);
      const { rows: updated } = await client.query(`
        UPDATE children SET total_points = total_points + $1
        WHERE id=$2 AND family_code=$3 RETURNING *
      `, [points, child.id, req.familyCode]);
      const streak = await recordStreak(client, req.familyCode);
      const week = (await weekPointsFor(client, req.familyCode, [child.id])).get(child.id);
      const result = {
        goal_id: id, completion_id: completions[0].id, event: events[0],
        child: { ...updated[0], week_points: week }, streak, date: today.date,
        duplicate: false,
      };
      await client.query(`
        INSERT INTO idempotency_keys (family_code, request_id, endpoint, args, result)
        VALUES ($1,$2,'today_goal_complete',$3::jsonb,$4::jsonb)
      `, [req.familyCode, requestId, JSON.stringify(args), JSON.stringify(result)]);
      await client.query('COMMIT');
      broadcast(req.familyCode, { type: 'points_updated', child_id: child.id });
      return res.json(result);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23505') {
        // An identical concurrent request may have won the database-level
        // request key. Return it if same args; otherwise reject, never re-award.
        const { rows } = await pool.query(
          'SELECT endpoint,args,result FROM idempotency_keys WHERE family_code=$1 AND request_id=$2',
          [req.familyCode, requestId]);
        if (rows.length && rows[0].endpoint === 'today_goal_complete' &&
            JSON.stringify(rows[0].args) === JSON.stringify(args)) {
          return res.json({ ...rows[0].result, duplicate: true });
        }
        return res.status(409).json({ error: 'Goal already completed today or request reused.' });
      }
      return fail(res, err, 'Complete today goal');
    } finally { client.release(); }
  });

  return router;
}
