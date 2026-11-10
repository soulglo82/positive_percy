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

const newRequestId = () =>
  (globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

// One request per award: the server writes the balance and the history row
// together. The request id is made once per tap so a retry cannot apply twice.
export async function awardPoints(childId, { points, category, note }) {
  const res = await fetch(`/api/children/${childId}/award`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ points, category, note: note || undefined, request_id: newRequestId() }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'Could not update points');
    err.status = res.status;
    throw err;
  }
  return body; // { event, child, duplicate, capped }
}
