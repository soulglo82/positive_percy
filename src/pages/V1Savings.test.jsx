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

  it('Edit: a refused save with no message shows the stale-figures message', async () => {
    saveTowards.mockRejectedValue(Object.assign(new Error(''), { status: 409 }));
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
    // §20.1: why saved points stopped counting, with child, goal, amount and cause.
    const ended = (note) => rowText({ type: 'savings_ended', points: 40, label: 'Bike', note, child_name: 'Lara', created_date: t }, 'UTC');
    expect(ended('unmarked')).toMatchObject({ possessive: true, lead: 'savings for', what: 'Bike', after: 'ended' });
    expect(ended('unmarked').sub).toContain('40 saved points released · Bigger goal turned off');
    expect(ended('reassigned').sub).toContain('No longer for Lara');
    expect(ended('deleted').sub).toContain('Reward deleted');
    expect(rowIconKind({ type: 'savings_ended' })).toBe('saving');
  });
});

describe('code review of the screens', () => {
  it('Major: un-marking a goal, or taking it from a child, warns per child and asks before saving', async () => {
    const onSubmit = vi.fn(async () => true);
    const kids = [{ id: 'c1', name: 'Lara', goals: [goal('g1', 'Bike', 300, 120)] }, { id: 'c2', name: 'Omar', goals: [goal('g1', 'Bike', 300, 1)] }];
    mount(<RewardForm isOpen onClose={() => {}} onSubmit={onSubmit} children={kids} reward={R('g1', 'Bike', 300, { is_bigger_goal: true, goal_epoch: 1, goal_child_epochs: {} })} />);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Bigger goal/ }));
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Lara: 120 saved points will become available again.');
    expect(status).toContain('Omar: 1 saved point will become available again.');
    expect(status).toContain("Past savings won't be restored if you re-enable the goal.");
    fireEvent.click(screen.getByRole('button', { name: 'Save reward' }));
    const alert = await screen.findByRole('alertdialog');
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole('button', { name: 'Keep saving' }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save reward' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // §21: the confirmation is the snapshot shown, not a boolean.
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ is_bigger_goal: false, confirm_end_savings: {
      goal_epoch: 1, goal_child_epochs: {}, children: [{ child_id: 'c1', saved: 120 }, { child_id: 'c2', saved: 1 }] } });
  });

  it('Major: assigning a goal to one child (from all) warns for the one who loses it; nothing saved means no warning', async () => {
    const kids = [{ id: 'c1', name: 'Lara', goals: [] }, { id: 'c2', name: 'Omar', goals: [goal('g1', 'Bike', 300, 40)] }];
    const onSubmit = vi.fn(async () => true);
    mount(<RewardForm isOpen onClose={() => {}} onSubmit={onSubmit} children={kids} reward={R('g1', 'Bike', 300, { is_bigger_goal: true })} />);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Lara/ })); // Omar loses it
    expect(screen.getByRole('status').textContent).toContain('Omar: 40 saved points');
    expect(screen.getByRole('status').textContent).not.toContain('Lara');
    fireEvent.click(screen.getByRole('checkbox', { name: /Lara/ })); // back to all
    fireEvent.click(screen.getByRole('checkbox', { name: /Omar/ })); // Lara loses it, but has nothing saved
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled()); // no confirmation needed
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('confirm_end_savings');
  });

  it('"Fully saved!" instead of "0 to go", for the parent and in Child View; "Ready to redeem" in the dialog', async () => {
    state.children = [{ ...lara, goals: [goal('g1', 'Bike', 300, 300)], available_points: 20, saved_total: 300 }];
    mount(<ChildView />, '/childview?child=c1');
    expect(await screen.findByText('Fully saved!')).toBeTruthy();
    expect(screen.queryByText(/0 points to go/)).toBeNull();
  });

  it('Children: "Fully saved!" on the card and in the milestone; dialog shows Ready to redeem and the excess note', async () => {
    state.children = [{ ...lara, goals: [{ ...goal('g1', 'Bike', 300, 340) }], available_points: 0, saved_total: 340 }];
    mount(<Children />);
    expect((await screen.findAllByText('Fully saved!')).length).toBeGreaterThan(0);
    expect(screen.getByText('Bike: Fully saved!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit saving for something bigger for Lara' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByText('340 of 300 points saved · Ready to redeem')).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Redeem Bike' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText('40 saved points are more than this goal needs. They stay saved for Bike, and you can move them back.')).toBeTruthy();
  });

  it('a goal already requested is not offered (S1); the server message is shown when it refuses', async () => {
    state.children = [{ ...lara, reward_stack_priced: [{ rewardId: 'g2', name: 'Tent', cost: 80, stackIndex: 0 }] }];
    saveTowards.mockRejectedValue(Object.assign(new Error('More than this goal needs'), { status: 400 }));
    mount(<Children />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit saving for something bigger for Lara' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).queryByRole('radio', { name: /Tent/ })).toBeNull();
    fireEvent.change(within(d).getByLabelText('Points', { exact: true }), { target: { value: '5' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save points' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('More than this goal needs'));
  });

  it('a retry after a lost reply reuses the request id, even after another action; a refusal does not', async () => {
    saveTowards.mockRejectedValueOnce(Object.assign(new Error(''), { status: 503 }));
    moveBack.mockRejectedValueOnce(Object.assign(new Error('Not enough points saved'), { status: 400 }));
    saveTowards.mockResolvedValueOnce({ event: { id: 'e9' }, child: lara });
    mount(<Children />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit saving for something bigger for Lara' }));
    const d = await screen.findByRole('dialog');
    const input = within(d).getByLabelText('Points', { exact: true });
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save points' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't save that. Check your connection and try again."));
    fireEvent.click(within(d).getByRole('button', { name: 'Move points back' }));
    await waitFor(() => expect(moveBack).toHaveBeenCalled());
    fireEvent.click(within(d).getByRole('button', { name: 'Save points' }));
    await waitFor(() => expect(saveTowards).toHaveBeenCalledTimes(2));
    expect(saveTowards.mock.calls[1][3]).toBe(saveTowards.mock.calls[0][3]);
  });

  it('a double tap sends one request', async () => {
    let resolve;
    saveTowards.mockImplementation(() => new Promise((r) => { resolve = r; }));
    mount(<Children />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit saving for something bigger for Lara' }));
    const d = await screen.findByRole('dialog');
    fireEvent.change(within(d).getByLabelText('Points', { exact: true }), { target: { value: '10' } });
    const btn = within(d).getByRole('button', { name: 'Save points' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(saveTowards).toHaveBeenCalledTimes(1);
    resolve({ event: { id: 'e1' }, child: lara });
  });

  it('reopening starts on the goal Home leads with, with the amount cleared', async () => {
    state.children = [{ ...lara, goals: [goal('g2', 'Tent', 80, 50), goal('g1', 'Bike', 300, 50)] }]; // tie: Tent is closer
    mount(<Children />);
    const edit = await screen.findByRole('button', { name: 'Edit saving for something bigger for Lara' });
    fireEvent.click(edit);
    let d = await screen.findByRole('dialog');
    expect(within(d).getByRole('radio', { name: /Tent/ }).checked).toBe(true);
    fireEvent.click(within(d).getByRole('radio', { name: /Bike/ }));
    fireEvent.change(within(d).getByLabelText('Points', { exact: true }), { target: { value: '7' } });
    fireEvent.click(within(d).getAllByRole('button', { name: 'Close' }).at(-1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(edit);
    d = await screen.findByRole('dialog');
    expect(within(d).getByRole('radio', { name: /Tent/ }).checked).toBe(true);
    expect(within(d).getByLabelText('Points', { exact: true }).value).toBe('');
  });

  it('Children lists a marked goal with nothing saved, in the same order as Home', async () => {
    mount(<Children />);
    expect(await screen.findByText('120 of 300 points saved')).toBeTruthy();
    expect(screen.getByText('0 of 80 points saved')).toBeTruthy();
  });

  it('Rewards names the other rewards beside "Bigger rewards"', async () => {
    mount(<Rewards />);
    expect(await screen.findByRole('heading', { name: 'Other rewards' })).toBeTruthy();
    state.rewards = [R('r1', 'Movie night', 25)];
  });

  it('the savings Undo offers a retry when the connection fails', async () => {
    const { undoSavingsAction } = await import('../components/savings/SavingsDialog');
    undoSavings.mockRejectedValueOnce(Object.assign(new Error(''), { status: 503 }));
    const client = new QueryClient();
    await undoSavingsAction('e1', client, 'fixed-id')();
    const [, opts] = toastError.mock.calls[0];
    expect(opts.action.label).toBe('Try again');
    undoSavings.mockResolvedValueOnce({ child: { name: 'Lara', available_points: 200 } });
    await opts.action.onClick();
    expect(undoSavings.mock.calls.map((c) => c[1])).toEqual(['fixed-id', 'fixed-id']);
    expect(toastSuccess).toHaveBeenCalledWith('Undone. Lara has 200 points available.');
  });
});

describe('§21: the confirmation is bound to what the parent saw', () => {
  const serverSaw = {
    ending: [{ child_id: 'c1', name: 'Lara', saved: 70 }, { child_id: 'c2', name: 'Omar', saved: 5 }],
    snapshot: { goal_epoch: 1, goal_child_epochs: {}, children: [{ child_id: 'c1', saved: 70 }, { child_id: 'c2', saved: 5 }] },
  };

  it("a 409 shows the server's list, even when this page saw nothing; the next confirmation sends the server's snapshot", async () => {
    const onSubmit = vi.fn()
      .mockResolvedValueOnce({ needsConfirm: serverSaw })
      .mockResolvedValueOnce(true);
    const kids = [{ id: 'c1', name: 'Lara', goals: [] }, { id: 'c2', name: 'Omar', goals: [] }]; // stale: nothing saved
    mount(<RewardForm isOpen onClose={() => {}} onSubmit={onSubmit} children={kids} reward={R('g1', 'Bike', 300, { is_bigger_goal: true, goal_epoch: 1 })} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Bigger goal/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save reward' })); // no local warning: sent unconfirmed
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('confirm_end_savings');
    const alert = await screen.findByRole('alertdialog');
    expect(alert.textContent).toContain('Lara: 70 saved points will become available again.');
    expect(alert.textContent).toContain('Omar: 5 saved points will become available again.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0].confirm_end_savings).toEqual(serverSaw.snapshot);
  });

  it("changing the goal switch or the children drops the server's list (it no longer describes this change)", async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce({ needsConfirm: serverSaw });
    const kids = [{ id: 'c1', name: 'Lara', goals: [] }, { id: 'c2', name: 'Omar', goals: [] }];
    mount(<RewardForm isOpen onClose={() => {}} onSubmit={onSubmit} children={kids} reward={R('g1', 'Bike', 300, { is_bigger_goal: true, goal_epoch: 1 })} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Bigger goal/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save reward' }));
    const alert = await screen.findByRole('alertdialog');
    fireEvent.click(within(alert).getByRole('button', { name: 'Keep saving' }));
    expect(screen.getByRole('status').textContent).toContain('Lara: 70');
    fireEvent.click(screen.getByRole('checkbox', { name: /Bigger goal/ })); // back on: nothing ends
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('delete lists each child who loses savings and sends that snapshot; a 409 shows the server list and asks again', async () => {
    const onDelete = vi.fn().mockResolvedValueOnce({ needsConfirm: serverSaw }).mockResolvedValueOnce(true);
    const kids = [{ id: 'c1', name: 'Lara', goals: [goal('g1', 'Bike', 300, 40)] }, { id: 'c2', name: 'Omar', goals: [] }];
    mount(<RewardForm isOpen onClose={() => {}} onSubmit={vi.fn()} onDelete={onDelete} children={kids}
      reward={R('g1', 'Bike', 300, { is_bigger_goal: true, goal_epoch: 1, goal_child_epochs: {} })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Reward' }));
    let alert = await screen.findByRole('alertdialog');
    expect(alert.textContent).toContain('Lara: 40 saved points will become available again.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onDelete.mock.calls[0][1]).toEqual({ goal_epoch: 1, goal_child_epochs: {}, children: [{ child_id: 'c1', saved: 40 }] });
    alert = await screen.findByRole('alertdialog');
    await waitFor(() => expect(alert.textContent).toContain('Lara: 70 saved points'));
    expect(alert.textContent).toContain('Omar: 5 saved points');
    fireEvent.click(within(alert).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
    expect(onDelete.mock.calls[1][1]).toEqual(serverSaw.snapshot);
  });

  it('deleting a reward with no savings sends no snapshot', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    mount(<RewardForm isOpen onClose={() => {}} onSubmit={vi.fn()} onDelete={onDelete} children={[{ id: 'c1', name: 'Lara', goals: [] }]} reward={R('r1', 'Movie night', 25)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Reward' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    expect(onDelete.mock.calls[0][1]).toBeNull();
  });
});

