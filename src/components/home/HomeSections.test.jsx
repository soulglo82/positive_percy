// V1-A Home sections (review of PR #57): Working towards shows the server's
// priced stack (the one available_points uses), singular "point", and carries
// the selected child to Child View; the strip and Quick Points name their
// controls and state.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StreakStrip, FamilyStrip, AvailableLine, WorkingTowards, QuickPoints } from './HomeSections';

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
    expect(screen.getByRole('link', { name: 'View all Big Goals and rewards' }).getAttribute('href')).toBe('/childview?child=c1');
  });
});

describe('AvailableLine: the points line on Home (V1-F §13)', () => {
  it('one paragraph that reads "Available now for Lara 90 points", with the bare number on its hook', () => {
    const { container } = wrap(<AvailableLine child={lara} />);
    const line = container.querySelector('[data-points-line]');
    expect(line.querySelectorAll('p')).toHaveLength(1);
    expect(line.querySelector('p').textContent).toBe('Available now for Lara 90 points');
    expect(line.querySelector('[data-available]').textContent).toBe('90');
    expect(line.querySelector('bdi').textContent).toBe('Lara'); // a right-to-left name cannot reorder the figure (A7)
    expect([...line.querySelectorAll('[data-icon]')].map((i) => i.getAttribute('data-icon'))).toEqual(['phosphor:piggy-bank:duotone']);
    expect(line.querySelector('[data-icon]').closest('[aria-hidden="true"]')).toBeTruthy();
    // Not a heading, not a live region, and not the stacked figure e2e/checks.js measures (P2, P3).
    expect(line.querySelectorAll('h1, h2, h3, [role="status"], [aria-live], [data-figure]')).toHaveLength(0);
    // The slogan card is gone, and the week is not repeated (owner, 22 and 24 Nov).
    expect(container.textContent).not.toMatch(/Little wins|Every positive step|18 \/ 25|This week/);
  });
  it('the figure: 0, the fall-back to total_points, then 0 (A2); and it follows the child (A5)', () => {
    const text = (child) => { const { container, unmount } = wrap(<AvailableLine child={child} />); const t = container.querySelector('p').textContent; unmount(); return t; };
    expect(text({ ...lara, available_points: 0 })).toBe('Available now for Lara 0 points');
    expect(text({ id: 'c2', name: 'Omar', total_points: 40 })).toBe('Available now for Omar 40 points');
    expect(text({ id: 'c3', name: 'Joud' })).toBe('Available now for Joud 0 points');
    expect(text({ ...lara, available_points: 1000000 })).toBe('Available now for Lara 1000000 points');
  });
  it('the week is in the selected child\'s tile, once', () => {
    const { container } = wrap(<FamilyStrip children={[lara]} selectedId={lara.id} onSelect={() => {}} />);
    expect(container.textContent).toContain('18 / 25 this week');
  });
  it('a child with no weekly target stored shows 0 in the tile, never a blank (code review)', () => {
    const { container } = wrap(<FamilyStrip children={[{ ...lara, weekly_target: null }]} selectedId={lara.id} onSelect={() => {}} />);
    expect(container.textContent).toContain('18 / 0 this week');
  });
  it('1 available point is singular', () => {
    const { container } = wrap(<AvailableLine child={{ ...lara, available_points: 1 }} />);
    expect(container.querySelector('p').textContent).toBe('Available now for Lara 1 point');
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

// V1-F design section 11: Give Percy Points uses a one-line picker.
describe('FamilyStrip, compact (Give Percy Points)', () => {
  it('one line per child: the name only, the selected one marked, no weekly figure', () => {
    const onSelect = vi.fn();
    const kids = [lara, { ...lara, id: 'c2', name: 'Omar' }, { ...lara, id: 'c3', name: 'Alexandra-Josephine Montgomery-Wellington' }];
    wrap(<FamilyStrip compact children={kids} selectedId="c1" onSelect={onSelect} />);
    const group = screen.getByRole('group', { name: 'Choose a child' });
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(within(group).getByRole('button', { name: 'Lara' })).toBeTruthy();
    expect(group.textContent).not.toContain('this week');
    fireEvent.click(within(group).getByRole('button', { name: 'Omar' }));
    expect(onSelect).toHaveBeenCalledWith('c2');
    // A button is never wider than the row, and a name can wrap inside it.
    const long = within(group).getByRole('button', { name: 'Alexandra-Josephine Montgomery-Wellington' });
    expect(long.className).toMatch(/(^|\s)max-w-full(\s|$)/);
    // The selected child's border is the same width as the others' (a ring marks it).
    for (const b of within(group).getAllByRole('button')) expect(b.className).not.toMatch(/border-2/);
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
    // No boxes, so nothing to tap: the line about tapping a box is not shown.
    expect(document.body.textContent).not.toContain('Tap a box');
  });
  // Owner, 24 November 2026 (V1-F design section 10): the card says a box acts
  // at once, and the form is reached by "Custom points", not "Award points".
  it('says a box gives its points at once; Custom points opens the form; no Award points button', () => {
    const onOpenAward = vi.fn();
    const onOpenRewards = vi.fn();
    const onAward = vi.fn();
    const action = { id: 'k', label: 'Kindness', points: 1, icon_key: 'kindness' };
    const { container } = wrap(<QuickPoints child={lara} actions={[action]} awarding={false} onAward={onAward} onOpenAward={onOpenAward} onOpenRewards={onOpenRewards} />);
    expect(container.textContent).toContain('Tap a box to give its points straight away.');
    expect(screen.getByRole('button', { name: 'Custom points' }).className).toMatch(/border-warm-ink/);
    expect(container.textContent).not.toContain('whenever it happens');
    expect(screen.queryByRole('button', { name: /Award points/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Custom points' }));
    expect(onOpenAward).toHaveBeenCalledTimes(1);
    expect(onAward).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Rewards' }));
    expect(onOpenRewards).toHaveBeenCalledTimes(1);
    // Neither button is the solid purple one: the boxes are the main thing on the card.
    for (const name of ['Custom points', 'Rewards']) expect(screen.getByRole('button', { name }).className).not.toMatch(/(^|\s)bg-primary(\s|$)/);
    expect(screen.getByRole('button', { name: 'Custom points' }).className).toMatch(/bg-warm-soft/);
    expect(screen.getByRole('button', { name: 'Rewards' }).className).toMatch(/bg-accent/);
  });
  it('the streak strip is hidden at 0', () => {
    const { container } = wrap(<StreakStrip streak={0} />);
    expect(container.textContent).toBe('');
  });
});
