import { useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Numeric input that behaves like a normal text field while editing.
 *
 * The naive `<Input type="number" value={n} onChange={e => set(Number(e.target.value))}/>`
 * pattern coerces every keystroke with `Number()`. Because `Number('') === 0`,
 * the field can never be emptied — it snaps back to 0 — so a field defaulting to
 * 0 shows a "mandatory" leading zero you can't delete. This component keeps the
 * raw text locally so the field can be blank while the user types, and only
 * reports a number (or `emptyValue` when blank) to the parent.
 *
 * `value` is the numeric model value. `onChange` receives a Number. A field
 * whose value equals `emptyValue` renders blank (showing its placeholder)
 * instead of a stuck zero.
 */
export default function NumberInput({ value, onChange, emptyValue = 0, ...props }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');

  const modelText =
    value === null || value === undefined || value === emptyValue ? '' : String(value);

  // While the field is focused we never overwrite what the user is typing;
  // otherwise the displayed text mirrors the model value.
  const displayed = focused ? text : modelText;

  const handleChange = (e) => {
    const raw = e.target.value;
    setText(raw);
    if (raw === '') {
      onChange(emptyValue);
      return;
    }
    const n = Number(raw);
    // Ignore transient non-numeric states (e.g. a lone "-") — keep the text so
    // the user can finish typing, but don't push NaN to the parent.
    if (!Number.isNaN(n)) onChange(n);
  };

  return (
    <Input
      {...props}
      type="number"
      value={displayed}
      onChange={handleChange}
      onFocus={(e) => {
        setFocused(true);
        setText(modelText);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
    />
  );
}
