import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';

import { MemoryRouter } from 'react-router-dom';
import { StreakStrip, FamilyStrip, LittleWins, WorkingTowards, QuickPoints } from '../components/home/HomeSections';
import RewardCard from '../components/rewards/RewardCard';

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
  name: 'Alexandra-Josephine Montgomery',
  total_points: 1250,
  week_points: 60,
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

// V1 Home sections (replace ChildCard, removed in the PR #57 review fixes).
describe('Accessibility: V1 Home sections', () => {
  const kids = [
    { id: 'c1', name: 'Lara', colour_index: 0, created_date: '2026-01-01', week_points: 18, weekly_target: 25, total_points: 120, available_points: 90,
      reward_stack_priced: [{ rewardId: 'r1', name: 'New bike', cost: 30 }] },
    { id: 'c2', name: 'Omar', colour_index: 1, created_date: '2026-01-02', week_points: 0, weekly_target: 20, total_points: 0, available_points: 0, reward_stack_priced: [] },
  ];
  it('streak, family strip, Little wins, Working towards and Quick Points have no critical/serious axe violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <main>
          <StreakStrip streak={3} />
          <FamilyStrip children={kids} selectedId="c1" onSelect={() => {}} />
          <LittleWins child={kids[0]} />
          <WorkingTowards child={kids[0]} />
          <QuickPoints child={kids[0]} actions={[{ id: 'k', label: 'Kindness', points: 1, icon_key: 'kindness' }]}
            awarding={false} onAward={() => {}} onOpenAward={() => {}} onOpenRewards={() => {}} />
          <QuickPoints child={kids[1]} actions={[]} awarding={false} onAward={() => {}} onOpenAward={() => {}} onOpenRewards={() => {}} />
        </main>
      </MemoryRouter>
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
