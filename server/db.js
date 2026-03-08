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
    ];
    for (const sql of migrations) {
      await client.query(sql).catch(() => {});
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
