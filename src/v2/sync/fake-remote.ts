import { TABLES, type AnyRow, type Tables } from '../store/state';
import type { Remote } from './remote';

/**
 * In-memory server with the same rules as the SQL: rows belong to one user (like row-level security),
 * the newer updatedAt wins, and every accepted write gets a new server cursor.
 */
export function createFakeRemote(communitySeed: Record<string, { average: number; count: number }> = {}) {
  const rows = new Map<string, { table: keyof Tables; row: AnyRow; seq: number }>();
  let seq = 0;
  let offline = false;
  const cursor = (n: number) => String(n).padStart(12, '0');

  const remote: Remote & { setOffline(v: boolean): void; all(): AnyRow[] } = {
    setOffline(v) { offline = v; },
    all: () => [...rows.values()].map((r) => r.row),

    async push(userId, changes) {
      if (offline) throw new Error('offline');
      for (const table of TABLES) {
        for (const row of changes[table] as AnyRow[]) {
          if (row.userId !== userId) throw new Error('row-level security: not your row');
          const key = `${table}:${row.userId}:${row.id}`;
          const stored = rows.get(key);
          if (stored && stored.row.updatedAt >= row.updatedAt) continue; // an older write never overwrites a newer one
          rows.set(key, { table, row, seq: ++seq });
        }
      }
    },

    async pull(userId, since) {
      if (offline) throw new Error('offline');
      const changes: Tables = { cups: [], saved: [], userCoffees: [] };
      for (const { table, row, seq: s } of rows.values()) {
        if (row.userId === userId && (since === null || cursor(s) > since)) (changes[table] as AnyRow[]).push(row);
      }
      return { changes, cursor: cursor(seq) };
    },

    async fetchCommunityRatings() {
      if (offline) throw new Error('offline');
      return communitySeed;
    },
  };
  return remote;
}
