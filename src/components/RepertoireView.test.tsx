import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveUserData } from '../lib/storage';
import type { Rating } from '../types/coffee';
import { RepertoireView } from './RepertoireView';

afterEach(cleanup);

const ratings: Rating[] = [
  {
    coffeeId: 'eth-yirg-001',
    stars: 3,
    flavorTags: [],
    note: 'Tea-like',
    ratedAt: '2026-07-17T12:00:00.000Z',
  },
  {
    coffeeId: 'ken-aa-003',
    stars: 5,
    flavorTags: ['berry'],
    note: 'Juicy',
    photoDataUrl: 'data:image/jpeg;base64,dGVzdA==',
    ratedAt: '2026-07-18T12:00:00.000Z',
  },
];

describe('RepertoireView controls', () => {
  it('searches the fallback catalog flavors displayed on a card', async () => {
    saveUserData({ ratings, tasteProfile: null });
    const user = userEvent.setup();
    render(<RepertoireView onSelectCoffee={vi.fn()} refreshKey={0} />);

    await user.type(screen.getByRole('searchbox', { name: 'Search journal' }), 'floral');

    expect(screen.getByRole('heading', { name: 'Yirgacheffe Kochere' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kenya AA Nyeri' })).not.toBeInTheDocument();
  });

  it('combines filters and sorting without mutating persisted data', async () => {
    saveUserData({ ratings, tasteProfile: null });
    const user = userEvent.setup();
    render(<RepertoireView onSelectCoffee={vi.fn()} refreshKey={0} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter journal' }), 'favorites');
    expect(screen.getByRole('heading', { name: 'Kenya AA Nyeri' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Yirgacheffe Kochere' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter journal' }), 'all');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort journal' }), 'name');
    const names = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual(['Kenya AA Nyeri', 'Yirgacheffe Kochere']);
    expect(JSON.parse(localStorage.getItem('pico-user-data') ?? '{}').ratings).toHaveLength(2);
  });
});
