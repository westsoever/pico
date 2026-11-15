import type { Coffee, TasteProfile } from '../types/coffee';
import { matchCoffeesFromText, normalizeLabelText } from './label-match';
import { draftToCoffee, parseLabel, type LabelDraft } from './label-parse';
import { scoreSimilarity } from './similarity';

export type MenuItem =
  | { kind: 'catalog'; coffee: Coffee; score: number | null }
  | { kind: 'draft'; title: string; draft: LabelDraft; score: number | null };

/** Below this mean word confidence (0–100), Tesseract's text is mostly guesses. */
export const POOR_CONFIDENCE = 55;
const MIN_WORDS = 3;

/** True when a photo read is too blurry or empty to show: say "move closer" instead of junk. */
export function isPoorRead({ text, confidence }: { text: string; confidence: number }): boolean {
  const words = normalizeLabelText(text).split(' ').filter((word) => word.length >= 3);
  return confidence < POOR_CONFIDENCE || words.length < MIN_WORDS;
}

/** A line ending in a price ("45 kr", "DKK 45", "€4.50") closes a menu item. */
const PRICE_END = /(?:\d+(?:[.,]\d{1,2})?\s*(?:kr\.?|dkk|,-|€)|(?:kr\.?|dkk|€)\s*\d+(?:[.,]\d{1,2})?)\s*$/i;

/**
 * Menu items as runs of lines. OCR often drops blank lines, so an item also ends at a price,
 * and a line naming a catalog coffee by its name starts a new one (a shelf of bags, one per line).
 */
function segments(text: string, coffees: Coffee[]): string[][] {
  const result: string[][] = [];
  let current: string[] = [];
  let named = false; // the current item started with a catalog coffee's name
  const close = () => { if (current.length) result.push(current); current = []; named = false; };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    // A named coffee keeps its description across a blank line (OCR adds them); it ends at its price or the next name.
    // shortcut: an unnamed coffee right after a price-less named one joins it; fine for priced menus, revisit with real menus.
    if (!line) { if (!named) close(); continue; }
    const hit = matchCoffeesFromText(line, coffees)[0];
    const isName = !!hit?.matched.includes(hit.coffee.name);
    if (current.length && isName) close();
    if (current.length === 0) named = isName;
    current.push(line);
    if (PRICE_END.test(line)) close();
  }
  close();
  return result;
}

/** Score for a sketched coffee: a part the label didn't give (roast) is left out of the profile, not guessed. */
function draftScore(draft: LabelDraft, profile: TasteProfile): number {
  const coffee = draftToCoffee(draft, { id: 'menu', name: 'menu', roaster: 'menu', roastLevel: draft.roastLevel ?? 'medium' });
  return scoreSimilarity(coffee, draft.roastLevel ? profile : { ...profile, topRoastLevels: [] });
}

/** A short title for an unknown coffee: the block's first line that is not just price or size. */
const titleOf = (lines: string[]) =>
  lines.find((line) => /\p{L}{3}/u.test(line) && !/^\s*(?:kr|dkk|€|\d)/i.test(line))?.slice(0, 40) ?? lines[0].slice(0, 40);

/**
 * Every coffee on a menu or shelf photo's text, best match for this person first.
 * Each item (see segments) is matched to the catalog; one with no catalog hit
 * becomes a sketch through parseLabel (only when it reads at least 2 taste fields).
 */
export function pickFromMenu(text: string, coffees: Coffee[], profile: TasteProfile | null): MenuItem[] {
  const items: MenuItem[] = [];
  const seen = new Set<string>();
  const score = (coffee: Coffee) => (profile ? scoreSimilarity(coffee, profile) : null);
  const addCatalog = (coffee: Coffee) => {
    if (seen.has(coffee.id)) return;
    seen.add(coffee.id);
    items.push({ kind: 'catalog', coffee, score: score(coffee) });
  };

  for (const lines of segments(text, coffees)) {
    const blockHit = matchCoffeesFromText(lines.join('\n'), coffees)[0]?.coffee;
    if (blockHit) {
      addCatalog(blockHit);
      continue;
    }
    const draft = parseLabel(lines.join('\n'), coffees);
    if (draft) items.push({ kind: 'draft', title: titleOf(lines), draft, score: profile ? draftScore(draft, profile) : null });
  }

  // Without a profile the menu order stays; with one, best match first (stable for ties).
  return profile ? items.map((item, index) => ({ item, index })).sort((a, b) => (b.item.score ?? 0) - (a.item.score ?? 0) || a.index - b.index).map(({ item }) => item) : items;
}
