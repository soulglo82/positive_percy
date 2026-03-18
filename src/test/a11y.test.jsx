import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';

import ChildCard from '../components/child/ChildCard';
import RewardCard from '../components/rewards/RewardCard';
import RedemptionCard from '../components/redemptions/RedemptionCard';
import ShareableCard from '../components/ShareableCard';

// Helper to run axe on a container element
async function checkA11y(container) {
  const results = await axe.run(container, {
    rules: {
      // Ignore region rule for isolated component tests
      region: { enabled: false },
    },
  });
  const violations = results.violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious'
  );
  if (violations.length > 0) {
    const messages = violations.map(
      v => `[${v.impact}] ${v.id}: ${v.description}\n  ${v.nodes.map(n => n.html).join('\n  ')}`
    );
    throw new Error(`Accessibility violations:\n${messages.join('\n\n')}`);
  }
  return results;
}

const mockChild = {
  id: '1',
  name: 'Test Child',
  total_points: 25,
  weekly_points: 10,
  weekly_target: 50,
  avatar_url: null,
  badges_earned: [],
};

const mockReward = {
  id: '1',
  title: 'Extra Screen Time',
  description: '30 minutes of tablet time',
  cost_points: 50,
  emoji: '🎮',
  visible_to_child: true,
  assigned_child_ids: [],
};

const mockRedemption = {
  id: '1',
  child_name: 'Test Child',
  reward_title: 'Extra Screen Time',
  reward_cost: 50,
  status: 'Completed',
  created_date: new Date().toISOString(),
};

describe('Accessibility: ChildCard', () => {
  it('should have no critical/serious axe violations', async () => {
    const { container } = render(
      <ChildCard
        child={mockChild}
        onAddPoints={() => {}}
        onEdit={() => {}}
        onQuickAction={() => {}}
        quickActions={[{ id: '1', label: 'Kindness', points: 5, icon: '⭐' }]}
        rewards={[mockReward]}
      />
    );
    await checkA11y(container);
  });
});

describe('Accessibility: RewardCard (child view)', () => {
  it('should have no critical/serious axe violations when in progress', async () => {
    const { container } = render(
      <RewardCard
        reward={mockReward}
        isParentView={false}
        onRequest={() => {}}
        canAfford={false}
        childPoints={25}
      />
    );
    await checkA11y(container);
  });

  it('should have no critical/serious axe violations when unlocked', async () => {
    const { container } = render(
      <RewardCard
        reward={mockReward}
        isParentView={false}
        onRequest={() => {}}
        canAfford={true}
        childPoints={100}
      />
    );
    await checkA11y(container);
  });
});

describe('Accessibility: RewardCard (parent view)', () => {
  it('should have no critical/serious axe violations', async () => {
    const { container } = render(
      <RewardCard
        reward={mockReward}
        isParentView={true}
        onEdit={() => {}}
        onToggleVisibility={() => {}}
      />
    );
    await checkA11y(container);
  });
});

describe('Accessibility: RedemptionCard', () => {
  it('should have no critical/serious axe violations', async () => {
    const { container } = render(
      <RedemptionCard
        redemption={mockRedemption}
        onApprove={() => {}}
        onDeny={() => {}}
      />
    );
    await checkA11y(container);
  });
});

describe('Accessibility: ShareableCard', () => {
  it('should have no critical/serious axe violations', async () => {
    const { container } = render(
      <ShareableCard child={mockChild} message="Great job!" />
    );
    await checkA11y(container);
  });
});
