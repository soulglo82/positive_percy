// V1-C (docs/engineering/V1-C-DESIGN.md §2): approved copy, row shapes, day
// labels, the four server filters, the child filter and paging.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/entities', () => ({ Child: { list: vi.fn(async () => kids) } }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }), getToken: () => 't' }));

import Activity, { dayLabel, rowText, rowIconKind } from './Activity';

const kids = [{ id: 'c1', name: 'Lara' }, { id: 'c2', name: 'Omar' }];
const now = new Date();
const at = (h, m, daysAgo = 0) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.toISOString(); };
const ROWS = [
  { id: 'e1', child_id: 'c1', child_name: 'Lara', points: 1, label: 'Learning', note: null, type: 'earn', created_date: at(0, 15), undone: false, goal_completion_id: 'x1', goal_title: 'Finish homework' },
  { id: 'e2', child_id: 'c2', child_name: 'Omar', points: 1, label: 'Kindness', note: 'Helped a friend', type: 'earn', created_date: at(0, 10), undone: false, goal_completion_id: null, goal_title: null },
  { id: 'r1', child_id: 'c1', child_name: 'Lara', points: -25, label: 'Movie night', note: null, type: 'spend', created_date: at(19, 10, 1), undone: false, goal_completion_id: null, goal_title: null },
];
let feedCalls;

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><Activity /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  feedCalls = [];
  global.fetch = vi.fn(async (url) => {
    if (url.startsWith('/api/summary')) {
      return { ok: true, json: async () => ({ weekStart: at(0, 0, 6), childStats: [{ week_points: 20 }, { week_points: 16 }], goalsCompleted: 7 }) };
    }
    feedCalls.push(new URL(url, 'http://x').searchParams);
    return { ok: true, json: async () => ROWS };
  });
});

describe('Activity screen', () => {
  it('approved copy; no design-only lines', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(screen.getByText("Every point has a story. This is your family's history.")).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'This week' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('36')).toBeTruthy());
    expect(screen.getByText('Points earned')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Goals completed')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Activity log' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Corrections and Undo' })).toBeTruthy();
    expect(screen.getByText('Historical entries remain visible when a parent corrects a mistaken award or reverses an eligible action.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Sample summary only|This preview does not change|Top categories|active day/);
  });

  it('the three approved row shapes, grouped by day', async () => {
    mount();
    expect(await screen.findByText('“Finish homework”')).toBeTruthy();
    const text = document.body.textContent;
    expect(text).toContain('Lara completed “Finish homework”');
    expect(text).toMatch(/Today’s Goal · Learning · 12:15 AM/);
    expect(text).toContain('Omar earned Kindness');
    expect(text).toMatch(/Helped a friend · 12:10 AM/);
    expect(text).toContain('Lara redeemed Movie night');
    expect(text).toMatch(/Parent-confirmed reward · 7:10 PM/);
    expect(screen.getByRole('heading', { name: /^Today · / })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^Yesterday · / })).toBeTruthy();
  });

  it('the four filters ask the server; the child filter is sent to the server', async () => {
    mount();
    await screen.findByText('“Finish homework”');
    expect(feedCalls.at(-1).get('filter')).toBe('all');
    for (const [label, key] of [['Earned', 'earned'], ['Goals', 'goals'], ['Spent', 'spent'], ['All', 'all']]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => expect(feedCalls.at(-1).get('filter')).toBe(key));
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
    }
    expect(feedCalls.every((p) => !p.has('child_id'))).toBe(true);
  });

  it('Load earlier activity appears only after a full page and asks for the next offset', async () => {
    const full = Array.from({ length: 50 }, (_, i) => ({ ...ROWS[1], id: 'p' + i }));
    global.fetch = vi.fn(async (url) => {
      if (url.startsWith('/api/summary')) return { ok: true, json: async () => ({ childStats: [], goalsCompleted: 0 }) };
      const p = new URL(url, 'http://x').searchParams;
      feedCalls.push(p);
      return { ok: true, json: async () => (p.get('offset') === '0' ? full : [ROWS[2]]) };
    });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Load earlier activity' }));
    await waitFor(() => expect(feedCalls.at(-1).get('offset')).toBe('50'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load earlier activity' })).toBeNull());
    expect(document.body.textContent).toContain('Lara redeemed Movie night');
  });
});

describe('row text and day labels', () => {
  it('day labels: Today, Yesterday, then the plain day (A1)', () => {
    const ref = new Date(2026, 10, 18, 12);
    expect(dayLabel(new Date(2026, 10, 18, 9).toISOString(), ref)).toBe('Today · Wednesday 18 November');
    expect(dayLabel(new Date(2026, 10, 17, 9).toISOString(), ref)).toBe('Yesterday · Tuesday 17 November');
    expect(dayLabel(new Date(2026, 10, 16, 9).toISOString(), ref)).toBe('Monday 16 November');
  });
  it('an award with no note shows only the time; "Other" shows its note', () => {
    const base = { type: 'earn', created_date: new Date(2026, 10, 18, 16, 15).toISOString(), goal_completion_id: null };
    expect(rowText({ ...base, label: 'Kindness', note: null })).toEqual({ lead: 'earned', what: 'Kindness', sub: '4:15 PM' });
    expect(rowText({ ...base, label: 'Other', note: 'Fed the cat' })).toEqual({ lead: 'earned', what: 'Fed the cat', sub: '4:15 PM' });
    expect(rowText({ ...base, type: 'starting', label: 'Starting points', points: 10 }).lead).toBe('started with');
  });
  it('row icons follow the approved kinds: goal tick, award heart, spend gift', () => {
    expect(rowIconKind({ type: 'earn', goal_completion_id: 'x' })).toBe('goal');
    expect(rowIconKind({ type: 'earn', goal_completion_id: null })).toBe('earn');
    expect(rowIconKind({ type: 'spend' })).toBe('spend');
    expect(rowIconKind({ type: 'undo' })).toBe('undo');
    expect(rowIconKind({ type: 'starting' })).toBe('other');
  });
});
