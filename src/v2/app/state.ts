// The screens' state: one instance of the real v2 store (src/v2/store) behind a small function API, with its sync
// engine talking to the in-memory fake server: no Supabase, no network yet. NEXT.md step b swaps in the Supabase
// remote together with the real sign-up (auth.ts); until then the sign-up here is the instant fake one.
// Demo states for design review live in demo.ts.
import { useSyncExternalStore } from 'react';
import {
  LOCAL_USER_ID, MIN_COMMUNITY_RATERS, PROTOTYPE_KEY, STORAGE_KEY, uid,
  type Cup, type PersistedState, type SavedCoffee, type User,
} from '../store/state';
import {
  FREE_SCANS, createStore, currentProfile, profileOf, totalsByCoffee, type CoffeeTotals, type StoreState,
} from '../store/store';
import { createSync, startAutoSync } from '../sync/engine';
import { createFakeRemote } from '../sync/fake-remote';
import { showAccounts } from '../flags';

export { FREE_SCANS, LOCAL_USER_ID, currentProfile, profileOf, totalsByCoffee, uid };
export type { CoffeeTotals, Cup, SavedCoffee, User };

/** The prototype's view of the state: the real store's, plus the sample community data under its old name. */
export type ProtoState = StoreState & {
  /** SAMPLE DATA: other people's ratings per coffee, seeded by demo states only (lives in the store's community cache). */
  communitySeed: PersistedState['communityRatings'];
};

const firstBoot = localStorage.getItem(STORAGE_KEY) === null;
export const store = createStore(localStorage);

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
export const communitySeed: PersistedState['communityRatings'] = { ...store.getState().communityRatings };
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
