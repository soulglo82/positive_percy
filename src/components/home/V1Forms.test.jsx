// V1-F (docs/engineering/V1-F-DESIGN.md): Onboarding, Welcome and Award Points.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import OnboardingTips from '@/components/OnboardingTips';
import WelcomeCard from '@/components/home/WelcomeCard';
import AwardPointsDialog from '@/components/home/AwardPointsDialog';

const kids = [
  { id: 'c1', name: 'Lara', colour_index: 0, created_date: '2026-01-01', week_points: 18, weekly_target: 25 },
  { id: 'c2', name: 'Omar', colour_index: 1, created_date: '2026-01-02', week_points: 10, weekly_target: 20 },
];
const cats = [
  { id: 'k1', name: 'Kindness', points: 1, icon_key: 'kindness', assigned_children: [] },
  { id: 'k2', name: 'Chores', points: 3, icon_key: 'chores', assigned_children: [] },
  { id: 'k3', name: 'Piano', points: 2, icon_key: 'music', assigned_children: ['c2'] },
];

const wrap = (ui) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('Onboarding (V1-F O)', () => {
  beforeEach(() => localStorage.clear());
  it('shows the three approved modes and Explore Percy closes and remembers', () => {
    const onClose = vi.fn();
    render(<OnboardingTips isOpen onClose={onClose} />);
    const d = screen.getByRole('dialog');
    expect(within(d).getByRole('heading', { name: "Let's get started" })).toBeTruthy();
    expect(d.textContent).toContain('Three ways to help good habits grow.');
    expect(d.textContent).toContain("1. Today's Goals");
    expect(d.textContent).toContain('Make daily and weekly routines easy to see and celebrate.');
    expect(d.textContent).toContain('2. Notice positive behaviour');
    expect(d.textContent).toContain('Reward kindness, effort, learning and helping whenever you see them.');
    expect(d.textContent).toContain('3. Save for something bigger');
    expect(d.textContent).toContain('Enjoy smaller weekly treats, or keep saving points towards bigger adventures.');
    expect(d.querySelector('img')).toBeNull(); // no illustration in the locked design
    expect(document.activeElement.textContent).toBe('Explore Percy'); // opens on the action, not the list
    fireEvent.click(within(d).getByRole('button', { name: 'Explore Percy' }));
    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem('percy_onboarding_done')).toBe('true');
  });
});

describe('Welcome (V1-F W)', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('approved copy and Add your first child; no map when the build supplies none (gate coverage: releaseGates.test.js and CI)', () => {
    const onAdd = vi.fn();
    const { container } = render(<WelcomeCard onAddFirstChild={onAdd} />);
    expect(screen.getByRole('heading', { name: 'Every adventure starts with a goal!' })).toBeTruthy();
    expect(container.textContent).toContain('Add your first child, recognise positive behaviours, and choose a little treat or something bigger to save towards.');
    expect(container.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add your first child' }));
    expect(onAdd).toHaveBeenCalled();
  });
  it('shows the map, decorative, when the build supplies it', () => {
    vi.stubEnv('VITE_WELCOME_MAP', '/gated/map.png');
    const { container } = render(<WelcomeCard onAddFirstChild={() => {}} />);
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toBe('/gated/map.png');
    expect(img.getAttribute('alt')).toBe('');
  });
});

function renderAward(props = {}) {
  const onSubmit = props.onSubmit || vi.fn(async () => true);
  const onClose = vi.fn();
  wrap(<AwardPointsDialog isOpen onClose={onClose} children={kids} categories={cats}
    initialChildId="c1" onSubmit={onSubmit} {...props} />);
  return { onSubmit, onClose, d: screen.getByRole('dialog') };
}

describe('Award Points (V1-F A)', () => {
  it('approved copy; the preselected child; points come from the behaviour', () => {
    const { d } = renderAward();
    expect(within(d).getByRole('heading', { name: 'Give Percy Points' })).toBeTruthy();
    expect(d.textContent).toContain('Notice something positive, whenever it happens.');
    expect(d.textContent).toContain("Who's earned points?");
    expect(d.textContent).toContain('Select the child receiving the award.');
    expect(d.textContent).toContain('What did Lara do?');
    expect(d.textContent).toContain('Choose a positive behaviour.');
    expect(within(d).getByRole('button', { name: /^Lara/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(d).getByRole('button', { name: 'Kindness +1' }).getAttribute('aria-pressed')).toBe('true');
    expect(d.textContent).toContain('Lara earns 1 Percy Point');
    expect(d.textContent).toContain('For Kindness.');
    expect(within(d).getByRole('button', { name: 'Award 1 point' })).toBeTruthy();
    expect(d.textContent).not.toMatch(/design preview/);
    // No "Other": every award names a behaviour. The amount can be changed (V1-F design section 9).
    expect(within(d).queryByRole('button', { name: /^Other/ })).toBeNull();
  });

  it('a 3-point behaviour pluralises; submit sends its points and name', async () => {
    const { d, onSubmit } = renderAward();
    fireEvent.click(within(d).getByRole('button', { name: 'Chores +3' }));
    expect(d.textContent).toContain('Lara earns 3 Percy Points');
    fireEvent.change(within(d).getByLabelText('Add a note (optional)'), { target: { value: 'Tidy room' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Award 3 points' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].id).toBe('c1');
    expect(onSubmit.mock.calls[0][1]).toEqual({ points: 3, category: 'Chores', note: 'Tidy room' });
  });

  it('assigned behaviours follow the child (A1, A2)', () => {
    const { d } = renderAward();
    expect(within(d).queryByRole('button', { name: 'Piano +2' })).toBeNull();
    fireEvent.click(within(d).getByRole('button', { name: 'Chores +3' }));
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    expect(d.textContent).toContain('What did Omar do?');
    fireEvent.click(within(d).getByRole('button', { name: 'Piano +2' }));
    expect(d.textContent).toContain('Omar earns 2 Percy Points');
    // Back to Lara: Piano is not hers, so the selection moves to her first behaviour.
    fireEvent.click(within(d).getByRole('button', { name: /^Lara/ }));
    expect(within(d).getByRole('button', { name: 'Kindness +1' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps a usable selection when the child changes (A2)', () => {
    const { d } = renderAward();
    fireEvent.click(within(d).getByRole('button', { name: 'Chores +3' }));
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    expect(within(d).getByRole('button', { name: 'Chores +3' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('double tap sends once; a failure keeps the dialog open (E4, E5)', async () => {
    let release;
    const onSubmit = vi.fn(() => new Promise((r) => { release = r; }));
    const { d, onClose } = renderAward({ onSubmit });
    const btn = within(d).getByRole('button', { name: 'Award 1 point' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    release(false);
    await waitFor(() => expect(btn.disabled).toBe(false));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('no behaviours: existing guidance, submit disabled (E1)', () => {
    const { d } = renderAward({ categories: [] });
    expect(d.textContent).toContain('Add a behaviour in Family settings first.');
    expect(within(d).getByRole('button', { name: /^Award/ }).disabled).toBe(true);
    // Nothing to give an amount for.
    expect(within(d).queryByRole('spinbutton')).toBeNull();
    expect(d.textContent).not.toContain('How many points?');
  });
});

// Owner, 24 November 2026 (V1-F design section 10): the amount is one row,
// "Points", under the behaviour boxes: minus, the number, plus. It starts as
// the behaviour's points; once the parent chooses an amount (typed, or set
// with minus or plus) it stays for that behaviour; tapping a box starts again
// from the box's points.
describe('Award Points: the Points row (V1-F section 10)', () => {
  const RULE = 'Points must be a whole number from 1 to 1000.';
  const field = (d) => within(d).getByRole('spinbutton', { name: 'Points' });
  const plus = (d) => within(d).getByRole('button', { name: 'One point more' });
  const minus = (d) => within(d).getByRole('button', { name: 'One point fewer' });
  const type = (d, text) => { fireEvent.focus(field(d)); fireEvent.change(field(d), { target: { value: text } }); };
  const awardButton = (d) => within(d).getByRole('button', { name: /^Award/ });
  const tile = (d, name) => within(d).getByRole('button', { name });
  const press = (button, times = 1) => { for (let i = 0; i < times; i += 1) fireEvent.click(button); };

  it('two steps; the Points row sits under the boxes, inside the second step; the old amount step is gone', () => {
    const { d } = renderAward();
    const headings = within(d).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Who's earned points?", 'What did Lara do?']);
    expect(d.textContent).not.toContain('How many points?');
    expect(d.textContent).not.toContain("Use the behaviour's points, or choose another amount.");
    for (const old of ['+2', '+4', '+5', '+10']) expect(within(d).queryByRole('button', { name: old })).toBeNull();
    expect(field(d).value).toBe('1');
    expect(awardButton(d).textContent).toBe('Award 1 point');
    expect(d.textContent).not.toContain(RULE);
    // After the last box, before the note, in the same section as the boxes.
    const section = tile(d, 'Kindness +1').closest('section');
    expect(section.contains(field(d))).toBe(true);
    const boxes = within(d).getAllByRole('button', { name: /\+\d+$/ });
    const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(after(boxes.at(-1), minus(d))).toBe(true);
    expect(after(minus(d), field(d))).toBe(true);
    expect(after(field(d), plus(d))).toBe(true);
    expect(after(plus(d), within(d).getByLabelText('Add a note (optional)'))).toBe(true);
    expect(within(section).getByText('Points', { selector: 'label' })).toBeTruthy();
  });

  it('untouched, the amount follows the chosen behaviour', () => {
    const { d } = renderAward();
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d).value).toBe('3');
    expect(awardButton(d).textContent).toBe('Award 3 points');
  });

  it('plus four times gives 5; the request carries it with the behaviour\'s name', async () => {
    const { d, onSubmit } = renderAward();
    press(plus(d), 4);
    expect(field(d).value).toBe('5');
    expect(d.textContent).toContain('Lara earns 5 Percy Points');
    expect(d.textContent).toContain('For Kindness.');
    fireEvent.click(within(d).getByRole('button', { name: 'Award 5 points' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toEqual({ points: 5, category: 'Kindness', note: '' });
  });

  it('minus takes one away from the behaviour\'s points', () => {
    const { d } = renderAward();
    fireEvent.click(tile(d, 'Chores +3'));
    press(minus(d));
    expect(field(d).value).toBe('2');
    expect(awardButton(d).textContent).toBe('Award 2 points');
  });

  it('stays inside 1 to 1000, and the buttons stay usable at both ends', () => {
    const { d } = renderAward();
    press(minus(d), 3);
    expect(field(d).value).toBe('1');
    expect(minus(d).disabled).toBe(false); // a disabled button would drop the focus
    expect(minus(d).getAttribute('aria-disabled')).toBe('true');
    type(d, '999');
    expect(minus(d).getAttribute('aria-disabled')).toBe('false');
    press(plus(d), 3);
    expect(field(d).value).toBe('1000');
    expect(plus(d).disabled).toBe(false);
    expect(plus(d).getAttribute('aria-disabled')).toBe('true');
    expect(awardButton(d).textContent).toBe('Award 1000 points');
    expect(d.textContent).not.toContain(RULE);
  });

  it.each([
    ['', 'plus', '1'], ['', 'minus', '1'],
    ['0', 'plus', '1'], ['0', 'minus', '1'], ['-3', 'plus', '1'], ['-3', 'minus', '1'],
    ['2.5', 'plus', '3'], ['2.5', 'minus', '2'], ['0.5', 'minus', '1'],
    ['1001', 'plus', '1000'], ['1001', 'minus', '1000'], ['5000', 'minus', '1000'],
    ['25', 'plus', '26'], ['25', 'minus', '24'], ['007', 'plus', '8'],
  ])('typed %j then %s gives %s, which can be awarded', (text, which, expected) => {
    const { d } = renderAward();
    type(d, text);
    press(which === 'plus' ? plus(d) : minus(d));
    expect(field(d).value).toBe(expected);
    expect(awardButton(d).disabled).toBe(false);
    expect(awardButton(d).textContent).toBe(`Award ${expected} ${expected === '1' ? 'point' : 'points'}`);
    expect(d.textContent).not.toContain(RULE);
  });

  it('a typed amount is awarded', async () => {
    const { d, onSubmit } = renderAward();
    type(d, '25');
    expect(d.textContent).toContain('Lara earns 25 Percy Points');
    fireEvent.click(within(d).getByRole('button', { name: 'Award 25 points' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1].points).toBe(25);
  });

  it('a chosen amount stays through a child change that keeps the behaviour, and is sent', async () => {
    const { d, onSubmit } = renderAward();
    fireEvent.click(tile(d, 'Chores +3'));
    press(plus(d), 7);
    expect(field(d).value).toBe('10');
    fireEvent.click(tile(d, /^Omar/)); // Chores is Omar's too: the behaviour and the amount stay
    expect(tile(d, 'Chores +3').getAttribute('aria-pressed')).toBe('true');
    expect(field(d).value).toBe('10');
    expect(d.textContent).toContain('Omar earns 10 Percy Points');
    expect(d.textContent).toContain('For Chores.');
    fireEvent.click(within(d).getByRole('button', { name: 'Award 10 points' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].name).toBe('Omar');
    expect(onSubmit.mock.calls[0][1]).toEqual({ points: 10, category: 'Chores', note: '' });
  });

  it('tapping a box sets Points to that box\'s points, whatever was chosen before', () => {
    const { d } = renderAward();
    press(plus(d), 9);
    expect(field(d).value).toBe('10');
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d).value).toBe('3');
    expect(awardButton(d).textContent).toBe('Award 3 points');
    type(d, '40');
    fireEvent.click(tile(d, 'Chores +3')); // the selected box too
    expect(field(d).value).toBe('3');
    type(d, '');
    fireEvent.click(tile(d, 'Kindness +1')); // an emptied field is refilled
    expect(field(d).value).toBe('1');
    expect(awardButton(d).textContent).toBe('Award 1 point');
  });

  it('a child change that moves the behaviour starts again from the new behaviour\'s points', () => {
    const { d } = renderAward();
    fireEvent.click(tile(d, /^Omar/));
    fireEvent.click(tile(d, 'Piano +2'));
    press(plus(d), 5);
    expect(field(d).value).toBe('7');
    fireEvent.click(tile(d, /^Lara/)); // Piano is not Lara's: the behaviour moves to Kindness
    expect(tile(d, 'Kindness +1').getAttribute('aria-pressed')).toBe('true');
    expect(field(d).value).toBe('1');
    expect(awardButton(d).textContent).toBe('Award 1 point');
  });

  it('minus at 1 changes nothing and chooses nothing; plus then minus is a chosen amount', () => {
    const { d } = renderAward();
    press(minus(d), 2); // already 1: not a choice
    fireEvent.click(tile(d, /^Omar/)); // the behaviour stays, so a chosen amount would stay
    expect(field(d).value).toBe('1');
    press(plus(d));
    press(minus(d)); // back to 1, but now chosen
    expect(field(d).value).toBe('1');
    expect(minus(d).getAttribute('aria-disabled')).toBe('true');
    expect(plus(d).getAttribute('aria-disabled')).toBe('false');
  });

  it('an empty field cannot be awarded and says nothing', () => {
    const { d } = renderAward();
    type(d, '');
    expect(field(d).value).toBe('');
    expect(awardButton(d).disabled).toBe(true);
    expect(awardButton(d).textContent).toBe('Award points');
    expect(d.textContent).not.toContain(RULE);
    expect(d.textContent).not.toContain('Lara earns');
    expect(field(d).getAttribute('aria-invalid')).toBe('false');
    // A child change that keeps the behaviour does not refill an amount the parent emptied.
    fireEvent.click(tile(d, /^Omar/));
    expect(field(d).value).toBe('');
    expect(awardButton(d).disabled).toBe(true);
  });

  it('a number too large to be a number cannot be awarded', () => {
    const { d, onSubmit } = renderAward();
    type(d, '1e400');
    expect(awardButton(d).disabled).toBe(true);
    fireEvent.click(awardButton(d));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['0', '-3', '1001', '2.5'])('typing %j cannot be awarded and shows the rule', (text) => {
    const { d, onSubmit } = renderAward();
    type(d, text);
    expect(awardButton(d).disabled).toBe(true);
    expect(awardButton(d).textContent).toBe('Award points');
    expect(within(d).getByRole('alert').textContent).toBe(RULE);
    expect(field(d).getAttribute('aria-invalid')).toBe('true');
    expect(field(d).getAttribute('aria-describedby')).toBe(within(d).getByRole('alert').id);
    expect(d.textContent).not.toContain('Lara earns');
    fireEvent.click(awardButton(d));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([['1000', 1000], ['1e3', 1000], ['007', 7]])('typing %j awards %i', async (text, n) => {
    const { d, onSubmit } = renderAward();
    type(d, text);
    fireEvent.click(awardButton(d));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1].points).toBe(n);
  });

  // PR #73 review: the first typed character must not replace the field.
  it('typing an amount one character at a time keeps the same field, with focus', () => {
    const { d } = renderAward();
    const input = field(d);
    act(() => input.focus());
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '2' } });
    expect(input.isConnected).toBe(true);
    expect(field(d)).toBe(input);
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '25' } });
    expect(field(d)).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('25');
    expect(awardButton(d).textContent).toBe('Award 25 points');
  });

  it('clearing the amount and typing another keeps the same field, with focus', () => {
    const { d } = renderAward();
    const input = field(d);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '' } });
    expect(field(d)).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('');
    expect(awardButton(d).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '7' } });
    expect(field(d)).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(awardButton(d).textContent).toBe('Award 7 points');
  });

  it('an amount that was not typed never replaces the field or takes its focus', () => {
    // Minus, plus, another behaviour, another child: each can happen with
    // focus still in the field (a screen reader or switch).
    const { d } = renderAward();
    const input = field(d);
    act(() => input.focus());
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d)).toBe(input);
    expect(input.value).toBe('3');
    press(plus(d));
    expect(field(d)).toBe(input);
    expect(input.value).toBe('4');
    fireEvent.change(input, { target: { value: '40' } });
    expect(input.value).toBe('40');
    press(minus(d));
    expect(input.value).toBe('39');
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    expect(field(d)).toBe(input);
    expect(input.value).toBe('39');
    expect(document.activeElement).toBe(input);
  });

  it('typed text with leading zeros, then plus and minus, shows the plain amount', () => {
    const { d } = renderAward();
    const input = field(d);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '03' } });
    expect(input.value).toBe('03');
    press(plus(d));
    expect(input.value).toBe('4');
    press(minus(d));
    expect(input.value).toBe('3');
  });

  it('the field follows the behaviour\'s points even while it has focus', () => {
    const { d } = renderAward();
    fireEvent.focus(field(d));
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d).value).toBe('3');
    expect(awardButton(d).textContent).toBe('Award 3 points');
  });

  it('a refused award keeps the dialog open with the chosen amount; the amount cannot change while it is being sent', async () => {
    let release;
    const onSubmit = vi.fn(() => new Promise((r) => { release = r; }));
    const { d, onClose } = renderAward({ onSubmit });
    press(plus(d), 9);
    fireEvent.click(within(d).getByRole('button', { name: 'Award 10 points' }));
    expect(field(d).disabled).toBe(true);
    expect(plus(d).disabled).toBe(true);
    expect(minus(d).disabled).toBe(true);
    release(false);
    await waitFor(() => expect(field(d).disabled).toBe(false));
    expect(plus(d).disabled).toBe(false);
    expect(minus(d).disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(field(d).value).toBe('10');
    expect(onSubmit.mock.calls[0][1].points).toBe(10);
  });

  it('nothing that decides the amount can change while an award is being sent', async () => {
    // No amount chosen, so the amount is the behaviour's. A behaviour or child
    // picked in flight would show another amount than the one being sent.
    let release;
    const onSubmit = vi.fn(() => new Promise((r) => { release = r; }));
    const { d } = renderAward({ onSubmit });
    fireEvent.click(within(d).getByRole('button', { name: 'Award 1 point' }));
    fireEvent.click(tile(d, 'Chores +3'));
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    expect(awardButton(d).textContent).toBe('Award 1 point');
    expect(field(d).value).toBe('1');
    expect(tile(d, 'Kindness +1').getAttribute('aria-pressed')).toBe('true');
    expect(within(d).getByRole('button', { name: /^Lara/ }).getAttribute('aria-pressed')).toBe('true');
    release(false);
    await waitFor(() => expect(field(d).disabled).toBe(false));
    expect(onSubmit.mock.calls[0][0].name).toBe('Lara');
    expect(onSubmit.mock.calls[0][1]).toMatchObject({ points: 1, category: 'Kindness' });
    // Once the refusal is back the form works again.
    fireEvent.click(tile(d, 'Chores +3'));
    expect(awardButton(d).textContent).toBe('Award 3 points');
  });

  it('a refused award with the focus left in the field keeps the same field and the typed amount', async () => {
    // A browser sends no blur when a focused field is disabled.
    let release;
    const onSubmit = vi.fn(() => new Promise((r) => { release = r; }));
    const { d } = renderAward({ onSubmit });
    const input = field(d);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Award 25 points' }));
    release(false);
    await waitFor(() => expect(field(d).disabled).toBe(false));
    expect(field(d)).toBe(input);
    expect(input.value).toBe('25');
    press(minus(d));
    expect(input.value).toBe('24');
  });

  it('no behaviour to choose: no Points row', () => {
    const { d } = renderAward({ categories: [] });
    expect(within(d).queryByRole('spinbutton')).toBeNull();
    expect(within(d).queryByRole('button', { name: 'One point more' })).toBeNull();
    expect(within(d).queryByRole('button', { name: 'One point fewer' })).toBeNull();
    expect(awardButton(d).disabled).toBe(true);
  });

  const Dialog = (props) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}><AwardPointsDialog onClose={() => {}} children={kids} initialChildId="c1" onSubmit={async () => true} {...props} /></QueryClientProvider>;
  };

  it('reopening the same dialog starts fresh', () => {
    const view = render(<Dialog isOpen categories={cats} />);
    press(plus(screen.getByRole('dialog')), 9);
    expect(field(screen.getByRole('dialog')).value).toBe('10');
    view.rerender(<Dialog isOpen={false} categories={cats} />);
    view.rerender(<Dialog isOpen categories={cats} />);
    expect(field(screen.getByRole('dialog')).value).toBe('1');
    expect(tile(screen.getByRole('dialog'), 'Kindness +1').getAttribute('aria-pressed')).toBe('true');
  });

  it('behaviours that arrive after the dialog opened set the amount; a reload of the same behaviours keeps a chosen amount', () => {
    const view = render(<Dialog isOpen categories={[]} />);
    expect(within(screen.getByRole('dialog')).queryByRole('spinbutton')).toBeNull();
    view.rerender(<Dialog isOpen categories={cats} />);
    const d = screen.getByRole('dialog');
    expect(field(d).value).toBe('1');
    press(plus(d), 3);
    view.rerender(<Dialog isOpen categories={cats.map((c) => ({ ...c }))} />); // the same behaviours, new objects
    expect(field(screen.getByRole('dialog')).value).toBe('4');
  });

  it('minus at 1 chooses nothing: the amount still follows the behaviour if its points change', () => {
    const view = render(<Dialog isOpen categories={cats} />);
    press(minus(screen.getByRole('dialog')), 2); // already 1: nothing changes
    view.rerender(<Dialog isOpen categories={cats.map((c) => (c.id === 'k1' ? { ...c, points: 2 } : c))} />);
    expect(field(screen.getByRole('dialog')).value).toBe('2');
    // A real choice does not follow.
    press(plus(screen.getByRole('dialog')));
    view.rerender(<Dialog isOpen categories={cats.map((c) => (c.id === 'k1' ? { ...c, points: 5 } : c))} />);
    expect(field(screen.getByRole('dialog')).value).toBe('3');
  });

  it('a behaviour with no stored points counts as 1', () => {
    const { d } = renderAward({ categories: [{ id: 'k9', name: 'Listening', icon_key: 'kindness', assigned_children: [] }] });
    expect(field(d).value).toBe('1');
    expect(awardButton(d).textContent).toBe('Award 1 point');
  });
});
