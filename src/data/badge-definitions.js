export const BADGE_DEFINITIONS = [
  // Point milestones
  { id: 'first_points', emoji: '⭐', title: 'First Star', description: 'Earned your first points!', condition: (child) => child.total_points >= 1 },
  { id: 'fifty_club', emoji: '🌟', title: '50 Club', description: 'Earned 50 total points', condition: (child) => child.total_points >= 50 },
  { id: 'century', emoji: '💯', title: 'Century!', description: 'Reached 100 total points', condition: (child) => child.total_points >= 100 },
  { id: 'star_250', emoji: '🏅', title: 'Rising Star', description: 'Earned 250 total points', condition: (child) => child.total_points >= 250 },
  { id: 'star_500', emoji: '🏆', title: 'Superstar', description: 'Earned 500 total points', condition: (child) => child.total_points >= 500 },
  { id: 'legend', emoji: '👑', title: 'Legend', description: 'Earned 1000 total points', condition: (child) => child.total_points >= 1000 },

  // Weekly goal achievements
  { id: 'goal_getter', emoji: '🎯', title: 'Goal Getter', description: 'Hit a weekly target', condition: (child) => child.weekly_points >= child.weekly_target },

  // Redemption milestones
  { id: 'first_reward', emoji: '🎁', title: 'First Treat', description: 'Redeemed your first reward', condition: (_, stats) => (stats?.redemptions || 0) >= 1 },
  { id: 'reward_fan', emoji: '🎉', title: 'Reward Fan', description: 'Redeemed 5 rewards', condition: (_, stats) => (stats?.redemptions || 0) >= 5 },
  { id: 'reward_master', emoji: '🌈', title: 'Reward Master', description: 'Redeemed 10 rewards', condition: (_, stats) => (stats?.redemptions || 0) >= 10 },
];

export function evaluateBadges(child, stats = {}) {
  const earned = child.badges_earned || [];
  const newBadges = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (!earned.includes(badge.id) && badge.condition(child, stats)) {
      newBadges.push(badge.id);
    }
  }

  return newBadges;
}

export function getBadgeById(id) {
  return BADGE_DEFINITIONS.find(b => b.id === id);
}
