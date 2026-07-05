// Single source of truth for which columns each table accepts from client
// payloads. Used by the create/update/filter routes to strip any key that is
// not an intended column, so unexpected fields (e.g. isAdmin, family_id) are
// silently ignored rather than persisted — mass-assignment protection — and
// no column name is ever echoed back to the client.

export const COLUMN_WHITELIST = {
  children: new Set(['name', 'avatar_url', 'total_points', 'weekly_points',
    'weekly_target', 'last_reset_date', 'parent_email', 'family_code',
    'date_of_birth', 'age', 'points_spent', 'reward_stack']),
  point_events: new Set(['child_id', 'points', 'category', 'note',
    'child_name', 'family_code']),
  redemptions: new Set(['child_id', 'child_name', 'reward_id', 'reward_title',
    'reward_cost', 'status', 'family_code']),
  rewards: new Set(['title', 'description', 'cost_points', 'image_url',
    'emoji', 'visible_to_child', 'assigned_child_ids', 'family_code']),
  family_goals: new Set(['title', 'description', 'emoji', 'target_points',
    'current_points', 'status', 'family_code']),
};

// Return a shallow copy of `data` containing only the keys that are valid
// columns for `table`. Unknown keys are dropped silently. Tables not in the
// whitelist (none, currently) pass through unchanged.
export function pickAllowedColumns(table, data) {
  const allowed = COLUMN_WHITELIST[table];
  if (!allowed) return { ...data };
  const result = {};
  for (const key of Object.keys(data || {})) {
    if (allowed.has(key)) result[key] = data[key];
  }
  return result;
}
