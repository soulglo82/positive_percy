// Family-authenticated Today's Goals API. The server chooses the family-local day
// and the current category points; no points or award dates come from the UI.
import { getToken } from '@/lib/AuthContext';
import { newRequestId } from '@/lib/points';

async function callGoals(path, options = {}) {
  const res = await fetch('/api/todays-goals' + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + getToken(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'Could not update goals');
    err.status = res.status;
    throw err;
  }
  return body;
}

export const loadTodaysGoals = (manage = false) =>
  callGoals(manage ? '?manage=true' : '');

export const saveTodayGoal = (payload, id = null) =>
  callGoals(id ? '/' + id : '', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  });

export const archiveTodayGoal = (id) =>
  callGoals('/' + id, { method: 'DELETE' });

// Same request id is retried on transient failure, so a lost reply cannot
// award again. Server-side constraints also protect simultaneous taps.
export async function completeTodayGoal(id, requestId = newRequestId()) {
  const send = () => callGoals('/' + id + '/complete', {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId }),
  });
  try {
    return await send();
  } catch (err) {
    if (err.status && err.status < 500) throw err;
    return send();
  }
}

export const GOAL_DAYS = [
  { number: 1, label: 'Mon' }, { number: 2, label: 'Tue' },
  { number: 3, label: 'Wed' }, { number: 4, label: 'Thu' },
  { number: 5, label: 'Fri' }, { number: 6, label: 'Sat' },
  { number: 7, label: 'Sun' },
];

export function goalSchedule(goal) {
  if (goal.schedule_kind === 'one_off') return goal.scheduled_date;
  return GOAL_DAYS.filter(day => (goal.weekdays || []).includes(day.number))
    .map(day => day.label).join(', ');
}
