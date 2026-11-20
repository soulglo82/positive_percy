// V1-F G: Manage goals list and goal form, with the E05 start-date safeguard.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const saveTodayGoal = vi.fn();
vi.mock('@/lib/todaysGoals', async (orig) => {
  const real = await orig();
  return {
    ...real,
    saveTodayGoal: (...a) => saveTodayGoal(...a),
    archiveTodayGoal: vi.fn(async () => ({})),
    loadTodaysGoals: vi.fn(async () => ({
      date: '2026-11-18', weekday: 3,
      goals: [
        { id: 'g1', child_id: 'c1', title: 'Finish homework', category_id: 'k2', category_name: 'Learning', category_points: 1,
          category_icon_key: 'learning', schedule_kind: 'one_off', scheduled_date: '2026-11-18', weekdays: [] },
        { id: 'g2', child_id: 'c1', title: 'Help set the table', category_id: 'k1', category_name: 'Helping', category_points: 1,
          category_icon_key: 'helping', schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7], start_date: '2026-11-02' },
        { id: 'g3', child_id: 'c1', title: 'Read for 15 minutes', category_id: 'k3', category_name: 'Reading', category_points: 2,
          category_icon_key: 'reading', schedule_kind: 'weekly', weekdays: [1, 3, 5], start_date: '2026-11-02' },
        { id: 'g4', child_id: 'c2', title: 'Practise piano', category_id: 'k3', category_name: 'Reading', category_points: 2,
          category_icon_key: 'reading', schedule_kind: 'weekly', weekdays: [2], start_date: '2026-11-02' },
        { id: 'g5', child_id: 'c2', title: 'Old piano goal', category_id: 'k0', category_name: 'Piano', category_points: 2,
          category_icon_key: 'music', schedule_kind: 'weekly', weekdays: [2], start_date: '2026-11-02' },
      ],
    })),
  };
});

import ManageGoalsDialog from './ManageGoalsDialog';

const kids = [
  { id: 'c2', name: 'Omar', colour_index: 1, created_date: '2026-01-02', week_points: 10, weekly_target: 20 },
  { id: 'c1', name: 'Lara', colour_index: 0, created_date: '2026-01-01', week_points: 18, weekly_target: 25 },
];
const cats = [
  { id: 'k0', name: 'Piano', points: 2, assigned_children: ['c1'] },
  { id: 'k1', name: 'Helping', points: 1, assigned_children: [] },
  { id: 'k2', name: 'Learning', points: 1, assigned_children: [] },
  { id: 'k3', name: 'Reading', points: 2, assigned_children: [] },
];

function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>
    <ManageGoalsDialog open onClose={() => {}} child={kids[1]} children={kids} categories={cats} today="2026-11-18" />
  </QueryClientProvider>);
  return screen.getByRole('dialog');
}

beforeEach(() => { saveTodayGoal.mockReset(); saveTodayGoal.mockResolvedValue({}); });

describe('Manage goals list (G1)', () => {
  it('approved copy, count, V1 meta and Edit per goal', async () => {
    const d = open();
    expect(within(d).getByRole('heading', { name: "Manage Lara's goals" })).toBeTruthy();
    expect(d.textContent).toContain('Create routines, update schedules or archive goals safely.');
    await within(d).findByText('3 goals for Lara');
    expect(d.textContent).toContain('Learning · Today · +1 point');
    expect(d.textContent).toContain('Helping · Daily · +1 point');
    expect(d.textContent).toContain('Reading · Mon, Wed, Fri · +2 points');
    expect(within(d).getByRole('button', { name: 'Edit Finish homework' }).textContent).toBe('Edit');
    expect(within(d).queryByRole('button', { name: /^Archive/ })).toBeNull(); // archive lives in the edit form
    expect(d.textContent).toContain('Existing completions and earned points remain safe when a goal is edited or archived.');
  });

  it('the child strip (oldest first) switches the list', async () => {
    const d = open();
    await within(d).findByText('3 goals for Lara');
    const strip = within(d).getByRole('group', { name: 'Choose a child' });
    expect(within(strip).getAllByRole('button').map((b) => b.textContent)).toEqual([expect.stringContaining('Lara'), expect.stringContaining('Omar')]);
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    expect(within(d).getByRole('heading', { name: "Manage Omar's goals" })).toBeTruthy();
    expect(d.textContent).toContain('2 goals for Omar');
  });
});

describe('Goal form (G2, G3)', () => {
  it('New goal: approved copy and payload', async () => {
    const d = open();
    await within(d).findByText('3 goals for Lara');
    fireEvent.click(within(d).getByRole('button', { name: 'Add goal' }));
    expect(within(d).getByRole('heading', { name: 'New goal' })).toBeTruthy();
    expect(d.textContent).toContain('For Lara · earned points are awarded when you mark a goal complete');
    expect(d.textContent).toContain('Goal details');
    expect(d.textContent).toContain('Give the goal a name your child understands.');
    expect(d.textContent).toContain('When should it happen?');
    expect(d.textContent).toContain('Choose a routine or a one-off achievement.');
    expect(d.textContent).toContain('Point value comes from the selected behaviour.');
    expect(within(d).getByRole('button', { name: 'Repeat weekly' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(within(d).getByLabelText('Goal name'), { target: { value: 'Tidy room' } });
    fireEvent.change(within(d).getByLabelText('Positive behaviour'), { target: { value: 'k3' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Create goal' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0]).toEqual([{ title: 'Tidy room', child_id: 'c1', category_id: 'k3',
      schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5], start_date: '2026-11-18' }, null]);
    // Back on the list after saving.
    await within(d).findByRole('heading', { name: "Manage Lara's goals" });
  });

  it('renaming a running routine never sends start_date (E05 S2)', async () => {
    const d = open();
    await within(d).findByText('3 goals for Lara');
    fireEvent.click(within(d).getByRole('button', { name: 'Edit Read for 15 minutes' }));
    expect(within(d).getByRole('heading', { name: 'Edit goal' })).toBeTruthy();
    expect(d.textContent).toContain('Started');
    fireEvent.change(within(d).getByLabelText('Goal name'), { target: { value: 'Read for 20 minutes' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0][0]).not.toHaveProperty('start_date');
    expect(saveTodayGoal.mock.calls[0][1]).toBe('g3');
  });

  it('a server refusal shows inline and keeps the form (E9)', async () => {
    saveTodayGoal.mockRejectedValue(new Error('Create a separate goal for a one-off task.'));
    const d = open();
    await within(d).findByText('3 goals for Lara');
    fireEvent.click(within(d).getByRole('button', { name: 'Edit Read for 15 minutes' }));
    fireEvent.click(within(d).getByRole('button', { name: 'One-off' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Save changes' }));
    expect((await within(d).findByRole('alert')).textContent).toContain('Create a separate goal');
    expect(within(d).getByRole('heading', { name: 'Edit goal' })).toBeTruthy();
  });

  it('Archive is offered only when editing; Cancel returns to the list', async () => {
    const d = open();
    await within(d).findByText('3 goals for Lara');
    fireEvent.click(within(d).getByRole('button', { name: 'Add goal' }));
    expect(within(d).queryByRole('button', { name: 'Archive goal' })).toBeNull();
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await within(d).findByRole('button', { name: 'Edit Finish homework' }));
    expect(within(d).getByRole('button', { name: 'Archive goal' })).toBeTruthy();
  });

  it('switching child after Cancel picks the new child\'s behaviours (review finding 2)', async () => {
    const d = open();
    await within(d).findByText('3 goals for Lara');
    fireEvent.click(within(d).getByRole('button', { name: 'Add goal' }));
    expect(within(d).getByLabelText('Positive behaviour').value).toBe('k0'); // Lara-only behaviour first
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    fireEvent.click(within(d).getByRole('button', { name: 'Add goal' }));
    expect(within(d).getByLabelText('Positive behaviour').value).toBe('k1');
    fireEvent.change(within(d).getByLabelText('Goal name'), { target: { value: 'Scales' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Create goal' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0][0]).toMatchObject({ child_id: 'c2', category_id: 'k1' });
  });

  it('New goal after cancelling an edit is a fresh goal with an editable start (review finding 2)', async () => {
    const d = open();
    await within(d).findByText('3 goals for Lara');
    fireEvent.click(within(d).getByRole('button', { name: 'Edit Read for 15 minutes' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Add goal' }));
    expect(within(d).getByLabelText('Goal name').value).toBe('');
    expect(within(d).getByLabelText('Starts on')).toBeTruthy();
    fireEvent.change(within(d).getByLabelText('Goal name'), { target: { value: 'New one' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Create goal' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0]).toEqual([expect.objectContaining({ start_date: '2026-11-18' }), null]);
  });

  it('a goal whose behaviour is no longer offered must choose again (review finding 3)', async () => {
    const d = open();
    await within(d).findByText('3 goals for Lara');
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    // "Piano" (k0) is now assigned only to Lara, so it is not offered for Omar.
    fireEvent.click(within(d).getByRole('button', { name: 'Edit Old piano goal' }));
    const select = within(d).getByLabelText('Positive behaviour');
    expect(select.value).toBe('');
    expect(within(d).getByRole('button', { name: 'Save changes' }).disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'k1' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0]).toEqual([expect.objectContaining({ category_id: 'k1', child_id: 'c2' }), 'g5']);
  });

  it('switching views moves focus to the new title, not the dialog (review of PR #58)', async () => {
    const d = open();
    await within(d).findByText('3 goals for Lara');
    const add = within(d).getByRole('button', { name: 'Add goal' });
    add.focus();
    fireEvent.click(add);
    expect(document.activeElement).toBe(within(d).getByRole('heading', { name: 'New goal' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(within(d).getByRole('heading', { name: "Manage Lara's goals" }));
    fireEvent.click(within(d).getByRole('button', { name: 'Edit Finish homework' }));
    expect(document.activeElement).toBe(within(d).getByRole('heading', { name: 'Edit goal' }));
  });
});
