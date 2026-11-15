// Feature 2: the camera inside Pico. The picture stays live for as long as the scan screen shows it; the shutter
// grabs its current frame. While `autoRead` is on, a still picture is read by itself, one read at a time, until a hit,
// 15 s or one slow read; after that only the shutter reads. No camera or no permission: `camera` turns 'off'.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAllCoffees } from '../../../lib/catalog';
import { matchCoffeesFromText } from '../../../lib/label-match';
import { readLabel } from '../../../lib/label-ocr';
import { parseLabel, type LabelDraft } from '../../../lib/label-parse';
import { STEADY_START, frameDifference, liveDecision, nextSteadiness, readFinished, shouldFallBack } from '../../../lib/live-scan';
import { isPoorRead } from '../../../lib/menu-pick';
import type { Coffee } from '../../../types/coffee';
import './wow.css';

/** What a read was made from: kept so "Add it now" can prefill from it and the photo can be saved. */
export interface Shot { photo: string; text: string }

export type LiveResult =
  | { kind: 'open'; coffee: Coffee; shot: Shot }
  | { kind: 'results'; coffees: Coffee[]; shot: Shot; draft?: LabelDraft | null };

export type CameraState = 'pending' | 'on' | 'off';
export interface LiveScanHandle { grab: () => string | null }

const TICK_MS = 150;
const TINY_WIDTH = 64;
const READ_MAX = 1200;
/** No answer from the camera prompt by then: show the photo button instead of a dead shutter. */
const START_TIMEOUT_MS = 8000;

export const LiveScan = forwardRef<LiveScanHandle, {
  autoRead: boolean;
  onResult: (result: LiveResult) => void;
  onCamera: (state: CameraState) => void;
  /** A live read found nothing (or nothing readable); the last shot it read. */
  onMiss?: (shot: Shot) => void;
  onReading?: (reading: boolean) => void;
  /** The auto-read loop gave up without a hit (15 s, a slow read, the reader failed); the shutter still works. */
  onLoopEnd?: () => void;
}>(function LiveScan({ autoRead, onResult, onCamera, onMiss, onReading, onLoopEnd }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  // Latest props without restarting the camera when the parent re-renders.
  const props = useRef({ autoRead, onResult, onCamera, onMiss, onReading, onLoopEnd });
  props.current = { autoRead, onResult, onCamera, onMiss, onReading, onLoopEnd };

  useImperativeHandle(ref, () => ({
    grab: () => {
      const el = video.current;
      if (!el || el.readyState < 2 || !el.videoWidth) return null;
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, READ_MAX / Math.max(el.videoWidth, el.videoHeight));
      canvas.width = Math.round(el.videoWidth * scale);
      canvas.height = Math.round(el.videoHeight * scale);
      canvas.getContext('2d')?.drawImage(el, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    },
  }), []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let startTimer: number | undefined;
    let unmounted = false;
    let looping = true; // the auto-read loop; the camera itself runs on
    let steady = STEADY_START;
    let previous: Uint8ClampedArray | null = null;
    let lastReadMs: number | null = null;
    let startedAt = 0;
    let generation = 0; // only the latest camera start may keep its stream
    const giveUp = () => { if (looping) { looping = false; if (!unmounted) props.current.onLoopEnd?.(); } };
    const tiny = document.createElement('canvas');
    const full = document.createElement('canvas');
    const setCamera = (state: CameraState) => { if (!unmounted) props.current.onCamera(state); };

    const stopCamera = () => {
      window.clearInterval(timer);
      window.clearTimeout(startTimer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    const read = async (el: HTMLVideoElement) => {
      const scale = Math.min(1, READ_MAX / Math.max(el.videoWidth, el.videoHeight));
      full.width = Math.round(el.videoWidth * scale);
      full.height = Math.round(el.videoHeight * scale);
      full.getContext('2d')?.drawImage(el, 0, 0, full.width, full.height);
      const photo = full.toDataURL('image/jpeg', 0.85);
      const t0 = performance.now();
      props.current.onReading?.(true);
      try {
        const result = await readLabel(photo);
        lastReadMs = Math.round(performance.now() - t0);
        setLastMs(lastReadMs);
        // Left, or the shutter took over while this read ran: its answer is stale.
        if (unmounted || !props.current.autoRead) return;
        const shot = { photo, text: result.text };
        const coffees = getAllCoffees();
        const matches = matchCoffeesFromText(result.text, coffees);
        const decision = liveDecision(matches);
        // A clear hit opens even at low confidence (bag artwork lowers it); anything weaker waits for a clean read.
        if (decision === 'open') { looping = false; props.current.onResult({ kind: 'open', coffee: matches[0].coffee, shot }); return; }
        if (!isPoorRead(result)) {
          if (decision === 'list') { looping = false; props.current.onResult({ kind: 'results', shot, coffees: matches.map((m) => m.coffee) }); return; }
          const draft = parseLabel(result.text, coffees);
          if (draft) { looping = false; props.current.onResult({ kind: 'results', shot, coffees: [], draft }); return; }
        }
        props.current.onMiss?.(shot);
      } catch {
        giveUp(); // the reader failed to load: the shutter still works
      } finally {
        if (!unmounted) props.current.onReading?.(false);
        steady = readFinished(steady, performance.now()); // the steadiness state is the one-read-at-a-time guard
      }
    };

    const tick = () => {
      const el = video.current;
      if (!looping || !props.current.autoRead || !el || el.readyState < 2 || !el.videoWidth) return;
      if (shouldFallBack(startedAt, performance.now(), lastReadMs)) { giveUp(); return; }
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

    const start = () => {
      if (!navigator.mediaDevices?.getUserMedia) { setCamera('off'); return; }
      setCamera('pending');
      const current = ++generation;
      let settled = false;
      startTimer = window.setTimeout(() => { if (!settled) { settled = true; setCamera('off'); } }, START_TIMEOUT_MS);
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
        .then((s) => {
          if (unmounted || document.hidden || current !== generation) { s.getTracks().forEach((track) => track.stop()); return; }
          stream = s;
          s.getVideoTracks()[0]?.addEventListener('ended', () => { if (stream === s) { stopCamera(); setCamera('off'); } });
          window.clearTimeout(startTimer);
          settled = true;
          // 'on' once there is a frame to grab, so the shutter is never live while it would grab nothing.
          // Also after the timeout: a late yes still turns the camera on.
          const el = video.current;
          if (el) {
            el.srcObject = s;
            el.addEventListener('loadeddata', () => { if (stream === s) setCamera('on'); }, { once: true });
            void el.play().catch(() => undefined);
          } else setCamera('on');
          startedAt = performance.now();
          steady = STEADY_START;
          timer = window.setInterval(tick, TICK_MS);
        })
        .catch(() => { if (current !== generation) return; window.clearTimeout(startTimer); settled = true; setCamera('off'); }); // denied or no camera: the file input
    };

    // A hidden tab stops the camera; coming back starts it again (no second prompt once allowed).
    const onVisibility = () => {
      if (document.hidden) { generation += 1; stopCamera(); }
      else if (!stream) start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => {
      unmounted = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stopCamera();
    };
  }, []);

  return (
    <>
      <video ref={video} className="w-live" muted playsInline aria-hidden="true" />
      {/* Prototype only: the real read time on this device, for the phone test. */}
      {lastMs !== null && (import.meta.env.DEV || new URLSearchParams(window.location.search).has('proto')) && createPortal(<span className="w-readms">{lastMs} ms</span>, document.body)}
    </>
  );
});
