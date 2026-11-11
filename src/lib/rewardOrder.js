// Rewards page order (external review, 2026-11-11): rewards children can see
// first, hidden ones after; cheapest first within each group.
export function sortRewardsForParent(rewards = []) {
  const shown = (r) => (r.visible_to_child !== false ? 1 : 0);
  return [...rewards].sort((a, b) => (shown(b) - shown(a)) || ((a.cost_points ?? 0) - (b.cost_points ?? 0)));
}
