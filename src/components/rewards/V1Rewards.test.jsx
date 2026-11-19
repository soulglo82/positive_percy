// V1-D (docs/engineering/V1-D-DESIGN.md §4, §6, §10): reward icon precedence,
// the picker, the reward form's payload rules (F1-F4), the catalogue
// filters and the parent's confirmation of a child's requests.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RewardIcon from './RewardIcon';
import RewardPicker, { countLine } from './RewardPicker';
import RewardForm from './RewardForm';
import { RewardTile } from '@/pages/Rewards';
import SpendRewardsModal from '@/components/child/SpendRewardsModal';

const PIZZA = 'phosphor:pizza:duotone';
const CONTROLLER = 'phosphor:game-controller:duotone';

describe('RewardIcon precedence (R2)', () => {
  it('chosen icon, then image, then emoji, then gift', () => {
    const { container, rerender } = render(<RewardIcon reward={{ icon_key: PIZZA, image_url: '/u/a.png', emoji: '🍕' }} />);
    expect(container.querySelector('[data-reward-icon]').getAttribute('data-reward-icon')).toBe(PIZZA);
    expect(container.querySelector('img')).toBeNull();
    rerender(<RewardIcon reward={{ icon_key: null, image_url: '/u/a.png', emoji: '🍕' }} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('/u/a.png');
    expect(container.querySelector('img').getAttribute('alt')).toBe('');
    rerender(<RewardIcon reward={{ emoji: '🍕' }} />);
    expect(container.textContent).toBe('🍕');
    rerender(<RewardIcon reward={{}} />);
    expect(container.querySelector('svg[data-icon="phosphor:gift:duotone"]')).toBeTruthy();
  });
});

describe('RewardPicker', () => {
  it('starts on Fun & games with the approved count; tiles are named by their label', () => {
    render(<RewardPicker value={null} onChange={() => {}} />);
    expect(screen.getByText('7 icons in Fun & games')).toBeTruthy();
    const grid = screen.getByRole('group', { name: 'Reward icons' });
    expect(within(grid).getAllByRole('button')).toHaveLength(7);
    expect(within(grid).getByRole('button', { name: 'Game Controller' })).toBeTruthy();
  });
  it('category chips switch the list; search dedupes and counts in the singular', () => {
    render(<RewardPicker value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tech & media' }));
    expect(screen.getByText('4 icons in Tech & media')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Find an icon'), { target: { value: 'bike' } });
    expect(screen.getByText('1 icon matches your search')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Reward icons' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Bicycle']);
    fireEvent.change(screen.getByLabelText('Find an icon'), { target: { value: 'zzz' } });
    expect(screen.getByText('No matching icons. Try a different word.')).toBeTruthy();
  });
  it('a tap selects; the selected tile is pressed', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RewardPicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Game Controller' }));
    expect(onChange).toHaveBeenCalledWith(CONTROLLER);
    rerender(<RewardPicker value={CONTROLLER} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Game Controller' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('count wording', () => {
    expect(countLine(7, 'Fun & games', false)).toBe('7 icons in Fun & games');
    expect(countLine(1, 'Outings', false)).toBe('1 icon in Outings');
    expect(countLine(3, 'x', true)).toBe('3 icons match your search');
  });
});

function openForm(props = {}) {
  const onSubmit = props.onSubmit || vi.fn(async () => true);
  render(<RewardForm isOpen onClose={() => {}} children={[]} onSubmit={onSubmit} onDelete={() => {}} {...props} />);
  return { onSubmit, d: screen.getByRole('dialog') };
}

describe('RewardForm', () => {
  it('approved copy; a new reward opens the picker with no icon chosen (R1)', () => {
    const { d } = openForm();
    expect(within(d).getByRole('heading', { name: 'Create or edit reward' })).toBeTruthy();
    expect(d.textContent).toContain('The reward');
    expect(d.textContent).toContain('Set the name and point cost.');
    expect(within(d).getByLabelText('Reward name').getAttribute('placeholder')).toBe('e.g. Choose a movie');
    expect(within(d).getByLabelText('Points needed')).toBeTruthy();
    expect(d.textContent).toContain('Current icon');
    expect(d.textContent).toContain('Selected reward icon');
    expect(within(d).getByRole('button', { name: 'Hide' })).toBeTruthy();
    expect(within(d).getByText('Choose an icon')).toBeTruthy();
    expect(within(d).getAllByRole('button', { pressed: true }).filter((b) => b.closest('[aria-label="Reward icons"]'))).toHaveLength(0);
    expect(d.textContent).not.toMatch(/Approved Phosphor icons/); // C2: not shipped
  });
  it('F1: a new reward without a tap is saved with its emoji and no icon_key', async () => {
    const { d, onSubmit } = openForm();
    fireEvent.change(within(d).getByLabelText('Reward name'), { target: { value: 'Movie night' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({ title: 'Movie night', cost_points: 50, emoji: '🎁', visible_to_child: true, assigned_child_ids: [] });
    expect(payload).not.toHaveProperty('icon_key');
  });
  it('a tap sets icon_key and the row names it', async () => {
    const { d, onSubmit } = openForm();
    fireEvent.change(within(d).getByLabelText('Reward name'), { target: { value: 'Gaming' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Game Controller' }));
    expect(within(d).getByText('Game Controller', { selector: 'p' })).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].icon_key).toBe(CONTROLLER);
  });
  it('a starter template keeps its emoji (no automatic icon)', async () => {
    const { d, onSubmit } = openForm({ initialTemplate: { title: 'Extra Screen Time', cost_points: 30, emoji: '🎮' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Extra Screen Time', cost_points: 30, emoji: '🎮' });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('icon_key');
  });
  it('F4: editing a legacy reward starts closed and sends no icon_key unless one is picked', async () => {
    const legacy = { id: 'r1', title: 'Pizza', cost_points: 7, emoji: '🍕', icon_key: null, visible_to_child: false, assigned_child_ids: ['c1'] };
    const { d, onSubmit } = openForm({ reward: legacy });
    expect(within(d).getByRole('button', { name: 'Change' })).toBeTruthy();
    expect(within(d).queryByLabelText('Find an icon')).toBeNull();
    fireEvent.change(within(d).getByLabelText('Reward name'), { target: { value: 'Pizza night' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({ title: 'Pizza night', cost_points: 7, visible_to_child: false, assigned_child_ids: ['c1'] });
    expect(payload).not.toHaveProperty('icon_key');
    expect(payload).not.toHaveProperty('emoji'); // an edit never rewrites the emoji
  });
  it('F2/F3: picking an icon on a legacy or image reward sends only icon_key', async () => {
    const withImage = { id: 'r2', title: 'Zoo', cost_points: 40, emoji: '🦁', image_url: '/u/zoo.png', icon_key: null, visible_to_child: true };
    const { d, onSubmit } = openForm({ reward: withImage });
    fireEvent.click(within(d).getByRole('button', { name: 'Change' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Treats & food' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Pizza' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Save reward' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.icon_key).toBe(PIZZA);
    expect(payload).not.toHaveProperty('image_url');
    expect(payload).not.toHaveProperty('emoji');
  });
  it('save is blocked without a name', () => {
    const { d } = openForm();
    expect(within(d).getByRole('button', { name: 'Save reward' }).disabled).toBe(true);
  });
});

describe('Picker opens where the chosen icon is', () => {
  it('editing a reward with an icon opens on that icon\'s category', () => {
    render(<RewardPicker value={PIZZA} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Treats & food' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Pizza' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Catalogue tile', () => {
  it('shows icon, title, points (singular), visibility and a named Edit; no subtitle', () => {
    const onEdit = vi.fn();
    const r = { id: 'r', title: 'Sticker', cost_points: 1, emoji: '⭐', visible_to_child: false };
    const { container } = render(<RewardTile reward={r} onEdit={onEdit} />);
    expect(container.textContent).toContain('1 point');
    expect(container.textContent).not.toContain('1 points');
    expect(container.textContent).toContain('Hidden from children');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Sticker' }));
    expect(onEdit).toHaveBeenCalledWith(r);
  });
});

describe('Parent confirmation of requests (D5, R4)', () => {
  const child = {
    id: 'c1', name: 'Lara', total_points: 60, available_points: 47,
    reward_stack_priced: [
      { rewardId: 'a', name: 'Kite', cost: 5, stackIndex: 1, icon_key: null, emoji: '🪁', image_url: null },
      { rewardId: 'b', name: 'Cinema', cost: 8, stackIndex: 2, icon_key: 'phosphor:film-slate:duotone', emoji: '🎬', image_url: null },
    ],
  };
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ confirmed_count: 2, points_deducted: 13, redemption_ids: ['x', 'y'] }) }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  const open = (c = child) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><SpendRewardsModal isOpen onClose={() => {}} child={c} rewards={[{ id: 'z', title: 'Big', cost_points: 50, visible_to_child: true }]} /></MemoryRouter></QueryClientProvider>);
    return screen.getByRole('dialog');
  };

  it('lists the requests and agrees to exactly what is shown', async () => {
    const d = open();
    expect(within(d).getByRole('heading', { name: 'Lara asked for' })).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Agree to 2 rewards' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/children/c1/stack/confirm');
    const body = JSON.parse(init.body);
    expect(body.expected).toEqual([{ reward_id: 'a', stack_index: 1, cost: 5 }, { reward_id: 'b', stack_index: 2, cost: 8 }]);
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('"Not now" removes that request by its stored position and names it', async () => {
    const d = open();
    fireEvent.click(within(d).getByRole('button', { name: 'Not now: Cinema' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/children/c1/stack/2?reward_id=b');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
  it('affordability uses points available now, not the total', () => {
    const d = open();
    expect(within(d).getByRole('button', { name: 'Need 3 more' })).toBeTruthy(); // 50 - 47
  });
  it('no requests: no section', () => {
    const d = open({ ...child, reward_stack_priced: [] });
    expect(within(d).queryByRole('heading', { name: /asked for/ })).toBeNull();
  });
});
