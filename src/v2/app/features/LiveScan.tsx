// Feature 2: shutterless live scan inside the scan frame. Reads a frame only when the picture is still,
// one read at a time, and hands over to the shutter after 15 s, one slow read, a hidden tab or no camera.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAllCoffees } from '../../../lib/catalog';
import { matchCoffeesFromText } from '../../../lib/label-match';
import { readLabel } from '../../../lib/label-ocr';
import { parseLabel, type LabelDraft } from '../../../lib/label-parse';
import { STEADY_START, frameDifference, liveDecision, nextSteadiness, readFinished, shouldFallBack } from '../../../lib/live-scan';
import { isPoorRead } from '../../../lib/menu-pick';
import type { Coffee } from '../../../types/coffee';
import './wow.css';

export type LiveResult =
  | { kind: 'open'; coffee: Coffee }
  | { kind: 'results'; coffees: Coffee[]; photo: string; draft?: LabelDraft | null };

const TICK_MS = 150;
const TINY_WIDTH = 64;
const READ_MAX = 1200;

export function LiveScan({ active, onResult, onStop }: { active: boolean; onResult: (result: LiveResult) => void; onStop: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  // Latest callbacks without restarting the camera when the parent re-renders.
  const handlers = useRef({ onResult, onStop });
  handlers.current = { onResult, onStop };

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    let steady = STEADY_START;
    let previous: Uint8ClampedArray | null = null;
    let lastReadMs: number | null = null;
    const startedAt = performance.now();
    const tiny = document.createElement('canvas');
    const full = document.createElement('canvas');

    const stop = (handOver: boolean) => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      document.removeEventListener('visibilitychange', onVisibility);
      if (handOver) handlers.current.onStop();
    };
    const onVisibility = () => { if (document.hidden) stop(true); };

    const read = async (el: HTMLVideoElement) => {
      const scale = Math.min(1, READ_MAX / Math.max(el.videoWidth, el.videoHeight));
      full.width = Math.round(el.videoWidth * scale);
      full.height = Math.round(el.videoHeight * scale);
      full.getContext('2d')?.drawImage(el, 0, 0, full.width, full.height);
      const photo = full.toDataURL('image/jpeg', 0.85);
      const t0 = performance.now();
      try {
        const result = await readLabel(photo);
        lastReadMs = Math.round(performance.now() - t0);
        setLastMs(lastReadMs);
        if (stopped) return;
        const coffees = getAllCoffees();
        const matches = matchCoffeesFromText(result.text, coffees);
        const decision = liveDecision(matches);
        // A clear hit opens even at low confidence (bag artwork lowers it); anything weaker waits for a clean read.
        if (decision === 'open') { stop(false); handlers.current.onResult({ kind: 'open', coffee: matches[0].coffee }); return; }
        if (isPoorRead(result)) return;
        if (decision === 'list') { stop(false); handlers.current.onResult({ kind: 'results', photo, coffees: matches.map((m) => m.coffee) }); return; }
        const draft = parseLabel(result.text, coffees);
        if (draft) { stop(false); handlers.current.onResult({ kind: 'results', photo, coffees: [], draft }); }
      } catch {
        stop(true);
      } finally {
        steady = readFinished(steady, performance.now()); // the steadiness state is the one-read-at-a-time guard
      }
    };

    const tick = () => {
      const el = video.current;
      if (stopped || !el || el.readyState < 2 || !el.videoWidth) return;
      if (shouldFallBack(startedAt, performance.now(), lastReadMs)) { stop(true); return; }
      tiny.width = TINY_WIDTH;
      tiny.height = Math.max(1, Math.round((TINY_WIDTH * el.videoHeight) / el.videoWidth));
      const ctx = tiny.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(el, 0, 0, tiny.width, tiny.height);
      const frame = ctx.getImageData(0, 0, tiny.width, tiny.height).data;
      const diff = previous ? frameDifference(previous, frame) : 255;
      previous = frame;
      const next = nextSteadiness(steady, diff, performance.now());
      steady = next.state;
      if (next.read) void read(el);
    };

    if (!navigator.mediaDevices?.getUserMedia) { handlers.current.onStop(); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        stream = s;
        if (stopped || !video.current) { stop(false); return; }
        video.current.srcObject = s;
        void video.current.play().catch(() => undefined);
        document.addEventListener('visibilitychange', onVisibility);
        timer = window.setInterval(tick, TICK_MS);
      })
      .catch(() => stop(true)); // no permission or no camera: today's file-input flow stays
    return () => stop(false);
  }, [active]);

  return (
    <>
      {active && <video ref={video} className="w-live" muted playsInline aria-hidden="true" />}
      {/* Prototype only: the real read time on this device, for the phone test. */}
      {lastMs !== null && (import.meta.env.DEV || new URLSearchParams(window.location.search).has('proto')) && createPortal(<span className="w-readms">{lastMs} ms</span>, document.body)}
    </>
  );
}
