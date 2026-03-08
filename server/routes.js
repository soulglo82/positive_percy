import { Router } from 'express';
import jwt from 'jsonwebtoken';
import pool from './db.js';

const router = Router();

let broadcastFn = () => {};
export function setBroadcast(fn) { broadcastFn = fn; }

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
  return res.status(401).json({ error: 'Authentication required' });
}

// ─── Input validation helpers ───────────────────────────────────────────────

const MAX_NAME_LENGTH = 100;
const MAX_NOTE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 1000;

function sanitizeString(str, maxLength) {
  if (typeof str !== 'string') return str;
  return str.trim().slice(0, maxLength);
}

function validateCreatePayload(table, data) {
  if (table === 'children') {
    if (data.name !== undefined) {
      data.name = sanitizeString(data.name, MAX_NAME_LENGTH);
      if (!data.name) throw Object.assign(new Error('Child name is required'), { status: 400 });
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

const COLUMN_WHITELIST = {
  children: new Set(['name', 'avatar_url', 'total_points', 'weekly_points',
    'weekly_target', 'last_reset_date', 'parent_email', 'family_code', 'date_of_birth', 'points_spent']),
  point_events: new Set(['child_id', 'points', 'category', 'note',
    'child_name', 'family_code']),
  redemptions: new Set(['child_id', 'child_name', 'reward_id', 'reward_title',
    'reward_cost', 'status', 'family_code']),
  rewards: new Set(['title', 'description', 'cost_points', 'image_url',
    'emoji', 'visible_to_child', 'assigned_child_ids', 'family_code']),
  family_goals: new Set(['title', 'description', 'emoji', 'target_points',
    'current_points', 'status', 'family_code']),
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
  family_goals: 'family_goals',
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

// Check and update parent streak (FEAT-006)
router.post('/api/family/check-streak', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const { rows } = await pool.query(
      'SELECT current_streak, last_active_date, longest_streak FROM families WHERE family_code = $1',
      [req.familyCode]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Family not found' });

    const family = rows[0];
    let newStreak = family.current_streak || 0;

    if (family.last_active_date === today) {
      return res.json({ streak: newStreak, longest: family.longest_streak || 0, updated: false });
    } else if (family.last_active_date === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    const longestStreak = Math.max(newStreak, family.longest_streak || 0);

    await pool.query(
      'UPDATE families SET current_streak = $1, last_active_date = $2, longest_streak = $3 WHERE family_code = $4',
      [newStreak, today, longestStreak, req.familyCode]
    );

    res.json({ streak: newStreak, longest: longestStreak, updated: true });
  } catch (err) {
    console.error('Check streak error:', err);
    res.status(500).json({ error: err.message });
  }
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
    broadcastFn(req.familyCode, { type: 'points_updated', child_id: req.params.id });
    res.json(rows[0]);
  } catch (err) {
    console.error('Adjust points error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Track points spent on rewards (atomic increment)
router.post('/api/children/:id/track-spending', authMiddleware, async (req, res) => {
  try {
    const { points } = req.body;
    if (typeof points !== 'number' || points <= 0) {
      return res.status(400).json({ error: 'points must be a positive number' });
    }

    const { rows } = await pool.query(
      `UPDATE children
       SET points_spent = COALESCE(points_spent, 0) + $1
       WHERE id = $2 AND family_code = $3
       RETURNING *`,
      [points, req.params.id, req.familyCode]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Child not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Track spending error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Atomic reward redemption (prevents double-spend via DB transaction)
router.post('/api/children/:id/redeem', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { reward_id, reward_title, reward_cost, child_name } = req.body;
    const childId = req.params.id;

    if (!reward_id || !reward_title || typeof reward_cost !== 'number' || reward_cost < 1) {
      return res.status(400).json({ error: 'Invalid redemption data' });
    }

    await client.query('BEGIN');

    // Lock the child row and check balance
    const { rows: childRows } = await client.query(
      'SELECT total_points, weekly_points FROM children WHERE id = $1 AND family_code = $2 FOR UPDATE',
      [childId, req.familyCode]
    );

    if (childRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Child not found' });
    }

    if (childRows[0].total_points < reward_cost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough points' });
    }

    // Deduct points
    await client.query(
      `UPDATE children
       SET total_points = GREATEST(0, total_points - $1),
           weekly_points = GREATEST(0, weekly_points - $1),
           points_spent = COALESCE(points_spent, 0) + $1
       WHERE id = $2`,
      [reward_cost, childId]
    );

    // Create redemption record
    const { rows: redemptionRows } = await client.query(
      `INSERT INTO redemptions (child_id, child_name, reward_id, reward_title, reward_cost, status, family_code)
       VALUES ($1, $2, $3, $4, $5, 'Completed', $6) RETURNING *`,
      [childId, child_name || '', reward_id, reward_title, reward_cost, req.familyCode]
    );

    await client.query('COMMIT');

    // Fetch updated child
    const { rows: updatedChild } = await pool.query(
      'SELECT * FROM children WHERE id = $1',
      [childId]
    );

    broadcastFn(req.familyCode, { type: 'points_updated', child_id: childId });
    res.json({ child: updatedChild[0], redemption: redemptionRows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Redeem error:', err);
    res.status(500).json({ error: err.message });
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
    console.error('Summary error:', err);
    res.status(500).json({ error: err.message });
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
      "SELECT COUNT(*)::int as count FROM redemptions WHERE child_id = $1 AND status = 'Completed'",
      [childId]
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
        'UPDATE children SET badges_earned = $1 WHERE id = $2',
        [allBadges, childId]
      );
      return res.json({ new_badges: newBadges, all_badges: allBadges });
    }

    res.json({ new_badges: [], all_badges: earned });
  } catch (err) {
    console.error('Check badges error:', err);
    res.status(500).json({ error: err.message });
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
    console.error('List quick actions error:', err);
    res.status(500).json({ error: err.message });
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
    console.error('Create quick action error:', err);
    res.status(500).json({ error: err.message });
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
    console.error('Update quick action error:', err);
    res.status(500).json({ error: err.message });
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
    console.error('Delete quick action error:', err);
    res.status(500).json({ error: err.message });
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
    console.error('Activity feed error:', err);
    res.status(500).json({ error: err.message });
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
        "UPDATE family_goals SET status = 'completed' WHERE id = $1",
        [goal.id]
      );
      goal.status = 'completed';
    }

    res.json(goal);
  } catch (err) {
    console.error('Contribute to goal error:', err);
    res.status(500).json({ error: err.message });
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
    let data = req.body;
    const keys = Object.keys(data);
    validateColumns(table, keys);
    data = validateCreatePayload(table, data);
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
    console.error(`Create ${req.params.entity} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE – PUT /api/:entity/:id
router.put('/api/:entity/:id', authMiddleware, async (req, res) => {
  const table = TABLE_MAP[req.params.entity];
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    let data = req.body;
    const keys = Object.keys(data);
    validateColumns(table, keys);
    data = validateCreatePayload(table, data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    values.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    // ENH-006: Cascade child name updates to related tables
    if (table === 'children' && data.name) {
      await pool.query('UPDATE point_events SET child_name = $1 WHERE child_id = $2', [data.name, req.params.id]);
      await pool.query('UPDATE redemptions SET child_name = $1 WHERE child_id = $2', [data.name, req.params.id]);
    }

    broadcastFn(req.familyCode, { type: `${req.params.entity}_updated`, id: req.params.id });
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
    // Cascade deletes for children and rewards
    if (table === 'children') {
      await pool.query('DELETE FROM point_events WHERE child_id = $1', [req.params.id]);
      await pool.query('DELETE FROM redemptions WHERE child_id = $1', [req.params.id]);
    } else if (table === 'rewards') {
      await pool.query("UPDATE redemptions SET status = 'Denied' WHERE reward_id = $1 AND status = 'Pending'", [req.params.id]);
    }

    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    broadcastFn(req.familyCode, { type: `${req.params.entity}_deleted`, id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error(`Delete ${req.params.entity} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
