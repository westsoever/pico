// Feature 5: photo of a café menu or shelf → every coffee on it, the one for you first (#/menu).
// Also the unsharp-photo path (PoorRead), shared with the bag scan.
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { resizePhoto } from '../../../components/CameraCapture';
import { getAllCoffees } from '../../../lib/catalog';
import { preloadLabelReader, readLabel } from '../../../lib/label-ocr';
import { isPoorRead, pickFromMenu, type MenuItem } from '../../../lib/menu-pick';
import { formatMatchPercent } from '../../../lib/similarity';
import type { Coffee } from '../../../types/coffee';
import { CloseIcon, LibraryIcon } from '../icons';
import { currentProfile, spendScan, type ProtoState } from '../state';
import { LabelAnswer } from './LabelAnswer';
import { LiveScan, type CameraState, type LiveScanHandle } from './LiveScan';
import './wow.css';

const go = (to: string) => { window.location.hash = to; };
const cap = (text: string) => text[0].toUpperCase() + text.slice(1);

/**
 * A blurry or empty read: no junk results, always a way forward. Owns its library input; the camera input only
 * when no `onRetake` is given (the bag scan retakes with its own live camera). `onAdd`: log it by hand.
 */
export function PoorRead({ onFile, onRetake, onAdd }: { onFile: (file?: File) => void; onRetake?: () => void; onAdd?: () => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const pick = (e: ChangeEvent<HTMLInputElement>) => { onFile(e.target.files?.[0]); e.target.value = ''; };
  return (
    <div className="w-poor">
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={library} type="file" accept="image/*" hidden onChange={pick} />
      <h1>Move closer and hold still</h1>
      <p>The photo was too blurry to read.</p>
      <button className="p-btn p-btn--amber" onClick={() => (onRetake ? onRetake() : camera.current?.click())}>Retake photo</button>
      {onAdd && <button className="p-btn p-btn--ghost-dark" onClick={onAdd}>Not found, add it now</button>}
      <button className="p-btn p-btn--ghost-dark" onClick={() => library.current?.click()}>Choose from library</button>
      <button className="p-link p-link--light" onClick={() => go('/discover')}>Search instead</button>
    </div>
  );
}

type Phase = { kind: 'idle' } | { kind: 'reading' } | { kind: 'poor' } | { kind: 'results'; items: MenuItem[]; photo: string };

export function MenuPick({ s, bag }: { s: ProtoState; bag: (coffee: Coffee) => ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [open, setOpen] = useState<number | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('pending');
  const cam = useRef<LiveScanHandle>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const profile = useMemo(() => currentProfile(s), [s]);
  useEffect(preloadLabelReader, []);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      await readPhoto(await resizePhoto(file));
    } catch {
      setPhase({ kind: 'poor' });
    }
  };
  // The same in-app camera as the bag scan, without its auto-read: a menu is read when the shutter is tapped.
  const shutter = () => {
    if (cameraState === 'off') { camera.current?.click(); return; }
    const photo = cam.current?.grab();
    if (photo) void readPhoto(photo);
  };
  const readPhoto = async (photo: string) => {
    if (!spendScan()) { go('/signup?reason=scans&next=/menu'); return; }
    setPhase({ kind: 'reading' });
    setOpen(null);
    try {
      const read = await readLabel(photo);
      const items = pickFromMenu(read.text, getAllCoffees(), profile);
      // Found coffees always show; "blurry" only when the read gave nothing (artwork lowers confidence on good reads).
      if (!items.length && isPoorRead(read)) { setPhase({ kind: 'poor' }); return; }
      setPhase({ kind: 'results', photo, items });
    } catch {
      setPhase({ kind: 'poor' });
    }
  };
  const pct = (score: number | null) => (score === null ? null : `${formatMatchPercent(score)}% match`);

  return (
    <div className={phase.kind === 'idle' || phase.kind === 'reading' ? 'p-scan p-scan--cam' : 'p-scan'}>
      <button className="p-scan__close" onClick={() => history.back()} aria-label="Close"><CloseIcon /></button>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={library} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {(phase.kind === 'idle' || phase.kind === 'reading') && (
        <>
          <div className="p-cam" data-off={cameraState === 'off' || undefined}>
            <LiveScan ref={cam} autoRead={false} onCamera={setCameraState} onResult={() => undefined} />
            <p className="p-cam__pill" role="status" data-busy={phase.kind === 'reading' || undefined}>
              {phase.kind === 'reading' ? 'Reading the menu…' : cameraState === 'pending' ? 'Opening the camera…' : 'Fit the coffee menu or shelf in the picture'}
            </p>
          </div>
          <div className="p-cam__controls">
            <div className="p-cam__row">
              <button className="p-cam__library" disabled={phase.kind === 'reading'} onClick={() => library.current?.click()} aria-label="Choose from library"><LibraryIcon /></button>
              <button className="p-scan__shutter" disabled={phase.kind === 'reading' || cameraState === 'pending'} onClick={shutter} aria-label="Take photo"><span /></button>
              <span />
            </div>
          </div>
        </>
      )}

      {phase.kind === 'poor' && <PoorRead onFile={onFile} />}

      {phase.kind === 'results' && (
        <div className="p-results">
          <h1>{phase.items.length === 0 ? 'No coffees found on this menu' : profile ? 'The one for you' : 'On this menu'}</h1>
          {phase.items.map((item, i) => {
            const best = i === 0 && profile !== null;
            if (item.kind === 'catalog') {
              return (
                <button key={item.coffee.id} className="p-result" data-best={best || undefined} onClick={() => go(`/coffee/${item.coffee.id}`)}>
                  <span className="p-result__img">{bag(item.coffee)}</span>
                  <span className="p-result__text">
                    <b>{item.coffee.name}</b>
                    <span>{item.coffee.roaster} · {item.coffee.origin}</span>
                    {pct(item.score) && <span className="p-result__verdict">{pct(item.score)}</span>}
                  </span>
                </button>
              );
            }
            const facts = [item.draft.origin, item.draft.process && cap(item.draft.process), item.draft.tastingNotes.slice(0, 2).join(', ')].filter(Boolean).join(' · ');
            return (
              <div key={`draft-${i}`}>
                <button className="p-result" data-best={best || undefined} onClick={() => setOpen(open === i ? null : i)}>
                  <span className="p-result__img"><img className="p-img-photo w-menu__crop" src={phase.photo} alt="" /></span>
                  <span className="p-result__text">
                    <b>{item.title}</b>
                    {facts && <span>{facts}</span>}
                    {pct(item.score) && <span className="p-result__verdict">{pct(item.score)}</span>}
                  </span>
                </button>
                {open === i && <LabelAnswer draft={item.draft} profile={profile} onRetry={() => setOpen(null)} retryLabel="Close" />}
              </div>
            );
          })}
          {phase.items.length === 0 && <p className="w-poor__p">Try a closer photo of the coffee part of the menu.</p>}
          <button className="p-link p-link--light" onClick={() => setPhase({ kind: 'idle' })}>Scan another menu</button>
        </div>
      )}
    </div>
  );
}
