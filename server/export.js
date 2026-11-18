// Parent-requested family data export. Intentionally enumerates fields so an
// internal secret, token, request key or a newly added table column cannot be
// exported just because it happens to exist in the database.
import { uploadIdOf } from './uploads.js';

export const MAX_EXPORT_BYTES = 25 * 1024 * 1024;

export async function prepareFamilyExport(pool, familyCode, { includePhotos = true } = {}) {
  const client = await pool.connect();
  try {
    // A consistent, read-only view: a parent should not get a balance from
    // one moment and the matching history from another.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    const rows = async (sql) => (await client.query(sql, [familyCode])).rows;
    const families = await rows(`
      SELECT family_name, timezone, current_streak, longest_streak,
             last_active_date, created_date
      FROM families WHERE family_code = $1
    `);
    if (families.length !== 1) {
      await client.query('ROLLBACK');
      return null;
    }

    const children = await rows(`
      SELECT id, name, age, avatar_url, total_points, weekly_target,
             badges_earned, points_spent, reward_stack, colour_index, created_date
      FROM children WHERE family_code = $1 ORDER BY created_date, id
    `);
    const rewards = await rows(`
      SELECT id, title, description, cost_points, image_url, emoji,
             visible_to_child, assigned_child_ids, created_date
      FROM rewards WHERE family_code = $1 ORDER BY created_date, id
    `);
    const pointEvents = await rows(`
      SELECT id, child_id, points, category, note, child_name, kind,
             reverses_id, created_date
      FROM point_events
      WHERE child_id IN (SELECT id FROM children WHERE family_code = $1)
        AND (family_code = $1 OR family_code IS NULL)
      ORDER BY created_date, id
    `);
    const redemptions = await rows(`
      SELECT id, child_id, child_name, reward_id, reward_title,
             reward_cost, status, reversed_at, created_date
      FROM redemptions
      WHERE child_id IN (SELECT id FROM children WHERE family_code = $1)
        AND (family_code = $1 OR family_code IS NULL)
      ORDER BY created_date, id
    `);
    const behaviours = await rows(`
      SELECT id, name, icon, icon_key, sort_order, is_default, points,
             is_quick_action, assigned_children, created_date, updated_date
      FROM behavior_categories WHERE family_code = $1 ORDER BY sort_order, id
    `);
    const familyGoals = await rows(`
      SELECT id, title, description, emoji, target_points, current_points,
             status, created_date
      FROM family_goals WHERE family_code = $1 ORDER BY created_date, id
    `);
    const todaysGoals = await rows(`
      SELECT id, child_id, category_id, title, schedule_kind,
        to_char(scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
        weekdays, to_char(start_date, 'YYYY-MM-DD') AS start_date,
        archived_at, created_at, updated_at
      FROM today_goals WHERE family_code = $1 ORDER BY created_at, id
    `);
    const todayGoalCompletions = await rows(`
      SELECT id, goal_id, child_id,
        to_char(scheduled_for, 'YYYY-MM-DD') AS scheduled_for,
        point_event_id, awarded_points, category_name, created_at, undone_at
      FROM today_goal_completions
      WHERE family_code = $1
        AND child_id IN (SELECT id FROM children WHERE family_code = $1)
      ORDER BY created_at, id
    `);
    const legacyQuickActions = await rows(`
      SELECT id, label, points, icon, display_order, created_date
      FROM quick_actions WHERE family_code = $1 ORDER BY display_order, id
    `);
    const grownUps = await rows(`
      SELECT full_name, mum_name, mum_phone, dad_name, dad_phone, created_date
      FROM users WHERE family_code = $1 ORDER BY created_date, id
    `);

    // Only photos referenced by this family's children/rewards may be included.
    // Even if an older row references another family's photo, the export may
    // never contain that other family's photo bytes.
    const referenced = [...new Set([
      ...children.map((c) => uploadIdOf(c.avatar_url)),
      ...rewards.map((r) => uploadIdOf(r.image_url)),
    ].filter(Boolean))];
    let photos = [];
    if (includePhotos && referenced.length) {
      // Keep huge photo collections from exhausting application memory.
      // Actual JSON size is checked again before returning the response.
      const { rows: [size] } = await client.query(`
        SELECT COALESCE(SUM(octet_length(data)), 0)::bigint AS bytes
        FROM uploads WHERE family_code = $1 AND id = ANY($2::uuid[])
      `, [familyCode, referenced]);
      if (Number(size.bytes) > MAX_EXPORT_BYTES * 0.8) {
        const error = new Error('Export photos too large');
        error.code = 'EXPORT_TOO_LARGE';
        throw error;
      }
      const { rows: owned } = await client.query(`
        SELECT id, data, content_type, created_date
        FROM uploads WHERE family_code = $1 AND id = ANY($2::uuid[])
        ORDER BY created_date, id
      `, [familyCode, referenced]);
      photos = owned;
    }

    const result = {
      format: 'positive-percy-family-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      // Family code (the account credential), JWTs, internal request keys and
      // synthesized login email are deliberately excluded.
      family: families[0],
      grownUps,
      children,
      behaviours,
      rewards,
      pointEvents,
      redemptions,
      familyGoals,
      todaysGoals,
      todayGoalCompletions,
      legacyQuickActions,
      photos,
      photoInformation: {
        included: includePhotos,
        referencedCount: referenced.length,
        includedCount: photos.length,
        // External photo URLs and older unowned images remain in the
        // child/reward records but their image bytes are not bundled.
        unavailableCount: includePhotos ? referenced.length - photos.length : referenced.length,
      },
    };
    const body = JSON.stringify(result, null, 2);
    const byteLength = Buffer.byteLength(body, 'utf8');

    await client.query('COMMIT');
    return { body, byteLength };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
