import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS children (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        avatar_url TEXT,
        total_points INTEGER DEFAULT 0,
        weekly_points INTEGER DEFAULT 0,
        weekly_target INTEGER DEFAULT 50,
        last_reset_date TEXT,
        parent_email TEXT NOT NULL,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS point_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        child_id UUID NOT NULL,
        points INTEGER NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        child_name TEXT,
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
        created_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        full_name TEXT,
        mum_name TEXT,
        mum_phone TEXT,
        dad_name TEXT,
        dad_phone TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Database tables initialized');
  } finally {
    client.release();
  }
}

export default pool;
