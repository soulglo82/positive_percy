import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS families (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_code TEXT UNIQUE NOT NULL,
        family_name TEXT NOT NULL,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS children (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        avatar_url TEXT,
        total_points INTEGER DEFAULT 0,
        weekly_points INTEGER DEFAULT 0,
        weekly_target INTEGER DEFAULT 50,
        last_reset_date TEXT,
        parent_email TEXT,
        family_code TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS point_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        child_id UUID NOT NULL,
        points INTEGER NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        child_name TEXT,
        family_code TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS redemptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        child_id UUID NOT NULL,
        child_name TEXT NOT NULL,
        reward_id UUID NOT NULL,
        reward_title TEXT NOT NULL,
        reward_cost INTEGER NOT NULL,
        status TEXT DEFAULT 'Pending',
        family_code TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        cost_points INTEGER NOT NULL,
        image_url TEXT,
        emoji TEXT,
        visible_to_child BOOLEAN DEFAULT true,
        assigned_child_ids TEXT[] DEFAULT '{}',
        family_code TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data TEXT NOT NULL,
        content_type TEXT NOT NULL,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS family_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        emoji TEXT DEFAULT '🎯',
        target_points INTEGER NOT NULL,
        current_points INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        family_code TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        full_name TEXT,
        family_code TEXT,
        mum_name TEXT,
        mum_phone TEXT,
        dad_name TEXT,
        dad_phone TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quick_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_code TEXT NOT NULL,
        label TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 5,
        icon TEXT DEFAULT '⭐',
        display_order INTEGER DEFAULT 0,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS behavior_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_code TEXT NOT NULL,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50) DEFAULT '⭐',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_date TIMESTAMPTZ DEFAULT NOW(),
        updated_date TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (family_code, name)
      );

      CREATE INDEX IF NOT EXISTS idx_behavior_categories_family
        ON behavior_categories(family_code);
    `);

    // Add columns to existing tables if they don't exist (handles upgrades)
    const migrations = [
      // family_code on all entity tables
      "ALTER TABLE children ADD COLUMN IF NOT EXISTS family_code TEXT",
      "ALTER TABLE point_events ADD COLUMN IF NOT EXISTS family_code TEXT",
      "ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS family_code TEXT",
      "ALTER TABLE rewards ADD COLUMN IF NOT EXISTS family_code TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS family_code TEXT",
      // user profile columns (may be missing if users table was created earlier)
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mum_name TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS dad_name TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mum_phone TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS dad_phone TEXT",
      // Drop NOT NULL on parent_email - no longer used, replaced by family_code
      "ALTER TABLE children ALTER COLUMN parent_email DROP NOT NULL",
      // Age / date of birth field (FEAT-007)
      "ALTER TABLE children ADD COLUMN IF NOT EXISTS date_of_birth TEXT",
      // Streak tracking (FEAT-006)
      "ALTER TABLE families ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0",
      "ALTER TABLE families ADD COLUMN IF NOT EXISTS last_active_date TEXT",
      "ALTER TABLE families ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0",
      // Milestone badges (FEAT-010)
      "ALTER TABLE children ADD COLUMN IF NOT EXISTS badges_earned TEXT[] DEFAULT '{}'",
      // Track points spent on rewards
      "ALTER TABLE children ADD COLUMN IF NOT EXISTS points_spent INTEGER DEFAULT 0",
      // Reward stack: queued rewards awaiting parent confirmation
      "ALTER TABLE children ADD COLUMN IF NOT EXISTS reward_stack JSONB DEFAULT '[]'",
      // FIX-1: Merge quick actions into behavior categories
      "ALTER TABLE behavior_categories ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 5",
      "ALTER TABLE behavior_categories ADD COLUMN IF NOT EXISTS is_quick_action BOOLEAN DEFAULT false",
      "ALTER TABLE behavior_categories ADD COLUMN IF NOT EXISTS assigned_children TEXT[] DEFAULT '{}'",
    ];
    for (const sql of migrations) {
      await client.query(sql).catch(() => {});
    }

    // IMPL-5: Seed default behavior categories for existing families that don't have any
    await client.query(`
      INSERT INTO behavior_categories (family_code, name, icon, sort_order, is_default)
      SELECT f.family_code, d.name, d.icon, d.sort_order, true
      FROM families f
      CROSS JOIN (VALUES
        ('Kindness', '💛', 0),
        ('Helpfulness', '🤝', 1),
        ('Bravery', '🦁', 2),
        ('Resilience', '💪', 3),
        ('Caring', '🫶', 4),
        ('Chores', '🧹', 5),
        ('Homework', '📖', 6),
        ('Adventurous', '🌟', 7)
      ) AS d(name, icon, sort_order)
      WHERE NOT EXISTS (
        SELECT 1 FROM behavior_categories bc WHERE bc.family_code = f.family_code
      )
      ON CONFLICT (family_code, name) DO NOTHING
    `).catch(() => {});

    // Migrate existing families from old default categories to new ones
    // Delete old defaults that aren't in the new set, then insert new ones
    const OLD_DEFAULTS = ['Learning', 'Responsibility', 'Creativity', 'Physical Activity'];
    const NEW_CATEGORIES = [
      { name: 'Kindness', icon: '💛', sort_order: 0, points: 5, is_quick_action: true },
      { name: 'Helpfulness', icon: '🤝', sort_order: 1, points: 5, is_quick_action: true },
      { name: 'Bravery', icon: '🦁', sort_order: 2, points: 10, is_quick_action: true },
      { name: 'Resilience', icon: '💪', sort_order: 3, points: 10, is_quick_action: false },
      { name: 'Caring', icon: '🫶', sort_order: 4, points: 5, is_quick_action: true },
      { name: 'Chores', icon: '🧹', sort_order: 5, points: 5, is_quick_action: false },
      { name: 'Homework', icon: '📖', sort_order: 6, points: 5, is_quick_action: false },
      { name: 'Adventurous', icon: '🌟', sort_order: 7, points: 10, is_quick_action: false },
    ];

    // Remove old defaults that no longer exist
    await client.query(
      `DELETE FROM behavior_categories WHERE is_default = true AND name = ANY($1)`,
      [OLD_DEFAULTS]
    ).catch(() => {});

    // Insert new defaults for all families (skip if already exists)
    for (const cat of NEW_CATEGORIES) {
      await client.query(
        `INSERT INTO behavior_categories (family_code, name, icon, sort_order, is_default, points, is_quick_action)
         SELECT f.family_code, $1, $2, $3, true, $4, $5
         FROM families f
         ON CONFLICT (family_code, name) DO UPDATE
           SET icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order,
               points = EXCLUDED.points, is_quick_action = EXCLUDED.is_quick_action`,
        [cat.name, cat.icon, cat.sort_order, cat.points, cat.is_quick_action]
      ).catch(() => {});
    }

    // Backfill points_spent from existing redemptions for children that still show 0
    await client.query(`
      UPDATE children c
      SET points_spent = sub.total_spent
      FROM (
        SELECT child_id, COALESCE(SUM(reward_cost), 0) AS total_spent
        FROM redemptions
        WHERE status IN ('Completed', 'Approved')
        GROUP BY child_id
      ) sub
      WHERE c.id = sub.child_id
        AND COALESCE(c.points_spent, 0) = 0
        AND sub.total_spent > 0
    `).catch(() => {});

    console.log('Database tables initialized');
  } finally {
    client.release();
  }
}

export default pool;
