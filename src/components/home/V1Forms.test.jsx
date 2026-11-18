// V1-F (docs/engineering/V1-F-DESIGN.md): Onboarding, Welcome and Award Points.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
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
    // No free amount and no "Other".
    expect(within(d).queryByRole('spinbutton')).toBeNull();
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
  });
});
