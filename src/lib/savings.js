// D1 savings (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §19). A parent
// saves points towards a bigger goal, moves them back, undoes either, and
// redeems the goal. Every call carries a request id made once per tap and
// reused for one automatic retry, so a lost reply can only replay.
import { getToken } from '@/lib/AuthContext';
import { newRequestId } from '@/lib/points';

async function post(path, body) {
  const send = () => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  });
  let res;
  try { res = await send(); } catch { res = null; }
  if (!res || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 800));
    res = await send();
  }
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(result.error || '');
    err.status = res.status;
    throw err;
  }
  return result; // { event | redemption, child, duplicate }
}

export const saveTowards = (childId, rewardId, points, requestId = newRequestId()) =>
  post(`/api/children/${childId}/savings/save`, { reward_id: rewardId, points, request_id: requestId });

export const moveBack = (childId, rewardId, points, requestId = newRequestId()) =>
  post(`/api/children/${childId}/savings/release`, { reward_id: rewardId, points, request_id: requestId });

export const undoSavings = (eventId, requestId = newRequestId()) =>
  post(`/api/savings-events/${eventId}/undo`, { request_id: requestId });

export const redeemGoal = (childId, rewardId, requestId = newRequestId()) =>
  post(`/api/children/${childId}/savings/redeem`, { reward_id: rewardId, request_id: requestId });

// The goal shown first (design §5 O5, N7): the one with the most saved,
// then the one closest to done, then by title, so the choice is stable.
export function leadingGoal(goals = []) {
  return [...goals].sort((a, b) => (b.saved - a.saved) || (a.to_go - b.to_go) || String(a.name).localeCompare(String(b.name)))[0] || null;
}

// Bigger goals this child may save for: marked, in the family, for all
// children or for this one. Figures still come from the server (child.goals).
export const goalRewardsFor = (rewards, childId, isAssignedTo) =>
  rewards.filter((r) => r.is_bigger_goal && isAssignedTo(r, childId));

export const pointsWord = (n) => (n === 1 ? 'point' : 'points');
