import { describe, expect, it } from 'vitest';
import type { Cup, SavedCoffee, UserCoffee } from '../store/state';
import { fromDb, nextCursor, toDb } from './supabase-remote';

const server = (row: Record<string, unknown>) => ({ ...row, updated_at: '2026-11-15T12:00:00.123+00:00' });

describe('supabase rows', () => {
  it('round-trips cups, saved coffees and hand-added coffees through the table columns', () => {
    const cup: Cup = {
      id: 'c1', userId: 'u1', coffeeId: 'fixture-kenya', stars: 4, flavorTags: ['berry'], note: 'V60',
      brew: { method: 'pour-over', doseGrams: 15 }, ratedAt: '2026-11-15T08:00:00.000Z', updatedAt: '2026-11-15T09:00:00.000Z',
    };
    const saved: SavedCoffee = { id: 'fixture-brazil', userId: 'u1', coffeeId: 'fixture-brazil', savedAt: '2026-11-14T08:00:00.000Z', updatedAt: '2026-11-15T09:00:00.000Z', deletedAt: '2026-11-15T09:00:00.000Z' };
    const mine: UserCoffee = {
      id: 'custom-1', userId: 'u1', name: 'Home roast', roaster: 'Me', origin: 'Peru', process: 'washed', roastLevel: 'medium',
      flavorTags: ['nutty'], description: '', isCustom: true, sentToPico: false, updatedAt: '2026-11-15T09:00:00.000Z',
    };
    expect(fromDb('cups', server(toDb('cups', cup)))).toEqual(cup);
    expect(fromDb('saved', server(toDb('saved', saved)))).toEqual(saved);
    expect(fromDb('userCoffees', server(toDb('userCoffees', mine)))).toEqual(mine);
    expect(toDb('saved', saved)).not.toHaveProperty('id'); // its key is (user_id, coffee_id)
  });

  it('takes the next cursor from the server times it got back, or keeps the old one', () => {
    expect(nextCursor(['2026-11-15T10:00:00.000Z', '2026-11-15T12:00:00.000Z', '2026-11-15T11:00:00.000Z'], null)).toBe('2026-11-15T12:00:00.000Z');
    expect(nextCursor([], '2026-11-15T09:00:00.000Z')).toBe('2026-11-15T09:00:00.000Z');
  });
});
