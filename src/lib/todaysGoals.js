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

// E05: all text below is built from the server's YYYY-MM-DD strings and fixed
// word lists, never from the device clock, zone or locale (design N9).
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const parts = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // ISO weekday of a calendar date, computed in UTC so no zone can shift it.
  const iso = ((new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7) + 1;
  return { y, mo, d, iso };
};

// "Thursday 12 November"
export function goalDateLine(ymd) {
  const p = parts(ymd);
  return p ? `${WEEKDAY_NAMES[p.iso - 1]} ${p.d} ${MONTHS[p.mo - 1]}` : '';
}

// "16 Nov"
export function goalShortDate(ymd) {
  const p = parts(ymd);
  return p ? `${p.d} ${MONTHS[p.mo - 1].slice(0, 3)}` : '';
}

const uniqueDays = (days) => [...new Set((days || []).map(Number))]
  .filter(d => d >= 1 && d <= 7).sort((a, b) => a - b);

// Today's Goals row: "Repeats Mon, Wed, Fri" / "Repeats every day" (register
// recurring_indicator: the actual scheduled days, never a streak).
export function goalRepeatText(weekdays) {
  const days = uniqueDays(weekdays);
  if (!days.length) return '';
  if (days.length === 7) return 'Repeats every day';
  return 'Repeats ' + days.map(d => GOAL_DAYS[d - 1].label).join(', ');
}

// Manage goals row schedule: "Every day", "Mon–Fri", "Mon, Wed, Fri", "One-off · 16 Nov".
export function goalScheduleSummary(goal) {
  if (goal.schedule_kind === 'one_off') return 'One-off · ' + goalShortDate(goal.scheduled_date);
  const days = uniqueDays(goal.weekdays);
  if (days.length === 7) return 'Every day';
  const contiguous = days.length >= 3 && days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  if (contiguous) return GOAL_DAYS[days[0] - 1].label + '–' + GOAL_DAYS[days[days.length - 1] - 1].label;
  return days.map(d => GOAL_DAYS[d - 1].label).join(', ');
}

export const pointsText = (n) => '+' + n + (n === 1 ? ' point' : ' points');

export const sameWeekdays = (a, b) => uniqueDays(a).join(',') === uniqueDays(b).join(',');

// The form's start-date state for a weekly goal (mirrors the server rule,
// design section 9). Returns whether the start date is editable, its value,
// and the hint to show.
export function editStartDate(goal, weekdays, today) {
  if (!goal) return { editable: true, value: today, hint: null };
  const stored = goal.schedule_kind === 'weekly' ? goal.start_date : null;
  const changed = !stored || !sameWeekdays(goal.weekdays, weekdays);
  if (!changed) {
    if (stored < today) return { editable: false, value: stored, hint: null };
    return { editable: true, value: stored, hint: null };
  }
  const value = stored && stored > today ? stored : today;
  return { editable: true, value, hint: stored ? 'newSchedule' : null };
}

// V1 approved wording (design 18769f7): "Wednesday 18 Nov".
export function goalDateShortLine(ymd) {
  const p = parts(ymd);
  return p ? `${WEEKDAY_NAMES[p.iso - 1]} ${p.d} ${MONTHS[p.mo - 1].slice(0, 3)}` : '';
}

// V1 approved recurrence text on goal rows: "Today" (one-off due today),
// "Daily" (all seven days), otherwise the real days ("Mon, Wed, Fri").
// A one-off on another date shows its date ("16 Nov").
export function goalRecurrenceV1(goal, today) {
  if (goal.schedule_kind === 'one_off') return goal.scheduled_date === today ? 'Today' : goalShortDate(goal.scheduled_date);
  const days = uniqueDays(goal.weekdays);
  if (days.length === 7) return 'Daily';
  return days.map(d => GOAL_DAYS[d - 1].label).join(', ');
}
