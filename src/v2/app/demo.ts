// Demo states for design review (dev, or ?proto on the live site): switch with ?state=… or the Prototype panel.
import { getAllCoffees } from '../../lib/catalog';
import { EMPTY, MIN_COMMUNITY_RATERS, uid, type Cup, type PersistedState, type SavedCoffee, type User } from '../store/state';
import { FREE_SCANS } from '../store/store';
import { communitySeed, store } from './state';

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
