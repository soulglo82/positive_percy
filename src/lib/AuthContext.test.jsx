// V1-E code review of #63: refreshing the user after a rename never signs
// anyone out, even when the server fails.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

let api;
function Probe() { api = useAuth(); return <p>{api.user?.family?.family_name || '-'}</p>; }

beforeEach(() => {
  localStorage.setItem('positive_percy_family_code', 'ABC123');
  localStorage.setItem('positive_percy_token', 'tok');
});

describe('refreshUser and setFamilyName', () => {
  it('a failed refresh keeps the stored login and what is shown', async () => {
    let fail = false;
    global.fetch = vi.fn(async () => (fail ? { ok: false, status: 500, json: async () => ({}) }
      : { ok: true, json: async () => ({ id: 'u', family: { family_name: 'The Smiths' } }) }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('The Smiths');
    act(() => api.setFamilyName('The Joneses'));
    expect(screen.getByText('The Joneses')).toBeTruthy();
    fail = true;
    let ok;
    await act(async () => { ok = await api.refreshUser(); });
    expect(ok).toBe(false);
    expect(localStorage.getItem('positive_percy_token')).toBe('tok');
    expect(localStorage.getItem('positive_percy_family_code')).toBe('ABC123');
    expect(api.isAuthenticated).toBe(true);
    expect(screen.getByText('The Joneses')).toBeTruthy();
    // A network error too.
    global.fetch = vi.fn(async () => { throw new Error('offline'); });
    await act(async () => { ok = await api.refreshUser(); });
    expect(ok).toBe(false);
    expect(localStorage.getItem('positive_percy_token')).toBe('tok');
  });

  it('a successful refresh shows the server\'s family', async () => {
    let name = 'Before';
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'u', family: { family_name: name } }) }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('Before');
    name = 'After';
    await act(async () => { await api.refreshUser(); });
    await waitFor(() => expect(screen.getByText('After')).toBeTruthy());
  });
});
