// Prototype store = the real v2 store (src/v2/store) behind the prototype's old function API, so the screens
// run on the real local-first store and sync engine. The server is the in-memory fake: no Supabase, no network.
// Prototype-only extras stay here: demo states, the instant fake sign-up, sample community ratings.
// Roll back: copy store.proto.ts (the previous fake store, unchanged) over this file.
import { useSyncExternalStore } from 'react';
import { getAllCoffees } from '../src/lib/catalog';
import {
  EMPTY, LOCAL_USER_ID, MIN_COMMUNITY_RATERS, PROTOTYPE_KEY, STORAGE_KEY, uid,
  type Cup, type PersistedState, type SavedCoffee, type User,
} from '../src/v2/store/state';
import {
  FREE_SCANS, createStore, currentProfile, profileOf, totalsByCoffee, type CoffeeTotals, type StoreState,
} from '../src/v2/store/store';
import { createSync, startAutoSync } from '../src/v2/sync/engine';
import { createFakeRemote } from '../src/v2/sync/fake-remote';
import { showAccounts } from '../src/v2/flags';

export { FREE_SCANS, LOCAL_USER_ID, currentProfile, profileOf, totalsByCoffee, uid };
export type { CoffeeTotals, Cup, SavedCoffee, User };

/** The prototype's view of the state: the real store's, plus the sample community data under its old name. */
export type ProtoState = StoreState & {
  /** SAMPLE DATA: other people's ratings per coffee, seeded by demo states only (lives in the store's community cache). */
  communitySeed: PersistedState['communityRatings'];
};

const firstBoot = localStorage.getItem(STORAGE_KEY) === null;
const store = createStore(localStorage);

// A test phone with prototype data: the real migration brings cups and settings over as signed-out rows.
// In the prototype its fake account and sample community data are part of the demo, so keep those too.
if (firstBoot) {
  try {
    const proto = JSON.parse(localStorage.getItem(PROTOTYPE_KEY) ?? 'null');
    if (proto?.user) store.setUser(proto.user);
    if (proto?.communitySeed) store.setCommunityRatings(proto.communitySeed);
  } catch {
    // unreadable prototype data: start as the migration left it
  }
}

// The fake server's community data is the demo seed; demo states replace it in place.
const communitySeed: PersistedState['communityRatings'] = { ...store.getState().communityRatings };
const sync = createSync(store, createFakeRemote(communitySeed));
startAutoSync(store, sync);

let lastState: StoreState | null = null;
let lastView: ProtoState | null = null;
const view = (): ProtoState => {
  const s = store.getState();
  if (s !== lastState) {
    lastState = s;
    lastView = { ...s, communitySeed: s.communityRatings };
  }
  return lastView!;
};

export function useStore(): ProtoState {
  return useSyncExternalStore(store.subscribe, view);
}

/**
 * The prototype's setState: local fields go to the store; `user: null` is the instant sign-out
 * (the `cups: [], saved: []` that the Account screen sends with it are what the sign-out clears anyway).
 */
export function setState(patch: Partial<Pick<ProtoState, 'user' | 'cups' | 'saved' | 'seenWelcome' | 'tasteSeed' | 'scansUsed' | 'v1Imported'>>) {
  const { user, cups: _cups, saved: _saved, ...local } = patch;
  if ('user' in patch && user === null) {
    // shortcut: the prototype's sign-out wipes at once like before; the real flow (auth.signOut) backs up first.
    const { tasteSeed, scansUsed } = store.getState();
    store.discardAccount();
    store.setState({ tasteSeed, scansUsed });
  }
  if (Object.keys(local).length) store.setState(local);
}

/** Instant fake sign-up: a new account id, and cups rated signed out move into it (as the real sign-in does). */
export function signUp(name: string) {
  store.setUser({ id: uid(), displayName: name || 'Coffee friend', createdAt: new Date().toISOString() });
}

export const addCup = store.addCup;
export const updateCup = store.updateCup;
export const deleteCup = store.deleteCup;
export const isSaved = store.isSaved;
export const toggleSaved = store.toggleSaved;

/** The fake account screens and prompts are shown: dev or ?proto only, never from Supabase config alone. Off on the live beta. */
export const ACCOUNTS = showAccounts(import.meta.env, window.location.search);
// No accounts to unlock more scans with, so no scan limit either.
export const spendScan = () => (ACCOUNTS ? store.spendScan() : true);
export const readV1Ratings = store.readV1Ratings;
export const importV1 = store.importV1;

/**
 * A coffee's community rating: how many people rated it and the mean of each person's own average.
 * null below MIN_COMMUNITY_RATERS and for hand-added coffees. The signed-in user counts as one rater; cups saved
 * signed out stay on the phone and don't count. Other raters come from the sample `communitySeed`.
 */
export function communityRating(coffeeId: string): { average: number; count: number } | null {
  if (coffeeId.startsWith('custom-')) return null;
  const s = store.getState();
  const others = s.communityRatings[coffeeId] ?? { average: 0, count: 0 };
  const mine = s.user ? s.cups.filter((c) => c.coffeeId === coffeeId && c.userId === s.user?.id) : [];
  const own = mine.length ? mine.reduce((t, c) => t + c.stars, 0) / mine.length : null;
  const count = others.count + (own === null ? 0 : 1);
  if (count < MIN_COMMUNITY_RATERS) return null;
  return { average: (others.average * others.count + (own ?? 0)) / count, count };
}

// ---------- Demo states (switch with ?state=… or the Proto panel) ----------

/** SAMPLE DATA for demos: ~50% of coffees, 3–40 raters, averages 3.4–4.8, the same on every load (hash of the id). */
function sampleCommunity(): PersistedState['communityRatings'] {
  const seed: PersistedState['communityRatings'] = {};
  for (const c of getAllCoffees()) {
    let h = 7;
    for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    if (h % 10 >= 6) continue;
    seed[c.id] = { count: MIN_COMMUNITY_RATERS + (h % 38), average: 3.4 + ((h >>> 4) % 15) / 10 };
  }
  return seed;
}

function seedCups(userId: string, months: number, perMonth: number): Cup[] {
  const coffees = getAllCoffees().filter((c) => c.imageUrl);
  const cups: Cup[] = [];
  let n = 0;
  const now = new Date();
  for (let m = months - 1; m >= 0; m--) {
    for (let i = 0; i < perMonth; i++) {
      const coffee = coffees[(n * 7 + m * 3) % 18]; // repeats some coffees, so totals show
      const day = new Date(now.getFullYear(), now.getMonth() - m, 1 + ((i * 4) % 27), 8 + (i % 3) * 4);
      if (day > now) continue;
      cups.push({
        id: uid(),
        userId,
        coffeeId: coffee.id,
        stars: [5, 4, 4, 3, 5, 2, 4][n % 7],
        // Notes line up with the stars above: the 2★ cup gets the complaint.
        note: ['', 'Lovely as a V60', '', '', 'Morning favourite', 'Too sour for me', 'Great with milk'][n % 7],
        flavorTags: coffee.flavorTags,
        ratedAt: day.toISOString(),
        updatedAt: day.toISOString(),
      });
      n++;
    }
  }
  return cups.sort((a, b) => b.ratedAt.localeCompare(a.ratedAt));
}

export const DEMO_STATES = {
  'first-run': 'First visit, signed out',
  'scans-1': 'Signed out, 1 free scan left',
  'scans-0': 'Signed out, no free scans left',
  'new-user': 'Just signed up, empty journal',
  'regular': 'Signed in, 3 months of cups',
} as const;
export type DemoState = keyof typeof DEMO_STATES;

export function applyDemoState(name: DemoState) {
  const user: User = { id: 'demo-user', displayName: 'Lea', createdAt: '2026-08-01T09:00:00Z' };
  const reset = (next: Partial<PersistedState>) => {
    const seed = next.communityRatings ?? {};
    for (const k of Object.keys(communitySeed)) delete communitySeed[k];
    Object.assign(communitySeed, seed);
    store.replaceState({ ...EMPTY, ...next, communityRatings: seed });
  };
  switch (name) {
    case 'first-run':
      return reset({});
    case 'scans-1':
      return reset({ seenWelcome: true, scansUsed: FREE_SCANS - 1 });
    case 'scans-0':
      return reset({ seenWelcome: true, scansUsed: FREE_SCANS });
    case 'new-user':
      return reset({ seenWelcome: true, user, v1Imported: true, communityRatings: sampleCommunity() });
    case 'regular': {
      const cups = seedCups(user.id, 3, 9);
      const tried = new Set(cups.map((c) => c.coffeeId));
      const saved: SavedCoffee[] = getAllCoffees().filter((c) => c.imageUrl && !tried.has(c.id)).slice(0, 5)
        .map((c, i) => {
          const at = new Date(Date.now() - (i + 1) * 3 * 86400000).toISOString();
          return { id: c.id, userId: user.id, coffeeId: c.id, savedAt: at, updatedAt: at };
        });
      return reset({ seenWelcome: true, user, v1Imported: true, cups, saved, communityRatings: sampleCommunity() });
    }
  }
}
