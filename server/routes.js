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
    res.status(500).json({ error: 'Upload failed' });
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
      return res.json(rows[0]);
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

  res.json(rows[0]);
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
router.get('/api/auth/me', async (req, res) => {
  try {
    const familyCode = req.query.family_code;
    if (!familyCode) {
      return res.status(400).json({ error: 'No family code provided' });
    }

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
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/api/auth/me', async (req, res) => {
  try {
    const familyCode = req.query.family_code;
    if (!familyCode) return res.status(400).json({ error: 'No family code' });

    const data = req.body;
    const keys = Object.keys(data);
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
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Entity CRUD routes ─────────────────────────────────────────────────────

// LIST  – GET /api/:entity?sort=&limit=&family_code=
router.get('/api/:entity', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const sort = buildSort(req.query.sort);
    const limit = req.query.limit ? `LIMIT ${parseInt(req.query.limit)}` : '';

    let where = '';
    const values = [];
    if (req.query.family_code) {
      values.push(req.query.family_code);
      where = `WHERE family_code = $1`;
    }

    const { rows } = await pool.query(
      `SELECT * FROM ${table} ${where} ORDER BY ${sort} ${limit}`,
      values
    );
    res.json(rows);
  } catch (err) {
    console.error(`List ${req.params.entity} error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// FILTER – POST /api/:entity/filter
router.post('/api/:entity/filter', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
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
  } catch (err) {
    console.error(`Filter ${req.params.entity} error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE – POST /api/:entity
router.post('/api/:entity', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const data = req.body;
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const { rows } = await pool.query(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(`Create ${req.params.entity} error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE – PUT /api/:entity/:id
router.put('/api/:entity/:id', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
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
  } catch (err) {
    console.error(`Update ${req.params.entity} error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE – DELETE /api/:entity/:id
router.delete('/api/:entity/:id', async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(`Delete ${req.params.entity} error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
