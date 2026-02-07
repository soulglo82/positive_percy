import { Router } from 'express';
import pool from './db.js';

const router = Router();

// ─── Generic helpers ────────────────────────────────────────────────────────

function buildSort(sortField) {
  if (!sortField) return 'created_date DESC';
  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;
  return `${field} ${desc ? 'DESC' : 'ASC'}`;
}

const TABLE_MAP = {
  children: 'children',
  point_events: 'point_events',
  redemptions: 'redemptions',
  rewards: 'rewards',
};

// ─── Entity CRUD routes ─────────────────────────────────────────────────────

// LIST  – GET /api/:entity?sort=&limit=
router.get('/api/:entity', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  const sort = buildSort(req.query.sort);
  const limit = req.query.limit ? `LIMIT ${parseInt(req.query.limit)}` : '';

  const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY ${sort} ${limit}`);
  res.json(rows);
});

// FILTER – POST /api/:entity/filter
router.post('/api/:entity/filter', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  const { filter, sort } = req.body;
  const conditions = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(filter || {})) {
    conditions.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = buildSort(sort);

  const { rows } = await pool.query(
    `SELECT * FROM ${table} ${where} ORDER BY ${orderBy}`,
    values
  );
  res.json(rows);
});

// CREATE – POST /api/:entity
router.post('/api/:entity', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  const data = req.body;
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`);

  const { rows } = await pool.query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values
  );
  res.json(rows[0]);
});

// UPDATE – PUT /api/:entity/:id
router.put('/api/:entity/:id', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  const data = req.body;
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// DELETE – DELETE /api/:entity/:id
router.delete('/api/:entity/:id', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

// ─── User / Auth routes ─────────────────────────────────────────────────────

// Get or create user
router.get('/api/auth/me', async (req, res) => {
  const email = req.query.email || 'parent@family.local';

  let { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

  if (rows.length === 0) {
    const result = await pool.query(
      `INSERT INTO users (email, full_name) VALUES ($1, $2) RETURNING *`,
      [email, 'Parent']
    );
    rows = result.rows;
  }

  res.json(rows[0]);
});

// Update user
router.put('/api/auth/me', async (req, res) => {
  const email = req.query.email || 'parent@family.local';
  const data = req.body;
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(email);

  const { rows } = await pool.query(
    `UPDATE users SET ${setClause} WHERE email = $${values.length} RETURNING *`,
    values
  );
  res.json(rows[0]);
});

export default router;
