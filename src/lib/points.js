import { getToken } from '@/lib/AuthContext';
import { toast } from 'sonner';

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
  // Retry once, same id, if the first attempt may have landed without us
  // hearing back: a network failure or a server/gateway error.
  let res;
  try {
    res = await postAward(childId, body);
  } catch {
    res = null;
  }
  if (!res || res.status >= 500) {
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

// Undo an award or a spend (within 10 minutes). Same pattern: one request id
// per tap, reused for one automatic retry, so a lost reply never undoes twice.
async function postUndo(path, requestId) {
  const send = () => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ request_id: requestId }),
  });
  let res;
  try {
    res = await send();
  } catch {
    res = null;
  }
  if (!res || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 800));
    res = await send();
  }
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(result.error || "Couldn't undo that");
    err.status = res.status;
    throw err;
  }
  return result; // { child, event | redemption, duplicate }
}

export const undoAward = (eventId, requestId = newRequestId()) =>
  postUndo(`/api/point-events/${eventId}/undo`, requestId);

export const undoSpend = (redemptionId, requestId = newRequestId()) =>
  postUndo(`/api/redemptions/${redemptionId}/undo`, requestId);

export const UNDO_TOAST_MS = 10000;

// The toast's Undo button. Runs once: a second tap does nothing. The request
// id is fixed per toast, so even a repeat call could only replay.
export function undoAction(kind, id, queryClient) {
  const requestId = newRequestId();
  let started = false;
  return async () => {
    if (started) return;
    started = true;
    try {
      const r = await (kind === 'spend' ? undoSpend(id, requestId) : undoAward(id, requestId));
      toast.success(`Undone. ${r.child.name} has ${r.child.total_points} points.`);
    } catch (err) {
      toast.error(err.status === 409 || err.status === 404 ? err.message : "Couldn't undo that. Check your connection and look in Activity.");
    } finally {
      refreshPoints(queryClient);
    }
  };
}

// One spend per tap. The server prices the reward. The request id is made
// once and reused for one automatic retry, so a spend whose reply was lost
// is not charged twice. Returns the parsed reply; throws with the server's
// message when it refuses.
export async function spendReward(childId, rewardId, requestId = newRequestId()) {
  const send = () => fetch(`/api/children/${childId}/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ reward_id: rewardId, request_id: requestId }),
  });
  let res;
  try {
    res = await send();
  } catch {
    res = null;
  }
  if (!res || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 800));
    res = await send();
  }
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(result.error || 'Could not spend the points');
    err.status = res.status;
    throw err;
  }
  return result; // { child, redemption, duplicate }
}
