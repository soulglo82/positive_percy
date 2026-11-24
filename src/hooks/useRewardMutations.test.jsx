// The reward save and delete used by the Rewards page, the Children page and
// the Daily Wins & Big Goals pop-up (V1-F §12; code review of decdbcf,
// finding 1): only the pop-up waits for the lists to be refetched, and never
// for longer than REFETCH_WAIT_MS.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

const api = { list: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() };
vi.mock('@/api/entities', () => ({
  Reward: { list: (...a) => api.list(...a), update: (...a) => api.update(...a), create: (...a) => api.create(...a), delete: (...a) => api.delete(...a) },
}));
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...a) => toastSuccess(...a), error: vi.fn() } }));

import { useRewardMutations, BIG_GOAL_WORDS, REFETCH_WAIT_MS } from './useRewardMutations';

// A page that shows the reward list, so a save has a list to refetch.
let hook;
function Page() {
  useQuery({ queryKey: ['rewards'], queryFn: () => api.list() });
  hook = useRewardMutations();
  return null;
}
async function mount() {
  api.list.mockResolvedValueOnce([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
}
const never = () => new Promise(() => {});

beforeEach(() => { for (const f of Object.values(api)) f.mockReset(); toastSuccess.mockReset(); api.update.mockResolvedValue({}); api.delete.mockResolvedValue({}); });
afterEach(() => { vi.useRealTimers(); });

describe('useRewardMutations', () => {
  it('a page form is answered as soon as the save is: a hung refetch does not hold it (Rewards, Children)', async () => {
    await mount();
    api.list.mockImplementation(never);
    // Answered at once, not after the wait the pop-up allows itself.
    const soon = (promise) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve('still waiting'), 1000))]);
    expect(await soon(hook.save('r1', { title: 'Kite' }))).toBe(true);
    expect(toastSuccess).toHaveBeenCalledWith('Reward updated.');
    expect(await soon(hook.remove({ id: 'r1' }))).toBe(true);
    expect(toastSuccess).toHaveBeenCalledWith('Reward deleted');
  });

  it('the pop-up waits for the refetched list before it is answered', async () => {
    await mount();
    let release;
    api.list.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    let answered = false;
    const saving = hook.save('r1', { title: 'Kite' }, BIG_GOAL_WORDS, { awaitRefetch: true }).then((r) => { answered = r; });
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(answered).toBe(false);
    expect(toastSuccess).not.toHaveBeenCalled();
    release([]);
    await saving;
    expect(answered).toBe(true);
    expect(toastSuccess).toHaveBeenCalledWith('Big Goal updated.');
  });

  it('but never for longer than REFETCH_WAIT_MS: a hung refetch cannot hold a saved form shut', async () => {
    await mount();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.list.mockImplementation(never);
    let answered = false;
    const saving = hook.save('r1', { title: 'Kite' }, BIG_GOAL_WORDS, { awaitRefetch: true }).then((r) => { answered = r; });
    await vi.advanceTimersByTimeAsync(REFETCH_WAIT_MS - 500);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    await saving;
    expect(answered).toBe(true);
  });
});
