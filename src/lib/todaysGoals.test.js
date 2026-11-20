// E05: goal text and the start-date rule, independent of the device zone.
import { describe, it, expect } from 'vitest';
import { goalDateLine, goalShortDate, goalScheduleSummary, pointsText, editStartDate, sameWeekdays } from './todaysGoals';

describe('goal text', () => {
  it('formats the server date with fixed words, whatever the process zone', () => {
    expect(goalDateLine('2026-11-12')).toBe('Thursday 12 November');
    expect(goalDateLine('2026-01-04')).toBe('Sunday 4 January');
    expect(goalDateLine('2028-02-29')).toBe('Tuesday 29 February');
    expect(goalShortDate('2026-11-16')).toBe('16 Nov');
    expect(goalDateLine('nonsense')).toBe('');
    expect(goalDateLine(undefined)).toBe('');
  });
  it('dialog schedule summaries', () => {
    expect(goalScheduleSummary({ schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe('Mon–Fri');
    expect(goalScheduleSummary({ schedule_kind: 'weekly', weekdays: [6, 7] })).toBe('Sat, Sun');
    expect(goalScheduleSummary({ schedule_kind: 'weekly', weekdays: [1, 3, 5] })).toBe('Mon, Wed, Fri');
    expect(goalScheduleSummary({ schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7] })).toBe('Every day');
    expect(goalScheduleSummary({ schedule_kind: 'one_off', scheduled_date: '2026-11-16' })).toBe('One-off · 16 Nov');
  });
  it('points text is singular for one point', () => {
    expect(pointsText(1)).toBe('+1 point');
    expect(pointsText(5)).toBe('+5 points');
  });
});

describe('editStartDate (mirrors the server rule)', () => {
  const today = '2026-11-18';
  const running = { schedule_kind: 'weekly', weekdays: [1, 3], start_date: '2026-10-01' };
  it('new goal: editable, today', () => {
    expect(editStartDate(null, [1], today)).toEqual({ editable: true, value: today, hint: null });
  });
  it('running routine, same days (any order): kept and read-only', () => {
    expect(editStartDate(running, [3, 1], today)).toEqual({ editable: false, value: '2026-10-01', hint: null });
  });
  it('running routine, days changed: today, with the new-schedule hint', () => {
    expect(editStartDate(running, [2], today)).toEqual({ editable: true, value: today, hint: 'newSchedule' });
  });
  it('future routine: stays editable; a schedule change keeps the later start', () => {
    const future = { ...running, start_date: '2026-12-01' };
    expect(editStartDate(future, [1, 3], today)).toEqual({ editable: true, value: '2026-12-01', hint: null });
    expect(editStartDate(future, [5], today).value).toBe('2026-12-01');
  });
  it('a one-off becoming weekly starts today', () => {
    expect(editStartDate({ schedule_kind: 'one_off', scheduled_date: '2026-11-01', weekdays: [] }, [1], today).value).toBe(today);
  });
  it('weekday comparison ignores order and duplicates', () => {
    expect(sameWeekdays([3, 1, 1], [1, 3])).toBe(true);
    expect(sameWeekdays([1], [1, 2])).toBe(false);
  });
});

import { goalDateShortLine, goalRecurrenceV1 } from './todaysGoals';
describe('V1 goal wording', () => {
  it('short date line and recurrence', () => {
    expect(goalDateShortLine('2026-11-18')).toBe('Wednesday 18 Nov');
    expect(goalRecurrenceV1({ schedule_kind: 'one_off', scheduled_date: '2026-11-18' }, '2026-11-18')).toBe('Today');
    expect(goalRecurrenceV1({ schedule_kind: 'one_off', scheduled_date: '2026-11-20' }, '2026-11-18')).toBe('20 Nov');
    // Real days only: sorted, de-duplicated, out-of-range values dropped.
    expect(goalRecurrenceV1({ schedule_kind: 'weekly', weekdays: [5, 1, 3, 3, 0, 8] }, '2026-11-18')).toBe('Mon, Wed, Fri');
    expect(goalRecurrenceV1({ schedule_kind: 'weekly', weekdays: [7, 6, 5, 4, 3, 2, 1, 1] }, '2026-11-18')).toBe('Daily');
    expect(goalRecurrenceV1({ schedule_kind: 'weekly', weekdays: [7, 1, 2, 3, 4, 5, 6] }, 'x')).toBe('Daily');
    expect(goalRecurrenceV1({ schedule_kind: 'weekly', weekdays: [5, 1, 3] }, 'x')).toBe('Mon, Wed, Fri');
  });
});
