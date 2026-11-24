// V1-F §12: the Daily Wins & Big Goals pop-up (owner's option C): its two sides,
// the Daily Win form with the E05 start-date safeguard, the Big Goal form and
// the savings view, all in one dialog.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
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

const rewardApi = { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
vi.mock('@/api/entities', () => ({
  Reward: { list: (...a) => rewardApi.list(...a), create: (...a) => rewardApi.create(...a), update: (...a) => rewardApi.update(...a), delete: (...a) => rewardApi.delete(...a) },
}));
const saveTowards = vi.fn();
const moveBack = vi.fn();
const redeemGoal = vi.fn();
vi.mock('@/lib/savings', async (orig) => ({ ...(await orig()), saveTowards: (...a) => saveTowards(...a), moveBack: (...a) => moveBack(...a), redeemGoal: (...a) => redeemGoal(...a) }));

import ManageGoalsDialog from './ManageGoalsDialog';
import RewardForm from '@/components/rewards/RewardForm';
import SavingsDialog from '@/components/savings/SavingsDialog';

const kids = [
  { id: 'c2', name: 'Omar', colour_index: 1, created_date: '2026-01-02', week_points: 10, weekly_target: 20, available_points: 5,
    goals: [{ rewardId: 'r5', name: 'Lego set', cost: 80, saved: 80, to_go: 0 }] },
  { id: 'c1', name: 'Lara', colour_index: 0, created_date: '2026-01-01', week_points: 18, weekly_target: 25, available_points: 34,
    goals: [{ rewardId: 'r1', name: 'New bike', cost: 300, saved: 45, to_go: 255 }], reward_stack_priced: [{ rewardId: 'r3', name: 'Zoo trip', cost: 60 }] },
];
const cats = [
  { id: 'k0', name: 'Piano', points: 2, assigned_children: ['c1'] },
  { id: 'k1', name: 'Helping', points: 1, assigned_children: [] },
  { id: 'k2', name: 'Learning', points: 1, assigned_children: [] },
  { id: 'k3', name: 'Reading', points: 2, assigned_children: [] },
];
const rewards = [
  { id: 'r1', title: 'New bike', cost_points: 300, is_bigger_goal: true, assigned_child_ids: [], visible_to_child: true },
  { id: 'r2', title: 'Telescope', cost_points: 120, is_bigger_goal: true, assigned_child_ids: ['c1'], visible_to_child: false, description: 'A real one' },
  { id: 'r3', title: 'Zoo trip', cost_points: 60, is_bigger_goal: true, assigned_child_ids: ['c1'], visible_to_child: true },
  { id: 'r4', title: 'Movie night', cost_points: 25, is_bigger_goal: false, assigned_child_ids: [], visible_to_child: true },
  { id: 'r5', title: 'Lego set', cost_points: 80, is_bigger_goal: true, assigned_child_ids: ['c2'], visible_to_child: true },
];

function open(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(<QueryClientProvider client={client}>
    <ManageGoalsDialog open onClose={onClose} child={kids[1]} children={kids} categories={cats} today="2026-11-18" {...props} />
  </QueryClientProvider>);
  const d = screen.getByRole('dialog');
  d.onClose = onClose;
  d.client = client;
  return d;
}
const pressed = (d, name) => within(d).getByRole('button', { name, exact: true }).getAttribute('aria-pressed');
const listed = (d) => within(d).findByRole('button', { name: /^Edit Finish homework/ });
const toBigGoals = async (d) => { fireEvent.click(within(d).getByRole('button', { name: 'Big Goals' })); await within(d).findByRole('region', { name: /Big Goals$/ }); await waitFor(() => expect(within(d).queryByText('Loading Big Goals…')).toBeNull()); };

beforeEach(() => {
  saveTodayGoal.mockReset(); saveTodayGoal.mockResolvedValue({});
  saveTowards.mockReset(); saveTowards.mockResolvedValue({ event: { id: 'e1' }, child: {} });
  moveBack.mockReset(); moveBack.mockResolvedValue({ event: { id: 'e2' }, child: {} });
  redeemGoal.mockReset(); redeemGoal.mockResolvedValue({ redemption: { id: 'x1' }, child: {} });
  for (const f of Object.values(rewardApi)) f.mockReset();
  rewardApi.list.mockResolvedValue(rewards);
  rewardApi.create.mockResolvedValue({ id: 'r9' }); rewardApi.update.mockResolvedValue({}); rewardApi.delete.mockResolvedValue({});
});

describe('The list: two sides in one pop-up (W3 to W5)', () => {
  it('opens on Daily Wins: title, switch, a row per Daily Win with its icon and meta, one Add button', async () => {
    const d = open();
    expect(within(d).getByRole('heading', { name: 'Daily Wins & Big Goals' })).toBeTruthy();
    await listed(d);
    const show = within(d).getByRole('group', { name: 'Show' });
    expect(within(show).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['Daily Wins', 'true'], ['Big Goals', 'false']]);
    const region = within(d).getByRole('region', { name: "Lara's Daily Wins" });
    expect(within(region).getAllByRole('button')).toHaveLength(3); // one control per Daily Win: the row itself
    expect(region.textContent).toContain('Learning · Today · +1 point');
    expect(region.textContent).toContain('Helping · Daily · +1 point');
    expect(region.textContent).toContain('Reading · Mon, Wed, Fri · +2 points');
    // Each row keeps its behaviour's icon (owner, 24 Nov): the icon in its own hidden span, not just the row's chevron.
    const icons = [...region.querySelectorAll('li')].map((li) => li.querySelector('span[aria-hidden="true"] svg')?.getAttribute('data-icon'));
    expect(icons).toHaveLength(3);
    for (const icon of icons) expect(icon).toMatch(/^phosphor:/);
    expect(within(d).queryByRole('button', { name: /^Archive/ })).toBeNull(); // archive lives in the edit form
    expect(within(d).getByRole('button', { name: 'Add Daily Win' })).toBeTruthy();
    expect(within(d).queryByRole('button', { name: 'Add Big Goal' })).toBeNull();
    // The retired words are gone.
    expect(d.textContent).not.toMatch(/Manage .* goals|Current goals|routine/i);
  });

  it('pressing the pressed side changes nothing; the other side swaps the list and the Add button', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Daily Wins' }));
    expect(pressed(d, 'Daily Wins')).toBe('true');
    await toBigGoals(d);
    expect(pressed(d, 'Big Goals')).toBe('true');
    expect(within(d).getByRole('region', { name: "Lara's Big Goals" })).toBeTruthy();
    expect(within(d).queryByRole('button', { name: 'Add Daily Win' })).toBeNull();
    expect(within(d).getByRole('button', { name: 'Add Big Goal' })).toBeTruthy();
  });

  it('the child picker (oldest first) switches the list and keeps the side (X3)', async () => {
    const d = open();
    await listed(d);
    const strip = within(d).getByRole('group', { name: 'Choose a child' });
    expect(within(strip).getAllByRole('button').map((b) => b.textContent)).toEqual([expect.stringContaining('Lara'), expect.stringContaining('Omar')]);
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    expect(within(d).getByRole('region', { name: "Omar's Daily Wins" }).querySelectorAll('li')).toHaveLength(2);
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: /^Lara/ }));
    expect(pressed(d, 'Big Goals')).toBe('true');
    expect(within(d).getByRole('region', { name: "Lara's Big Goals" })).toBeTruthy();
  });

  it('one child: no picker (X1)', async () => {
    const d = open({ children: [kids[1]] });
    await listed(d);
    expect(within(d).queryByRole('group', { name: 'Choose a child' })).toBeNull();
  });

  it('Big Goals: the child\'s marked rewards in order, at the server\'s figures or 0, with their own controls (W5, X7, X8, X24)', async () => {
    const d = open();
    await toBigGoals(d);
    const region = within(d).getByRole('region', { name: "Lara's Big Goals" });
    const items = [...region.querySelectorAll('li')];
    // Most saved first, then closest to done; Movie night is not a Big Goal and Lego set is Omar's.
    expect(items.map((li) => li.getAttribute('data-big-goal'))).toEqual(['r1', 'r3', 'r2']);
    expect(items[0].textContent).toContain('45 of 300 points saved');
    expect(items[2].textContent).toContain('0 of 120 points saved');
    expect(items[2].textContent).toContain('Hidden from children');
    expect(items[0].textContent).not.toContain('Hidden from children');
    // Two sibling controls, never one inside the other.
    expect(within(items[0]).getAllByRole('button')).toHaveLength(2);
    expect(within(items[0]).getByRole('button', { name: 'Save points for New bike' }).textContent).toBe('Save points');
    expect(d.querySelectorAll('button button, a button, button a')).toHaveLength(0);
    // Asked for: cannot be saved towards (S1).
    expect(items[1].textContent).toContain('Asked for');
    expect(within(items[1]).getAllByRole('button')).toHaveLength(1);
  });

  it('a Big Goal whose savings cover its cost offers Redeem (X9); a whole-family goal lists at 0 for another child', async () => {
    const d = open({ child: kids[0] });
    await toBigGoals(d);
    const region = within(d).getByRole('region', { name: "Omar's Big Goals" });
    expect([...region.querySelectorAll('li')].map((li) => li.getAttribute('data-big-goal'))).toEqual(['r5', 'r1']);
    expect(within(region).getByRole('button', { name: 'Redeem Lego set' }).textContent).toBe('Redeem');
    expect(region.textContent).toContain('0 of 300 points saved');
  });

  it('nothing yet: each side says so and keeps its Add button (X2)', async () => {
    rewardApi.list.mockResolvedValue([rewards[3]]);
    const d = open({ child: { id: 'c9', name: 'Joud' }, children: [{ id: 'c9', name: 'Joud' }] });
    await within(d).findByText('No Daily Wins yet for Joud.');
    expect(within(d).getByRole('button', { name: 'Add Daily Win' })).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Big Goals' }));
    await within(d).findByText('No Big Goals yet for Joud.');
    expect(within(d).getByRole('button', { name: 'Add Big Goal' })).toBeTruthy();
  });

  it('rewards fail to load: the Big Goals side says so with Try again; Daily Wins is unaffected (X12)', async () => {
    rewardApi.list.mockRejectedValue(new Error('offline'));
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Big Goals' }));
    await within(d).findByText('Could not load Big Goals.');
    rewardApi.list.mockResolvedValue(rewards);
    fireEvent.click(within(d).getByRole('button', { name: 'Try again' }));
    await within(d).findByRole('button', { name: /^Edit New bike/ });
  });

  it('opens on the Big Goals side when asked (W9)', async () => {
    const d = open({ start: { side: 'bigGoals' } });
    expect(pressed(d, 'Big Goals')).toBe('true');
    await within(d).findByRole('button', { name: /^Edit New bike/ });
  });
});

describe('Daily Win form (W6; G2 to G4 and E05 unchanged)', () => {
  it('New Daily Win: wording, option text and payload', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Add Daily Win' }));
    expect(within(d).getByRole('heading', { name: 'New Daily Win' })).toBeTruthy();
    expect(d.textContent).toContain('For Lara');
    expect(d.textContent).not.toMatch(/Goal details|When should it happen|Point value comes from|earned points are awarded/);
    expect(within(d).getByRole('button', { name: 'Every week' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(d).getByRole('button', { name: 'One day' }).getAttribute('aria-pressed')).toBe('false');
    const select = within(d).getByLabelText('Points for');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Piano · 2 points', 'Helping · 1 point', 'Learning · 1 point', 'Reading · 2 points']);
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'Tidy room' } });
    fireEvent.change(select, { target: { value: 'k3' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save Daily Win' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0]).toEqual([{ title: 'Tidy room', child_id: 'c1', category_id: 'k3',
      schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5], start_date: '2026-11-18' }, undefined]);
    // Back on the list after saving.
    await within(d).findByRole('heading', { name: 'Daily Wins & Big Goals' });
  });

  it('One day: sends the date, never weekdays', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Add Daily Win' }));
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'Dentist' } });
    fireEvent.click(within(d).getByRole('button', { name: 'One day' }));
    expect(within(d).getByLabelText('Date').value).toBe('2026-11-18');
    fireEvent.click(within(d).getByRole('button', { name: 'Save Daily Win' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0][0]).toEqual({ title: 'Dentist', child_id: 'c1', category_id: 'k0', schedule_kind: 'one_off', scheduled_date: '2026-11-18' });
  });

  it('renaming a running routine never sends start_date (E05 S2)', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: /^Edit Read for 15 minutes/ }));
    expect(within(d).getByRole('heading', { name: 'Edit Daily Win' })).toBeTruthy();
    expect(d.textContent).toContain('Started');
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'Read for 20 minutes' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save Daily Win' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0][0]).not.toHaveProperty('start_date');
    expect(saveTodayGoal.mock.calls[0][1]).toBe('g3');
  });

  it('a server refusal shows inline and keeps the form (E9)', async () => {
    saveTodayGoal.mockRejectedValue(new Error('Create a separate Daily Win for a one-off task.'));
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: /^Edit Read for 15 minutes/ }));
    fireEvent.click(within(d).getByRole('button', { name: 'One day' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Save Daily Win' }));
    expect((await within(d).findByRole('alert')).textContent).toContain('Create a separate Daily Win');
    expect(within(d).getByRole('heading', { name: 'Edit Daily Win' })).toBeTruthy();
  });

  it('Archive is offered only when editing; Cancel returns to the list', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Add Daily Win' }));
    expect(within(d).queryByRole('button', { name: 'Archive Daily Win' })).toBeNull();
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await listed(d));
    expect(within(d).getByRole('button', { name: 'Archive Daily Win' })).toBeTruthy();
  });

  it('switching child after Cancel picks the new child\'s behaviours (review finding 2)', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Add Daily Win' }));
    expect(within(d).getByLabelText('Points for').value).toBe('k0'); // Lara-only behaviour first
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    fireEvent.click(within(d).getByRole('button', { name: 'Add Daily Win' }));
    expect(d.textContent).toContain('For Omar');
    expect(within(d).getByLabelText('Points for').value).toBe('k1');
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'Scales' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save Daily Win' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0][0]).toMatchObject({ child_id: 'c2', category_id: 'k1' });
    // Back on the list for the child the picker shows (X31).
    await within(d).findByRole('region', { name: "Omar's Daily Wins" });
  });

  it('New after cancelling an edit is a fresh Daily Win with an editable start (review finding 2)', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: /^Edit Read for 15 minutes/ }));
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Add Daily Win' }));
    expect(within(d).getByLabelText('What is it?').value).toBe('');
    expect(within(d).getByLabelText('Starts on')).toBeTruthy();
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'New one' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save Daily Win' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0]).toEqual([expect.objectContaining({ start_date: '2026-11-18' }), undefined]);
  });

  it('a Daily Win whose behaviour is no longer offered must choose again (review finding 3, X15)', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    // "Piano" (k0) is now assigned only to Lara, so it is not offered for Omar.
    fireEvent.click(within(d).getByRole('button', { name: /^Edit Old piano goal/ }));
    const select = within(d).getByLabelText('Points for');
    expect(select.value).toBe('');
    expect(within(d).getByRole('button', { name: 'Save Daily Win' }).disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'k1' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save Daily Win' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0]).toEqual([expect.objectContaining({ category_id: 'k1', child_id: 'c2' }), 'g5']);
  });

  it('each opening starts where it was asked to, for the child it was opened for (code review of #61, X16)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (props) => (<QueryClientProvider client={client}>
      <ManageGoalsDialog onClose={() => {}} children={kids} categories={cats} today="2026-11-18" {...props} />
    </QueryClientProvider>);
    // First shown for Lara (whose first behaviour is Piano, k0, hers only), left on a form, then closed.
    const { rerender } = render(view({ open: true, child: kids[1] }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Daily Win' }));
    rerender(view({ open: false, child: kids[1] }));
    // Opened again for Omar straight on a new Daily Win: nothing of Lara's form is left.
    rerender(view({ open: true, child: kids[0], start: { view: 'form' } }));
    let d = await screen.findByRole('dialog');
    expect(within(d).getByRole('heading', { name: 'New Daily Win' })).toBeTruthy();
    expect(within(d).getByLabelText('Points for').value).toBe('k1');
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'Practise scales' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save Daily Win' }));
    await waitFor(() => expect(saveTodayGoal).toHaveBeenCalledTimes(1));
    expect(saveTodayGoal.mock.calls[0][0]).toMatchObject({ child_id: 'c2', category_id: 'k1' });
    // Opened again for Omar on a Daily Win whose behaviour (Piano) is not his: it must be chosen again.
    rerender(view({ open: false, child: kids[0] }));
    rerender(view({ open: true, child: kids[0], start: { goal: { id: 'g5', child_id: 'c2', title: 'Old piano goal', category_id: 'k0',
      schedule_kind: 'weekly', weekdays: [2], start_date: '2026-11-02' } } }));
    d = await screen.findByRole('dialog');
    expect(within(d).getByRole('heading', { name: 'Edit Daily Win' })).toBeTruthy();
    expect(within(d).getByLabelText('Points for').value).toBe('');
    // Cancel returns to the Daily Wins list.
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(pressed(d, 'Daily Wins')).toBe('true');
    // Opened again plainly: on the list, not on the last form.
    rerender(view({ open: false, child: kids[0] }));
    rerender(view({ open: true, child: kids[1] }));
    d = await screen.findByRole('dialog');
    expect(within(d).getByRole('heading', { name: 'Daily Wins & Big Goals' })).toBeTruthy();
  });
});

describe('Big Goal form and savings, in the same dialog (W7, W8)', () => {
  it('Add Big Goal for the child the picker shows: the short form and the payload (X6); back on the Big Goals side (X31)', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    fireEvent.click(within(d).getByRole('button', { name: 'Big Goals' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Add Big Goal' }));
    expect(within(d).getByRole('heading', { name: 'New Big Goal' })).toBeTruthy();
    expect(d.textContent).toContain('For Omar');
    // Hidden by the variant: the long form's extras.
    expect(within(d).queryByLabelText(/Description/)).toBeNull();
    expect(within(d).queryAllByRole('checkbox')).toHaveLength(0);
    expect(d.textContent).not.toMatch(/Assign to Children|Choose an icon|The reward/);
    expect(screen.getAllByRole('dialog')).toHaveLength(1); // no dialog stacked on another
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'Scooter' } });
    fireEvent.change(within(d).getByLabelText('Points needed'), { target: { value: '250' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save Big Goal' }));
    await waitFor(() => expect(rewardApi.create).toHaveBeenCalledTimes(1));
    expect(rewardApi.create.mock.calls[0][0]).toEqual({ title: 'Scooter', cost_points: 250, description: '',
      visible_to_child: true, is_bigger_goal: true, assigned_child_ids: ['c2'], emoji: '🎁' });
    await within(d).findByRole('region', { name: "Omar's Big Goals" });
    expect(pressed(d, 'Big Goals')).toBe('true');
  });

  it('editing a Big Goal sends only its name and cost; Cancel returns to the Big Goals side (X13)', async () => {
    const d = open();
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: /^Edit Telescope/ }));
    expect(within(d).getByRole('heading', { name: 'Edit Big Goal' })).toBeTruthy();
    expect(d.textContent).toContain('For Lara');
    expect(within(d).getByRole('button', { name: 'Delete Big Goal' })).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(within(d).getByRole('region', { name: "Lara's Big Goals" })).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: /^Edit Telescope/ }));
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'Big telescope' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save Big Goal' }));
    await waitFor(() => expect(rewardApi.update).toHaveBeenCalledTimes(1));
    expect(rewardApi.update.mock.calls[0]).toEqual(['r2', { title: 'Big telescope', cost_points: 120 }]);
  });

  it('a whole-family Big Goal says so (X4)', async () => {
    const d = open();
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: /^Edit New bike/ }));
    expect(d.textContent).toContain('For the whole family');
  });

  it('Save points opens the savings view on that goal; Close returns; a move closes the whole pop-up (X14)', async () => {
    const d = open();
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Save points for Telescope' }));
    expect(within(d).getByRole('heading', { name: 'Save points for a Big Goal' })).toBeTruthy();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(d).getByRole('radio', { name: /Telescope/ }).checked).toBe(true); // not the leading goal (New bike)
    expect(within(d).queryByRole('radio', { name: /Zoo trip/ })).toBeNull(); // asked for: not offered
    fireEvent.click(within(d).getAllByRole('button', { name: 'Close' }).find((b) => b.textContent === 'Close' && !b.querySelector('svg')));
    expect(within(d).getByRole('region', { name: "Lara's Big Goals" })).toBeTruthy();
    expect(d.onClose).not.toHaveBeenCalled();
    fireEvent.click(within(d).getByRole('button', { name: 'Save points for Telescope' }));
    fireEvent.change(within(d).getByLabelText('Points'), { target: { value: '10' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save points' }));
    await waitFor(() => expect(saveTowards).toHaveBeenCalledTimes(1));
    expect(saveTowards.mock.calls[0].slice(0, 3)).toEqual(['c1', 'r2', 10]);
    await waitFor(() => expect(d.onClose).toHaveBeenCalledTimes(1));
  });

  it('every view change moves focus to the new view\'s title (review of PR #58, W8)', async () => {
    const d = open();
    await listed(d);
    const heading = (name) => within(d).getByRole('heading', { name });
    const add = within(d).getByRole('button', { name: 'Add Daily Win' });
    add.focus();
    fireEvent.click(add);
    expect(document.activeElement).toBe(heading('New Daily Win'));
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(heading('Daily Wins & Big Goals'));
    fireEvent.click(within(d).getByRole('button', { name: /^Edit Finish homework/ }));
    expect(document.activeElement).toBe(heading('Edit Daily Win'));
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    const big = within(d).getByRole('button', { name: 'Big Goals' });
    big.focus();
    fireEvent.click(big);
    expect(document.activeElement).toBe(big); // the switch keeps focus
    fireEvent.click(within(d).getByRole('button', { name: 'Add Big Goal' }));
    expect(document.activeElement).toBe(heading('New Big Goal'));
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(heading('Daily Wins & Big Goals'));
    fireEvent.click(await within(d).findByRole('button', { name: 'Save points for New bike' }));
    expect(document.activeElement).toBe(heading('Save points for a Big Goal'));
  });
});

describe('RewardForm, bigGoal variant (W7)', () => {
  const mount = (props) => render(<RewardForm isOpen onClose={() => {}} variant="bigGoal" children={kids} {...props} />);

  it('an edit sends exactly the name, the cost and a changed picture, even after the reward changes under the open form (X21)', async () => {
    const onSubmit = vi.fn(async () => true);
    const stored = { ...rewards[1], goal_epoch: 1 };
    const view = (reward) => <RewardForm isOpen onClose={() => {}} variant="bigGoal" children={kids} onSubmit={onSubmit} reward={reward} />;
    const { rerender } = render(view(stored));
    // Another device re-assigns it, shows it and un-marks it while this form is open.
    rerender(view({ ...stored, assigned_child_ids: ['c2'], visible_to_child: true, is_bigger_goal: false, description: 'Changed' }));
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Big Goal' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ title: 'Renamed', cost_points: 120 });
    expect(screen.queryByRole('alertdialog')).toBeNull(); // an edit here can end nobody's savings
  });

  it('an edit that loses a child with savings still asks nothing: no assignment is sent', async () => {
    const onSubmit = vi.fn(async () => true);
    // Omar has savings in it; this form's stale copy does not list him, so the long form would warn that he loses them.
    const withSavings = [kids[1], { ...kids[0], goals: [{ rewardId: 'r2', name: 'Telescope', cost: 120, saved: 40, to_go: 80 }] }];
    const view = (reward) => <RewardForm isOpen onClose={() => {}} variant="bigGoal" children={withSavings} onSubmit={onSubmit} reward={reward} />;
    const { rerender } = render(view(rewards[1]));
    rerender(view({ ...rewards[1], assigned_child_ids: ['c1', 'c2'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Big Goal' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(Object.keys(onSubmit.mock.calls[0][0]).sort()).toEqual(['cost_points', 'title']);
  });

  it('who it is for: named children that still exist, ids in any case; the whole family when unassigned (X4, X5)', () => {
    const { unmount } = mount({ reward: { ...rewards[1], assigned_child_ids: ['C1', 'c2', 'gone'] } });
    expect(screen.getByRole('dialog').textContent).toContain('For Omar and Lara');
    unmount();
    mount({ reward: rewards[0] });
    expect(screen.getByRole('dialog').textContent).toContain('For the whole family');
  });

  it('points needed: empty, 0 and a decimal cannot be saved; 1 and 1001 can (X28)', () => {
    mount({ forChild: kids[1], onSubmit: vi.fn() });
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Kite' } });
    const cost = screen.getByLabelText('Points needed');
    const save = () => screen.getByRole('button', { name: 'Save Big Goal' });
    for (const [value, disabled] of [['', true], ['0', true], ['1.5', true], ['1', false], ['1001', false]]) {
      fireEvent.change(cost, { target: { value } });
      expect([value, save().disabled]).toEqual([value, disabled]);
    }
  });

  it('the default variant is unchanged: its full payload and its controls', async () => {
    const onSubmit = vi.fn(async () => true);
    render(<RewardForm isOpen onClose={() => {}} children={kids} onSubmit={onSubmit} reward={rewards[1]} />);
    expect(screen.getByRole('heading', { name: 'Edit reward' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Big Goal/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ title: 'Telescope', cost_points: 120, description: 'A real one',
      visible_to_child: false, is_bigger_goal: true, assigned_child_ids: ['c1'] });
  });
});

describe('Code review of the build (decdbcf)', () => {
  it('deleting a Big Goal with savings from the pop-up: the warning, the confirmed snapshot, then the list (X11)', async () => {
    const withSavings = [kids[0], { ...kids[1], goals: [...kids[1].goals, { rewardId: 'r2', name: 'Telescope', cost: 120, saved: 40, to_go: 80 }] }];
    const d = open({ children: withSavings, child: withSavings[1] });
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: /^Edit Telescope/ }));
    fireEvent.click(within(d).getByRole('button', { name: 'Delete Big Goal' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm.textContent).toContain('This will permanently delete this Big Goal for everyone it is for.');
    expect(within(confirm).getByRole('status').textContent).toContain('Lara: 40 saved points will become available again.');
    rewardApi.list.mockResolvedValue(rewards.filter((r) => r.id !== 'r2'));
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(rewardApi.delete).toHaveBeenCalledTimes(1));
    expect(rewardApi.delete.mock.calls[0]).toEqual(['r2', { confirm_end_savings: { goal_epoch: 0, goal_child_epochs: {}, children: [{ child_id: 'c1', saved: 40 }] } }]);
    // Back on the Big Goals side, without the goal, and with nothing left open over the pop-up.
    await screen.findByRole('region', { name: "Lara's Big Goals" });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Edit Telescope/ })).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('a refused move keeps the savings view open; moving points back then closes the whole pop-up (X14)', async () => {
    saveTowards.mockRejectedValueOnce(Object.assign(new Error('Not enough points'), { status: 409 }));
    const d = open();
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Save points for New bike' }));
    fireEvent.change(within(d).getByLabelText('Points'), { target: { value: '10' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save points' }));
    await waitFor(() => expect(saveTowards).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Save points' }).disabled).toBe(false));
    expect(d.onClose).not.toHaveBeenCalled();
    expect(within(d).getByRole('heading', { name: 'Save points for a Big Goal' })).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Move points back' }));
    await waitFor(() => expect(moveBack).toHaveBeenCalledTimes(1));
    expect(moveBack.mock.calls[0].slice(0, 3)).toEqual(['c1', 'r1', 10]);
    await waitFor(() => expect(d.onClose).toHaveBeenCalledTimes(1));
  });

  it('redeeming from the pop-up closes the whole pop-up too (X14)', async () => {
    const d = open({ child: kids[0] });
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Redeem Lego set' }));
    expect(within(d).getByRole('radio', { name: /Lego set/ }).checked).toBe(true);
    fireEvent.click(within(d).getByRole('button', { name: 'Redeem Lego set' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Redeem' }));
    await waitFor(() => expect(redeemGoal).toHaveBeenCalledTimes(1));
    expect(redeemGoal.mock.calls[0].slice(0, 2)).toEqual(['c2', 'r5']);
    await waitFor(() => expect(d.onClose).toHaveBeenCalledTimes(1));
  });

  it('Escape closes the whole pop-up from the Daily Win form and from the savings view (X13)', async () => {
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Add Daily Win' }));
    fireEvent.keyDown(d, { key: 'Escape' });
    expect(d.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Save points for New bike' }));
    fireEvent.keyDown(d, { key: 'Escape' });
    expect(d.onClose).toHaveBeenCalledTimes(2);
  });

  it('while a Big Goal is being saved the pop-up cannot be closed under the request', async () => {
    let answer;
    rewardApi.create.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    const d = open();
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Add Big Goal' }));
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'Kite' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save Big Goal' }));
    await waitFor(() => expect(rewardApi.create).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(d, { key: 'Escape' });
    expect(d.onClose).not.toHaveBeenCalled();
    answer({ id: 'r9' });
    await screen.findByRole('region', { name: "Lara's Big Goals" });
    fireEvent.keyDown(d, { key: 'Escape' });
    expect(d.onClose).toHaveBeenCalledTimes(1);
  });

  it('Enter in the Big Goal form saves it', async () => {
    const d = open();
    await toBigGoals(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Add Big Goal' }));
    fireEvent.change(within(d).getByLabelText('What is it?'), { target: { value: 'Kite' } });
    fireEvent.keyDown(within(d).getByLabelText('What is it?'), { key: 'Enter' });
    await waitFor(() => expect(rewardApi.create).toHaveBeenCalledTimes(1));
    expect(rewardApi.create.mock.calls[0][0]).toMatchObject({ title: 'Kite', cost_points: 100, assigned_child_ids: ['c1'] });
  });

  it('Big Goals: loading says so; a failed refresh keeps the list already shown (X26)', async () => {
    let release;
    rewardApi.list.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const d = open();
    await listed(d);
    fireEvent.click(within(d).getByRole('button', { name: 'Big Goals' }));
    expect(within(d).getByText('Loading Big Goals…')).toBeTruthy();
    release(rewards);
    await within(d).findByRole('button', { name: /^Edit New bike/ });
    rewardApi.list.mockRejectedValue(new Error('offline'));
    await act(async () => { await d.client.invalidateQueries({ queryKey: ['rewards'] }); });
    expect(within(d).getByRole('button', { name: /^Edit New bike/ })).toBeTruthy();
    expect(within(d).queryByText('Could not load Big Goals.')).toBeNull();
  });

  it('a Big Goal edit sends a changed picture, and only then (W7)', async () => {
    const onSubmit = vi.fn(async () => true);
    render(<RewardForm isOpen onClose={() => {}} variant="bigGoal" children={kids} onSubmit={onSubmit} reward={rewards[1]} />);
    expect(screen.queryByRole('button', { name: 'Fun & games' })).toBeNull(); // the pictures open only on Change
    fireEvent.click(screen.getByRole('button', { name: 'Change picture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fun & games' }));
    fireEvent.click(screen.getByRole('button', { name: 'Game Controller' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Big Goal' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ title: 'Telescope', cost_points: 120, icon_key: expect.stringContaining('controller') });
  });

  it('SavingsDialog: a goal that is not an option is ignored; with nothing to save for it says so, with no empty group', () => {
    const client = new QueryClient();
    const view = (props) => <QueryClientProvider client={client}><SavingsDialog open onClose={() => {}} child={kids[1]} {...props} /></QueryClientProvider>;
    // Zoo trip (r3) is asked for, so it is not an option: the opening falls back to the leading goal.
    const { unmount } = render(view({ goalRewards: rewards.filter((r) => r.is_bigger_goal), initialGoalId: 'r3' }));
    expect(screen.getByRole('radio', { name: /New bike/ }).checked).toBe(true);
    expect(screen.queryByRole('radio', { name: /Zoo trip/ })).toBeNull();
    unmount();
    render(view({ goalRewards: [] }));
    expect(screen.getByText('No Big Goals to save for yet.')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
  });
});

