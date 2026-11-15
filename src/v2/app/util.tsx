import { type ReactNode } from 'react';
import { formatMatchPercent, scoreSimilarity } from '../../lib/similarity';
import { tasteLine } from '../../lib/taste-line';
import { type Coffee, type FlavorTag, type TasteProfile } from '../../types/coffee';
import { communityRating, type ProtoState } from './state';
import { Star } from './icons';

// A bookmark tapped while signed out: saved right after sign-up. (Ratings need no detour: they save on the phone.)
export const pendingSave: { id: string | null } = { id: null };

// Coffee type chips come from roastStyle; 'omni' counts as both. No cold-brew data in the catalog yet.
export const COFFEE_TYPES = ['filter', 'espresso'] as const;

export type CoffeeType = (typeof COFFEE_TYPES)[number];

export const TYPE_LABELS: Record<CoffeeType, string> = { filter: 'Filter coffee', espresso: 'Espresso' };

// No roastStyle in the data yet counts as both, so those coffees aren't hidden by a type chip.
export const isType = (c: Coffee, t: CoffeeType) => !c.roastStyle || c.roastStyle === t || c.roastStyle === 'omni';

// Discover shelves: each coffee goes to the group of its first flavor tag, the one tasteLine shows,
// so a tile's line never contradicts its shelf. No tags: Bold if dark, otherwise no shelf.
export const SHELVES: { title: string; tags: FlavorTag[] }[] = [
  { title: 'Chocolatey & nutty', tags: ['chocolate', 'nutty', 'caramel'] },
  { title: 'Fruity & bright', tags: ['fruity', 'berry', 'citrus', 'bright'] },
  { title: 'Floral & delicate', tags: ['floral'] },
  { title: 'Bold & full', tags: ['heavy-body', 'spice'] },
];

export const shelfOf = (c: Coffee) =>
  c.flavorTags.length ? SHELVES.findIndex((sh) => sh.tags.includes(c.flavorTags[0])) : c.roastLevel === 'dark' ? 3 : -1;

export const RATING_WORDS = ['Tap to rate', 'Not for me', 'It’s okay', 'Good cup', 'Really good', 'Loved it'];

export const month = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// Match % or null. Tiles and carousel cards pass floor 50 (`match(c, profile, 50)`), so low numbers don't discourage;
// the coffee page shows the honest number (no floor).
export const match = (coffee: Coffee, profile: TasteProfile | null, floor = 0) => {
  const m = profile ? formatMatchPercent(scoreSimilarity(coffee, profile)) : null;
  return m !== null && m >= floor ? m : null;
};

// Quiet third line: community rating first when there is one, then the taste. "★ 4.6 (8) · Fruity · light"
export const tileLine = (c: Coffee) => {
  const cr = communityRating(c.id);
  return `${cr ? `★ ${cr.average.toFixed(1)} (${cr.count}) · ` : ''}${tasteLine(c, 'short')}`;
};

// Every tile's top-left badge: "You ★ x.x" once you've rated it (never mistaken for the community rating),
// else match % from 50 up, else nothing.
export function tileBadge(s: ProtoState, c: Coffee, profile: TasteProfile | null): ReactNode {
  const mine = s.cups.filter((x) => x.coffeeId === c.id);
  if (mine.length) return <>You <Star size={12} /> {(mine.reduce((t, x) => t + x.stars, 0) / mine.length).toFixed(1)}</>;
  const m = match(c, profile, 50);
  return m !== null ? `${m}%` : undefined;
}

// Wrapped and the taste card are cut from the first release: entry points hidden, code kept.
// #/wrapped stays reachable from the Prototype panel.
export const SHOW_WRAPPED = false;

// Beta on the live site: demo states and the panel only in dev or with ?proto in the URL (e.g. /pico/?proto#/discover).
export const PROTO_TOOLS = import.meta.env.DEV || new URLSearchParams(window.location.search).has('proto');
