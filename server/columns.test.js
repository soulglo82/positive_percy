import { describe, it, expect } from 'vitest';
import { pickAllowedColumns, COLUMN_WHITELIST, findMissingRequired } from './columns.js';

describe('pickAllowedColumns — children', () => {
  it('keeps every intended Add Child column', () => {
    const payload = {
      name: 'Emma',
      avatar_url: '/api/uploads/1',
      weekly_target: 35,
      total_points: 20,
      weekly_points: 20,
      age: 7,
      family_code: 'ABC123',
    };
    expect(pickAllowedColumns('children', payload)).toEqual(payload);
  });

  it('silently drops unexpected fields (mass-assignment protection)', () => {
    const result = pickAllowedColumns('children', {
      name: 'Emma',
      isAdmin: true,
      family_id: 'other-family',
      role: 'owner',
      reward_stack: '[]', // whitelisted, kept
    });
    expect(result).toEqual({ name: 'Emma', reward_stack: '[]' });
    expect(result).not.toHaveProperty('isAdmin');
    expect(result).not.toHaveProperty('family_id');
    expect(result).not.toHaveProperty('role');
  });

  it('drops raw camelCase form keys that never map to a column', () => {
    const result = pickAllowedColumns('children', {
      name: 'Emma',
      weeklyTarget: 50,
      startingPoints: 20,
    });
    expect(result).toEqual({ name: 'Emma' });
  });

  it('does not leak column names — returns data only, never throws on bad keys', () => {
    expect(() => pickAllowedColumns('children', { nope: 1 })).not.toThrow();
    expect(pickAllowedColumns('children', { nope: 1 })).toEqual({});
  });

  it('handles empty / nullish input', () => {
    expect(pickAllowedColumns('children', {})).toEqual({});
    expect(pickAllowedColumns('children', null)).toEqual({});
    expect(pickAllowedColumns('children', undefined)).toEqual({});
  });
});

describe('COLUMN_WHITELIST', () => {
  it('includes age for children', () => {
    expect(COLUMN_WHITELIST.children.has('age')).toBe(true);
  });
});

describe('pickAllowedColumns — table without a whitelist entry', () => {
  it('returns the data unfiltered (documents the fallback path)', () => {
    // 'users' is intentionally not in COLUMN_WHITELIST; its route enforces its
    // own USER_COLUMN_WHITELIST. This asserts the helper's documented fallback.
    const result = pickAllowedColumns('users', { email: 'a@b.com', isAdmin: true });
    expect(result).toEqual({ email: 'a@b.com', isAdmin: true });
  });
});

describe('findMissingRequired', () => {
  it('flags a child create missing its required name', () => {
    expect(findMissingRequired('children', { age: 5 })).toEqual(['name']);
    expect(findMissingRequired('children', { name: '   ' })).toEqual(['name']); // blank
    expect(findMissingRequired('children', { name: null })).toEqual(['name']);
  });

  it('passes a child create that has a name', () => {
    expect(findMissingRequired('children', { name: 'Emma' })).toEqual([]);
  });

  it('flags each missing required reward column', () => {
    expect(findMissingRequired('rewards', {}).sort()).toEqual(['cost_points', 'title']);
    expect(findMissingRequired('rewards', { title: 'Ice cream', cost_points: 10 })).toEqual([]);
  });

  it('does not require family_code (it is stamped from the token)', () => {
    expect(findMissingRequired('children', { name: 'Emma' })).not.toContain('family_code');
  });

  it('requires nothing for a table with no required columns', () => {
    expect(findMissingRequired('users', { anything: 1 })).toEqual([]);
  });
});
