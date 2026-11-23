import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';

import { MemoryRouter } from 'react-router-dom';
import { StreakStrip, FamilyStrip, LittleWins, WorkingTowards, QuickPoints } from '../components/home/HomeSections';
import { RewardTile } from '../pages/Rewards';
import RewardPicker from '../components/rewards/RewardPicker';
import { HomeHero, HomeQuickPoints, HomeWorkingTowards } from '../components/percy/HomeV11';
import { ChildSelector, ProgressRing } from '../components/percy/parts';

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

// V1-D: the catalogue tile and the icon picker (RewardCard was removed).
describe('Accessibility: V1 reward catalogue tile and icon picker', () => {
  it('has no critical/serious axe violations', async () => {
    const { container } = render(
      <main>
        <RewardTile reward={{ id: 'r1', title: 'Movie night', cost_points: 25, emoji: '🎬', icon_key: 'phosphor:film-slate:duotone', visible_to_child: true }} onEdit={() => {}} />
        <RewardTile reward={{ id: 'r2', title: 'Pizza', cost_points: 1, emoji: '🍕', visible_to_child: false }} onEdit={() => {}} />
        <RewardPicker value="phosphor:pizza:duotone" onChange={() => {}} />
      </main>
    );
    await checkA11y(container);
  });
});


// V1.1 Home (design/v11): the sections Home renders now.
describe('V1.1 Home sections', () => {
  it('hero, Quick Points and working towards have no critical/serious axe violations', async () => {
    const kids = [mockChild, { ...mockChild, id: '2', name: 'Sam', avatar_url: '/api/uploads/9' }];
    const child = { ...mockChild, available_points: 1, goals: [{ rewardId: 'r', name: 'Bike', saved: 300, cost: 300, to_go: 0 }],
      reward_stack_priced: [{ rewardId: 's', name: 'Screen time', cost: 20 }] };
    const { container } = render(
      <MemoryRouter>
        <main>
          <HomeHero children={kids} child={child} streak={3} foxPlay={0} onSelect={() => {}} onOpenRewards={() => {}} />
          <HomeQuickPoints child={child} actions={[{ id: 'k', label: 'Kindness', points: 1, icon_key: 'heart' }]} awarding={false} onAward={() => {}} onOpenAward={() => {}} />
          <HomeWorkingTowards child={child} />
          <ChildSelector children={kids} selectedId="1" onSelect={() => {}} />
          <ProgressRing metric="week" value={60} max={50} progress={{ label: 'Weekly target', valueText: '0 weekly points to go' }} />
        </main>
      </MemoryRouter>
    );
    await checkA11y(container);
  });
});
