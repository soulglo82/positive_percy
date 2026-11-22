// V1-B (docs/engineering/V1-B-DESIGN.md §2, §3, §5): the Children page and
// the request-only Child View.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, within, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = { children: [], rewards: [] };
vi.mock('@/api/entities', () => ({
  Child: { list: vi.fn(async () => state.children), update: vi.fn(async () => ({})), create: vi.fn(), delete: vi.fn() },
  Reward: { list: vi.fn(async () => state.rewards), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }), getToken: () => 't' }));
const requestReward = vi.fn();
vi.mock('@/lib/points', async (orig) => ({ ...(await orig()), requestReward: (...a) => requestReward(...a) }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a) => toastError(...a), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/todaysGoals', async (orig) => ({
  ...(await orig()),
  loadTodaysGoals: vi.fn(async () => ({
    date: '2026-11-18', weekday: 3,
    goals: [
      { id: 'g1', child_id: 'c1', title: 'Finish homework', category_id: 'k2', category_name: 'Learning', category_points: 1,
        schedule_kind: 'one_off', scheduled_date: '2026-11-18', weekdays: [], completion_id: 'x1' },
      { id: 'g2', child_id: 'c1', title: 'Help set the table', category_id: 'k1', category_name: 'Helping', category_points: 1,
        schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7], start_date: '2026-11-02', completion_id: 'x2' },
      { id: 'g3', child_id: 'c1', title: 'Read for 15 minutes', category_id: 'k3', category_name: 'Reading', category_points: 1,
        schedule_kind: 'weekly', weekdays: [1, 3, 5], start_date: '2026-11-02', completion_id: null },
      { id: 'g4', child_id: 'c2', title: 'Practise piano', category_id: 'k3', category_name: 'Reading', category_points: 2,
        schedule_kind: 'weekly', weekdays: [2], start_date: '2026-11-02', completion_id: 'x4' },
    ],
  })),
}));

import Children from './Children';
import ChildView, { rewardState, childRewards } from './ChildView';

const lara = { id: 'c1', name: 'Lara', created_date: '2026-01-01', week_points: 18, weekly_target: 25, total_points: 115, available_points: 90, reward_stack_priced: [] };
const omar = { id: 'c2', name: 'Omar', created_date: '2026-01-02', week_points: 10, weekly_target: 20, total_points: 40, available_points: 40, reward_stack_priced: [] };
const R = (id, title, cost, extra = {}) => ({ id, title, cost_points: cost, visible_to_child: true, assigned_child_ids: [], ...extra });

function mount(Page, url = '/') {
  window.history.replaceState({}, '', url);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><Page /></MemoryRouter></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  requestReward.mockReset();
  toastError.mockReset();
  state.children = [omar, lara];
  state.rewards = [R('r1', 'Movie night', 25), R('r2', 'Gaming time', 20), R('r3', 'Secret', 5, { visible_to_child: false }),
    R('r4', 'Omar only', 1, { assigned_child_ids: ['c2'] })];
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
});

describe('Children page (§2)', () => {
  it('1 available point is singular on the weekly-target card (code review)', async () => {
    state.children = [{ ...lara, available_points: 1 }];
    mount(Children);
    await screen.findByRole('heading', { name: "Lara's page" });
    expect([...document.querySelectorAll('[data-figure]')].map((f) => f.querySelector('p').textContent)[1]).toBe('1 point Available now');
  });

  it('approved copy and server figures for the oldest child', async () => {
    mount(Children);
    expect(await screen.findByRole('heading', { name: 'Children' })).toBeTruthy();
    expect(screen.getByText("See what every child has achieved and what they're saving for.")).toBeTruthy();
    expect(screen.getByRole('heading', { name: "Lara's page" })).toBeTruthy();
    expect(screen.getByText('18 of 25 weekly points · 90 available')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View as child' }).getAttribute('href')).toBe('/childview?child=c1');
    expect(screen.getByRole('heading', { name: "Lara's weekly target" })).toBeTruthy();
    // The same figure as Child View's points card (owner, 22 Nov): an icon, the
    // figure with its unit, and the approved label beneath.
    const figures = [...document.querySelectorAll('[data-figure]')].map((f) => f.querySelector('p').textContent);
    expect(figures).toEqual(['18 / 25 Earned this week', '90 points Available now']);
    expect([...document.querySelectorAll('[data-figure] [data-icon]')].map((i) => i.getAttribute('data-icon')))
      .toEqual(['phosphor:target:duotone', 'phosphor:piggy-bank:duotone']);
    expect(screen.getByText("7 to reach this week's target")).toBeTruthy();
    expect(screen.getByText('7 weekly points to go')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'All rewards' })).toBeTruthy();
    // D1 (savings §19.3): the savings section and the approved milestone
    // subtitle; with no bigger goals there is nothing to Edit. The
    // design-only note never ships.
    expect(screen.getByRole('heading', { name: 'Saving for something bigger' })).toBeTruthy();
    expect(screen.getByText('No bigger goals yet.', { exact: false })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit saving for something bigger/ })).toBeNull();
    expect(document.body.textContent).not.toContain('Multiple rewards can be shown');
    expect(screen.getByText('Weekly target and bigger goal')).toBeTruthy();
  });

  it('goals of this child only, with today\'s completions counted', async () => {
    mount(Children);
    expect(await screen.findByText('Learning · Today · +1 point')).toBeTruthy();
    expect(screen.getByText('Helping · Daily · +1 point')).toBeTruthy();
    expect(screen.getByText('Reading · Mon, Wed, Fri · +1 point')).toBeTruthy();
    expect(screen.queryByText('Practise piano')).toBeNull();
    expect(screen.getByText('2 today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage all goals for Lara' })).toBeTruthy();
  });

  it('treats: hidden ones shown tagged, other children\'s left out; Edit opens the reward form', async () => {
    mount(Children);
    await screen.findByRole('heading', { name: 'Weekly treats to choose from' });
    expect(screen.getByText('Secret')).toBeTruthy();
    expect(screen.getByText('Hidden from children')).toBeTruthy();
    expect(screen.queryByText('Omar only')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Movie night' }));
    expect(await screen.findByRole('heading', { name: 'Edit reward' })).toBeTruthy(); // approved C1
  });

  it('E3: the target reached shows 0, as the approved code does', async () => {
    state.children = [{ ...lara, week_points: 30 }];
    mount(Children);
    expect(await screen.findByText("0 to reach this week's target")).toBeTruthy();
    expect(screen.getByText('0 weekly points to go')).toBeTruthy();
  });

  it('?child= picks the child; an unknown id falls back to the oldest (E2)', async () => {
    mount(Children, '/children?child=c2');
    expect(await screen.findByRole('heading', { name: "Omar's page" })).toBeTruthy();
    cleanupAndMount('/children?child=nope');
    expect(await screen.findByRole('heading', { name: "Lara's page" })).toBeTruthy();
  });

  it('New goal opens the goal form; a goal\'s Edit opens it filled in; weekly target Edit has no Delete', async () => {
    mount(Children);
    fireEvent.click(await screen.findByRole('button', { name: 'New goal' }));
    let d = await screen.findByRole('dialog');
    expect(within(d).getByRole('heading', { name: 'New goal' })).toBeTruthy();
    fireEvent.keyDown(d, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Edit Finish homework' }));
    d = await screen.findByRole('dialog');
    expect(within(d).getByDisplayValue('Finish homework')).toBeTruthy();
    fireEvent.keyDown(d, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: "Edit Lara's weekly target" }));
    d = await screen.findByRole('dialog');
    expect(within(d).queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('E1: no children shows the welcome card', async () => {
    state.children = [];
    mount(Children);
    expect(await screen.findByRole('button', { name: /first child/i })).toBeTruthy();
  });
});

function cleanupAndMount(url) {
  cleanup();
  mount(Children, url);
}

describe('Child View states (§3)', () => {
  const child = { ...lara, available_points: 20, reward_stack_priced: [{ rewardId: 'r1', name: 'Movie night', cost: 25, stackIndex: 0 }] };
  it('requested wins over affordability (E5b); affordable asks; otherwise how many more (E5)', () => {
    expect(rewardState(R('r1', 'Movie night', 25), child)).toEqual({ kind: 'requested' });
    expect(rewardState(R('r2', 'Gaming time', 20), child)).toEqual({ kind: 'ask' });
    expect(rewardState(R('r5', 'Bike ride', 25), child)).toEqual({ kind: 'need', more: 5 });
    // E4d: no available_points falls back to the total.
    expect(rewardState(R('r5', 'Bike ride', 25), { ...lara, available_points: undefined, total_points: 30 })).toEqual({ kind: 'ask' });
  });
  it('visible and assigned rewards, plus requested ones even if hidden since (E4c, E6, E7)', () => {
    const asked = { ...lara, reward_stack_priced: [{ rewardId: 'r3', name: 'Secret', cost: 5, stackIndex: 0 }] };
    expect(childRewards(state.rewards, lara).map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(childRewards(state.rewards, asked).map((r) => r.id)).toEqual(['r3', 'r2', 'r1']);
    expect(childRewards(state.rewards, omar).map((r) => r.id)).toEqual(['r4', 'r2', 'r1']);
  });
});

describe('Child View page (§3)', () => {
  it('approved copy; no Spend, no Edit, no visibility tags (D5, D8)', async () => {
    state.children = [{ ...lara, reward_stack_priced: [{ rewardId: 'r1', name: 'Movie night', cost: 25, stackIndex: 0 }] }];
    mount(ChildView);
    expect(await screen.findByRole('heading', { name: 'My Percy adventure' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Back to Home' })).toBeTruthy();
    expect(screen.getByText('A child-friendly view of goals, points and rewards. No independent child account.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: "You're doing great, Lara!" })).toBeTruthy();
    // Owner review 22 Nov (design §10): one figure with a piggy bank, its unit beside it and the label beneath.
    const figure = document.querySelector('[data-available]');
    expect(figure.textContent).toBe('90');
    expect(figure.closest('p').textContent).toBe('90 points Ready to use'); // real spaces, not "90points"
    const picture = figure.closest('[data-figure]').querySelector('[data-icon]');
    expect(picture.getAttribute('data-icon')).toBe('phosphor:piggy-bank:duotone');
    expect(picture.parentElement.closest('[aria-hidden="true"]')).toBeTruthy(); // the tile around it, not the svg's own attribute
    expect(document.querySelector('img[src*="stickies-star"]')).toBeNull();
    expect(screen.getByText('25 points · Ready when a parent agrees')).toBeTruthy();
    expect(screen.getByText('20 points · Ask a parent')).toBeTruthy();
    expect(screen.getByText('Choosing a reward is a request. Only a parent-authorised confirmation can spend points.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Spend|Edit/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Visible to children|Hidden from children|Saved towards|My next big adventure/);
  });

  it('the points figure is singular for 1, plain for 0, and falls back when the server sends none (design §10.4)', async () => {
    const sentence = () => document.querySelector('[data-available]').closest('p').textContent;
    state.children = [{ ...lara, available_points: 1 }];
    mount(ChildView);
    await screen.findByRole('heading', { name: "You're doing great, Lara!" });
    expect(sentence()).toBe('1 point Ready to use');
    cleanup();
    state.children = [{ ...lara, available_points: 0 }];
    mount(ChildView);
    await screen.findByRole('heading', { name: "You're doing great, Lara!" });
    expect(sentence()).toBe('0 points Ready to use');
    cleanup();
    state.children = [{ ...lara, available_points: undefined, total_points: undefined }];
    mount(ChildView);
    await screen.findByRole('heading', { name: "You're doing great, Lara!" });
    expect(sentence()).toBe('0 points Ready to use');
  });

  it('E4: one request per reward, through the POST and the refetch after it', async () => {
    let resolvePost;
    requestReward.mockImplementation(() => new Promise((r) => { resolvePost = r; }));
    const client = mount(ChildView);
    const btn = await screen.findByRole('button', { name: 'Ask a parent for Gaming time' });
    let resolveRefetch;
    const refetch = vi.spyOn(client, 'refetchQueries').mockImplementation(() => new Promise((r) => { resolveRefetch = r; }));
    fireEvent.click(btn);
    fireEvent.click(btn); // in flight
    expect(requestReward).toHaveBeenCalledTimes(1);
    expect(requestReward).toHaveBeenCalledWith('c1', 'r2');
    await act(async () => { resolvePost({ reward_stack: [] }); });
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    fireEvent.click(btn); // POST done, refetch not yet
    expect(requestReward).toHaveBeenCalledTimes(1);
    await act(async () => { resolveRefetch(); });
    await waitFor(() => expect(btn.disabled).toBe(false));
  });

  it('after a request, focus moves to the row and one status line announces it (code review of #61)', async () => {
    requestReward.mockResolvedValue({ reward_stack: [] });
    const client = mount(ChildView);
    const btn = await screen.findByRole('button', { name: 'Ask a parent for Gaming time' });
    btn.focus();
    vi.spyOn(client, 'refetchQueries').mockImplementation(async () => {
      // The fresh data the refetch would bring: Gaming time is now requested.
      client.setQueryData(['children'], [omar, { ...lara, reward_stack_priced: [{ rewardId: 'r2', name: 'Gaming time', cost: 20, stackIndex: 0 }] }]);
    });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Gaming time: Ready when a parent agrees'));
    await waitFor(() => expect(document.activeElement.textContent).toBe('20 points · Ready when a parent agrees'));
    expect(document.querySelectorAll('[aria-live]').length).toBe(0);
  });

  it('a failed refresh keeps the row locked until data loads again (code review of #61)', async () => {
    requestReward.mockResolvedValue({ reward_stack: [] });
    const client = mount(ChildView);
    const btn = await screen.findByRole('button', { name: 'Ask a parent for Gaming time' });
    vi.spyOn(client, 'refetchQueries').mockResolvedValue(undefined);
    vi.spyOn(client, 'getQueryState').mockReturnValue({ status: 'error' });
    fireEvent.click(btn);
    await waitFor(() => expect(requestReward).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(requestReward).toHaveBeenCalledTimes(1);
  });

  it('a rewards load failure is not shown as an empty catalogue', async () => {
    const { Reward } = await import('@/api/entities');
    Reward.list.mockRejectedValueOnce(new Error('down'));
    mount(ChildView);
    expect(await screen.findByText("Couldn't load rewards")).toBeTruthy();
    expect(screen.queryByText('No rewards created yet.')).toBeNull();
  });

  it('E4b: a sibling\'s same reward is not locked by a request in flight', async () => {
    requestReward.mockImplementation(() => new Promise(() => {}));
    mount(ChildView);
    fireEvent.click(await screen.findByRole('button', { name: 'Ask a parent for Gaming time' }));
    fireEvent.click(screen.getByRole('button', { name: /^Omar/ }));
    const omarBtn = await screen.findByRole('button', { name: 'Ask a parent for Gaming time' });
    expect(omarBtn.disabled).toBe(false);
  });

  it('errors: a 400 shows the server message; anything else the shipped fallback, never a raw message', async () => {
    requestReward.mockRejectedValueOnce(Object.assign(new Error('Not enough points'), { status: 400 }));
    mount(ChildView);
    fireEvent.click(await screen.findByRole('button', { name: 'Ask a parent for Gaming time' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Not enough points'));
    requestReward.mockRejectedValueOnce(Object.assign(new Error('Reward not found'), { status: 404 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ask a parent for Gaming time' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Ask a parent for Gaming time' }));
    await waitFor(() => expect(toastError).toHaveBeenLastCalledWith("Couldn't update points. Please try again."));
  });

  it('cost 1 reads "1 point" (E5c); unaffordable is disabled with Need n more', async () => {
    state.children = [{ ...lara, available_points: 0 }];
    state.rewards = [R('r6', 'Sticker', 1)];
    mount(ChildView);
    expect(await screen.findByText('1 point')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Need 1 more' }).disabled).toBe(true);
  });
});

// D5 guard: Child View never spends. Fails if ChildView.jsx imports a spend
// path; it does not catch a spend reached through a new, differently named
// helper (design §6).
export const SPEND_IMPORTS = /\b(spendReward|redeem|SpendRewardsModal)\b/;
describe('D5 guard', () => {
  it('ChildView.jsx imports no spend path', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'ChildView.jsx'), 'utf8');
    const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
    expect(imports).not.toMatch(SPEND_IMPORTS);
  });
  it('the guard fails on a spend import (fixture)', () => {
    expect("import { spendReward } from '@/lib/points';").toMatch(SPEND_IMPORTS);
    expect("import SpendRewardsModal from '../components/child/SpendRewardsModal';").toMatch(SPEND_IMPORTS);
  });
});
