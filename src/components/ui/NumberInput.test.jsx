import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react';
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

  it('supports typing a negative number character by character', () => {
    render(<Harness initial={0} />);
    const input = screen.getByLabelText('n');
    fireEvent.focus(input);
    // A lone "-" is a transient, not-yet-valid number: field stays editable and
    // the parent is not handed NaN.
    fireEvent.change(input, { target: { value: '-' } });
    expect(input).toHaveValue(null);
    expect(screen.getByTestId('val')).toHaveTextContent('0');
    // Completing it reports the negative value.
    fireEvent.change(input, { target: { value: '-5' } });
    expect(input).toHaveValue(-5);
    expect(screen.getByTestId('val')).toHaveTextContent('-5');
  });

  // followModel: another control can set the value while the field has focus
  // (the Give Percy Points amount). Off by default: the other forms keep the
  // typed text, whatever the parent does with the number.
  describe('followModel', () => {
    function Follows({ follow, emptyValue = '', initial = 1, clamp }) {
      const [v, setV] = useState(initial);
      return (
        <>
          <NumberInput value={v} onChange={(n) => setV(clamp ? Math.min(n, clamp) : n)} emptyValue={emptyValue} followModel={follow} aria-label="n" />
          <button type="button" onClick={() => setV(4)}>four</button>
          <button type="button" onClick={() => setV(0)}>zero</button>
          <span data-testid="val">{String(v)}</span>
        </>
      );
    }
    const setFour = () => fireEvent.click(screen.getByRole('button', { name: 'four' }));

    // followModel is the field's own option, not an attribute: React reports an
    // unknown attribute once per run, so every test here listens for it, and
    // for anything else React has to say.
    let errors;
    beforeEach(() => { errors = vi.spyOn(console, 'error').mockImplementation(() => {}); });
    afterEach(() => {
      const said = errors.mock.calls.map((c) => c.join(' '));
      errors.mockRestore();
      expect(said).toEqual([]);
    });

    it('shows a value set from outside while focused, in the same field, still focused', () => {
      render(<Follows follow />);
      const input = screen.getByLabelText('n');
      act(() => input.focus());
      fireEvent.change(input, { target: { value: '25' } });
      setFour();
      expect(screen.getByLabelText('n')).toBe(input);
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe('4');
      // Typing carries on from what is showing.
      fireEvent.change(input, { target: { value: '40' } });
      expect(input.value).toBe('40');
      expect(screen.getByTestId('val')).toHaveTextContent('40');
    });

    it('off (the default): a focused field keeps the typed text when the value is set from outside', () => {
      render(<Follows />);
      const input = screen.getByLabelText('n');
      act(() => input.focus());
      fireEvent.change(input, { target: { value: '25' } });
      setFour();
      expect(input.value).toBe('25');
      expect(screen.getByTestId('val')).toHaveTextContent('4');
    });

    it('off (the default): a parent that changes the number does not rewrite the typed text', () => {
      render(<Follows clamp={10} />);
      const input = screen.getByLabelText('n');
      act(() => input.focus());
      fireEvent.change(input, { target: { value: '25' } });
      expect(input.value).toBe('25');
      expect(screen.getByTestId('val')).toHaveTextContent('10');
    });

    it.each([['007', '7'], ['1e3', '1000'], ['2.5', '2.5'], ['0', '0'], ['-3', '-3'], ['', '']])(
      'keeps the typed text "%s" exactly as typed (it still stands for the value)', (typed, model) => {
        render(<Follows follow />);
        const input = screen.getByLabelText('n');
        act(() => input.focus());
        fireEvent.change(input, { target: { value: typed } });
        expect(input.value).toBe(typed);
        expect(screen.getByTestId('val')).toHaveTextContent(model === '' ? '' : model);
        expect(document.activeElement).toBe(input);
      });

    it('keeps a typed "0" when 0 is also the empty value', () => {
      render(<Follows follow emptyValue={0} initial={5} />);
      const input = screen.getByLabelText('n');
      act(() => input.focus());
      fireEvent.change(input, { target: { value: '0' } });
      expect(input.value).toBe('0');
    });

    it.each([[0, ['0', '0.5']], [0, ['-0', '-0.5']], [1, ['1', '15']], [0, ['', '7']], ['', ['0', '0.5']]])(
      'empty value %s: typing %j is never taken for a change from outside', (emptyValue, steps) => {
        render(<Follows follow emptyValue={emptyValue} initial={5} />);
        const input = screen.getByLabelText('n');
        act(() => input.focus());
        for (const text of steps) {
          fireEvent.change(input, { target: { value: text } });
          expect(input.value).toBe(text);
        }
        expect(screen.getByTestId('val')).toHaveTextContent(String(Number(steps.at(-1))));
      });

    it('typing one character at a time is never overtaken', () => {
      render(<Follows follow />);
      const input = screen.getByLabelText('n');
      act(() => input.focus());
      for (const text of ['', '2', '25', '2', '']) {
        fireEvent.change(input, { target: { value: text } });
        expect(input.value).toBe(text);
        expect(document.activeElement).toBe(input);
      }
    });

    it('an emptied field shows a 0 set from outside (empty does not stand for 0 here)', () => {
      render(<Follows follow />);
      const input = screen.getByLabelText('n');
      act(() => input.focus());
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'zero' }));
      expect(input.value).toBe('0');
    });

  });
});
