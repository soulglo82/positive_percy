import { describe, it, expect } from 'vitest';
import { sortRewardsForParent } from './rewardOrder';

describe('sortRewardsForParent', () => {
  it('shown first, then hidden; cheapest first in each; input untouched', () => {
    const input = [
      { id: 'h1', visible_to_child: false, cost_points: 5 },
      { id: 's2', visible_to_child: true, cost_points: 50 },
      { id: 's1', visible_to_child: true, cost_points: 20 },
      { id: 'h2', visible_to_child: false, cost_points: 1 },
      { id: 'u', cost_points: 30 }, // no flag: shown (the server default)
    ];
    expect(sortRewardsForParent(input).map((r) => r.id)).toEqual(['s1', 'u', 's2', 'h2', 'h1']);
    expect(input[0].id).toBe('h1');
  });
});
