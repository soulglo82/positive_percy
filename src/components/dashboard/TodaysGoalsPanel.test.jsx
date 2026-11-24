// E05: a completed goal keeps its category icon (register completed_goal),
// shows a separate Done mark, names the selected child, and the completion
// control's accessible name includes the visible points.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/todaysGoals', async (orig) => {
  const real = await orig();
  return {
    ...real,
    loadTodaysGoals: vi.fn(async () => ({
      date: '2026-11-12', weekday: 4,
      goals: [
        { id: 'g1', child_id: 'c1', title: 'Read', category_name: 'Reading', category_points: 2,
          category_icon_key: 'reading', schedule_kind: 'weekly', weekdays: [1, 3, 5], completion_id: 'x1' },
        { id: 'g2', child_id: 'c1', title: 'Tidy', category_name: 'Reading', category_points: 1,
          category_icon_key: 'reading', schedule_kind: 'one_off', scheduled_date: '2026-11-12', weekdays: [], completion_id: null },
      ],
    })),
  };
});

// The pop-up loads the reward list while it is open (V1-F §12 W5).
vi.mock('@/api/entities', () => ({ Reward: { list: vi.fn(async () => []) } }));

import TodaysGoalsPanel from './TodaysGoalsPanel';

const kids = [
  { id: 'c1', name: 'Ava', colour_index: 0, created_date: '2026-01-01' },
  { id: 'c2', name: 'Ben', colour_index: 1, created_date: '2026-01-02' },
];

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><TodaysGoalsPanel children={kids} enabled /></QueryClientProvider>);
}

describe('TodaysGoalsPanel (E05)', () => {
  it('done and not-done rows draw the same category icon; Done is separate', async () => {
    renderPanel();
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    const tileIcon = (li) => li.querySelector('span[aria-hidden="true"] svg').getAttribute('data-icon');
    expect(tileIcon(items[0])).toBe('phosphor:book-open-text:duotone');
    expect(tileIcon(items[1])).toBe(tileIcon(items[0]));
    expect(within(items[0]).getByText('Done')).toBeTruthy();
    expect(within(items[0]).queryByRole('button')).toBeNull();
  });

  it('V1 wording: checklist owner, short server date, done count, recurrence, Complete name', async () => {
    renderPanel();
    await screen.findAllByRole('listitem');
    expect(screen.getByText('Thursday 12 Nov')).toBeTruthy();
    expect(screen.getByText("Ava's checklist")).toBeTruthy();
    expect(screen.getByText('1 of 2 done')).toBeTruthy();
    expect(screen.getByText('Reading · Mon, Wed, Fri · +2 points')).toBeTruthy();
    expect(screen.getByText('Reading · Today · +1 point')).toBeTruthy();
    const btn = screen.getByRole('button', { name: 'Complete Tidy' });
    expect(btn.textContent).toContain('Complete');
    // The Home strip chooses the child; the panel has no chips of its own.
    expect(screen.queryByRole('group', { name: 'Choose a child' })).toBeNull();
  });

  it('shows the child the Home strip chose; an unknown id falls back to the first child', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TodaysGoalsPanel children={kids} enabled selectedChildId="c2" /></QueryClientProvider>);
    expect(await screen.findByText("Ben's checklist")).toBeTruthy();
  });

  it('Daily Wins: the new names and one door for both kinds (V1-F §12 W1, W2)', async () => {
    const { container } = renderPanel();
    await screen.findAllByRole('listitem');
    expect(screen.getByRole('heading', { name: 'Daily Wins' })).toBeTruthy();
    const door = screen.getByRole('button', { name: 'Manage Daily Wins & Big Goals' });
    // A native button whose label may wrap on a narrow phone (X30), not a nowrap Button.
    expect(door.className).not.toContain('whitespace-nowrap');
    expect(container.textContent).not.toMatch(/Today's Goals|Manage goals|Set up goals/);
  });

  it('nothing today: the empty state has no button of its own; the one door stays (W2)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(<QueryClientProvider client={client}><TodaysGoalsPanel children={[...kids, { id: 'c3', name: 'Cal' }]} enabled selectedChildId="c3" /></QueryClientProvider>);
    expect(await screen.findByText('No Daily Wins for Cal today.')).toBeTruthy();
    expect(screen.getByText('Something to do today or every week.')).toBeTruthy();
    expect(container.querySelector('.pv-empty').querySelectorAll('button')).toHaveLength(0); // V1.1 empty state (design/v11)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Manage Daily Wins & Big Goals']);
  });

  it('the pop-up opens from the door, and closing it returns focus to the door (X32)', async () => {
    renderPanel();
    await screen.findAllByRole('listitem');
    const door = screen.getByRole('button', { name: 'Manage Daily Wins & Big Goals' });
    fireEvent.click(door);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Daily Wins & Big Goals' })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(door));
  });

  it('a selected id no longer in the list shows the first child', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TodaysGoalsPanel children={kids} enabled selectedChildId="gone" /></QueryClientProvider>);
    expect(await screen.findByText("Ava's checklist")).toBeTruthy();
  });
});
