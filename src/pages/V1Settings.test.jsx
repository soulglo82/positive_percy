// V1-E (docs/engineering/V1-E-DESIGN.md §2): the four approved groups, row
// actions with distinct names, the family-name dialog, Quick Points opening
// straight to its controls, and no technical JSON export tile.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = { children: [] };
const refreshUser = vi.fn(async () => true);
vi.mock('@/api/entities', () => ({
  Child: { list: vi.fn(async () => state.children), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', full_name: 'Old user name', family: { family_name: 'The Smiths' } }, familyCode: 'ABC123', refreshUser }),
  getToken: () => 't',
}));
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...a) => toastSuccess(...a), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import ParentProfile from './ParentProfile';

const cats = [
  { id: 'k1', name: 'Kindness', points: 1, icon_key: 'heart', is_quick_action: true, is_default: true, sort_order: 0 },
  { id: 'k2', name: 'Reading', points: 2, icon_key: 'book', is_quick_action: false, is_default: false, sort_order: 1 },
];
let calls;
beforeEach(() => {
  calls = [];
  refreshUser.mockClear();
  toastSuccess.mockClear();
  state.children = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push([url, opts]);
    if (url.startsWith('/api/behavior-categories')) return { ok: true, json: async () => cats };
    if (url === '/api/family/name') return { ok: true, json: async () => ({ family_name: JSON.parse(opts.body).family_name.trim() }) };
    if (url.startsWith('/api/family/timezone')) return { ok: true, json: async () => ({ timezone: 'Europe/London' }) };
    return { ok: true, json: async () => ({}) };
  });
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><ParentProfile /></MemoryRouter></QueryClientProvider>);
}

describe('Settings rows', () => {
  it('the four approved groups, rows and actions; status labels are not buttons', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'Family settings' })).toBeTruthy();
    expect(screen.getByText('Make Percy work for your family.')).toBeTruthy();
    for (const g of ['Behaviours & Quick Points', 'Children & goals', 'Family & access', 'Reports & privacy']) {
      expect(screen.getByRole('heading', { name: g })).toBeTruthy();
    }
    const rows = [
      ['Positive behaviour categories', 'Names, point values and approved icons', 'Edit Positive behaviour categories'],
      ['Quick Points', 'Choose your quick award buttons for Home', 'Edit Quick Points'],
      ['Children', 'Profiles, avatars and weekly targets', 'Edit Children'],
      ['Today’s Goals', 'Recurring routines and one-off achievements', 'Edit Today’s Goals'],
      ['Family timezone', 'Determines today’s date and weekly schedule', 'Edit Family timezone'],
      ['Family name', 'How your family appears in Percy', 'Edit Family name'],
      ['Invite parent', 'Available with existing family invitation flow', 'View Invite parent'],
      ['Family Report (PDF)', 'Printable achievements and recent history', 'Download Family Report (PDF)'],
    ];
    for (const [, subtitle, name] of rows) {
      expect(screen.getByText(subtitle)).toBeTruthy();
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    // D6: read-only, no action.
    expect(screen.getByText('New behaviours and Quick Points start at 1 point')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Point defaults/ })).toBeNull();
    // Planned and Review are status labels until those features exist.
    expect(screen.getByText('Planned').tagName).not.toBe('BUTTON');
    expect(screen.getByText('Review').tagName).not.toBe('BUTTON');
    expect(screen.queryByRole('button', { name: /Planned|Review|Shared carers|Privacy/ })).toBeNull();
    // The technical JSON export tile is gone (the endpoint stays).
    expect(screen.queryByRole('button', { name: /technical data|JSON/ })).toBeNull();
    // Visible action words are inside the accessible names (WCAG 2.5.3).
    expect(screen.getByRole('button', { name: 'Edit Family name' }).textContent).toBe('Edit');
  });

  it('Today’s Goals is disabled with no children (E4)', async () => {
    mount();
    expect((await screen.findByRole('button', { name: 'Edit Today’s Goals' })).disabled).toBe(true);
  });
});

describe('Family name', () => {
  it('opens with the family’s own name and saves it through PUT /api/family/name, then refreshes', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Family name' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('heading', { name: 'Family name' })).toBeTruthy();
    const input = within(d).getByLabelText('Family name');
    expect(input.value).toBe('The Smiths'); // not the user record's name
    fireEvent.change(input, { target: { value: 'The Joneses' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    const put = calls.find(([u]) => u === '/api/family/name');
    expect(put[1].method).toBe('PUT');
    expect(JSON.parse(put[1].body)).toEqual({ family_name: 'The Joneses' });
    expect(calls.some(([u]) => u.startsWith('/api/auth/me'))).toBe(false);
    expect(toastSuccess).toHaveBeenCalledWith('Family name updated.');
  });
});

describe('Behaviour dialogs', () => {
  it('Quick Points opens straight to the quick-button controls (owner review)', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Quick Points' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('heading', { name: 'Quick Points' })).toBeTruthy();
    expect(await within(d).findByRole('checkbox', { name: 'Kindness quick action' })).toBeTruthy();
    expect(within(d).getByRole('checkbox', { name: 'Reading quick action' })).toBeTruthy();
    expect(within(d).queryByRole('button', { name: /Add behaviour/ })).toBeNull();
    expect(within(d).queryByRole('button', { name: /^Kindness/ })).toBeNull(); // no row editing here
  });

  it('Positive behaviour categories opens the full manager', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Positive behaviour categories' }));
    const d = await screen.findByRole('dialog');
    expect(await within(d).findByRole('button', { name: /Add behaviour/ })).toBeTruthy();
    expect(within(d).queryByText('Behaviours')).toBeNull(); // embedded: no second header
  });

  it('Invite parent shows the family code', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'View Invite parent' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByText('ABC123')).toBeTruthy();
    expect(within(d).getByRole('button', { name: /Share invite link/ })).toBeTruthy();
  });
});
