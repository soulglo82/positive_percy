import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { pickAllowedColumns, findMissingRequired } from './columns.js';

const router = Router();

// Every route with an :id expects a UUID. Anything else is not found, so a
// malformed id never reaches the database.
router.param('id', (req, res, next, id) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(404).json({ error: 'Not found' });
  return next();
});

let broadcastFn = () => {};
export function setBroadcast(fn) { broadcastFn = fn; }

const JWT_EXPIRY = '30d';
const MIN_SECRET_LENGTH = 32;

// The signing secret has no fallback. A missing or short secret stops the
// server at startup (see index.js) and fails every sign/verify here, whatever
// NODE_ENV says.
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters`);
  }
  return secret;
}

function signToken(familyCode) {
  return jwt.sign({ family_code: familyCode }, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

// Returns { familyCode, expiresAt } for a valid token, or null.
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded.family_code !== 'string') return null;
    return { familyCode: decoded.family_code, expiresAt: decoded.exp ? decoded.exp * 1000 : null };
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], getJwtSecret());
      req.familyCode = decoded.family_code;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
  return res.status(401).json({ error: 'Authentication required' });
}

// Generic 500: detail goes to the server log only, never to the client.
function serverError(res, label, err) {
  console.error(`${label}:`, err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// Points per award, per category and as a starting balance.
export const MAX_AWARD = 1000;
const isWholeNumber = (v) => typeof v === 'number' && Number.isInteger(v);

// Category points: whole number 1..MAX_AWARD, default 5.
function categoryPoints(value, fallback = 5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_AWARD, Math.max(1, Math.round(n)));
}

// Reads a reward the caller may spend on this child: it must belong to the
// family and, if assigned to specific children, include this one. Cost and
// title always come from here, never from the request.
async function loadSpendableReward(db, rewardId, childId, familyCode) {
  if (!isUuid(String(rewardId || ''))) return null;
  const { rows } = await db.query(
    'SELECT id, title, cost_points, assigned_child_ids FROM rewards WHERE id = $1 AND family_code = $2',
    [rewardId, familyCode]
  );
  const r = rows[0];
  if (!r) return null;
  const assigned = r.assigned_child_ids || [];
  if (assigned.length > 0 && !assigned.includes(childId)) return null;
  return { id: r.id, title: r.title, cost: r.cost_points };
}

const stackTotalOf = (stack) => (stack || []).reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

// The stack re-priced from the rewards table, dropping items whose reward is
// gone or no longer for this child. Saved costs are never trusted.
async function pricedStack(db, stack, childId, familyCode) {
  const out = [];
  for (const item of stack || []) {
    const reward = await loadSpendableReward(db, item.rewardId, childId, familyCode);
    if (reward) out.push({ rewardId: reward.id, name: reward.title, cost: reward.cost });
  }
  return out;
}

// ─── Input validation helpers ───────────────────────────────────────────────

const MAX_NAME_LENGTH = 100;
const MAX_NOTE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 1000;

function sanitizeString(str, maxLength) {
  if (typeof str !== 'string') return str;
  return str.trim().slice(0, maxLength);
}

function validateCreatePayload(table, data, { isCreate = false } = {}) {
  if (isCreate && findMissingRequired(table, data).length > 0) {
    // Generic, user-safe message — do not echo the specific column names.
    throw Object.assign(new Error('Missing required fields'), { status: 400 });
  }
  if (table === 'children') {
    if (data.name !== undefined) {
      data.name = sanitizeString(data.name, MAX_NAME_LENGTH);
      if (!data.name) throw Object.assign(new Error('Child name is required'), { status: 400 });
    }
    if (data.age !== undefined) {
      // age is an INTEGER column — normalize whatever the client sent to a
      // whole positive number, or null. Server is authoritative here.
      const n = Number(data.age);
      data.age = Number.isFinite(n) && n >= 1 && n <= 17 ? Math.trunc(n) : null;
    }
  }
  if (table === 'rewards') {
    if (data.title !== undefined) {
      data.title = sanitizeString(data.title, MAX_NAME_LENGTH);
      if (!data.title) throw Object.assign(new Error('Reward title is required'), { status: 400 });
    }
    if (data.description !== undefined) {
      data.description = sanitizeString(data.description, MAX_DESCRIPTION_LENGTH);
    }
    if (data.cost_points !== undefined) {
      if (typeof data.cost_points !== 'number' || data.cost_points < 1) {
        throw Object.assign(new Error('Reward cost must be at least 1 point'), { status: 400 });
      }
    }
  }
  if (table === 'point_events') {
    if (data.note !== undefined) {
      data.note = sanitizeString(data.note, MAX_NOTE_LENGTH);
    }
    if (data.category !== undefined) {
      data.category = sanitizeString(data.category, MAX_NAME_LENGTH);
    }
  }
  if (table === 'family_goals') {
    if (data.title !== undefined) {
      data.title = sanitizeString(data.title, MAX_NAME_LENGTH);
      if (!data.title) throw Object.assign(new Error('Goal title is required'), { status: 400 });
    }
    if (data.description !== undefined) {
      data.description = sanitizeString(data.description, MAX_DESCRIPTION_LENGTH);
    }
  }
  return data;
}

// ─── Generic helpers ────────────────────────────────────────────────────────

const SORT_WHITELIST = new Set(['created_date', 'name', 'title', 'points',
  'total_points', 'weekly_points', 'cost_points', 'status']);

// family_code and email are not client-settable: family_code is the tenant
// key, and email is UNIQUE so it could be squatted.
const USER_COLUMN_WHITELIST = new Set(['full_name',
  'mum_name', 'mum_phone', 'dad_name', 'dad_phone']);

function buildSort(sortField) {
  if (!sortField) return 'created_date DESC';
  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;
  if (!SORT_WHITELIST.has(field)) return 'created_date DESC';
  return `${field} ${desc ? 'DESC' : 'ASC'}`;
}

// Substrings to reject in generated family codes (case-insensitive check)
const BLOCKED_CODE_PATTERNS = [
  'ASS', 'BUT', 'CUM', 'DAM', 'DIK', 'DIC', 'FAG', 'FAT', 'FUC', 'FUK',
  'GAY', 'GOD', 'HEL', 'JEW', 'KKK', 'NAZ', 'NIG', 'PEN', 'PIZ', 'POO',
  'PUS', 'RAP', 'SEX', 'SHT', 'SLU', 'TIT', 'WTF', 'XXX',
];

// The family code is a bearer credential, so it comes from a cryptographic
// RNG. 32 symbols divide 256 evenly, so byte % 32 has no bias.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateFamilyCode(randomBytes = crypto.randomBytes) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = randomBytes(CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    if (!BLOCKED_CODE_PATTERNS.some(p => code.includes(p))) return code;
  }
  throw new Error('Could not generate a family code');
}

const TABLE_MAP = {
  children: 'children',
  point_events: 'point_events',
  redemptions: 'redemptions',
  rewards: 'rewards',
  family_goals: 'family_goals',
};

// ─── File upload ────────────────────────────────────────────────────────────

// Images only, checked by their actual bytes, not by what the client claims.
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function sniffImageType(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return 'image/gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

function decodeDataUrl(data) {
  if (typeof data !== 'string') return null;
  const m = data.match(/^data:[^;,]*;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m) return null;
  return Buffer.from(m[1], 'base64');
}

// Upload file (accepts base64 data URL in JSON body)
router.post('/api/upload', authMiddleware, async (req, res) => {
  try {
    const buffer = decodeDataUrl(req.body?.data);
    if (!buffer || buffer.length === 0) return res.status(400).json({ error: 'Please upload an image file.' });
    if (buffer.length > MAX_UPLOAD_BYTES) return res.status(400).json({ error: 'That image is too large.' });
    const type = sniffImageType(buffer);
    if (!type) return res.status(400).json({ error: 'Please upload a PNG, JPEG, GIF or WebP image.' });

    const { rows } = await pool.query(
      'INSERT INTO uploads (data, content_type) VALUES ($1, $2) RETURNING id',
      [`data:${type};base64,${buffer.toString('base64')}`, type]
    );
    res.json({ file_url: `/api/uploads/${rows[0].id}` });
  } catch (err) {
    return serverError(res, 'Upload error', err);
  }
});

// Serve uploaded file. Public, because <img> tags cannot send a bearer token;
// ids are random UUIDs. The type comes from the bytes, never from what was
// stored, so rows saved before validation existed can never render as HTML.
router.get('/api/uploads/:id', async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).send('Not found');
    const { rows } = await pool.query('SELECT data FROM uploads WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).send('Not found');

    const buffer = decodeDataUrl(rows[0].data) || Buffer.from(String(rows[0].data));
    const type = sniffImageType(buffer);
    res.set('X-Content-Type-Options', 'nosniff');
    if (!type) {
      res.set('Content-Type', 'application/octet-stream');
      res.set('Content-Disposition', 'attachment');
      return res.send(buffer);
    }
    res.set('Content-Type', type);
    res.set('Content-Disposition', 'inline');
    res.set('Cache-Control', 'public, max-age=31536000');
    return res.send(buffer);
  } catch (err) {
    console.error('Upload serve error:', err);
    res.status(500).send('Error loading file');
  }
});

// ─── Family auth routes ─────────────────────────────────────────────────────

// Create a new family
router.post('/api/family/create', async (req, res) => {
  const family_name = typeof req.body?.family_name === 'string' ? req.body.family_name.trim().slice(0, 100) : '';
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

      // IMPL-5.5: Seed default behavior categories atomically
      await pool.query(
        `INSERT INTO behavior_categories (family_code, name, icon, sort_order, is_default, points, is_quick_action) VALUES
          ($1, 'Kindness', '💛', 0, true, 5, true),
          ($1, 'Helpfulness', '🤝', 1, true, 5, true),
          ($1, 'Bravery', '🦁', 2, true, 10, true),
          ($1, 'Resilience', '💪', 3, true, 10, false),
          ($1, 'Caring', '🫶', 4, true, 5, true),
          ($1, 'Chores', '🧹', 5, true, 5, false),
          ($1, 'Homework', '📖', 6, true, 5, false),
          ($1, 'Adventurous', '🌟', 7, true, 10, false)
        ON CONFLICT (family_code, name) DO NOTHING`,
        [family_code]
      );

      const token = signToken(family_code);
      return res.json({ ...rows[0], token });
    } catch (err) {
      if (err.code === '23505') {
        attempts++;
        continue;
      }
      return serverError(res, 'Create family error', err);
    }
  }
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Join an existing family
router.post('/api/family/join', async (req, res) => {
  const family_code = req.body?.family_code;
  if (typeof family_code !== 'string' || !family_code.trim()) {
    return res.status(400).json({ error: 'Family code is required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM families WHERE family_code = $1',
      [family_code.trim().toUpperCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Family not found. Check the code and try again.' });
    }

    const token = signToken(rows[0].family_code);
    res.json({ ...rows[0], token });
  } catch (err) {
    return serverError(res, 'Join family error', err);
  }
});

// Get family info: your own family only. Not removed, because the SPA
// catch-all would answer an unknown /api path with 200.
// Must come before '/api/family/:code', which would otherwise match 'streak'.
router.get('/api/family/streak', authMiddleware, readStreak);

router.get('/api/family/:code', authMiddleware, async (req, res) => {
  if (req.params.code.toUpperCase() !== req.familyCode) {
    return res.status(404).json({ error: 'Family not found' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM families WHERE family_code = $1',
      [req.familyCode]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Family not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    return serverError(res, 'Get family error', err);
  }
});

// Parent streak (FEAT-006): consecutive days (UTC) with at least one award.
// Recorded by the server inside the award transaction, never by a page
// load or a client flag, so visiting the app does not count.
const STREAK_MILESTONES = [7, 14, 30, 60, 100];
const utcDay = (offsetDays = 0) => new Date(Date.now() - offsetDays * 86400000).toISOString().split('T')[0];

export async function recordStreak(db, familyCode) {
  const today = utcDay(0);
  const yesterday = utcDay(1);
  const { rows } = await db.query(
    'SELECT current_streak, last_active_date, longest_streak FROM families WHERE family_code = $1 FOR UPDATE',
    [familyCode]
  );
  if (rows.length === 0) return { streak: 0, milestone: false };
  const f = rows[0];
  if (f.last_active_date === today) return { streak: f.current_streak || 0, milestone: false };
  const streak = f.last_active_date === yesterday ? (f.current_streak || 0) + 1 : 1;
  await db.query(
    'UPDATE families SET current_streak = $1, last_active_date = $2, longest_streak = GREATEST(COALESCE(longest_streak, 0), $1) WHERE family_code = $3',
    [streak, today, familyCode]
  );
  return { streak, milestone: STREAK_MILESTONES.includes(streak) };
}

// Read-only. A streak whose last award was before yesterday shows as 0.
async function readStreak(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT current_streak, last_active_date, longest_streak FROM families WHERE family_code = $1',
      [req.familyCode]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Family not found' });
    const f = rows[0];
    const live = f.last_active_date === utcDay(0) || f.last_active_date === utcDay(1);
    res.json({ streak: live ? (f.current_streak || 0) : 0, longest: f.longest_streak || 0, updated: false });
  } catch (err) {
    return serverError(res, 'Read streak error', err);
  }
}
// Kept for older app versions still open in a browser: now read-only.
router.post('/api/family/check-streak', authMiddleware, readStreak);

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
    return serverError(res, 'Auth GET error:', err);
  }
});

// Update user profile
router.put('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const familyCode = req.familyCode;

    // Unknown keys are dropped silently and never echoed back.
    const data = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (USER_COLUMN_WHITELIST.has(k)) data[k] = v;
    }
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
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
    return serverError(res, 'Auth PUT error:', err);
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
    if (rowCount > 0) broadcastFn(req.familyCode, { type: 'points_updated' });
    res.json({ reset: true, children_reset: rowCount });
  } catch (err) {
    return serverError(res, 'Weekly reset error:', err);
  }
});

// Atomic point adjustment (prevents race conditions)
// A request_id seen before: same award -> return what happened, unchanged.
// Anything different under the same id -> 409, never a second award.
function replayAward(res, prior, child, points, category) {
  const sameChild = prior.child_id === child.id;
  const sameCategory = prior.category === String(category).trim();
  const sameDirection = Math.sign(prior.points) === Math.sign(points);
  const fits = points > 0 ? prior.points === points : prior.points >= points;
  if (!sameChild || !sameCategory || !sameDirection || !fits) {
    return res.status(409).json({ error: 'Invalid request' });
  }
  return res.json({ event: prior, child, duplicate: true, capped: prior.points !== points });
}

// Award or deduct points. The only way a balance changes outside spending:
// one transaction locks the child, applies the amount (a deduction stops at
// 0), and writes the history row for exactly what was applied. request_id
// makes a retried request apply once.
router.post('/api/children/:id/award', authMiddleware, async (req, res) => {
  const { points, category, note, request_id } = req.body || {};
  if (!isWholeNumber(points) || points === 0 || Math.abs(points) > MAX_AWARD) {
    return res.status(400).json({ error: `Points must be a whole number from 1 to ${MAX_AWARD}, or minus that.` });
  }
  if (typeof category !== 'string' || !category.trim() || category.length > 100) {
    return res.status(400).json({ error: 'Please choose a category.' });
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) {
    return res.status(400).json({ error: 'Note is too long.' });
  }
  if (!isUuid(String(request_id || ''))) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Child not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: childRows } = await client.query(
      'SELECT * FROM children WHERE id = $1 AND family_code = $2 FOR UPDATE',
      [req.params.id, req.familyCode]
    );
    if (childRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Child not found' });
    }
    const child = childRows[0];

    // Already applied: return the original result, do nothing again.
    const { rows: prior } = await client.query(
      'SELECT * FROM point_events WHERE family_code = $1 AND request_id = $2',
      [req.familyCode, request_id]
    );
    if (prior.length > 0) {
      await client.query('ROLLBACK');
      return replayAward(res, prior[0], child, points, category);
    }

    const applied = points < 0 ? Math.max(points, -child.total_points) : points;
    if (applied === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `${child.name} has no points to take away.` });
    }

    let eventRows;
    try {
      ({ rows: eventRows } = await client.query(
        `INSERT INTO point_events (child_id, points, category, note, child_name, family_code, request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [child.id, applied, category.trim(), note || null, child.name, req.familyCode, request_id]
      ));
    } catch (err) {
      // Same request_id committed meanwhile (for another child's row lock).
      if (err.code !== '23505') throw err;
      await client.query('ROLLBACK');
      const { rows: won } = await pool.query(
        'SELECT * FROM point_events WHERE family_code = $1 AND request_id = $2',
        [req.familyCode, request_id]
      );
      if (won.length === 0) throw err;
      return replayAward(res, won[0], child, points, category);
    }
    const { rows: updated } = await client.query(
      `UPDATE children
       SET total_points = total_points + $1,
           weekly_points = GREATEST(0, weekly_points + $1)
       WHERE id = $2 AND family_code = $3
       RETURNING *`,
      [applied, child.id, req.familyCode]
    );
    const streak = applied > 0 ? await recordStreak(client, req.familyCode) : null;
    await client.query('COMMIT');

    broadcastFn(req.familyCode, { type: 'points_updated', child_id: child.id });
    res.json({ event: eventRows[0], child: updated[0], duplicate: false, capped: applied !== points, streak });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return serverError(res, 'Award points error', err);
  } finally {
    client.release();
  }
});

router.post('/api/children/:id/redeem', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { reward_id } = req.body || {};
    const childId = req.params.id;
    if (!isUuid(childId)) return res.status(404).json({ error: 'Child not found' });

    await client.query('BEGIN');

    // Lock the child row and check balance
    const { rows: childRows } = await client.query(
      'SELECT name, total_points, weekly_points, reward_stack FROM children WHERE id = $1 AND family_code = $2 FOR UPDATE',
      [childId, req.familyCode]
    );

    if (childRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Child not found' });
    }

    const reward = await loadSpendableReward(client, reward_id, childId, req.familyCode);
    if (!reward) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reward not found' });
    }
    const reward_cost = reward.cost;
    const reward_title = reward.title;
    const child_name = childRows[0].name;

    // Points already set aside in the reward stack are not spendable twice.
    const reserved = stackTotalOf(await pricedStack(client, childRows[0].reward_stack, childId, req.familyCode));
    if (childRows[0].total_points - reserved < reward_cost) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: reserved > 0
          ? `Not enough points: ${reserved} are already set aside for stacked rewards.`
          : 'Not enough points',
      });
    }

    // Deduct points
    await client.query(
      `UPDATE children
       SET total_points = GREATEST(0, total_points - $1),
           weekly_points = GREATEST(0, weekly_points - $1),
           points_spent = COALESCE(points_spent, 0) + $1
       WHERE id = $2 AND family_code = $3`,
      [reward_cost, childId, req.familyCode]
    );

    // Create redemption record
    const { rows: redemptionRows } = await client.query(
      `INSERT INTO redemptions (child_id, child_name, reward_id, reward_title, reward_cost, status, family_code)
       VALUES ($1, $2, $3, $4, $5, 'Completed', $6) RETURNING *`,
      [childId, child_name || '', reward.id, reward_title, reward_cost, req.familyCode]
    );

    await client.query('COMMIT');

    // Fetch updated child
    const { rows: updatedChild } = await pool.query(
      'SELECT * FROM children WHERE id = $1 AND family_code = $2',
      [childId, req.familyCode]
    );

    broadcastFn(req.familyCode, { type: 'points_updated', child_id: childId });
    res.json({ child: updatedChild[0], redemption: redemptionRows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return serverError(res, 'Redeem error:', err);
  } finally {
    client.release();
  }
});

// ─── Reward Stack endpoints ──────────────────────────────────────────────────

// Add reward to child's stack
router.post('/api/children/:id/stack/add', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { reward_id } = req.body || {};
    const childId = req.params.id;
    if (!isUuid(childId)) return res.status(404).json({ error: 'Child not found' });

    await client.query('BEGIN');

    const reward = await loadSpendableReward(client, reward_id, childId, req.familyCode);
    if (!reward) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reward not found' });
    }
    const reward_cost = reward.cost;
    const reward_title = reward.title;

    const { rows: childRows } = await client.query(
      'SELECT total_points, reward_stack FROM children WHERE id = $1 AND family_code = $2 FOR UPDATE',
      [childId, req.familyCode]
    );

    if (childRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Child not found' });
    }

    const stack = await pricedStack(client, childRows[0].reward_stack, childId, req.familyCode);
    const stackTotal = stackTotalOf(stack);

    if (stackTotal + reward_cost > childRows[0].total_points) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Not enough points',
        stack_total: stackTotal,
        new_item_cost: reward_cost,
        balance: childRows[0].total_points,
      });
    }

    stack.push({ rewardId: reward.id, name: reward_title, cost: reward_cost });

    await client.query(
      'UPDATE children SET reward_stack = $1 WHERE id = $2 AND family_code = $3',
      [JSON.stringify(stack), childId, req.familyCode]
    );

    await client.query('COMMIT');

    broadcastFn(req.familyCode, { type: 'stack_updated', child_id: childId });
    res.json({ reward_stack: stack });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return serverError(res, 'Stack add error:', err);
  } finally {
    client.release();
  }
});

// Remove reward from child's stack by index
router.delete('/api/children/:id/stack/:index', authMiddleware, async (req, res) => {
  if (!/^\d+$/.test(req.params.index)) return res.status(400).json({ error: 'Invalid stack index' });
  const index = Number(req.params.index);
  const childId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Locked so a remove racing a confirm cannot put paid items back.
    const { rows: childRows } = await client.query(
      'SELECT reward_stack FROM children WHERE id = $1 AND family_code = $2 FOR UPDATE',
      [childId, req.familyCode]
    );
    if (childRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Child not found' });
    }
    const stack = childRows[0].reward_stack || [];
    if (index >= stack.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid stack index' });
    }
    stack.splice(index, 1);
    await client.query(
      'UPDATE children SET reward_stack = $1 WHERE id = $2 AND family_code = $3',
      [JSON.stringify(stack), childId, req.familyCode]
    );
    await client.query('COMMIT');
    broadcastFn(req.familyCode, { type: 'stack_updated', child_id: childId });
    res.json({ reward_stack: stack });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return serverError(res, 'Stack remove error:', err);
  } finally {
    client.release();
  }
});

// Confirm rewards — parent action: deduct points + clear stack + log redemptions (atomic)
router.post('/api/children/:id/stack/confirm', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const childId = req.params.id;

    await client.query('BEGIN');

    // Lock child row
    const { rows: childRows } = await client.query(
      'SELECT total_points, weekly_points, reward_stack, name FROM children WHERE id = $1 AND family_code = $2 FOR UPDATE',
      [childId, req.familyCode]
    );

    if (childRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Child not found' });
    }

    const child = childRows[0];
    const stack = child.reward_stack || [];

    if (stack.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stack is empty' });
    }

    // Price every item from the rewards table now. Items whose reward is gone
    // or no longer for this child are dropped, never charged.
    const priced = await pricedStack(client, stack, childId, req.familyCode);
    if (priced.length === 0) {
      await client.query("UPDATE children SET reward_stack = '[]' WHERE id = $1 AND family_code = $2", [childId, req.familyCode]);
      await client.query('COMMIT');
      broadcastFn(req.familyCode, { type: 'stack_updated', child_id: childId });
      return res.status(400).json({ error: 'Those rewards are no longer available.' });
    }
    stack.splice(0, stack.length, ...priced);
    const stackTotal = stackTotalOf(stack);

    if (stackTotal > child.total_points) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough points for stacked rewards' });
    }

    // 1. Deduct points
    await client.query(
      `UPDATE children
       SET total_points = GREATEST(0, total_points - $1),
           weekly_points = GREATEST(0, weekly_points - $1),
           points_spent = COALESCE(points_spent, 0) + $1,
           reward_stack = '[]'
       WHERE id = $2 AND family_code = $3`,
      [stackTotal, childId, req.familyCode]
    );

    // 2. Log each reward as a redemption
    for (const item of stack) {
      await client.query(
        `INSERT INTO redemptions (child_id, child_name, reward_id, reward_title, reward_cost, status, family_code)
         VALUES ($1, $2, $3, $4, $5, 'Completed', $6)`,
        [childId, child.name, item.rewardId, item.name, item.cost, req.familyCode]
      );
    }

    await client.query('COMMIT');

    // Fetch updated child
    const { rows: updatedChild } = await pool.query(
      'SELECT * FROM children WHERE id = $1 AND family_code = $2',
      [childId, req.familyCode]
    );

    broadcastFn(req.familyCode, { type: 'points_updated', child_id: childId });
    res.json({ child: updatedChild[0], confirmed_count: stack.length, points_deducted: stackTotal });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return serverError(res, 'Stack confirm error:', err);
  } finally {
    client.release();
  }
});

// Server-side summary aggregation (ENH-004)
router.get('/api/summary', authMiddleware, async (req, res) => {
  try {
    const weekStart = req.query.week_start;
    const familyCode = req.familyCode;

    if (!weekStart) return res.status(400).json({ error: 'week_start is required' });

    const { rows: childStats } = await pool.query(`
      SELECT
        c.id, c.name, c.avatar_url, c.weekly_points, c.weekly_target, c.total_points,
        COALESCE(SUM(CASE WHEN pe.points > 0 THEN pe.points ELSE 0 END), 0)::int as positive_points,
        COALESCE(SUM(CASE WHEN pe.points < 0 THEN ABS(pe.points) ELSE 0 END), 0)::int as negative_points,
        COUNT(pe.id)::int as total_events
      FROM children c
      LEFT JOIN point_events pe ON pe.child_id = c.id
        AND pe.created_date >= $1
        AND pe.family_code = $2
      WHERE c.family_code = $2
      GROUP BY c.id
    `, [weekStart, familyCode]);

    const { rows: topCategories } = await pool.query(`
      SELECT category, SUM(points)::int as total_points, COUNT(*)::int as count
      FROM point_events
      WHERE family_code = $1 AND created_date >= $2 AND points > 0
      GROUP BY category
      ORDER BY total_points DESC
      LIMIT 5
    `, [familyCode, weekStart]);

    const { rows: categoryBreakdowns } = await pool.query(`
      SELECT child_id, category, COUNT(*)::int as count, SUM(points)::int as points
      FROM point_events
      WHERE family_code = $1 AND created_date >= $2
      GROUP BY child_id, category
      ORDER BY count DESC
    `, [familyCode, weekStart]);

    const { rows: weekEvents } = await pool.query(`
      SELECT id, child_id, points, category, note, created_date
      FROM point_events
      WHERE family_code = $1 AND created_date >= $2
      ORDER BY created_date DESC
    `, [familyCode, weekStart]);

    res.json({ childStats, topCategories, categoryBreakdowns, weekEvents });
  } catch (err) {
    return serverError(res, 'Summary error:', err);
  }
});

// ─── Badge evaluation (FEAT-010) ──────────────────────────────────────────────

// Check and award badges for a child
router.post('/api/children/:id/check-badges', authMiddleware, async (req, res) => {
  try {
    const childId = req.params.id;

    const { rows: childRows } = await pool.query(
      'SELECT * FROM children WHERE id = $1 AND family_code = $2',
      [childId, req.familyCode]
    );
    if (childRows.length === 0) return res.status(404).json({ error: 'Child not found' });

    const child = childRows[0];

    // Get redemption count for this child
    const { rows: redemptionCount } = await pool.query(
      "SELECT COUNT(*)::int as count FROM redemptions WHERE child_id = $1 AND family_code = $2 AND status = 'Completed'",
      [childId, req.familyCode]
    );
    const stats = { redemptions: redemptionCount[0]?.count || 0 };

    // Badge definitions evaluated server-side (mirrors client-side BADGE_DEFINITIONS)
    const BADGES = [
      { id: 'first_points', check: () => child.total_points >= 1 },
      { id: 'fifty_club', check: () => child.total_points >= 50 },
      { id: 'century', check: () => child.total_points >= 100 },
      { id: 'star_250', check: () => child.total_points >= 250 },
      { id: 'star_500', check: () => child.total_points >= 500 },
      { id: 'legend', check: () => child.total_points >= 1000 },
      { id: 'goal_getter', check: () => child.weekly_points >= child.weekly_target },
      { id: 'first_reward', check: () => stats.redemptions >= 1 },
      { id: 'reward_fan', check: () => stats.redemptions >= 5 },
      { id: 'reward_master', check: () => stats.redemptions >= 10 },
    ];

    const earned = child.badges_earned || [];
    const newBadges = [];

    for (const badge of BADGES) {
      if (!earned.includes(badge.id) && badge.check()) {
        newBadges.push(badge.id);
      }
    }

    if (newBadges.length > 0) {
      const allBadges = [...earned, ...newBadges];
      await pool.query(
        'UPDATE children SET badges_earned = $1 WHERE id = $2 AND family_code = $3',
        [allBadges, childId, req.familyCode]
      );
      broadcastFn(req.familyCode, { type: 'points_updated', child_id: childId });
      return res.json({ new_badges: newBadges, all_badges: allBadges });
    }

    res.json({ new_badges: [], all_badges: earned });
  } catch (err) {
    return serverError(res, 'Check badges error:', err);
  }
});

// ─── Behavior Categories CRUD (IMPL-5) ────────────────────────────────────────

// List all categories for family (sorted by sort_order)
router.get('/api/behavior-categories', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM behavior_categories WHERE family_code = $1 ORDER BY sort_order ASC, created_date ASC',
      [req.familyCode]
    );
    res.json(rows);
  } catch (err) {
    return serverError(res, 'List categories error:', err);
  }
});

// Create new category
router.post('/api/behavior-categories', authMiddleware, async (req, res) => {
  try {
    const { name, icon, points, is_quick_action, assigned_children } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(422).json({ error: 'Category name is required' });
    }
    const trimmedName = name.trim().slice(0, 100);

    // Get max sort_order
    const { rows: maxOrder } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM behavior_categories WHERE family_code = $1',
      [req.familyCode]
    );

    const { rows } = await pool.query(
      `INSERT INTO behavior_categories (family_code, name, icon, sort_order, is_default, points, is_quick_action, assigned_children)
       VALUES ($1, $2, $3, $4, false, $5, $6, $7) RETURNING *`,
      [req.familyCode, trimmedName, icon || '⭐', maxOrder[0].next_order,
       categoryPoints(points), Boolean(is_quick_action),
       Array.isArray(assigned_children) ? assigned_children : []]
    );
    broadcastFn(req.familyCode, { type: 'behavior_categories_updated' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(422).json({ error: 'A category with this name already exists' });
    }
    return serverError(res, 'Create category error:', err);
  }
});

// Update category
router.put('/api/behavior-categories/:id', authMiddleware, async (req, res) => {
  try {
    const { name, icon, points, is_quick_action, assigned_children } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      const trimmedName = String(name).trim().slice(0, 100);
      if (!trimmedName) return res.status(422).json({ error: 'Category name cannot be empty' });
      updates.push(`name = $${idx++}`);
      values.push(trimmedName);
    }
    if (icon !== undefined) {
      updates.push(`icon = $${idx++}`);
      values.push(icon);
    }
    if (points !== undefined) {
      updates.push(`points = $${idx++}`);
      values.push(categoryPoints(points));
    }
    if (is_quick_action !== undefined) {
      updates.push(`is_quick_action = $${idx++}`);
      values.push(Boolean(is_quick_action));
    }
    if (assigned_children !== undefined) {
      updates.push(`assigned_children = $${idx++}`);
      values.push(Array.isArray(assigned_children) ? assigned_children : []);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_date = NOW()`);
    values.push(req.params.id, req.familyCode);

    const { rows } = await pool.query(
      `UPDATE behavior_categories SET ${updates.join(', ')} WHERE id = $${idx++} AND family_code = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    broadcastFn(req.familyCode, { type: 'behavior_categories_updated' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(422).json({ error: 'A category with this name already exists' });
    }
    return serverError(res, 'Update category error:', err);
  }
});

// Delete category (only non-default)
router.delete('/api/behavior-categories/:id', authMiddleware, async (req, res) => {
  try {
    // Check if category exists at all, then verify ownership
    const { rows: allRows } = await pool.query(
      'SELECT is_default, name, family_code FROM behavior_categories WHERE id = $1',
      [req.params.id]
    );
    if (allRows.length === 0) return res.status(404).json({ error: 'Category not found' });
    if (allRows[0].family_code !== req.familyCode) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const catRows = allRows;
    if (catRows[0].is_default) {
      return res.status(400).json({ error: 'Default categories cannot be deleted' });
    }

    // Check if category has associated point events
    const { rows: eventCount } = await pool.query(
      'SELECT COUNT(*)::int as count FROM point_events WHERE family_code = $1 AND category = $2',
      [req.familyCode, catRows[0].name]
    );
    if (eventCount[0].count > 0) {
      return res.status(400).json({
        error: `This category has ${eventCount[0].count} associated events. Reassign them first.`,
        has_events: true,
        event_count: eventCount[0].count,
      });
    }

    await pool.query(
      'DELETE FROM behavior_categories WHERE id = $1 AND family_code = $2',
      [req.params.id, req.familyCode]
    );
    broadcastFn(req.familyCode, { type: 'behavior_categories_updated' });
    res.json({ success: true });
  } catch (err) {
    return serverError(res, 'Delete category error:', err);
  }
});

// Batch reorder categories
router.post('/api/behavior-categories/reorder', authMiddleware, async (req, res) => {
  try {
    const { order } = req.body; // Array of { id, sort_order }
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of order) {
        await client.query(
          'UPDATE behavior_categories SET sort_order = $1 WHERE id = $2 AND family_code = $3',
          [item.sort_order, item.id, req.familyCode]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const { rows } = await pool.query(
      'SELECT * FROM behavior_categories WHERE family_code = $1 ORDER BY sort_order ASC',
      [req.familyCode]
    );
    broadcastFn(req.familyCode, { type: 'behavior_categories_updated' });
    res.json(rows);
  } catch (err) {
    return serverError(res, 'Reorder categories error:', err);
  }
});

// ─── Motivation Metrics (IMPL-4) ──────────────────────────────────────────────

// Get motivation metrics for a child (replaces points_spent in child-facing views)
router.get('/api/children/:id/motivation', authMiddleware, async (req, res) => {
  try {
    const childId = req.params.id;

    // Verify child belongs to this family
    const { rows: childRows } = await pool.query(
      'SELECT id, total_points, weekly_points, weekly_target FROM children WHERE id = $1 AND family_code = $2',
      [childId, req.familyCode]
    );
    if (childRows.length === 0) return res.status(404).json({ error: 'Child not found' });

    // Rewards earned count (scoped to family)
    const { rows: redemptionCount } = await pool.query(
      "SELECT COUNT(*)::int as count FROM redemptions WHERE child_id = $1 AND family_code = $2 AND status IN ('Completed', 'Approved')",
      [childId, req.familyCode]
    );

    // Best streak: consecutive days with at least one positive point event (scoped to family)
    const { rows: eventDays } = await pool.query(
      `SELECT DISTINCT DATE(created_date) as day
       FROM point_events
       WHERE child_id = $1 AND family_code = $2 AND points > 0
       ORDER BY day DESC`,
      [childId, req.familyCode]
    );

    let bestStreak = 0;
    let currentRun = 0;
    for (let i = 0; i < eventDays.length; i++) {
      if (i === 0) {
        currentRun = 1;
      } else {
        const prev = new Date(eventDays[i - 1].day);
        const curr = new Date(eventDays[i].day);
        const diffDays = (prev - curr) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          currentRun++;
        } else {
          currentRun = 1;
        }
      }
      bestStreak = Math.max(bestStreak, currentRun);
    }

    // Next unlock ETA: nearest reward not yet affordable
    const { rows: rewards } = await pool.query(
      `SELECT title, cost_points FROM rewards
       WHERE family_code = $1 AND visible_to_child = true
         AND cost_points > $2
       ORDER BY cost_points ASC LIMIT 1`,
      [req.familyCode, childRows[0].total_points]
    );

    // Average daily earning rate over last 7 days (scoped to family)
    const { rows: avgRate } = await pool.query(
      `SELECT COALESCE(SUM(points), 0)::int as total
       FROM point_events
       WHERE child_id = $1 AND family_code = $2 AND points > 0
         AND created_date >= NOW() - INTERVAL '7 days'`,
      [childId, req.familyCode]
    );

    let nextUnlock = null;
    if (rewards.length > 0) {
      const pointsRemaining = rewards[0].cost_points - childRows[0].total_points;
      const dailyRate = avgRate[0].total / 7;
      nextUnlock = {
        reward_name: rewards[0].title,
        points_remaining: pointsRemaining,
        eta_days: dailyRate > 0 ? Math.ceil(pointsRemaining / dailyRate) : null,
      };
    }

    res.json({
      rewards_earned_count: redemptionCount[0]?.count || 0,
      best_streak: bestStreak,
      next_unlock: nextUnlock,
    });
  } catch (err) {
    return serverError(res, 'Motivation metrics error:', err);
  }
});

// ─── Quick Actions CRUD ─────────────────────────────────────────────────────

// List quick actions for family
router.get('/api/quick-actions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM quick_actions WHERE family_code = $1 ORDER BY display_order ASC, created_date ASC',
      [req.familyCode]
    );
    res.json(rows);
  } catch (err) {
    return serverError(res, 'List quick actions error:', err);
  }
});

// Create quick action
router.post('/api/quick-actions', authMiddleware, async (req, res) => {
  try {
    const { label, points, icon, display_order } = req.body;
    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'Label is required' });
    }
    if (typeof points !== 'number' || points < 1) {
      return res.status(400).json({ error: 'Points must be at least 1' });
    }

    const { rows } = await pool.query(
      `INSERT INTO quick_actions (family_code, label, points, icon, display_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.familyCode, sanitizeString(label, MAX_NAME_LENGTH), points, icon || '⭐', display_order || 0]
    );
    broadcastFn(req.familyCode, { type: 'quick_actions_updated' });
    res.json(rows[0]);
  } catch (err) {
    return serverError(res, 'Create quick action error:', err);
  }
});

// Update quick action
router.put('/api/quick-actions/:id', authMiddleware, async (req, res) => {
  try {
    const { label, points, icon, display_order } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    if (label !== undefined) { updates.push(`label = $${idx++}`); values.push(sanitizeString(label, MAX_NAME_LENGTH)); }
    if (points !== undefined) { updates.push(`points = $${idx++}`); values.push(points); }
    if (icon !== undefined) { updates.push(`icon = $${idx++}`); values.push(icon); }
    if (display_order !== undefined) { updates.push(`display_order = $${idx++}`); values.push(display_order); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id, req.familyCode);
    const { rows } = await pool.query(
      `UPDATE quick_actions SET ${updates.join(', ')} WHERE id = $${idx++} AND family_code = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Quick action not found' });
    broadcastFn(req.familyCode, { type: 'quick_actions_updated' });
    res.json(rows[0]);
  } catch (err) {
    return serverError(res, 'Update quick action error:', err);
  }
});

// Delete quick action
router.delete('/api/quick-actions/:id', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM quick_actions WHERE id = $1 AND family_code = $2',
      [req.params.id, req.familyCode]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Quick action not found' });
    broadcastFn(req.familyCode, { type: 'quick_actions_updated' });
    res.json({ success: true });
  } catch (err) {
    return serverError(res, 'Delete quick action error:', err);
  }
});

// ─── Unified Activity Feed ──────────────────────────────────────────────────

// Merges point_events and redemptions into a single feed
router.get('/api/activity-feed', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const filter = req.query.filter || 'all'; // all, earned, spent

    let query;
    if (filter === 'earned') {
      query = `
        SELECT id, child_id, child_name, points, category as label, note, 'earn' as type, created_date
        FROM point_events
        WHERE family_code = $1 AND points > 0
        ORDER BY created_date DESC
        LIMIT $2 OFFSET $3
      `;
    } else if (filter === 'spent') {
      query = `
        (SELECT id, child_id, child_name, -reward_cost as points, reward_title as label, NULL as note, 'spend' as type, created_date
         FROM redemptions
         WHERE family_code = $1 AND status = 'Completed')
        UNION ALL
        (SELECT id, child_id, child_name, points, category as label, note, 'adjust' as type, created_date
         FROM point_events
         WHERE family_code = $1 AND points < 0)
        ORDER BY created_date DESC
        LIMIT $2 OFFSET $3
      `;
    } else {
      query = `
        (SELECT id, child_id, child_name, points, category as label, note,
          CASE WHEN points > 0 THEN 'earn' ELSE 'adjust' END as type, created_date
         FROM point_events
         WHERE family_code = $1)
        UNION ALL
        (SELECT id, child_id, child_name, -reward_cost as points, reward_title as label, NULL as note, 'spend' as type, created_date
         FROM redemptions
         WHERE family_code = $1 AND status = 'Completed')
        ORDER BY created_date DESC
        LIMIT $2 OFFSET $3
      `;
    }

    const { rows } = await pool.query(query, [req.familyCode, limit, offset]);
    res.json(rows);
  } catch (err) {
    return serverError(res, 'Activity feed error:', err);
  }
});

// ─── Family Goals endpoints (FEAT-008) ────────────────────────────────────────

// Contribute points to family goal
router.post('/api/family-goals/:id/contribute', authMiddleware, async (req, res) => {
  try {
    const { points } = req.body;
    if (typeof points !== 'number' || points <= 0) {
      return res.status(400).json({ error: 'points must be a positive number' });
    }

    const { rows } = await pool.query(
      `UPDATE family_goals
       SET current_points = LEAST(current_points + $1, target_points)
       WHERE id = $2 AND family_code = $3 AND status = 'active'
       RETURNING *`,
      [points, req.params.id, req.familyCode]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Goal not found or already completed' });

    const goal = rows[0];
    if (goal.current_points >= goal.target_points) {
      await pool.query(
        "UPDATE family_goals SET status = 'completed' WHERE id = $1 AND family_code = $2",
        [goal.id, req.familyCode]
      );
      goal.status = 'completed';
    }

    res.json(goal);
  } catch (err) {
    return serverError(res, 'Contribute to goal error:', err);
  }
});

// ─── Entity CRUD routes ─────────────────────────────────────────────────────

// LIST  – GET /api/:entity?sort=&limit=&offset=
router.get('/api/:entity', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const sort = buildSort(req.query.sort);
    const limit = req.query.limit ? `LIMIT ${parseInt(req.query.limit)}` : '';
    const offset = req.query.offset ? `OFFSET ${parseInt(req.query.offset)}` : '';

    const values = [req.familyCode];
    const where = 'WHERE family_code = $1';

    const { rows } = await pool.query(
      `SELECT * FROM ${table} ${where} ORDER BY ${sort} ${limit} ${offset}`,
      values
    );
    res.json(rows);
  } catch (err) {
    return serverError(res, `List ${req.params.entity} error:`, err);
  }
});

// FILTER – POST /api/:entity/filter
router.post('/api/:entity/filter', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const { filter, sort } = req.body;
    // Silently drop any key that is not a real column: keeps unexpected fields
    // out of the query and guarantees only whitelisted identifiers are ever
    // interpolated into SQL below.
    const safeFilter = pickAllowedColumns(table, filter || {});
    // Tenant scope is enforced server-side, never from the client payload — a
    // client-supplied family_code is ignored so an empty/forged filter can't
    // read across families.
    delete safeFilter.family_code;

    const conditions = ['family_code = $1'];
    const values = [req.familyCode];
    let idx = 2;

    for (const [key, value] of Object.entries(safeFilter)) {
      conditions.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const orderBy = buildSort(sort);

    const { rows } = await pool.query(
      `SELECT * FROM ${table} ${where} ORDER BY ${orderBy}`,
      values
    );
    res.json(rows);
  } catch (err) {
    return serverError(res, `Filter ${req.params.entity} error:`, err);
  }
});

// CREATE – POST /api/:entity
router.post('/api/:entity', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });
  if (HISTORY_TABLES.has(table)) return res.status(405).json({ error: 'Not allowed' });

  try {
    if (table === 'children') {
      const data = validateCreatePayload(table, pickAllowedColumns(table, req.body), { isCreate: true });
      const child = await createChild(data, req.familyCode);
      broadcastFn(req.familyCode, { type: 'children_created', id: child.id });
      return res.json(child);
    }
    // Drop unexpected keys silently (mass-assignment protection), then enforce
    // required fields so a missing NOT NULL column is a clean 400, not a DB 500.
    let data = pickAllowedColumns(table, req.body);
    data = validateCreatePayload(table, data, { isCreate: true });
    // Tenant scope is authoritative from the JWT — never trust a client-supplied
    // family_code (it comes from user-editable localStorage). This prevents
    // cross-tenant writes and orphaned (NULL family_code) rows.
    data.family_code = req.familyCode;
    // A row that points at a child or reward must point at one of the caller's.
    if (!(await referencesAreOwned(pool, data, req.familyCode))) {
      return res.status(404).json({ error: 'Not found' });
    }
    const keys = Object.keys(data);
    // Fallback: nothing valid to insert (only reachable for a table with no
    // required columns). Reject cleanly instead of building empty SQL.
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const { rows } = await pool.query(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    broadcastFn(req.familyCode, { type: `${req.params.entity}_created`, id: rows[0].id });
    res.json(rows[0]);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    return serverError(res, `Create ${req.params.entity} error:`, err);
  }
});

// ─── Family-scoped writes ──────────────────────────────────────────────────

// History tables are written only by the award, redeem and stack endpoints,
// which change the balance in the same transaction. The generic routes may
// read them but never create, edit or delete rows.
const HISTORY_TABLES = new Set(['point_events', 'redemptions']);

// Balance fields on a child change only through award and spending.
const CHILD_BALANCE_FIELDS = ['total_points', 'weekly_points', 'points_spent', 'reward_stack', 'badges_earned', 'last_reset_date'];

function stripChildBalance(data) {
  const clean = { ...data };
  for (const f of CHILD_BALANCE_FIELDS) delete clean[f];
  return clean;
}

// Creates a child and, if it starts with points, the history row for them,
// in one transaction so history adds up from the first day.
async function createChild(data, familyCode) {
  let starting = data.total_points ?? 0;
  if (typeof starting === 'string' && starting.trim() !== '') starting = Number(starting);
  if (!isWholeNumber(starting) || starting < 0 || starting > MAX_AWARD) {
    const e = new Error(`Starting points must be a whole number from 0 to ${MAX_AWARD}.`);
    e.status = 400;
    throw e;
  }
  // last_reset_date = today (UTC, as weekly-reset uses) so a child added on a
  // Monday does not have its starting points wiped by that day's reset.
  const row = {
    ...stripChildBalance(data),
    total_points: starting,
    weekly_points: starting,
    last_reset_date: new Date().toISOString().split('T')[0],
    family_code: familyCode,
  };
  const keys = Object.keys(row);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO children (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      Object.values(row)
    );
    if (starting > 0) {
      await client.query(
        `INSERT INTO point_events (child_id, points, category, child_name, family_code)
         VALUES ($1, $2, 'Starting points', $3, $4)`,
        [rows[0].id, starting, rows[0].name, familyCode]
      );
    }
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const REFERENCES = { child_id: 'children', reward_id: 'rewards' };

export async function referencesAreOwned(db, data, familyCode) {
  for (const [col, table] of Object.entries(REFERENCES)) {
    if (data[col] === undefined || data[col] === null) continue;
    if (!isUuid(String(data[col]))) return false;
    const { rowCount } = await db.query(
      `SELECT 1 FROM ${table} WHERE id = $1 AND family_code = $2`,
      [data[col], familyCode]
    );
    if (rowCount === 0) return false;
  }
  return true;
}
// Every generic update and delete goes through these two helpers. Each one
// puts the caller's family_code in the WHERE clause of every statement it
// runs, including cascades, so no handler can forget the scope.

export async function scopedUpdate(db, table, id, familyCode, data) {
  const clean = table === 'children' ? stripChildBalance(data) : { ...data };
  delete clean.family_code; // never client-settable
  delete clean.id;
  const keys = Object.keys(clean);
  if (keys.length === 0) return { status: 400 };
  if (!isUuid(id)) return { status: 404 };
  if (!(await referencesAreOwned(db, clean, familyCode))) return { status: 404 };
  const values = Object.values(clean);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(id, familyCode);
  const { rows } = await db.query(
    `UPDATE ${table} SET ${setClause} WHERE id = $${values.length - 1} AND family_code = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return { status: 404 };

  // ENH-006: cascade child name updates to the same family's history rows
  if (table === 'children' && clean.name) {
    await db.query('UPDATE point_events SET child_name = $1 WHERE child_id = $2 AND family_code = $3', [clean.name, id, familyCode]);
    await db.query('UPDATE redemptions SET child_name = $1 WHERE child_id = $2 AND family_code = $3', [clean.name, id, familyCode]);
  }
  return { status: 200, row: rows[0] };
}

export async function scopedDelete(table, id, familyCode) {
  if (!isUuid(id)) return { status: 404 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Ownership first. Nothing else runs unless the row is the caller's.
    const owned = await client.query(
      `SELECT id FROM ${table} WHERE id = $1 AND family_code = $2 FOR UPDATE`,
      [id, familyCode]
    );
    if (owned.rowCount === 0) {
      await client.query('ROLLBACK');
      return { status: 404 };
    }
    if (table === 'children') {
      // Rows from before family_code was stamped have it NULL; they belong to
      // this child, whose ownership was just checked.
      await client.query('DELETE FROM point_events WHERE child_id = $1 AND (family_code = $2 OR family_code IS NULL)', [id, familyCode]);
      await client.query('DELETE FROM redemptions WHERE child_id = $1 AND (family_code = $2 OR family_code IS NULL)', [id, familyCode]);
    } else if (table === 'rewards') {
      await client.query(
        "UPDATE redemptions SET status = 'Denied' WHERE reward_id = $1 AND status = 'Pending' AND (family_code = $2 OR family_code IS NULL)",
        [id, familyCode]
      );
    }
    await client.query(`DELETE FROM ${table} WHERE id = $1 AND family_code = $2`, [id, familyCode]);
    await client.query('COMMIT');
    return { status: 200 };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// UPDATE – PUT /api/:entity/:id
router.put('/api/:entity/:id', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });
  if (HISTORY_TABLES.has(table)) return res.status(405).json({ error: 'Not allowed' });

  try {
    let data = pickAllowedColumns(table, req.body);
    data = validateCreatePayload(table, data);
    const result = await scopedUpdate(pool, table, req.params.id, req.familyCode, data);
    if (result.status === 400) return res.status(400).json({ error: 'No valid fields provided' });
    if (result.status === 404) return res.status(404).json({ error: 'Not found' });

    broadcastFn(req.familyCode, { type: `${req.params.entity}_updated`, id: req.params.id });
    res.json(result.row);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    return serverError(res, `Update ${req.params.entity} error`, err);
  }
});

// DELETE – DELETE /api/:entity/:id
router.delete('/api/:entity/:id', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });
  if (HISTORY_TABLES.has(table)) return res.status(405).json({ error: 'Not allowed' });

  try {
    const result = await scopedDelete(table, req.params.id, req.familyCode);
    if (result.status === 404) return res.status(404).json({ error: 'Not found' });
    broadcastFn(req.familyCode, { type: `${req.params.entity}_deleted`, id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    return serverError(res, `Delete ${req.params.entity} error`, err);
  }
});

export default router;
