import { describe, it, expect } from 'vitest';
import { pickAllowedColumns, COLUMN_WHITELIST } from './columns.js';

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
