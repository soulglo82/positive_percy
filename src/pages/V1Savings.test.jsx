// D1 savings screens (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §19.3):
// Children "Saving for something bigger" and its Edit dialog, Child View's
// "Saved towards" and "My next big adventure", Home's goal, the Rewards
// "Bigger rewards" section and form switch, Spend leaving goals out, and the
// Activity rows. Every figure comes from the server (child.goals).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = { children: [], rewards: [] };
vi.mock('@/api/entities', () => ({
  Child: { list: vi.fn(async () => state.children), update: vi.fn(async () => ({})), create: vi.fn(), delete: vi.fn() },
  Reward: { list: vi.fn(async () => state.rewards), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }), getToken: () => 't' }));
const saveTowards = vi.fn();
const moveBack = vi.fn();
const redeemGoal = vi.fn();
const undoSavings = vi.fn();
vi.mock('@/lib/savings', async (orig) => ({
  ...(await orig()),
  saveTowards: (...a) => saveTowards(...a),
  moveBack: (...a) => moveBack(...a),
  redeemGoal: (...a) => redeemGoal(...a),
  undoSavings: (...a) => undoSavings(...a),
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a) => toastError(...a), success: (...a) => toastSuccess(...a), info: vi.fn() } }));
vi.mock('@/lib/todaysGoals', async (orig) => ({ ...(await orig()), loadTodaysGoals: vi.fn(async () => ({ date: '2026-11-21', goals: [] })) }));

import Children from './Children';
import ChildView, { childRewards, visibleGoals } from './ChildView';
import Rewards from './Rewards';
import { WorkingTowards } from '../components/home/HomeSections';
import RewardForm from '../components/rewards/RewardForm';
import SpendRewardsModal from '../components/child/SpendRewardsModal';
import { rowText, rowIconKind } from './Activity';
import { leadingGoal } from '@/lib/savings';

const R = (id, title, cost, extra = {}) => ({ id, title, cost_points: cost, visible_to_child: true, assigned_child_ids: [], ...extra });
const goal = (rewardId, name, cost, saved) => ({ rewardId, name, cost, saved, to_go: Math.max(0, cost - saved), icon_key: null, emoji: '🚲', image_url: null });
const lara = {
  id: 'c1', name: 'Lara', created_date: '2026-01-01', week_points: 18, weekly_target: 25,
  total_points: 320, available_points: 200, saved_total: 120, reward_stack_priced: [],
  goals: [goal('g1', 'Bike', 300, 120)],
};

function mount(node, url = '/') {
  window.history.replaceState({}, '', url);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  for (const f of [saveTowards, moveBack, redeemGoal, undoSavings, toastSuccess, toastError]) f.mockReset();
  state.children = [lara];
  state.rewards = [R('g1', 'Bike', 300, { is_bigger_goal: true }), R('g2', 'Tent', 80, { is_bigger_goal: true }), R('r1', 'Movie night', 25)];
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
});

describe('Children: Saving for something bigger', () => {
  it('shows each goal from the server, with the approved figures, and leaves goals out of weekly treats', async () => {
    mount(<Children />);
    expect(await screen.findByRole('heading', { name: 'Saving for something bigger' })).toBeTruthy();
    expect(screen.getByText('120 of 300 points saved')).toBeTruthy();
    expect(screen.getAllByText('180 to go').length).toBeGreaterThan(0);
    expect(screen.getByText('Weekly target and bigger goal')).toBeTruthy();
    expect(screen.getByText('Bike: 180 to go')).toBeTruthy();
    // Goals are not weekly treats.
    const treats = screen.getByRole('heading', { name: 'Weekly treats to choose from' }).closest('div').parentElement;
    expect(within(treats).queryByText('Bike')).toBeNull();
    expect(within(treats).getByText('Movie night')).toBeTruthy();
  });

  it('Edit: save is limited by available and by what the goal still needs; move back by what is saved', async () => {
    mount(<Children />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit saving for something bigger for Lara' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByText('Saved: 120')).toBeTruthy();
    expect(within(d).getByText('Save up to 180 · Move back up to 120')).toBeTruthy(); // min(200 available, 180 to go)
    const input = within(d).getByLabelText('Points');
    const saveBtn = within(d).getByRole('button', { name: 'Save points' });
    const backBtn = within(d).getByRole('button', { name: 'Move points back' });
    fireEvent.change(input, { target: { value: '181' } });
    expect(saveBtn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '121' } });
    expect(backBtn.disabled).toBe(true);
    expect(saveBtn.disabled).toBe(false);
    fireEvent.change(input, { target: { value: '0' } });
    expect(saveBtn.disabled).toBe(true);
    // The other goal: nothing saved, so nothing to move back.
    fireEvent.click(within(d).getByRole('radio', { name: /Tent/ }));
    expect(within(d).getByText('Saved: 0')).toBeTruthy();
    expect(within(d).getByText('Save up to 80 · Move back up to 0')).toBeTruthy();
  });

  it('Edit: a save sends one request with the amount and offers Undo', async () => {
    saveTowards.mockResolvedValue({ event: { id: 'e1' }, child: lara });
    mount(<Children />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit saving for something bigger for Lara' }));
    const d = await screen.findByRole('dialog');
    fireEvent.change(within(d).getByLabelText('Points'), { target: { value: '30' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save points' }));
    await waitFor(() => expect(saveTowards).toHaveBeenCalledTimes(1));
    const [childId, rewardId, points, requestId] = saveTowards.mock.calls[0];
    expect({ childId, rewardId, points }).toEqual({ childId: 'c1', rewardId: 'g1', points: 30 });
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    // Closed, so the toast's Undo is usable (a modal dialog blocks the page).
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [message, opts] = toastSuccess.mock.calls[0];
    expect(message).toBe('Saved 30 points towards Bike');
    expect(opts.action.label).toBe('Undo');
    undoSavings.mockResolvedValue({});
    await opts.action.onClick();
    expect(undoSavings).toHaveBeenCalledWith('e1', expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it('Edit: a refused save shows the stale-figures message', async () => {
    saveTowards.mockRejectedValue(Object.assign(new Error('Not enough points'), { status: 400 }));
    mount(<Children />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit saving for something bigger for Lara' }));
    const d = await screen.findByRole('dialog');
    fireEvent.change(within(d).getByLabelText('Points'), { target: { value: '10' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save points' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("That didn't work: the figures changed. Check them and try again."));
  });

  it('Redeem: enabled only when saved + available covers the cost; confirms what it spends', async () => {
    redeemGoal.mockResolvedValue({ redemption: { id: 'red1' }, child: lara });
    mount(<Children />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit saving for something bigger for Lara' }));
    const d = await screen.findByRole('dialog');
    const redeem = within(d).getByRole('button', { name: 'Redeem Bike' });
    expect(redeem.disabled).toBe(false); // 120 + 200 >= 300
    fireEvent.click(redeem);
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText("This will spend 300 points from Lara's balance: 120 saved and 180 available.")).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Redeem' }));
    await waitFor(() => expect(redeemGoal).toHaveBeenCalledWith('c1', 'g1', expect.any(String)));
  });

  it('Redeem is disabled when the points do not cover it', async () => {
    state.children = [{ ...lara, available_points: 100 }]; // 120 + 100 < 300
    mount(<Children />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit saving for something bigger for Lara' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('button', { name: 'Redeem Bike' }).disabled).toBe(true);
  });

  it('no bigger goals: a pointer to Rewards and no Edit', async () => {
    state.rewards = [R('r1', 'Movie night', 25)];
    state.children = [{ ...lara, goals: [], saved_total: 0 }];
    mount(<Children />);
    expect(await screen.findByText('No bigger goals yet.', { exact: false })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mark a reward as a bigger goal' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit saving for something bigger/ })).toBeNull();
  });
});

describe('Child View', () => {
  it('"Saved towards" and "My next big adventure" from the server; no controls; goals are not choosable', async () => {
    mount(<ChildView />, '/childview?child=c1');
    expect(await screen.findByText('Saved towards Bike')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'My next big adventure' })).toBeTruthy();
    expect(screen.getByText('180 points to go')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save points|Move points back|Redeem/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ask a parent for Bike/ })).toBeNull();
    expect(childRewards(state.rewards, lara).map((r) => r.id)).toEqual(['r1']);
  });

  it('S5: a goal hidden from children shows on neither the tile nor the card', async () => {
    state.rewards = [R('g1', 'Bike', 300, { is_bigger_goal: true, visible_to_child: false }), R('r1', 'Movie night', 25)];
    expect(visibleGoals(state.rewards, lara)).toEqual([]);
    mount(<ChildView />, '/childview?child=c1');
    expect(await screen.findByText('Ready to use')).toBeTruthy();
    expect(screen.queryByText(/Saved towards/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'My next big adventure' })).toBeNull();
  });
});

describe('Home, Rewards, Spend and Activity', () => {
  it('Home shows the goal with the most saved, labelled, above the requests', () => {
    const child = { ...lara, goals: [goal('g2', 'Tent', 80, 10), goal('g1', 'Bike', 300, 120)], reward_stack_priced: [{ rewardId: 'r1', name: 'Movie night', cost: 25, stackIndex: 0 }] };
    mount(<WorkingTowards child={child} />);
    expect(screen.getByText('Saving for something bigger')).toBeTruthy();
    expect(screen.getByText('120 of 300 points saved')).toBeTruthy();
    expect(screen.queryByText('10 of 80 points saved')).toBeNull();
    expect(screen.getByText('25 points · Ready when a parent agrees')).toBeTruthy();
    expect(leadingGoal([goal('a', 'A', 100, 50), goal('b', 'B', 60, 50)]).rewardId).toBe('b'); // tie: closer to done
  });

  it('Rewards lists goals under "Bigger rewards" with the approved subtitle', async () => {
    mount(<Rewards />);
    const section = (await screen.findByRole('heading', { name: 'Bigger rewards' })).closest('section');
    expect(within(section).getByText('Bike')).toBeTruthy();
    expect(within(section).getByText('300 points · Bigger achievement')).toBeTruthy();
    expect(within(section).queryByText('Movie night')).toBeNull();
    expect(screen.getByText('Movie night')).toBeTruthy();
  });

  it('the reward form sends the Bigger goal switch', async () => {
    const onSubmit = vi.fn(async () => true);
    mount(<RewardForm isOpen onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Reward name'), { target: { value: 'Scooter' } });
    const sw = screen.getByRole('checkbox', { name: /Bigger goal/ });
    expect(sw.getAttribute('aria-describedby')).toBe('reward-bigger-goal-help');
    expect(screen.getByText('Save points towards this reward over time')).toBeTruthy();
    fireEvent.click(sw);
    fireEvent.click(screen.getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Scooter', is_bigger_goal: true });
  });

  it('editing a goal starts with the switch on', () => {
    mount(<RewardForm isOpen onClose={() => {}} onSubmit={vi.fn()} reward={R('g1', 'Bike', 300, { is_bigger_goal: true })} />);
    expect(screen.getByRole('checkbox', { name: /Bigger goal/ }).getAttribute('aria-checked')).toBe('true');
  });

  it("Home's Spend list leaves bigger goals out (they are redeemed from Children)", () => {
    mount(<SpendRewardsModal isOpen onClose={() => {}} child={{ ...lara, available_points: 400 }} rewards={state.rewards} />);
    const d = screen.getByRole('dialog');
    expect(within(d).queryByText('Bike')).toBeNull();
    expect(within(d).getByText('Movie night')).toBeTruthy();
  });

  it('Activity: savings rows use the proposed wording and are not balance rows', () => {
    const t = '2026-11-21T10:00:00Z';
    expect(rowText({ type: 'saving', points: 20, label: 'Bike', created_date: t }, 'UTC')).toMatchObject({ lead: 'saved 20 points towards', what: 'Bike' });
    expect(rowText({ type: 'moved_back', points: 1, label: 'Bike', created_date: t }, 'UTC')).toMatchObject({ lead: 'moved 1 point back from', what: 'Bike' });
    expect(rowIconKind({ type: 'saving' })).toBe('saving');
    expect(rowIconKind({ type: 'moved_back' })).toBe('saving');
  });
});
