// V1.1 Home and Children parts (design/v11). Each guard below names the
// input that breaks it, and the counter-example is asserted too.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProgressRing, PercyAvatar, ChildSelector, PercyFox } from './parts';
import { HomeHero, HomeQuickPoints, HomeWorkingTowards } from './HomeV11';

const C = 2 * Math.PI * 42;
const arc = (el) => el.querySelector('[data-ring-value]');
const kids = [
  { id: 'a', name: 'Lara', created_date: '2026-01-01', available_points: 95, avatar_url: null },
  { id: 'b', name: 'Omar', created_date: '2026-01-02', available_points: 1, avatar_url: '/api/uploads/1' },
];

describe('ProgressRing', () => {
  it('draws the fraction of the arc', () => {
    const { container } = render(<ProgressRing metric="week" value={18} max={25} />);
    expect(arc(container).getAttribute('stroke-dashoffset')).toBe((C * (1 - 18 / 25)).toFixed(2));
  });
  it('clamps the arc at full when over target, and marks it full', () => {
    const { container } = render(<ProgressRing metric="week" value={35} max={30} />);
    expect(arc(container).getAttribute('stroke-dashoffset')).toBe('0.00');
    expect(container.querySelector('.pv-ring').hasAttribute('data-full')).toBe(true);
  });
  it('a zero denominator is the neutral ring: no arc, not full, valuenow 0', () => {
    const { container } = render(<ProgressRing metric="week" value={12} max={0} progress={{ label: 'Weekly target', valueText: 'x' }} />);
    const ring = container.querySelector('.pv-ring');
    expect(ring.hasAttribute('data-empty')).toBe(true);
    expect(ring.hasAttribute('data-full')).toBe(false); // 12 >= 0 must not read as "reached"
    expect(arc(container)).toBeNull();
    expect(ring.getAttribute('aria-valuenow')).toBe('0');
  });
  it('a missing denominator is neutral too; negative values never draw backwards', () => {
    expect(arc(render(<ProgressRing metric="today" value={2} max={undefined} />).container)).toBeNull();
    expect(arc(render(<ProgressRing metric="today" value={-5} max={10} />).container)).toBeNull();
  });
  it('as a progressbar, valuenow is clamped to max (the figure beside it is not)', () => {
    render(<ProgressRing metric="week" value={35} max={30} progress={{ label: 'Weekly target', valueText: '0 weekly points to go' }} />);
    const bar = screen.getByRole('progressbar', { name: 'Weekly target' });
    expect([bar.getAttribute('aria-valuenow'), bar.getAttribute('aria-valuemax')]).toEqual(['30', '30']);
  });
});

describe('PercyAvatar', () => {
  it('shows the photo when there is one, else the initial at the same size', () => {
    const { container } = render(<><PercyAvatar child={kids[1]} children={kids} size="profile" /><PercyAvatar child={kids[0]} children={kids} size="profile" /></>);
    const [photo, initial] = container.querySelectorAll('.pv-avatar');
    expect(photo.querySelector('img').getAttribute('src')).toBe('/api/uploads/1');
    expect(initial.textContent).toBe('L');
    expect(photo.getAttribute('data-size')).toBe(initial.getAttribute('data-size'));
  });
  it('a photo that fails to load falls back to the initial', () => {
    const { container } = render(<PercyAvatar child={kids[1]} children={kids} />);
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('.pv-avatar').textContent).toBe('O');
    expect(container.querySelector('.pv-avatar').getAttribute('data-avatar')).toBe('initial');
  });
  it('takes the child colour class', () => {
    const { container } = render(<PercyAvatar child={kids[1]} children={kids} />);
    expect(container.querySelector('.pv-avatar').className).toContain('pv-kid-2');
  });
});

describe('ChildSelector', () => {
  it('names every child, marks the selected one and calls back', () => {
    const onSelect = vi.fn();
    render(<ChildSelector children={kids} selectedId="a" onSelect={onSelect} />);
    const group = screen.getByRole('group', { name: 'Choose a child' });
    expect(within(group).getByRole('button', { name: 'Lara' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: 'Omar' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
  it('is not drawn for one child', () => {
    const { container } = render(<ChildSelector children={[kids[0]]} selectedId="a" onSelect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PercyFox', () => {
  it('every pose key resolves to the unaltered seated Fox 1A file until pose art exists', () => {
    const { container } = render(<PercyFox pose="walking" />);
    const slot = container.querySelector('.pv-fox');
    expect(slot.getAttribute('data-resolved')).toBe('seated');
    expect(slot.querySelector('img').getAttribute('src')).toBe('/brand/fox-1a-symbol-full.svg');
  });
});

describe('Home V1.1', () => {
  const hero = (child, extra = {}) => render(<HomeHero children={kids} child={child} streak={0} foxPlay={0} onSelect={() => {}} onOpenRewards={() => {}} {...extra} />);
  it('the balance is a number with its unit, not a ring; 1 is singular', () => {
    const { container } = hero(kids[1]);
    expect(container.querySelector('[data-available]').closest('p').textContent).toBe('1 point');
    expect(container.querySelector('.pv-ring')).toBeNull();
  });
  it('no streak, no streak chip; a streak shows it', () => {
    expect(hero(kids[0]).container.textContent).not.toContain('family streak');
    expect(hero(kids[0], { streak: 3 }).container.textContent).toContain('3-day family streak');
  });
  it('Quick Point tiles: the spoken name starts with the visible name, and tapping awards that action', () => {
    const onAward = vi.fn();
    const action = { id: 'k', label: 'Kindness', points: 1, icon_key: 'heart' };
    render(<MemoryRouter><HomeQuickPoints child={kids[0]} actions={[action]} awarding={false} onAward={onAward} onOpenAward={() => {}} /></MemoryRouter>);
    const tile = screen.getByRole('button', { name: 'Kindness +1 for Lara' });
    expect(tile.textContent).toBe('Kindness+1');
    fireEvent.click(tile);
    expect(onAward).toHaveBeenCalledWith(kids[0], action);
  });
  it('tiles are disabled while an award for this child is saving', () => {
    render(<MemoryRouter><HomeQuickPoints child={kids[0]} actions={[{ id: 'k', label: 'Kindness', points: 1 }]} awarding onAward={() => {}} onOpenAward={() => {}} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Kindness/ }).disabled).toBe(true);
  });
  it('no quick behaviours: points to Settings', () => {
    render(<MemoryRouter><HomeQuickPoints child={kids[0]} actions={[]} awarding={false} onAward={() => {}} onOpenAward={() => {}} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Choose them in Settings' })).toBeTruthy();
  });
  it('working towards: nothing chosen and no bigger goal draws nothing; a goal shows the approved figures', () => {
    const { container } = render(<MemoryRouter><HomeWorkingTowards child={{ ...kids[0], goals: [], reward_stack_priced: [] }} /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
    render(<MemoryRouter><HomeWorkingTowards child={{ ...kids[0], goals: [{ rewardId: 'r', name: 'Bike', saved: 60, cost: 300, to_go: 240 }], reward_stack_priced: [] }} /></MemoryRouter>);
    expect(screen.getByText('60 of 300 points saved')).toBeTruthy();
    expect(screen.getByText('240 to go')).toBeTruthy();
  });
});
