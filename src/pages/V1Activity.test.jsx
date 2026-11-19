// V1-C (docs/engineering/V1-C-DESIGN.md §2): approved copy, row shapes, day
// labels, the four server filters, the child filter and paging.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/entities', () => ({ Child: { list: vi.fn(async () => kids) } }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }), getToken: () => 't' }));

import Activity, { dayLabel, rowText, rowIconKind, goalTitleOf } from './Activity';

const kids = [{ id: 'c1', name: 'Lara' }, { id: 'c2', name: 'Omar' }];
const now = new Date();
const at = (h, m, daysAgo = 0) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.toISOString(); };
const ROWS = [
  { id: 'e1', child_id: 'c1', child_name: 'Lara', points: 1, label: 'Learning', note: 'Today’s Goal: Finish homework', type: 'earn', created_date: at(0, 15), undone: false, goal_completion_id: 'x1' },
  { id: 'e2', child_id: 'c2', child_name: 'Omar', points: 1, label: 'Kindness', note: 'Helped a friend', type: 'earn', created_date: at(0, 10), undone: false, goal_completion_id: null },
  { id: 'r1', child_id: 'c1', child_name: 'Lara', points: -25, label: 'Movie night', note: null, type: 'spend', created_date: at(19, 10, 1), undone: false, goal_completion_id: null },
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
    expect(text).toMatch(/Reward redeemed · 7:10 PM/);
    expect(text).not.toContain('Parent-confirmed');
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

  it('groups days in the family zone from the summary', async () => {
    const nowSg = new Date();
    const ev = new Date(nowSg.getTime() - 60 * 1000).toISOString();
    global.fetch = vi.fn(async (url) => {
      if (url.startsWith('/api/summary')) return { ok: true, json: async () => ({ timezone: 'Pacific/Kiritimati', childStats: [], goalsCompleted: 0 }) };
      return { ok: true, json: async () => [{ ...ROWS[1], created_date: ev }] };
    });
    mount();
    const want = 'Today · ' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Pacific/Kiritimati', weekday: 'long', day: 'numeric', month: 'long' })
      .formatToParts(nowSg).filter((p) => p.type !== 'literal').map((p) => p.value).join(' ');
    expect(await screen.findByRole('heading', { name: want })).toBeTruthy();
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
  it('day labels: Today, Yesterday, the plain day, and the year when not this year (A1)', () => {
    const ref = new Date('2026-11-18T04:00:00Z');
    const z = 'Europe/London';
    expect(dayLabel('2026-11-18T09:00:00Z', ref, z)).toBe('Today · Wednesday 18 November');
    expect(dayLabel('2026-11-17T09:00:00Z', ref, z)).toBe('Yesterday · Tuesday 17 November');
    expect(dayLabel('2026-11-16T09:00:00Z', ref, z)).toBe('Monday 16 November');
    expect(dayLabel('2025-12-31T09:00:00Z', ref, z)).toBe('Wednesday 31 December 2025');
    // Yesterday across a month and a year boundary.
    expect(dayLabel('2026-12-31T12:00:00Z', new Date('2027-01-01T12:00:00Z'), z)).toBe('Yesterday · Thursday 31 December');
  });
  it('near midnight the family zone decides the day, not the device (owner, PR #62)', () => {
    // 16:30 UTC on 18 Nov is 00:30 on 19 Nov in Singapore and still 18 Nov in London.
    const ev = '2026-11-18T16:30:00Z';
    const now = new Date('2026-11-19T02:00:00Z');
    expect(dayLabel(ev, now, 'Asia/Singapore')).toBe('Today · Thursday 19 November');
    expect(dayLabel(ev, now, 'Europe/London')).toBe('Yesterday · Wednesday 18 November');
    expect(rowText({ type: 'spend', label: 'Movie night', created_date: ev }, 'Asia/Singapore').sub).toBe('Reward redeemed · 12:30 AM');
  });
  it('a goal row names the goal as it was when completed; never invented (A4)', () => {
    const base = { type: 'earn', label: 'Learning', created_date: '2026-11-18T09:00:00Z', goal_completion_id: 'x' };
    expect(goalTitleOf({ ...base, note: 'Today’s Goal: Old name' })).toBe('Old name');
    expect(rowText({ ...base, note: 'Today’s Goal: Old name' }, 'UTC').what).toBe('“Old name”');
    expect(rowText({ ...base, note: null }, 'UTC').what).toBe('a goal');
    expect(rowText({ ...base, note: 'Today’s Goal: ' }, 'UTC').what).toBe('a goal');
    // Not linked to a completion: the note is just a note.
    expect(goalTitleOf({ ...base, goal_completion_id: null, note: 'Today’s Goal: Fake' })).toBeNull();
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
