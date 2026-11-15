import type { Coffee, FlavorTag, RoastLevel, RoastStyle } from '../types/coffee';
import { flavorTagsFromNotes } from './catalog-schema';
import { normalizeLabelText } from './label-match';

/** What a label told us about a coffee Pico doesn't know. Fields not read stay undefined. */
export interface LabelDraft {
  roaster?: string;
  origin?: string;
  process?: string;
  variety?: string;
  roastLevel?: RoastLevel;
  roastStyle?: RoastStyle;
  tastingNotes: string[];
  flavorTags: FlavorTag[];
  /** How many taste fields were read (origin, process, variety, roast, notes). */
  fieldCount: number;
}

export const MIN_DRAFT_FIELDS = 2;

/** Label word (normalized: æ→ae, ø→o, å→a) → catalog spelling. */
const ORIGINS: Record<string, string> = Object.fromEntries([
  ...['Ethiopia', 'Kenya', 'Colombia', 'Brazil', 'Guatemala', 'Costa Rica', 'Peru', 'El Salvador', 'Honduras',
    'Rwanda', 'Burundi', 'Uganda', 'Tanzania', 'Panama', 'Nicaragua', 'Mexico', 'Bolivia', 'Ecuador', 'Yemen',
    'Indonesia', 'Sumatra', 'India', 'Papua New Guinea', 'Congo', 'China', 'Taiwan', 'Myanmar', 'Thailand', 'Vietnam']
    .map((name) => [normalizeLabelText(name), name]),
  ['etiopien', 'Ethiopia'], ['brasilien', 'Brazil'], ['colombien', 'Colombia'], ['indonesien', 'Indonesia'],
  ['mexico', 'Mexico'], ['mexiko', 'Mexico'], ['indien', 'India'], ['kina', 'China'], ['yemen', 'Yemen'],
]);

const PROCESSES: Record<string, string> = {
  washed: 'washed', vasket: 'washed', 'fully washed': 'washed',
  natural: 'natural', naturel: 'natural', naturlig: 'natural', 'sun dried': 'natural', 'dry process': 'natural',
  honey: 'honey', honning: 'honey', 'red honey': 'honey', 'yellow honey': 'honey', 'black honey': 'honey',
  anaerobic: 'anaerobic', anaerob: 'anaerobic', 'carbonic maceration': 'anaerobic',
  'wet hulled': 'wet-hulled', 'pulped natural': 'pulped natural',
};

const VARIETIES = [
  'Pink Bourbon', 'Yellow Bourbon', 'Red Bourbon', 'Bourbon', 'Gesha', 'Geisha', 'Typica', 'Caturra', 'Catuai',
  'Red Catuai', 'SL28', 'SL34', 'SL32', 'Pacamara', 'Heirloom', '74110', '74112', '74158', 'Castillo', 'Ruiru 11',
  'Batian', 'Sidra', 'Java', 'Maragogipe', 'Mundo Novo', 'Catimor', 'Kurume', 'Parainema', 'Pache', 'Wush Wush',
  'Villa Sarchi', 'Laurina', 'Marshell', 'Lempira',
].map((name) => [normalizeLabelText(name), name] as const);

const ROASTS: Record<string, RoastLevel> = {
  'light roast': 'light', 'lightly roasted': 'light', 'lys ristning': 'light', 'lyst ristet': 'light', 'let ristet': 'light',
  'medium roast': 'medium', 'medium ristning': 'medium', 'mellem ristning': 'medium', 'mellemristet': 'medium',
  'dark roast': 'dark', 'mork ristning': 'dark', 'morkristet': 'dark', 'mork ristet': 'dark',
};

const STYLES: Record<string, RoastStyle> = {
  omni: 'omni', 'omni roast': 'omni', filter: 'filter', espresso: 'espresso',
};

/** Danish tasting-note words → the English words Pico's flavor-tag map knows. */
const DANISH_NOTES: Record<string, string> = {
  jordbaer: 'strawberry', blabaer: 'blueberry', hindbaer: 'raspberry', brombaer: 'blackberry', solbaer: 'blackcurrant',
  ribs: 'redcurrant', kirsebaer: 'cherry', baer: 'berries', chokolade: 'chocolate', morkchokolade: 'dark chocolate',
  kakao: 'cocoa', karamel: 'caramel', honning: 'honey', citron: 'lemon', appelsin: 'orange', lime: 'lime',
  hasselnod: 'hazelnut', mandel: 'almond', nodder: 'nuts', blomster: 'flowers', jasmin: 'jasmine', aeble: 'apple',
  paere: 'pear', fersken: 'peach', abrikos: 'apricot', blomme: 'plum', rosin: 'raisin', rabarber: 'rhubarb',
  mork: 'dark', lys: 'light', rod: 'red', gron: 'green', sort: 'black', vanilje: 'vanilla', kanel: 'cinnamon', 'brun farin': 'brown sugar', rorsukker: 'cane sugar',
};

const NOTES_CUE = /\b(?:tasting notes|notes|smagsnoter|noter|smager af|smag|cup)\b\s*:?/i;
const SEPARATORS = /\s*(?:[,·•|/+&]|\band\b|\bog\b)\s*/i;

/** Values whose phrase appears as whole words in `text`, longest phrase first so "pink bourbon" beats "bourbon". */
function findAll<T>(text: string, entries: readonly (readonly [string, T])[]): T[] {
  const padded = ` ${text} `;
  const hits = [...entries].sort((a, b) => b[0].length - a[0].length).filter(([phrase]) => padded.includes(` ${phrase} `));
  return [...new Set(hits.map(([, value]) => value))];
}

function findFirst<T>(text: string, entries: readonly (readonly [string, T])[]): T | undefined {
  return findAll(text, entries)[0];
}

// Two countries on one bag is a blend: no single origin to name.
const onlyOne = (values: string[]) => (values.length === 1 ? values[0] : undefined);

function noteFrom(item: string): string | undefined {
  const words = normalizeLabelText(item);
  if (!words || words.split(' ').length > 3) return undefined;
  // OCR reads Danish "æ" as e/ee/oe ("hindbeer"), so a -bær word is tried with its ending restored.
  const danish = (word: string) => DANISH_NOTES[word] ?? DANISH_NOTES[word.replace(/(?:ee|oe|e)r$/, 'aer')] ?? word;
  const english = DANISH_NOTES[words] ?? words.split(' ').map(danish).join(' ');
  // Only items the flavor map knows count as notes, so OCR junk never becomes a "note".
  return flavorTagsFromNotes([english]).length > 0 ? english : undefined;
}

/** Notes only from a line that says it lists notes, or a list line where 2+ items are flavor words. */
function readNotes(lines: string[]): { notes: string[]; used: number[] } {
  for (const [index, raw] of lines.entries()) {
    // A list ending in a separator carries on in the next line.
    const continues = /[,&·+]$/.test(raw) && index + 1 < lines.length;
    const line = continues ? `${raw} ${lines[index + 1]}` : raw;
    const cue = NOTES_CUE.exec(line);
    const items = (cue ? line.slice(cue.index + cue[0].length) : line).split(SEPARATORS);
    const notes = items.map(noteFrom).filter((note): note is string => !!note);
    if ((cue && notes.length > 0) || notes.length >= 2) {
      return { notes: [...new Set(notes)].slice(0, 4), used: continues ? [index, index + 1] : [index] };
    }
  }
  return { notes: [], used: [] };
}

/**
 * Builds a coffee sketch from label text Pico read but couldn't match to the catalog.
 * Returns null when fewer than MIN_DRAFT_FIELDS taste fields were read; never guesses a field.
 * `partial` (the person chose to add it): always a draft with whatever was read, possibly nothing.
 */
export function parseLabel(text: string, coffees: Pick<Coffee, 'roaster'>[], opts: { partial: true }): LabelDraft;
export function parseLabel(text: string, coffees?: Pick<Coffee, 'roaster'>[], opts?: { partial?: boolean }): LabelDraft | null;
export function parseLabel(text: string, coffees: Pick<Coffee, 'roaster'>[] = [], opts: { partial?: boolean } = {}): LabelDraft | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const { notes: tastingNotes, used } = readNotes(lines);
  // Facts come from every line but the notes, so "honning" in the notes is never read as a honey process.
  const norm = normalizeLabelText(lines.filter((_, index) => !used.includes(index)).join('\n'));

  const roasters = [...new Set(coffees.map((c) => c.roaster))].map((name) => [normalizeLabelText(name), name] as const);
  const roastLevel = findFirst(norm, Object.entries(ROASTS));
  const draft: LabelDraft = {
    roaster: findFirst(norm, roasters.filter(([phrase]) => phrase.length >= 4)),
    origin: onlyOne(findAll(norm, Object.entries(ORIGINS))),
    process: findFirst(norm, Object.entries(PROCESSES)),
    variety: findFirst(norm, VARIETIES),
    roastLevel,
    roastStyle: findFirst(norm, Object.entries(STYLES)),
    tastingNotes,
    flavorTags: flavorTagsFromNotes(tastingNotes),
    fieldCount: 0,
  };
  draft.fieldCount = [draft.origin, draft.process, draft.variety, roastLevel, tastingNotes.length ? 'notes' : undefined]
    .filter(Boolean).length;
  return opts.partial || draft.fieldCount >= MIN_DRAFT_FIELDS ? draft : null;
}

/** The draft as a full Coffee for scoring and saving; unread origin/process become "Unknown" like hand-added coffees. */
export function draftToCoffee(
  draft: LabelDraft,
  input: { id: string; name: string; roaster: string; roastLevel: RoastLevel },
): Coffee {
  return {
    id: input.id,
    name: input.name.trim(),
    roaster: input.roaster.trim(),
    origin: draft.origin ?? 'Unknown',
    process: draft.process ?? 'Unknown',
    roastLevel: input.roastLevel,
    variety: draft.variety,
    roastStyle: draft.roastStyle,
    flavorTags: draft.flavorTags,
    tastingNotes: draft.tastingNotes.length ? draft.tastingNotes : undefined,
    description: 'Added from a label scan.',
    isCustom: true,
  };
}
