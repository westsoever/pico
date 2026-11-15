// Supabase implementation of Remote. supabase-js is loaded only when a project is configured (dynamic import),
// so the app without config fetches nothing. Tables and rules: supabase/migrations/0001_init.sql.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cup, SavedCoffee, Table, Tables, UserCoffee } from '../store/state';
import type { Remote } from './remote';

const TABLE_NAMES: Record<Table, string> = { cups: 'cups', saved: 'saved_coffees', userCoffees: 'user_coffees' };
const CONFLICT: Record<Table, string> = { cups: 'id', saved: 'user_id,coffee_id', userCoffees: 'id' };
const PAGE = 1000; // Supabase's default max rows per request
/**
 * Pull re-reads this much before the cursor. A row whose transaction commits late can carry an `updated_at`
 * older than a cursor this phone already stored; the overlap catches it. Merging is idempotent, so re-reading is harmless.
 * shortcut: a transaction slower than this could still be missed; switch to a server sequence if that ever shows up.
 */
const OVERLAP_MS = 5000;

type DbRow = Record<string, unknown> & { updated_at: string };

export function toDb(table: Table, row: Tables[Table][number]): Record<string, unknown> {
  const common = { user_id: row.userId, client_updated_at: row.updatedAt, deleted_at: row.deletedAt ?? null };
  if (table === 'cups') {
    const c = row as Cup;
    return { ...common, id: c.id, coffee_id: c.coffeeId, stars: c.stars, flavor_tags: c.flavorTags, note: c.note, brew: c.brew ?? null, rated_at: c.ratedAt };
  }
  if (table === 'saved') {
    const s = row as SavedCoffee;
    return { ...common, coffee_id: s.coffeeId, saved_at: s.savedAt };
  }
  const { id, userId: _u, updatedAt: _t, deletedAt: _d, sentToPico, ...coffee } = row as UserCoffee;
  return { ...common, id, coffee, sent_to_pico: sentToPico };
}

export function fromDb(table: Table, r: DbRow): Tables[Table][number] {
  const common = {
    userId: r.user_id as string,
    updatedAt: new Date(r.client_updated_at as string).toISOString(),
    ...(r.deleted_at ? { deletedAt: new Date(r.deleted_at as string).toISOString() } : {}),
  };
  if (table === 'cups') {
    return {
      ...common, id: r.id as string, coffeeId: r.coffee_id as string, stars: r.stars as number,
      flavorTags: r.flavor_tags as Cup['flavorTags'], note: r.note as string,
      ...(r.brew ? { brew: r.brew as Cup['brew'] } : {}), ratedAt: new Date(r.rated_at as string).toISOString(),
    } satisfies Cup;
  }
  if (table === 'saved') {
    return { ...common, id: r.coffee_id as string, coffeeId: r.coffee_id as string, savedAt: new Date(r.saved_at as string).toISOString() } satisfies SavedCoffee;
  }
  return { ...(r.coffee as Omit<UserCoffee, 'id'>), ...common, id: r.id as string, sentToPico: r.sent_to_pico as boolean } satisfies UserCoffee;
}

/** The cursor comes from the server's own timestamps on the rows it returned, never from this phone's clock. */
export function nextCursor(serverTimes: string[], since: string | null): string | null {
  return serverTimes.reduce<string | null>((max, t) => (max === null || t > max ? t : max), since);
}

export function createSupabaseRemote(client: SupabaseClient): Remote {
  return {
    async push(_userId, changes) {
      for (const table of Object.keys(TABLE_NAMES) as Table[]) {
        const rows = changes[table];
        if (rows.length === 0) continue;
        const { error } = await client.from(TABLE_NAMES[table]).upsert(rows.map((r) => toDb(table, r)), { onConflict: CONFLICT[table] });
        if (error) throw new Error(`push ${table}: ${error.message}`);
      }
    },

    async pull(userId, since) {
      const changes: Tables = { cups: [], saved: [], userCoffees: [] };
      const times: string[] = [];
      const from = since ? new Date(Date.parse(since) - OVERLAP_MS).toISOString() : null;
      for (const table of Object.keys(TABLE_NAMES) as Table[]) {
        for (let offset = 0; ; offset += PAGE) {
          let query = client.from(TABLE_NAMES[table]).select('*').eq('user_id', userId);
          if (from) query = query.gt('updated_at', from);
          const { data, error } = await query.order('updated_at').range(offset, offset + PAGE - 1);
          if (error) throw new Error(`pull ${table}: ${error.message}`);
          for (const r of data as DbRow[]) {
            (changes[table] as Tables[Table][number][]).push(fromDb(table, r));
            times.push(new Date(r.updated_at).toISOString());
          }
          if (data.length < PAGE) break;
        }
      }
      return { changes, cursor: nextCursor(times, since) ?? new Date(0).toISOString() };
    },

    async fetchCommunityRatings() {
      const { data, error } = await client.rpc('community_ratings');
      if (error) throw new Error(`community ratings: ${error.message}`);
      return Object.fromEntries((data as { coffee_id: string; average: number | string; raters: number }[])
        .map((r) => [r.coffee_id, { average: Number(r.average), count: r.raters }]));
    },
  };
}

/** The Supabase client, or null when no project is configured (the app then runs on the phone only). */
export async function loadSupabase(url: string | undefined, anonKey: string | undefined): Promise<SupabaseClient | null> {
  if (!url || !anonKey) return null;
  const { createClient } = await import('@supabase/supabase-js');
  // PKCE: Google sends the person back with ?code=… (query string), which leaves the app's #/route alone.
  return createClient(url, anonKey, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
}
