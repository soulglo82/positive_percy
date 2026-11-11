import { describe, it, expect } from 'vitest';
import { childColour, CHILD_COLOURS } from './childColour';

const kids = [
  { id: 'c', created_date: '2026-01-03T00:00:00Z' },
  { id: 'a', created_date: '2026-01-01T00:00:00Z' },
  { id: 'b', created_date: '2026-01-02T00:00:00Z' },
];

describe('childColour', () => {
  it('is the same whatever order the list arrives in', () => {
    const reversed = [...kids].reverse();
    for (const k of kids) expect(childColour(k, kids)).toBe(childColour(k.id, reversed));
  });
  it('gives the first six children six different colours', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `k${i}`, created_date: `2026-01-0${i + 1}T00:00:00Z` }));
    expect(new Set(six.map((k) => childColour(k, six).band)).size).toBe(6);
  });
  it('oldest child first', () => {
    expect(childColour('a', kids)).toBe(CHILD_COLOURS[0]);
    expect(childColour('c', kids)).toBe(CHILD_COLOURS[2]);
  });
  it('a new child does not change the others', () => {
    const before = kids.map((k) => childColour(k, kids));
    const more = [...kids, { id: 'z', created_date: '2026-02-01T00:00:00Z' }];
    expect(kids.map((k) => childColour(k, more))).toEqual(before);
  });
  it('same time: ordered by id, not by list order', () => {
    const tie = [{ id: 'y', created_date: '2026-01-01T00:00:00Z' }, { id: 'x', created_date: '2026-01-01T00:00:00Z' }];
    expect(childColour('x', tie)).toBe(CHILD_COLOURS[0]);
  });
  it('a stored colour wins over the order, and needs no list', () => {
    expect(childColour({ id: 'q', colour_index: 4 })).toBe(CHILD_COLOURS[4]);
    expect(childColour('c', [{ id: 'c', colour_index: 0, created_date: '2026-03-01T00:00:00Z' }, ...kids.slice(1)])).toBe(CHILD_COLOURS[0]);
  });
  it('an unknown child gets the neutral look', () => {
    expect(childColour('nobody', kids).band).toBe('bg-border');
  });
});
