// V1-C (docs/engineering/V1-C-DESIGN.md §2): approved copy, row shapes, day
// labels, the four server filters, the child filter and paging.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

vi.mock('@/api/entities', () => ({ Child: { list: vi.fn(async () => kids) } }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }), getToken: () => 't' }));

import Activity, { dayLabel, rowText, rowIconKind, goalTitleOf, safeZone } from './Activity';

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
  return client;
}
// A feed of `n` rows on the first page and `second` on the next.
function pagedFeed(first, second, summary = { childStats: [], goalsCompleted: 0 }) {
  global.fetch = vi.fn(async (url) => {
    if (url.startsWith('/api/summary')) return { ok: true, json: async () => summary };
    const p = new URL(url, 'http://x').searchParams;
    feedCalls.push(p);
    return { ok: true, json: async () => (p.get('offset') === '0' ? first() : second()) };
  });
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
    expect(text).toMatch(/Today’s Goal · Learning · 12:15\u00a0AM/);
    expect(text).toContain('Omar earned Kindness');
    expect(text).toMatch(/Helped a friend · 12:10\u00a0AM/);
    expect(text).toContain('Lara redeemed Movie night');
    expect(text).toMatch(/Reward redeemed · 7:10\u00a0PM/);
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

describe('paging and refresh (code review of #62)', () => {
  const full = () => Array.from({ length: 50 }, (_, i) => ({ ...ROWS[1], id: 'p' + i }));
  it('a refresh keeps every loaded page (no collapse back to the first page)', async () => {
    pagedFeed(full, () => [ROWS[2]]);
    const client = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Load earlier activity' }));
    expect(await screen.findByText('Movie night')).toBeTruthy();
    await act(async () => { await client.invalidateQueries({ queryKey: ['activityFeed'] }); });
    await waitFor(() => expect(feedCalls.filter((p) => p.get('offset') === '50').length).toBe(2));
    expect(screen.getByText('Movie night')).toBeTruthy();
  });
  it('a row that moved onto the next page is shown once', async () => {
    pagedFeed(full, () => [{ ...ROWS[1], id: 'p49' }, ROWS[2]]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Load earlier activity' }));
    await screen.findByText('Movie night');
    expect(document.querySelectorAll('[data-row-key="earn-p49"]').length).toBe(1);
  });
  it('a failed summary shows the error card, not zeros', async () => {
    global.fetch = vi.fn(async (url) => (url.startsWith('/api/summary') ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => ROWS }));
    mount();
    expect(await screen.findByText("Couldn't load activity")).toBeTruthy();
    expect(screen.queryByText('Points earned')).toBeNull();
  });
});

describe('Correct (A2 history)', () => {
  it('offered on this week\'s awards and goal awards, not on undone, spends or older rows', async () => {
    const week = at(0, 0, 6);
    pagedFeed(() => [
      { ...ROWS[0] },
      { ...ROWS[1] },
      { ...ROWS[1], id: 'u1', undone: true, child_name: 'Undone' },
      { ...ROWS[1], id: 'o1', child_name: 'Old', created_date: at(9, 0, 9) },
      { ...ROWS[2] },
    ], () => [], { weekStart: week, childStats: [], goalsCompleted: 0 });
    mount();
    await screen.findByText('Movie night');
    const names = screen.getAllByRole('button', { name: /^Correct / }).map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Correct Lara award of 1 point', 'Correct Omar award of 1 point']);
    // The dialog says "1 point" too (final validation: it said "1 points").
    fireEvent.click(screen.getByRole('button', { name: 'Correct Lara award of 1 point' }));
    expect(await screen.findByText(/Remove 1 mistakenly awarded point from Lara\?/)).toBeTruthy();
  });
});

describe('Undo a redeemed reward (V1-D §10 R3; final validation 2026-11-22)', () => {
  const recent = (minsAgo, extra = {}) => ({ id: 'red-' + minsAgo, child_id: 'c1', child_name: 'Lara', points: -25, label: 'Movie night', note: null, type: 'spend',
    created_date: new Date(Date.now() - minsAgo * 60000).toISOString(), undone: false, goal_completion_id: null, ...extra });

  it('offered on a redemption from the last 10 minutes only; not once undone; it calls the redemption undo once', async () => {
    const said = vi.spyOn(toast, 'success').mockImplementation(() => {});
    const calls = [];
    global.fetch = vi.fn(async (url, opts = {}) => {
      if (url.startsWith('/api/summary')) return { ok: true, json: async () => ({ childStats: [], goalsCompleted: 0 }) };
      if (url.startsWith('/api/redemptions/')) { calls.push([url, JSON.parse(opts.body)]); return { ok: true, status: 200, json: async () => ({ child: { name: 'Lara', total_points: 1 }, redemption: {} }) }; }
      // A fresh award too: only its type keeps Undo off it (review: the old row was hours old, so the window hid it anyway).
      return { ok: true, json: async () => [recent(9), recent(11), recent(3, { id: 'red-undone', undone: true }), recent(4, { label: 'Ice cream' }), { ...ROWS[1], created_date: recent(1).created_date }] };
    });
    mount();
    const undo = await screen.findAllByRole('button', { name: 'Undo Lara redeemed Movie night' });
    expect(undo).toHaveLength(1); // 9 minutes old: offered; 11 minutes old and the undone one: not
    expect(undo[0].closest('[data-row-key]').getAttribute('data-row-key')).toBe('spend-red-9');
    expect(screen.queryByRole('button', { name: /^Undo Omar/ })).toBeNull(); // never on an award
    fireEvent.click(undo[0]);
    fireEvent.click(undo[0]); // a double tap is one undo
    await waitFor(() => expect(calls).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('/api/redemptions/red-9/undo');
    expect(calls[0][1].request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(said).toHaveBeenCalledWith('Undone. Lara has 1 point.'); // singular
    // A later tap, after the list has refreshed, replays the same undo: the
    // same request id, so the server answers it as a duplicate (code review).
    await waitFor(() => expect(global.fetch.mock.calls.filter(([u]) => u.startsWith('/api/activity-feed')).length).toBeGreaterThan(1));
    fireEvent.click(screen.getByRole('button', { name: 'Undo Lara redeemed Movie night' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1][1].request_id).toBe(calls[0][1].request_id);
    // Another redemption has its own undo: its own address and its own id (code review).
    fireEvent.click(screen.getByRole('button', { name: 'Undo Lara redeemed Ice cream' }));
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2][0]).toBe('/api/redemptions/red-4/undo');
    expect(calls[2][1].request_id).not.toBe(calls[0][1].request_id);
    said.mockRestore();
  });
});

describe('row text and day labels', () => {
  it('an unknown zone falls back to the browser\'s', () => {
    expect(safeZone('Europe/London')).toBe('Europe/London');
    expect(safeZone('Mars/Olympus')).toBeUndefined();
    expect(safeZone(undefined)).toBeUndefined();
  });
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
    expect(rowText({ type: 'spend', label: 'Movie night', created_date: ev }, 'Asia/Singapore').sub).toBe('Reward redeemed · 12:30\u00a0AM'); // the time never breaks across lines
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
    expect(rowText({ ...base, label: 'Kindness', note: null })).toEqual({ lead: 'earned', what: 'Kindness', sub: '4:15\u00a0PM' });
    expect(rowText({ ...base, label: 'Other', note: 'Fed the cat' })).toEqual({ lead: 'earned', what: 'Fed the cat', sub: '4:15\u00a0PM' });
    expect(rowText({ ...base, type: 'starting', label: 'Starting points', points: 10 }).lead).toBe('started with');
    expect(rowText({ ...base, type: 'starting', label: 'Starting points', points: 10 }).what).toBe('10 points'); // not "started with Starting points"
    expect(rowText({ ...base, type: 'starting', label: 'Starting points', points: 1 }).what).toBe('1 point');
  });
  it('row icons follow the approved kinds: goal tick, award heart, spend gift', () => {
    expect(rowIconKind({ type: 'earn', goal_completion_id: 'x' })).toBe('goal');
    expect(rowIconKind({ type: 'earn', goal_completion_id: null })).toBe('earn');
    expect(rowIconKind({ type: 'spend' })).toBe('spend');
    expect(rowIconKind({ type: 'undo' })).toBe('undo');
    expect(rowIconKind({ type: 'starting' })).toBe('other');
  });
});
