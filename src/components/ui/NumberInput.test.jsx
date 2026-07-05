import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import NumberInput from './NumberInput';

// Mirrors real usage: a parent holds the numeric model value.
function Harness({ initial = 0, emptyValue }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <NumberInput value={v} onChange={setV} emptyValue={emptyValue} aria-label="n" />
      <span data-testid="val">{String(v)}</span>
    </>
  );
}

describe('NumberInput', () => {
  it('renders a value of 0 as an empty field — no stuck leading zero', () => {
    render(<Harness initial={0} />);
    expect(screen.getByLabelText('n')).toHaveValue(null); // number input, empty
  });

  it('renders a non-zero model value', () => {
    render(<Harness initial={50} />);
    expect(screen.getByLabelText('n')).toHaveValue(50);
  });

  it('reports the typed number to the parent', () => {
    render(<Harness initial={0} />);
    const input = screen.getByLabelText('n');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '20' } });
    expect(input).toHaveValue(20);
    expect(screen.getByTestId('val')).toHaveTextContent('20');
  });

  it('can be cleared to empty — falls back to emptyValue instead of snapping to 0 in the box', () => {
    render(<Harness initial={5} />);
    const input = screen.getByLabelText('n');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(null); // stays empty while focused
    expect(screen.getByTestId('val')).toHaveTextContent('0'); // parent gets emptyValue
  });

  it('uses a custom emptyValue when the field is cleared', () => {
    render(<Harness initial={5} emptyValue={1} />);
    const input = screen.getByLabelText('n');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByTestId('val')).toHaveTextContent('1');
  });
});
