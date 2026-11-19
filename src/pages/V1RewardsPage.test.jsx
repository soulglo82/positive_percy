// V1-D approved wording C6: an empty filter says so.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/entities', () => ({
  Child: { list: vi.fn(async () => []) },
  Reward: { list: vi.fn(async () => [{ id: 'r1', title: 'Cinema', cost_points: 8, visible_to_child: true, assigned_child_ids: [] }]) },
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }), getToken: () => 't' }));

import Rewards from './Rewards';

describe('Rewards filters', () => {
  it('a filter with no rewards shows "No rewards match this filter."', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><Rewards /></MemoryRouter></QueryClientProvider>);
    await screen.findByText('Cinema');
    expect(screen.queryByText('No rewards match this filter.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hidden' }));
    expect(screen.getByText('No rewards match this filter.')).toBeTruthy();
    expect(screen.queryByText('Cinema')).toBeNull();
  });
});
