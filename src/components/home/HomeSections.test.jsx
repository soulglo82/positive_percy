// V1-A Home sections (review of PR #57): Working towards shows the server's
// priced stack (the one available_points uses), singular "point", and carries
// the selected child to Child View; the strip and Quick Points name their
// controls and state.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StreakStrip, FamilyStrip, LittleWins, WorkingTowards, QuickPoints } from './HomeSections';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const lara = { id: 'c1', name: 'Lara', colour_index: 0, created_date: '2026-01-01', week_points: 18, weekly_target: 25,
  total_points: 120, available_points: 90,
  reward_stack: [{ rewardId: 'r1', name: 'Kite', cost: 20 }, { rewardId: 'gone', name: 'Deleted', cost: 5 }],
  reward_stack_priced: [{ rewardId: 'r1', name: 'Big kite', cost: 25 }, { rewardId: 'r2', name: 'Sticker', cost: 1 }] };

describe('WorkingTowards', () => {
  it('renders the priced stack, never the stored one', () => {
    wrap(<WorkingTowards child={lara} />);
    expect(screen.getByText('Big kite')).toBeTruthy();
    expect(screen.getByText('25 points · Ready when a parent agrees')).toBeTruthy();
    expect(screen.queryByText('Kite')).toBeNull();
    expect(screen.queryByText('Deleted')).toBeNull();
  });
  it('one point is singular', () => {
    wrap(<WorkingTowards child={lara} />);
    expect(screen.getByText('1 point · Ready when a parent agrees')).toBeTruthy();
  });
  it('a child with no priced stack lists nothing (not the stored stack)', () => {
    wrap(<WorkingTowards child={{ ...lara, reward_stack_priced: undefined }} />);
    expect(screen.queryByText('Kite')).toBeNull();
  });
  it('the link carries the selected child to Child View', () => {
    wrap(<WorkingTowards child={lara} />);
    expect(screen.getByRole('link', { name: 'View all goals and rewards' }).getAttribute('href')).toBe('/childview?child=c1');
  });
});

describe('LittleWins', () => {
  it('shows this week and available now from the server', () => {
    const { container } = wrap(<LittleWins child={lara} />);
    expect(container.textContent).toContain('18 / 25');
    expect(container.textContent).toContain('90 points');
    // The same figure as Child View and Children (owner, 22 Nov): icon, figure with its unit, approved label.
    expect([...container.querySelectorAll('[data-figure]')].map((f) => f.querySelector('p').textContent))
      .toEqual(['18 / 25 This week', '90 points Available now']);
    expect([...container.querySelectorAll('[data-figure] [data-icon]')].map((i) => i.getAttribute('data-icon')))
      .toEqual(['phosphor:target:duotone', 'phosphor:piggy-bank:duotone']);
  });
  it('a child with no weekly target stored shows 0, never "null" (code review)', () => {
    const { container } = wrap(<LittleWins child={{ ...lara, weekly_target: null, week_points: 0 }} />);
    expect(container.querySelector('[data-figure] p').textContent).toBe('0 / 0 This week');
  });
  it('1 available point is singular', () => {
    const { container } = wrap(<LittleWins child={{ ...lara, available_points: 1 }} />);
    expect(container.textContent).toContain('1 point');
    expect(container.textContent).not.toContain('1 points');
  });
});

describe('FamilyStrip', () => {
  it('names each child by its visible text and marks the selected one', () => {
    const onSelect = vi.fn();
    wrap(<FamilyStrip children={[lara, { ...lara, id: 'c2', name: 'Omar' }]} selectedId="c1" onSelect={onSelect} />);
    const group = screen.getByRole('group', { name: 'Choose a child' });
    expect(within(group).getByRole('button', { name: /^Lara\s*18 \/ 25 this week$/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: /^Omar\s*18 \/ 25 this week$/ }));
    expect(onSelect).toHaveBeenCalledWith('c2');
  });
});

describe('QuickPoints and StreakStrip', () => {
  it('tiles name the behaviour, points and child; none ticked links to Settings', () => {
    const onAward = vi.fn();
    const action = { id: 'k', label: 'Kindness', points: 1, icon_key: 'kindness' };
    const { unmount } = wrap(<QuickPoints child={lara} actions={[action]} awarding={false} onAward={onAward} onOpenAward={() => {}} onOpenRewards={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kindness +1 for Lara' }));
    expect(onAward).toHaveBeenCalledWith(lara, action);
    unmount();
    wrap(<QuickPoints child={lara} actions={[]} awarding={false} onAward={() => {}} onOpenAward={() => {}} onOpenRewards={() => {}} />);
    expect(screen.getByRole('link', { name: 'Choose them in Settings' })).toBeTruthy();
  });
  it('the streak strip is hidden at 0', () => {
    const { container } = wrap(<StreakStrip streak={0} />);
    expect(container.textContent).toBe('');
  });
});
