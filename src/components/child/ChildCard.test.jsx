import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChildCard from './ChildCard';
import { CHILD_COLOURS } from '@/lib/childColour';

const child = { id: '1', name: 'Sam', total_points: 12, week_points: 4, weekly_target: 10 };
const props = { child, colour: CHILD_COLOURS[0], onAddPoints: () => {} };

describe('ChildCard quick points', () => {
  it('none ticked: no built-in buttons, a link to Settings instead', () => {
    render(<MemoryRouter><ChildCard {...props} onQuickAction={() => {}} quickActions={[]} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Choose them in Settings/ })).toHaveAttribute('href', '/parentprofile');
    expect(screen.queryByRole('button', { name: / for Sam$/ })).toBeNull();
  });
});

describe('ChildCard pop', () => {
  it('no pop without an award from this device', () => {
    const { container } = render(<ChildCard {...props} />);
    expect(container.querySelector('.star-pop')).toBeNull();
  });
  it('pops when this device awards, and again on the next award', () => {
    const { container, rerender } = render(<ChildCard {...props} popKey={1} />);
    const first = container.querySelector('.star-pop');
    expect(first).not.toBeNull();
    rerender(<ChildCard {...props} popKey={2} />);
    const second = container.querySelector('.star-pop');
    expect(second).not.toBeNull();
    expect(second).not.toBe(first); // a new element, so the animation plays again
  });
  it('a refetch with a higher total does not pop', () => {
    const { container, rerender } = render(<ChildCard {...props} />);
    rerender(<ChildCard {...props} child={{ ...child, total_points: 50 }} />);
    expect(container.querySelector('.star-pop')).toBeNull();
  });
  it('the band and the bar wear the child colour', () => {
    const { container } = render(<ChildCard {...props} />);
    expect(container.querySelectorAll('.bg-kid-1').length).toBeGreaterThanOrEqual(2);
  });
});
