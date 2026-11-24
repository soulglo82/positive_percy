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
    expect(d.textContent).toContain('1. Daily Wins');
    expect(d.textContent).toContain('Make things to do each day easy to see and celebrate.');
    expect(d.textContent).toContain('2. Notice positive behaviour');
    expect(d.textContent).toContain('Reward kindness, effort, learning and helping whenever you see them.');
    expect(d.textContent).toContain('3. Save for a Big Goal');
    expect(d.textContent).toContain('Enjoy smaller weekly treats, or keep saving points towards a Big Goal.');
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
    expect(screen.getByRole('heading', { name: 'Every adventure starts with a Big Goal!' })).toBeTruthy();
    expect(container.textContent).toContain('Add your first child, recognise positive behaviours, and choose a little treat or a Big Goal to save towards.');
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

// Give Percy Points, the compact form the owner chose from mock-ups on 24
// November 2026 (V1-F design section 11, version B). The category boxes carry
// no value; the amount comes only from the Points row, fixed above Cancel and
// Award: it starts at 1 and changes only by typing or by minus and plus.
describe('Give Percy Points: the compact form (V1-F section 11)', () => {
  const RULE = 'Points must be a whole number from 1 to 1000.';
  const field = (d) => within(d).getByRole('spinbutton', { name: 'Points' });
  const plus = (d) => within(d).getByRole('button', { name: 'One point more' });
  const minus = (d) => within(d).getByRole('button', { name: 'One point fewer' });
  const type = (d, text) => { fireEvent.focus(field(d)); fireEvent.change(field(d), { target: { value: text } }); };
  const awardButton = (d) => within(d).getByRole('button', { name: /^Award/ });
  const kid = (d, name) => within(within(d).getByRole('group', { name: 'Choose a child' })).getByRole('button', { name });
  const boxes = (d) => within(within(d).getByRole('group', { name: /^What did/ })).getAllByRole('button');
  const box = (d, name) => within(within(d).getByRole('group', { name: /^What did/ })).getByRole('button', { name });
  const press = (button, times = 1) => { for (let i = 0; i < times; i += 1) fireEvent.click(button); };
  const scrolling = (el) => el.closest('.overflow-y-auto');

  it('the layout: title, children, categories without points, a note link, and the Points row outside the scrolling part', () => {
    const { d } = renderAward();
    expect(within(d).getByRole('heading', { name: 'Give Percy Points' })).toBeTruthy();
    // The line under the title is not shown, but still describes the pop-up to a screen reader.
    const described = document.getElementById(d.getAttribute('aria-describedby'));
    expect(described.textContent).toBe('Notice something positive, whenever it happens.');
    expect(described.className).toMatch(/(^|\s)sr-only(\s|$)/);
    for (const gone of ["Who's earned points?", 'Select the child receiving the award.', 'Choose a positive behaviour.', 'How many points?']) expect(d.textContent).not.toContain(gone);
    expect(within(d).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['What did Lara do?']);
    // Children: a name each, no weekly figure.
    expect(within(within(d).getByRole('group', { name: 'Choose a child' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['LLara', 'OOmar']);
    expect(kid(d, 'Lara').getAttribute('aria-pressed')).toBe('true');
    expect(d.textContent).not.toContain('this week');
    // Categories: the name only. No "+N" anywhere in the form.
    expect(boxes(d).map((b) => b.textContent)).toEqual(['Kindness', 'Chores']);
    expect(box(d, 'Kindness').getAttribute('aria-pressed')).toBe('true');
    expect(d.textContent).not.toMatch(/\+\d/);
    expect(within(d).getByRole('group', { name: /^What did/ }).getAttribute('data-tile-badge')).toBe('none');
    // The note is behind a link; no field until it is asked for.
    expect(within(d).getByRole('button', { name: 'Add a note' })).toBeTruthy();
    expect(within(d).queryByRole('textbox')).toBeNull();
    // The Points row and the buttons are fixed: not inside the part that scrolls.
    expect(scrolling(box(d, 'Kindness'))).not.toBeNull();
    for (const fixed of [field(d), minus(d), plus(d), awardButton(d), within(d).getByRole('button', { name: 'Cancel' })]) expect(scrolling(fixed)).toBeNull();
    expect(within(d).getByText('Points', { selector: 'label' })).toBeTruthy();
    expect(field(d).value).toBe('1');
    expect(awardButton(d).textContent).toBe('Award 1 point');
    // No "Other", no design-preview wording, no cream summary on screen.
    expect(within(d).queryByRole('button', { name: /^Other/ })).toBeNull();
    expect(d.textContent).not.toMatch(/design preview/);
  });

  it('the sentence the cream box used to show is still told to a screen reader, a moment after the last change', async () => {
    const { d } = renderAward();
    const live = d.querySelector('[aria-live="polite"]');
    expect(live.className).toMatch(/(^|\s)sr-only(\s|$)/);
    expect(scrolling(live)).toBeNull();
    await waitFor(() => expect(live.textContent).toBe('Lara earns 1 Percy Point. For Kindness.'));
    type(d, '12');
    fireEvent.click(box(d, 'Chores'));
    expect(live.textContent).toBe('Lara earns 1 Percy Point. For Kindness.'); // not yet: it waits for a pause
    await waitFor(() => expect(live.textContent).toBe('Lara earns 12 Percy Points. For Chores.'));
    type(d, '0');
    await waitFor(() => expect(live.textContent).toBe(''));
  });

  it('categories follow the child (A1, A2); a usable selection is kept', () => {
    const { d } = renderAward();
    expect(within(d).queryByRole('button', { name: 'Piano' })).toBeNull();
    fireEvent.click(kid(d, 'Omar'));
    expect(within(d).getByRole('heading', { level: 3 }).textContent).toBe('What did Omar do?');
    expect(boxes(d).map((b) => b.textContent)).toEqual(['Kindness', 'Chores', 'Piano']);
    fireEvent.click(box(d, 'Piano'));
    fireEvent.click(kid(d, 'Lara')); // Piano is not Lara's: her first category
    expect(box(d, 'Kindness').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(box(d, 'Chores'));
    fireEvent.click(kid(d, 'Omar'));
    expect(box(d, 'Chores').getAttribute('aria-pressed')).toBe('true');
  });

  it('the amount comes only from the Points row: a category or a child never changes it', () => {
    const { d } = renderAward();
    fireEvent.click(box(d, 'Chores')); // worth 3 on Home; not here
    expect(field(d).value).toBe('1');
    expect(awardButton(d).textContent).toBe('Award 1 point');
    type(d, '5');
    fireEvent.click(box(d, 'Kindness'));
    fireEvent.click(kid(d, 'Omar'));
    fireEvent.click(box(d, 'Piano'));
    fireEvent.click(kid(d, 'Lara')); // the category moves; the amount does not
    expect(field(d).value).toBe('5');
    expect(awardButton(d).textContent).toBe('Award 5 points');
    press(minus(d));
    fireEvent.click(box(d, 'Chores'));
    expect(field(d).value).toBe('4');
  });

  it('plus four times gives 5; the request carries it with the category\'s name', async () => {
    const { d, onSubmit, onClose } = renderAward();
    fireEvent.click(box(d, 'Chores'));
    press(plus(d), 4);
    expect(field(d).value).toBe('5');
    fireEvent.click(within(d).getByRole('button', { name: 'Award 5 points' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].name).toBe('Lara');
    expect(onSubmit.mock.calls[0][1]).toEqual({ points: 5, category: 'Chores', note: '' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('Add a note shows the field with the cursor in it; the note is sent trimmed', async () => {
    const { d, onSubmit } = renderAward();
    fireEvent.click(within(d).getByRole('button', { name: 'Add a note' }));
    const note = within(d).getByLabelText('Add a note (optional)');
    expect(document.activeElement).toBe(note);
    expect(note.getAttribute('placeholder')).toBe('What went well?');
    expect(scrolling(note)).not.toBeNull();
    expect(within(d).queryByRole('button', { name: 'Add a note' })).toBeNull();
    fireEvent.change(note, { target: { value: '  Shared the crayons  ' } });
    fireEvent.click(awardButton(d));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toEqual({ points: 1, category: 'Kindness', note: 'Shared the crayons' });
  });

  it('at 1 minus is marked unavailable and changes nothing; the same for plus at 1000; neither is disabled', () => {
    const { d } = renderAward();
    expect(minus(d).getAttribute('aria-disabled')).toBe('true');
    expect(plus(d).getAttribute('aria-disabled')).toBe('false');
    press(minus(d), 3);
    expect(field(d).value).toBe('1');
    expect(minus(d).disabled).toBe(false); // a disabled button would drop the focus
    press(plus(d));
    expect(minus(d).getAttribute('aria-disabled')).toBe('false');
    type(d, '999');
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

  it('an empty field cannot be awarded and says nothing; a category does not refill it', () => {
    const { d } = renderAward();
    type(d, '');
    expect(field(d).value).toBe('');
    expect(awardButton(d).disabled).toBe(true);
    expect(awardButton(d).textContent).toBe('Award points');
    expect(d.textContent).not.toContain(RULE);
    expect(field(d).getAttribute('aria-invalid')).toBe('false');
    fireEvent.click(box(d, 'Chores'));
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

  it.each(['0', '-3', '1001', '2.5'])('typing %j cannot be awarded and shows the rule, outside the scrolling part', (text) => {
    const { d, onSubmit } = renderAward();
    type(d, text);
    expect(awardButton(d).disabled).toBe(true);
    expect(awardButton(d).textContent).toBe('Award points');
    const alert = within(d).getByRole('alert');
    expect(alert.textContent).toBe(RULE);
    expect(scrolling(alert)).toBeNull();
    // Drawn over the list, not in the flow, so the row does not jump when it comes and goes.
    expect(alert.className).toMatch(/(^|\s)absolute(\s|$)/);
    expect(field(d).getAttribute('aria-invalid')).toBe('true');
    expect(field(d).getAttribute('aria-describedby')).toBe(alert.id);
    fireEvent.click(awardButton(d));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([['1000', 1000], ['1e3', 1000], ['007', 7], ['25', 25]])('typing %j awards %i', async (text, n) => {
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
    expect(awardButton(d).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '7' } });
    expect(field(d)).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(awardButton(d).textContent).toBe('Award 7 points');
  });

  it('minus and plus show in the field while it has focus, and never replace it or take its focus', () => {
    const { d } = renderAward();
    const input = field(d);
    act(() => input.focus());
    press(plus(d));
    expect(field(d)).toBe(input);
    expect(input.value).toBe('2');
    fireEvent.change(input, { target: { value: '040' } });
    expect(input.value).toBe('040');
    press(minus(d));
    expect(input.value).toBe('39');
    fireEvent.click(box(d, 'Chores'));
    fireEvent.click(kid(d, 'Omar'));
    expect(field(d)).toBe(input);
    expect(input.value).toBe('39');
    expect(document.activeElement).toBe(input);
  });

  it('double tap sends once; a refused award keeps the form, the amount and the note', async () => {
    let release;
    const onSubmit = vi.fn(() => new Promise((r) => { release = r; }));
    const { d, onClose } = renderAward({ onSubmit });
    press(plus(d), 9);
    fireEvent.click(within(d).getByRole('button', { name: 'Add a note' }));
    fireEvent.change(within(d).getByLabelText('Add a note (optional)'), { target: { value: 'Kept at it' } });
    const btn = within(d).getByRole('button', { name: 'Award 10 points' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(field(d).disabled).toBe(true);
    expect(within(d).getByLabelText('Add a note (optional)').disabled).toBe(true);
    expect(plus(d).disabled).toBe(true);
    expect(minus(d).disabled).toBe(true);
    release(false);
    await waitFor(() => expect(field(d).disabled).toBe(false));
    expect(plus(d).disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(field(d).value).toBe('10');
    expect(within(d).getByLabelText('Add a note (optional)').value).toBe('Kept at it');
    expect(onSubmit.mock.calls[0][1]).toEqual({ points: 10, category: 'Kindness', note: 'Kept at it' });
  });

  it('nothing that is sent can change while an award is being sent', async () => {
    let release;
    const onSubmit = vi.fn(() => new Promise((r) => { release = r; }));
    const { d } = renderAward({ onSubmit });
    fireEvent.click(within(d).getByRole('button', { name: 'Award 1 point' }));
    fireEvent.click(box(d, 'Chores'));
    fireEvent.click(kid(d, 'Omar'));
    press(plus(d));
    // The note cannot be opened in flight either: its text would not be in the award.
    expect(within(d).getByRole('button', { name: 'Add a note' }).disabled).toBe(true);
    fireEvent.click(within(d).getByRole('button', { name: 'Add a note' }));
    expect(within(d).queryByRole('textbox')).toBeNull();
    expect(awardButton(d).textContent).toBe('Award 1 point');
    expect(field(d).value).toBe('1');
    expect(box(d, 'Kindness').getAttribute('aria-pressed')).toBe('true');
    expect(kid(d, 'Lara').getAttribute('aria-pressed')).toBe('true');
    release(false);
    await waitFor(() => expect(field(d).disabled).toBe(false));
    expect(onSubmit.mock.calls[0][0].name).toBe('Lara');
    expect(onSubmit.mock.calls[0][1]).toMatchObject({ points: 1, category: 'Kindness' });
    // Once the refusal is back the form works again.
    fireEvent.click(box(d, 'Chores'));
    expect(box(d, 'Chores').getAttribute('aria-pressed')).toBe('true');
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

  it('no category at all: the guidance, no Points row, Award disabled (E1)', () => {
    const { d } = renderAward({ categories: [] });
    expect(d.textContent).toContain('Add a behaviour in Family settings first.');
    expect(within(d).queryByRole('spinbutton')).toBeNull();
    expect(within(d).queryByRole('button', { name: 'One point more' })).toBeNull();
    expect(within(d).queryByRole('button', { name: 'One point fewer' })).toBeNull();
    expect(awardButton(d).disabled).toBe(true);
  });

  it('a typed amount survives a child with no category and comes back with the next child', () => {
    const own = [{ id: 'a1', name: 'Reading', points: 2, icon_key: 'reading', assigned_children: ['c1'] }];
    const { d } = renderAward({ categories: own });
    type(d, '6');
    fireEvent.click(kid(d, 'Omar'));
    expect(within(d).queryByRole('spinbutton')).toBeNull();
    expect(awardButton(d).disabled).toBe(true);
    fireEvent.click(kid(d, 'Lara'));
    expect(field(d).value).toBe('6');
    expect(awardButton(d).textContent).toBe('Award 6 points');
  });

  const Dialog = (props) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}><AwardPointsDialog onClose={() => {}} children={kids} initialChildId="c1" onSubmit={async () => true} {...props} /></QueryClientProvider>;
  };

  it('reopening starts fresh: 1 point, the first category, the note closed and empty', () => {
    const view = render(<Dialog isOpen categories={cats} />);
    const d = () => screen.getByRole('dialog');
    press(plus(d()), 9);
    fireEvent.click(box(d(), 'Chores'));
    fireEvent.click(within(d()).getByRole('button', { name: 'Add a note' }));
    fireEvent.change(within(d()).getByLabelText('Add a note (optional)'), { target: { value: 'x' } });
    view.rerender(<Dialog isOpen={false} categories={cats} />);
    // Nothing of the last opening may be drawn, even for a frame: the old note
    // field would take the focus and then vanish (code review).
    const focused = [];
    const seen = (e) => focused.push(e.target.id || e.target.tagName);
    document.addEventListener('focusin', seen);
    view.rerender(<Dialog isOpen categories={cats} />);
    document.removeEventListener('focusin', seen);
    expect(focused).not.toContain('award-note');
    expect(field(d()).value).toBe('1');
    expect(box(d(), 'Kindness').getAttribute('aria-pressed')).toBe('true');
    expect(within(d()).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(d()).getByRole('button', { name: 'Add a note' }));
    expect(within(d()).getByLabelText('Add a note (optional)').value).toBe('');
  });

  it('categories that arrive after the pop-up opened are listed; a reload keeps the amount; a category\'s points never set it', () => {
    const view = render(<Dialog isOpen categories={[]} />);
    expect(within(screen.getByRole('dialog')).queryByRole('spinbutton')).toBeNull();
    view.rerender(<Dialog isOpen categories={cats.map((c) => ({ ...c, points: 9 }))} />);
    const d = screen.getByRole('dialog');
    expect(field(d).value).toBe('1');
    press(plus(d), 3);
    view.rerender(<Dialog isOpen categories={cats.map((c) => ({ ...c, points: 7 }))} />);
    expect(field(screen.getByRole('dialog')).value).toBe('4');
  });
});
