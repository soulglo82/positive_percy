import { getToken } from '@/lib/AuthContext';

export const MAX_AWARD = 1000;

// Every query that shows a balance, history or weekly figures. Invalidated
// together after any points change so no screen shows a stale number.
export const POINTS_QUERY_KEYS = [['children'], ['recentActivity'], ['activityFeed'], ['weeklySummary']];

export function refreshPoints(queryClient) {
  for (const queryKey of POINTS_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey });
  }
}

export const newRequestId = () =>
  (globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

async function postAward(childId, body) {
  return fetch(`/api/children/${childId}/award`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  });
}

// One request per award: the server writes the balance and the history row
// together. The request id is made once per tap and reused for the automatic
// retry, so if the first attempt landed but its reply was lost, the retry
// returns that result instead of awarding again.
export async function awardPoints(childId, { points, category, note }, requestId = newRequestId()) {
  const body = { points, category, note: note || undefined, request_id: requestId };
  let res;
  try {
    res = await postAward(childId, body);
  } catch {
    await new Promise((r) => setTimeout(r, 800));
    res = await postAward(childId, body);
  }
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(result.error || 'Could not update points');
    err.status = res.status;
    throw err;
  }
  return result; // { event, child, duplicate, capped }
}
