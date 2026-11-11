import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn knows the token scale', () => {
  it('keeps a custom size next to a colour', () => {
    expect(cn('w-16 h-16 text-title', 'rounded-full bg-selected text-foreground')).toContain('text-title');
    expect(cn('font-semibold text-foreground text-title')).toContain('text-foreground');
    expect(cn('text-total', 'text-earn')).toBe('text-total text-earn');
  });
  it('still lets a later size win over an earlier one', () => {
    expect(cn('text-sm', 'text-title')).toBe('text-title');
    expect(cn('text-title', 'text-lg')).toBe('text-lg');
  });
  it('still lets a later colour win over an earlier one', () => {
    expect(cn('text-foreground', 'text-earn')).toBe('text-earn');
  });
});
