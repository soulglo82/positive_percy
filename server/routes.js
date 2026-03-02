import { Router } from 'express';
import jwt from 'jsonwebtoken';
import pool from './db.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'positive-percy-secret-change-in-prod';
const JWT_EXPIRY = '30d';

function signToken(familyCode) {
  return jwt.sign({ family_code: familyCode }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      req.familyCode = decoded.family_code;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
  // Fallback: accept family_code from query/body for backward compatibility during migration
  const fc = req.query.family_code || req.body?.family_code;
  if (fc) {
    req.familyCode = fc;
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

// ─── Generic helpers ────────────────────────────────────────────────────────

const COLUMN_WHITELIST = {
  children: new Set(['name', 'avatar_url', 'total_points', 'weekly_points',
    'weekly_target', 'last_reset_date', 'parent_email', 'family_code', 'date_of_birth']),
  point_events: new Set(['child_id', 'points', 'category', 'note',
    'child_name', 'family_code']),
  redemptions: new Set(['child_id', 'child_name', 'reward_id', 'reward_title',
    'reward_cost', 'status', 'family_code']),
  rewards: new Set(['title', 'description', 'cost_points', 'image_url',
    'emoji', 'visible_to_child', 'assigned_child_ids', 'family_code']),
};

const SORT_WHITELIST = new Set(['created_date', 'name', 'title', 'points',
  'total_points', 'weekly_points', 'cost_points', 'status']);

const USER_COLUMN_WHITELIST = new Set(['email', 'full_name', 'family_code',
  'mum_name', 'mum_phone', 'dad_name', 'dad_phone']);

function validateColumns(table, keys) {
  const allowed = COLUMN_WHITELIST[table];
  if (!allowed) return;
  const invalid = keys.filter(k => !allowed.has(k));
  if (invalid.length > 0) {
    const err = new Error(`Invalid columns: ${invalid.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

function buildSort(sortField) {
  if (!sortField) return 'created_date DESC';
  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;
  if (!SORT_WHITELIST.has(field)) return 'created_date DESC';
  return `${field} ${desc ? 'DESC' : 'ASC'}`;
}

function generateFamilyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const TABLE_MAP = {
  children: 'children',
  point_events: 'point_events',
  redemptions: 'redemptions',
  rewards: 'rewards',
};

// ─── File upload ────────────────────────────────────────────────────────────

// Upload file (accepts base64 data URL in JSON body)
router.post('/api/upload', async (req, res) => {
  try {
    const { data, content_type } = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    const { rows } = await pool.query(
      'INSERT INTO uploads (data, content_type) VALUES ($1, $2) RETURNING id',
      [data, content_type || 'image/png']
    );
    res.json({ file_url: `/api/uploads/${rows[0].id}` });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Serve uploaded file
router.get('/api/uploads/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT data, content_type FROM uploads WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).send('Not found');

    const { data, content_type } = rows[0];

    if (data.startsWith('data:')) {
      const matches = data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const buffer = Buffer.from(matches[2], 'base64');
        res.set('Content-Type', matches[1]);
        res.set('Cache-Control', 'public, max-age=31536000');
        return res.send(buffer);
      }
    }

    res.set('Content-Type', content_type);
    res.send(data);
  } catch (err) {
    console.error('Upload serve error:', err);
    res.status(500).send('Error loading file');
  }
});

// ─── Family auth routes ─────────────────────────────────────────────────────

// Create a new family
router.post('/api/family/create', async (req, res) => {
  const { family_name } = req.body;
  if (!family_name) return res.status(400).json({ error: 'Family name is required' });

  let family_code;
  let attempts = 0;
  while (attempts < 10) {
    family_code = generateFamilyCode();
    try {
      const { rows } = await pool.query(
        'INSERT INTO families (family_code, family_name) VALUES ($1, $2) RETURNING *',
        [family_code, family_name]
      );
      const token = signToken(family_code);
      return res.json({ ...rows[0], token });
    } catch (err) {
      if (err.code === '23505') {
        attempts++;
        continue;
      }
      throw err;
    }
  }
  res.status(500).json({ error: 'Could not generate unique family code' });
});

// Join an existing family
router.post('/api/family/join', async (req, res) => {
  const { family_code } = req.body;
  if (!family_code) return res.status(400).json({ error: 'Family code is required' });

  const { rows } = await pool.query(
    'SELECT * FROM families WHERE family_code = $1',
    [family_code.toUpperCase()]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Family not found. Check the code and try again.' });
  }

  const token = signToken(rows[0].family_code);
  res.json({ ...rows[0], token });
});

// Get family info
router.get('/api/family/:code', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM families WHERE family_code = $1',
    [req.params.code.toUpperCase()]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Family not found' });
  }

  res.json(rows[0]);
});

// ─── User / Profile routes (MUST be before generic :entity routes) ──────────

// Get or create user by family code
router.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const familyCode = req.familyCode;

    const { rows: familyRows } = await pool.query(
      'SELECT * FROM families WHERE family_code = $1',
      [familyCode]
    );
    if (familyRows.length === 0) {
      return res.status(404).json({ error: 'Family not found' });
    }

    let { rows } = await pool.query(
      'SELECT * FROM users WHERE family_code = $1',
      [familyCode]
    );

    if (rows.length === 0) {
      const result = await pool.query(
        'INSERT INTO users (email, full_name, family_code) VALUES ($1, $2, $3) RETURNING *',
        [`family-${familyCode}@positivepercy.app`, familyRows[0].family_name, familyCode]
      );
      rows = result.rows;
    }

    res.json({ ...rows[0], family: familyRows[0] });
  } catch (err) {
    console.error('Auth GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update user profile
router.put('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const familyCode = req.familyCode;

    const data = req.body;
    const keys = Object.keys(data);
    const invalidKeys = keys.filter(k => !USER_COLUMN_WHITELIST.has(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({ error: `Invalid columns: ${invalidKeys.join(', ')}` });
    }
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    values.push(familyCode);

    const { rows } = await pool.query(
      `UPDATE users SET ${setClause} WHERE family_code = $${values.length} RETURNING *`,
      values
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Auth PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Children-specific endpoints ─────────────────────────────────────────────

// Weekly reset (server-side, idempotent)
router.post('/api/children/weekly-reset', authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    if (dayOfWeek !== 1) return res.json({ reset: false, reason: 'Not Monday' });

    const todayStr = today.toISOString().split('T')[0];
    const { rowCount } = await pool.query(
      `UPDATE children
       SET weekly_points = 0, last_reset_date = $1
       WHERE family_code = $2
         AND weekly_points > 0
         AND (last_reset_date IS NULL OR last_reset_date != $1)`,
      [todayStr, req.familyCode]
    );
    res.json({ reset: true, children_reset: rowCount });
  } catch (err) {
    console.error('Weekly reset error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Atomic point adjustment (prevents race conditions)
router.post('/api/children/:id/adjust-points', authMiddleware, async (req, res) => {
  try {
    const { points } = req.body;
    if (typeof points !== 'number') {
      return res.status(400).json({ error: 'points must be a number' });
    }

    const { rows } = await pool.query(
      `UPDATE children
       SET total_points = GREATEST(0, total_points + $1),
           weekly_points = GREATEST(0, weekly_points + $1)
       WHERE id = $2 AND family_code = $3
       RETURNING *`,
      [points, req.params.id, req.familyCode]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Child not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Adjust points error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Entity CRUD routes ─────────────────────────────────────────────────────

// LIST  – GET /api/:entity?sort=&limit=
router.get('/api/:entity', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const sort = buildSort(req.query.sort);
    const limit = req.query.limit ? `LIMIT ${parseInt(req.query.limit)}` : '';

    const values = [req.familyCode];
    const where = 'WHERE family_code = $1';

    const { rows } = await pool.query(
      `SELECT * FROM ${table} ${where} ORDER BY ${sort} ${limit}`,
      values
    );
    res.json(rows);
  } catch (err) {
    console.error(`List ${req.params.entity} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// FILTER – POST /api/:entity/filter
router.post('/api/:entity/filter', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const { filter, sort } = req.body;
    const filterKeys = Object.keys(filter || {});
    if (filterKeys.length > 0) {
      validateColumns(table, filterKeys);
    }

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
  } catch (err) {
    console.error(`Filter ${req.params.entity} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE – POST /api/:entity
router.post('/api/:entity', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const data = req.body;
    const keys = Object.keys(data);
    validateColumns(table, keys);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const { rows } = await pool.query(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(`Create ${req.params.entity} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE – PUT /api/:entity/:id
router.put('/api/:entity/:id', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const data = req.body;
    const keys = Object.keys(data);
    validateColumns(table, keys);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    values.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(`Update ${req.params.entity} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE – DELETE /api/:entity/:id
router.delete('/api/:entity/:id', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(`Delete ${req.params.entity} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
