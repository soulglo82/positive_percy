/**
 * Single source of truth for all Percy product terminology.
 * All user-facing strings for points, rewards, streaks, and badges
 * MUST be imported from this file.
 */

export const PERCY = {
  // Core nouns
  POINTS: 'Percy Points',
  POINTS_COMPACT: 'Percy Points',
  REWARDS: 'Percy Rewards',
  STREAK: 'Percy Streak',
  BADGES: 'Percy Badges',

  // Product framing
  PRODUCT_STATEMENT: 'Build habits with Percy Points.',
  TAGLINE: 'Building bright futures, one point at a time',

  // Helper text
  HELPER_TEXT_QUICK_ACTIONS: 'Default behaviours are active. Edit or add your own below.',

  // Reward template categories
  REWARD_CAT_QUICK: 'Quick Wins (5–15 Percy Points)',
  REWARD_CAT_MEDIUM: 'Medium (20–50 Percy Points)',
  REWARD_CAT_BIG: 'Big Goals (60+ Percy Points)',
};

/**
 * Format a point value for display.
 * @param {number} value
 * @param {object} [options]
 * @param {boolean} [options.compact] - Use "Points" instead of "Percy Points"
 * @param {boolean} [options.showSign] - Prefix with + for positive values
 * @returns {string}
 */
export function formatPoints(value, { compact = false, showSign = false } = {}) {
  const sign = showSign && value > 0 ? '+' : '';
  const label = compact ? PERCY.POINTS_COMPACT : PERCY.POINTS;
  return `${sign}${value} ${label}`;
}

/**
 * Format a short point badge (e.g. "+5 Points" for quick-action buttons).
 * @param {number} value
 * @returns {string}
 */
export function formatPointsBadge(value) {
  return `+${value} ${PERCY.POINTS_COMPACT}`;
}
