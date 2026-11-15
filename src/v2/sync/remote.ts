import type { Tables } from '../store/state';

/**
 * The server, as the sync engine sees it. Supabase is one implementation (supabase-remote.ts);
 * fake-remote.ts is the in-memory one for tests and for running without any server config.
 */
export interface Remote {
  /** Upsert rows for this user. The server keeps whichever version has the newer updatedAt. */
  push(userId: string, changes: Tables): Promise<void>;
  /** Rows of this user changed on the server after `since` (null = everything), and the cursor to pull from next time. */
  pull(userId: string, since: string | null): Promise<{ changes: Tables; cursor: string }>;
  /** Public, also signed out: per catalog coffee, raters and the mean of their own averages (MIN_COMMUNITY_RATERS or more only). */
  fetchCommunityRatings(): Promise<Record<string, { average: number; count: number }>>;
}
