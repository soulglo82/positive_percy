import { describe, it, expect } from 'vitest';
import { buildChildCreatePayload } from './childPayload';
import { COLUMN_WHITELIST } from '../../server/columns.js';

describe('buildChildCreatePayload', () => {
  it('maps every Add Child form field to snake_case columns', () => {
    const out = buildChildCreatePayload({
      name: '  Emma  ',
      age: '7',
      weeklyTarget: 35,
      startingPoints: 20,
      avatar_url: '/api/uploads/1',
    });
    expect(out).toMatchObject({
      name: 'Emma',
      weekly_target: 35,
      total_points: 20,
      weekly_points: 20,
      age: 7,
      avatar_url: '/api/uploads/1',
    });
    expect(out).toHaveProperty('last_reset_date');
  });

  it('emits only keys that are valid children columns', () => {
    const out = buildChildCreatePayload({
      name: 'Emma', age: 7, weeklyTarget: 50, startingPoints: 0, avatar_url: '',
    });
    for (const key of Object.keys(out)) {
      expect(COLUMN_WHITELIST.children.has(key)).toBe(true);
    }
  });

  it('startingPoints seeds the balance: 0 -> 0', () => {
    const out = buildChildCreatePayload({ name: 'Emma', startingPoints: 0 });
    expect(out.total_points).toBe(0);
    expect(out.weekly_points).toBe(0);
  });

  it('startingPoints seeds the balance: 20 -> 20', () => {
    const out = buildChildCreatePayload({ name: 'Emma', startingPoints: 20 });
    expect(out.total_points).toBe(20);
    expect(out.weekly_points).toBe(20);
  });

  it('falls back to defaults when optionals are omitted (name only)', () => {
    const out = buildChildCreatePayload({ name: 'Emma' });
    expect(out.weekly_target).toBe(50);
    expect(out.total_points).toBe(0);
    expect(out.age).toBeNull();
    expect(out.avatar_url).toBe('');
  });

  it('treats empty / non-positive age as null', () => {
    expect(buildChildCreatePayload({ name: 'Emma', age: '' }).age).toBeNull();
    expect(buildChildCreatePayload({ name: 'Emma', age: 0 }).age).toBeNull();
  });

  it('truncates a non-integer age to a whole number (INTEGER column)', () => {
    expect(buildChildCreatePayload({ name: 'Emma', age: 7.5 }).age).toBe(7);
    expect(buildChildCreatePayload({ name: 'Emma', age: '9.9' }).age).toBe(9);
    expect(Number.isInteger(buildChildCreatePayload({ name: 'Emma', age: 7.5 }).age)).toBe(true);
  });
});
