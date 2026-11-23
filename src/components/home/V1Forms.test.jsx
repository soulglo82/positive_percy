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

// Owner, 23 November 2026: a parent can give a custom amount again, as in the
// old dialog (V1-F design section 9). The amount starts as the behaviour's
// points; once the parent chooses one it stays until the dialog closes.
describe('Award Points: the amount (V1-F section 9)', () => {
  const RULE = 'Points must be a whole number from 1 to 1000.';
  const amounts = (d) => within(d).getByRole('group', { name: 'How many points?' });
  const field = (d) => within(d).getByRole('spinbutton', { name: 'Percy Points' });
  const pressed = (d) => within(amounts(d)).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
  const type = (d, text) => { fireEvent.focus(field(d)); fireEvent.change(field(d), { target: { value: text } }); };
  const awardButton = (d) => within(d).getByRole('button', { name: /^Award/ });
  const tile = (d, name) => within(d).getByRole('button', { name });

  it('starts as the behaviour\'s points, with the wording, the six quick amounts and the step order', () => {
    const { d } = renderAward();
    expect(d.textContent).toContain('How many points?');
    expect(d.textContent).toContain("Use the behaviour's points, or choose another amount.");
    expect(within(amounts(d)).getAllByRole('button').map((b) => b.textContent)).toEqual(['+1', '+2', '+3', '+4', '+5', '+10']);
    expect(field(d).value).toBe('1');
    expect(pressed(d)).toEqual(['+1']);
    expect(awardButton(d).textContent).toBe('Award 1 point');
    expect(d.textContent).not.toContain(RULE);
    // Who, how many, what: the amount comes before the behaviours, as in the old dialog.
    const headings = within(d).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Who's earned points?", 'How many points?', 'What did Lara do?']);
  });

  it('untouched, the amount follows the chosen behaviour', () => {
    const { d } = renderAward();
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d).value).toBe('3');
    expect(pressed(d)).toEqual(['+3']);
    expect(awardButton(d).textContent).toBe('Award 3 points');
  });

  it('a quick amount changes what is awarded; the behaviour\'s name is kept', async () => {
    const { d, onSubmit } = renderAward();
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+5' }));
    expect(pressed(d)).toEqual(['+5']);
    expect(field(d).value).toBe('5');
    expect(d.textContent).toContain('Lara earns 5 Percy Points');
    expect(d.textContent).toContain('For Kindness.');
    fireEvent.click(within(d).getByRole('button', { name: 'Award 5 points' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toEqual({ points: 5, category: 'Kindness', note: '' });
  });

  it('a typed amount is awarded; no quick amount is pressed for it', async () => {
    const { d, onSubmit } = renderAward();
    type(d, '25');
    expect(pressed(d)).toEqual([]);
    expect(d.textContent).toContain('Lara earns 25 Percy Points');
    fireEvent.click(within(d).getByRole('button', { name: 'Award 25 points' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1].points).toBe(25);
  });

  it('a quick amount chosen while the field still has focus shows in the field', () => {
    // A screen reader or switch can press the button and leave focus in the field.
    const { d } = renderAward();
    type(d, '25');
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+4' }));
    expect(field(d).value).toBe('4');
    expect(awardButton(d).textContent).toBe('Award 4 points');
  });

  it('a chosen amount stays when another behaviour or child is picked', async () => {
    const { d, onSubmit } = renderAward();
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+10' }));
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d).value).toBe('10');
    expect(d.textContent).toContain('Lara earns 10 Percy Points');
    expect(d.textContent).toContain('For Chores.');
    fireEvent.click(tile(d, /^Omar/));
    fireEvent.click(tile(d, 'Piano +2'));
    expect(field(d).value).toBe('10');
    fireEvent.click(tile(d, /^Lara/)); // Piano is not Lara's: the behaviour moves to Kindness
    expect(tile(d, 'Kindness +1').getAttribute('aria-pressed')).toBe('true');
    expect(field(d).value).toBe('10');
    fireEvent.click(within(d).getByRole('button', { name: 'Award 10 points' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toEqual({ points: 10, category: 'Kindness', note: '' });
  });

  it('an empty field cannot be awarded and says nothing', () => {
    const { d, onSubmit } = renderAward();
    type(d, '');
    expect(field(d).value).toBe('');
    expect(awardButton(d).disabled).toBe(true);
    expect(awardButton(d).textContent).toBe('Award points');
    expect(d.textContent).not.toContain('Lara earns');
    expect(d.textContent).not.toContain(RULE);
    expect(field(d).getAttribute('aria-invalid')).toBe('false');
    // Another behaviour does not fill it back in: the parent emptied it.
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d).value).toBe('');
    expect(awardButton(d).disabled).toBe(true);
    fireEvent.click(awardButton(d));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a number too large to be a number cannot be awarded', () => {
    // A number field turns "1e400" into nothing or into Infinity, depending on the browser: neither is awarded.
    const { d, onSubmit } = renderAward();
    type(d, '1e400');
    expect(awardButton(d).disabled).toBe(true);
    expect(d.textContent).not.toContain('Lara earns');
    fireEvent.click(awardButton(d));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['0', '-3', '1001', '2.5'])('typing %j cannot be awarded and shows the rule', (text) => {
    const { d, onSubmit } = renderAward();
    type(d, text);
    expect(awardButton(d).disabled).toBe(true);
    expect(awardButton(d).textContent).toBe('Award points');
    expect(d.textContent).not.toContain('Lara earns');
    expect(within(d).getByRole('alert').textContent).toBe(RULE);
    expect(field(d).getAttribute('aria-invalid')).toBe('true');
    expect(field(d).getAttribute('aria-describedby')).toBe(within(d).getByRole('alert').id);
    fireEvent.click(awardButton(d));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([['1000', 1000], ['1e3', 1000], ['007', 7]])('typing %j awards %i', async (text, n) => {
    const { d, onSubmit } = renderAward();
    type(d, text);
    expect(d.textContent).not.toContain(RULE);
    fireEvent.click(within(d).getByRole('button', { name: `Award ${n} points` }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1].points).toBe(n);
  });

  // PR #73 review: the first typed character must not replace the field. The
  // other tests here set the whole amount in one event, which cannot see that.
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
    // Quick amount, another behaviour, another child: each can happen with
    // focus still in the field (a screen reader or switch).
    const { d } = renderAward();
    const input = field(d);
    act(() => input.focus());
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d)).toBe(input);
    expect(input.value).toBe('3');
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+4' }));
    expect(field(d)).toBe(input);
    expect(input.value).toBe('4');
    fireEvent.change(input, { target: { value: '40' } });
    expect(input.value).toBe('40');
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+5' }));
    expect(input.value).toBe('5');
    fireEvent.click(within(d).getByRole('button', { name: /^Omar/ }));
    expect(field(d)).toBe(input);
    expect(input.value).toBe('5');
    expect(document.activeElement).toBe(input);
  });

  it('a quick amount pressed twice over typed text shows the plain amount', () => {
    // "03" stands for 3. After +5 the typed text is gone for good: +3 shows "3".
    const { d } = renderAward();
    const input = field(d);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '03' } });
    expect(input.value).toBe('03');
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+5' }));
    expect(input.value).toBe('5');
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+3' }));
    expect(input.value).toBe('3');
  });

  it('the field follows the behaviour\'s points even while it has focus', () => {
    // Until an amount is chosen the field shows the behaviour's points; a
    // screen reader can pick another behaviour and leave focus in the field.
    const { d } = renderAward();
    fireEvent.focus(field(d));
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d).value).toBe('3');
    expect(awardButton(d).textContent).toBe('Award 3 points');
  });

  it('tapping the amount already showing does not fix it; tapping it after a change does', () => {
    const { d } = renderAward();
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+1' })); // already pressed: nothing changes
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d).value).toBe('3'); // still following the behaviour
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+1' })); // now a choice
    fireEvent.click(tile(d, 'Kindness +1'));
    fireEvent.click(tile(d, 'Chores +3'));
    expect(field(d).value).toBe('1');
    expect(awardButton(d).textContent).toBe('Award 1 point');
  });

  it('a typed amount that equals a quick amount presses it', () => {
    const { d } = renderAward();
    type(d, '05');
    expect(pressed(d)).toEqual(['+5']);
    expect(awardButton(d).textContent).toBe('Award 5 points');
  });

  it('a refused award keeps the dialog open with the chosen amount; the amount cannot change while it is being sent', async () => {
    let release;
    const onSubmit = vi.fn(() => new Promise((r) => { release = r; }));
    const { d, onClose } = renderAward({ onSubmit });
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+10' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Award 10 points' }));
    expect(field(d).disabled).toBe(true);
    expect(within(amounts(d)).getAllByRole('button').every((b) => b.disabled)).toBe(true);
    release(false);
    await waitFor(() => expect(field(d).disabled).toBe(false));
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
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+4' }));
    expect(input.value).toBe('4');
  });

  it('"005" then +5 with the focus left in the field keeps the typed text; the amount is 5', () => {
    const { d } = renderAward();
    const input = field(d);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '005' } });
    expect(pressed(d)).toEqual(['+5']);
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+5' }));
    expect(input.value).toBe('005');
    expect(awardButton(d).textContent).toBe('Award 5 points');
  });

  const Dialog = (props) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}><AwardPointsDialog onClose={() => {}} children={kids} initialChildId="c1" onSubmit={async () => true} {...props} /></QueryClientProvider>;
  };

  it('reopening the same dialog starts fresh', () => {
    const view = render(<Dialog isOpen categories={cats} />);
    fireEvent.click(within(amounts(screen.getByRole('dialog'))).getByRole('button', { name: '+10' }));
    view.rerender(<Dialog isOpen={false} categories={cats} />);
    view.rerender(<Dialog isOpen categories={cats} />);
    expect(field(screen.getByRole('dialog')).value).toBe('1');
    expect(pressed(screen.getByRole('dialog'))).toEqual(['+1']);
    expect(tile(screen.getByRole('dialog'), 'Kindness +1').getAttribute('aria-pressed')).toBe('true');
  });

  it('behaviours that arrive after the dialog opened set the amount; a reload of the same behaviours keeps a chosen amount', () => {
    const view = render(<Dialog isOpen categories={[]} />);
    expect(within(screen.getByRole('dialog')).queryByRole('spinbutton')).toBeNull();
    view.rerender(<Dialog isOpen categories={cats} />);
    const d = screen.getByRole('dialog');
    expect(field(d).value).toBe('1');
    fireEvent.click(within(amounts(d)).getByRole('button', { name: '+4' }));
    view.rerender(<Dialog isOpen categories={cats.map((c) => ({ ...c }))} />); // the same behaviours, new objects
    expect(field(screen.getByRole('dialog')).value).toBe('4');
  });

  it('a behaviour with no stored points counts as 1', () => {
    const { d } = renderAward({ categories: [{ id: 'k9', name: 'Listening', icon_key: 'kindness', assigned_children: [] }] });
    expect(field(d).value).toBe('1');
    expect(awardButton(d).textContent).toBe('Award 1 point');
  });
});
