import { describe, it, expect } from 'vitest';
import { isAssignedTo } from './assignment';

describe('isAssignedTo', () => {
  it('no assignment: every child; otherwise the listed child, in any letter case', () => {
    expect(isAssignedTo({ assigned_child_ids: [] }, 'abc')).toBe(true);
    expect(isAssignedTo({}, 'abc')).toBe(true);
    expect(isAssignedTo({ assigned_child_ids: ['ABC'] }, 'abc')).toBe(true);
    expect(isAssignedTo({ assigned_child_ids: ['abc'] }, 'ABC')).toBe(true);
    expect(isAssignedTo({ assigned_child_ids: ['abd'] }, 'abc')).toBe(false);
    expect(isAssignedTo({ assigned_child_ids: ['abc'] }, null)).toBe(false);
  });
});
