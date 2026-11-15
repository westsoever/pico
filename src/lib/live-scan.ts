import { MATCH_THRESHOLD, isRoasterOnlyMatch, type LabelMatch } from './label-match';

/**
 * Auto-open needs a clear, named hit. Tuned on OCR of the 71 catalog bag photos: with these numbers
 * 29 opened by themselves and 1 was wrong (EverBean KeHo, whose photo text names CoTa's origins).
 */
export const AUTO_OPEN_MIN_SCORE = 2 * MATCH_THRESHOLD;
export const AUTO_OPEN_MIN_GAP = 1.5;

/** Mean luminance change (0–255) per pixel below which two tiny frames count as the same picture. */
export const STILL_DIFF = 6;
/** The picture must stay still this long before a frame is read. */
export const STILL_MS = 400;
/** Stop live scanning and hand over to the shutter after this long without a hit, or one read this slow. */
export const LIVE_BUDGET_MS = 15000;
export const SLOW_READ_MS = 4000;

export type LiveDecision = 'open' | 'list' | 'none';

/** open: go straight to the coffee. list: show the candidates as today. none: keep looking. */
export function liveDecision(matches: LabelMatch[]): LiveDecision {
  const [top, second] = matches;
  if (!top) return 'none';
  const named = top.matched.includes(top.coffee.name) || (!!top.coffee.producer && top.matched.includes(top.coffee.producer));
  const clear = top.score >= AUTO_OPEN_MIN_SCORE && top.score - (second?.score ?? 0) >= AUTO_OPEN_MIN_GAP;
  return clear && named && !isRoasterOnlyMatch(top) ? 'open' : 'list';
}

/** Mean absolute luminance difference between two same-size RGBA frames, 0–255. */
export function frameDifference(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return 255;
  let total = 0;
  for (let i = 0; i < a.length; i += 4) {
    const la = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
    const lb = b[i] * 0.299 + b[i + 1] * 0.587 + b[i + 2] * 0.114;
    total += Math.abs(la - lb);
  }
  return total / (a.length / 4);
}

/** After a read without a result, read the same still picture again this long after that read finished. */
export const REARM_MS = 1500;

/**
 * When to read a frame: only once the picture has been still for STILL_MS, never while a read runs,
 * and after a read only when the picture has changed and settled again, or REARM_MS after that read
 * finished (a hand-held bag can look "still" at 64 px the whole time). Motion-blurred frames are never read.
 */
export interface Steadiness {
  stillSince: number | null;
  armed: boolean;
  reading: boolean;
  lastReadEnd: number | null;
}

export const STEADY_START: Steadiness = { stillSince: null, armed: true, reading: false, lastReadEnd: null };

export function nextSteadiness(state: Steadiness, diff: number, now: number): { state: Steadiness; read: boolean } {
  if (diff > STILL_DIFF) return { state: { ...state, stillSince: null, armed: true }, read: false };
  const stillSince = state.stillSince ?? now;
  const armed = state.armed || (!state.reading && state.lastReadEnd !== null && now - state.lastReadEnd >= REARM_MS);
  const read = armed && !state.reading && now - stillSince >= STILL_MS;
  return { state: { ...state, stillSince, armed: armed && !read, reading: state.reading || read }, read };
}

/** Call when a read finishes without a result; starts the REARM_MS clock. */
export function readFinished(state: Steadiness, now: number): Steadiness {
  return { ...state, reading: false, lastReadEnd: now };
}

/** True when live scanning should stop and show the shutter instead. */
export function shouldFallBack(startedAt: number, now: number, lastReadMs: number | null): boolean {
  return now - startedAt > LIVE_BUDGET_MS || (lastReadMs !== null && lastReadMs > SLOW_READ_MS);
}
