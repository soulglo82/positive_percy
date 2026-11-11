import { describe, it, expect } from 'vitest';
import { REWARD_TEMPLATES } from './reward-templates';

describe('starter rewards', () => {
  it('offers extra screen time first without creating it automatically', () => {
    expect(REWARD_TEMPLATES[0]).toMatchObject({
      title: 'Extra Screen Time',
      category: 'starter',
      cost_points: 30,
      emoji: '🎮',
    });
    expect(REWARD_TEMPLATES.filter(t => t.category === 'starter')).toHaveLength(1);
  });
});
