import { describe, expect, it } from 'vitest';
import type { Coffee } from '../types/coffee';
import type { LabelMatch } from './label-match';
import { REARM_MS, STEADY_START, STILL_MS, frameDifference, liveDecision, nextSteadiness, readFinished, shouldFallBack } from './live-scan';

const coffee = (id: string): Coffee => ({ id, name: id, roaster: 'Roaster', origin: 'Kenya', process: 'washed', roastLevel: 'light', flavorTags: [], description: '' });
const hit = (id: string, score: number, matched = [id, 'Roaster']): LabelMatch => ({ coffee: coffee(id), score, matched });

describe('liveDecision', () => {
  it('opens a clear, named hit that beats the second', () => {
    expect(liveDecision([hit('Kieni', 8.99), hit('Other', 2.46)])).toBe('open');
    expect(liveDecision([hit('Kieni', 4.29)])).toBe('open');
  });

  it('lists close calls, low scores and hits without the coffee name', () => {
    expect(liveDecision([hit('A', 4.44), hit('B', 4.43)])).toBe('list'); // two near-equal coffees
    expect(liveDecision([hit('A', 2.6)])).toBe('list'); // above MATCH_THRESHOLD, below the auto-open bar
    expect(liveDecision([hit('A', 6, ['Roaster', 'Kenya', 'SL28'])])).toBe('list'); // never read the name
    expect(liveDecision([hit('A', 4, ['Roaster'])])).toBe('list'); // roaster only
  });

  it('keeps looking with no candidates', () => {
    expect(liveDecision([])).toBe('none');
  });
});

describe('frameDifference', () => {
  it('is 0 for the same frame and large for a different one', () => {
    const black = new Uint8ClampedArray(64 * 4);
    const white = new Uint8ClampedArray(64 * 4).fill(255);
    expect(frameDifference(black, black)).toBe(0);
    expect(frameDifference(black, white)).toBeCloseTo(255);
    expect(frameDifference(black, new Uint8ClampedArray(8))).toBe(255); // size changed: treat as moved
  });
});

describe('nextSteadiness', () => {
  it('reads after the picture is still, and again soon after a change settles', () => {
    let s = STEADY_START;
    let r = nextSteadiness(s, 1, 0); s = r.state; expect(r.read).toBe(false);
    r = nextSteadiness(s, 1, STILL_MS - 1); s = r.state; expect(r.read).toBe(false);
    r = nextSteadiness(s, 1, STILL_MS); s = r.state; expect(r.read).toBe(true);
    s = readFinished(s, 600);
    r = nextSteadiness(s, 40, 700); s = r.state; expect(r.read).toBe(false); // moved: re-armed
    r = nextSteadiness(s, 1, 800); s = r.state; expect(r.read).toBe(false);
    r = nextSteadiness(s, 1, 800 + STILL_MS); expect(r.read).toBe(true); // settled again, before REARM_MS
  });

  it('re-reads a still picture REARM_MS after the last read finished, one read at a time', () => {
    let s = STEADY_START;
    const reads: number[] = [];
    let readingUntil = -1;
    // A still, hand-held bag for 6 s; each read takes 700 ms and finds nothing.
    for (let t = 0; t <= 6000; t += 50) {
      if (t === readingUntil) s = readFinished(s, t);
      const r = nextSteadiness(s, 1, t);
      s = r.state;
      if (r.read) {
        expect(t).toBeGreaterThanOrEqual(readingUntil); // never two reads at once
        reads.push(t);
        readingUntil = t + 700;
      }
    }
    expect(reads[0]).toBe(STILL_MS);
    expect(reads[1]).toBe(STILL_MS + 700 + REARM_MS);
    expect(reads.length).toBe(3);
  });

  it('never starts a read while one runs, even when the picture changes', () => {
    let r = nextSteadiness(STEADY_START, 1, 0);
    r = nextSteadiness(r.state, 1, STILL_MS); expect(r.read).toBe(true);
    let s = r.state;
    for (let t = STILL_MS + 50; t < 4000; t += 50) {
      r = nextSteadiness(s, t % 500 === 0 ? 40 : 1, t);
      expect(r.read).toBe(false);
      s = r.state;
    }
  });

  it('never reads while the picture moves', () => {
    let s = STEADY_START;
    for (let t = 0; t < 3000; t += 150) {
      const r = nextSteadiness(s, 20, t);
      expect(r.read).toBe(false);
      s = r.state;
    }
  });
});

describe('shouldFallBack', () => {
  it('stops after the time budget or one slow read', () => {
    expect(shouldFallBack(0, 5000, 900)).toBe(false);
    expect(shouldFallBack(0, 15001, null)).toBe(true);
    expect(shouldFallBack(0, 5000, 4001)).toBe(true);
  });
});
