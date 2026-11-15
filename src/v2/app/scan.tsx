import { useEffect, useMemo, useRef, useState } from 'react';
import { getSimilarToCoffee } from '../../lib/similarity';
import { matchCoffeesFromText } from '../../lib/label-match';
import { parseLabel, type LabelDraft } from '../../lib/label-parse';
import { liveDecision } from '../../lib/live-scan';
import { LabelAnswer } from './features/LabelAnswer';
import { preloadLabelReader, readLabel } from '../../lib/label-ocr';
import { isPoorRead } from '../../lib/menu-pick';
import { PoorRead } from './features/MenuPick';
import { LiveScan, type CameraState, type LiveScanHandle, type Shot } from './features/LiveScan';
import { resizePhoto } from '../../components/CameraCapture';
import { type Coffee, type TasteProfile } from '../../types/coffee';
import { addScanPhoto } from '../store/photos';
import { ACCOUNTS, FREE_SCANS, currentProfile, spendScan, communityRating, type ProtoState, allCoffees } from './state';
import { ChevronRight, CloseIcon, LibraryIcon, PlusIcon, Star } from './icons';
import { Bag } from './parts';
import { back, closeScan, go } from './routing';
import { match } from './util';

// idle: the live camera. add: log a coffee Pico doesn't know, prefilled from whatever the photo gave.
type ScanPhase =
  | { kind: 'idle' }
  | { kind: 'reading'; photo?: string }
  | { kind: 'poor'; shot: Shot }
  | { kind: 'results'; coffees: Coffee[]; shot?: Shot; draft?: LabelDraft | null }
  | { kind: 'add'; shot?: Shot; missed: boolean };

// Scan result answer line: community rating, then your own stars or your match. Unfloored match: this is the decision moment.
function ResultVerdict({ s, coffee, profile, best }: { s: ProtoState; coffee: Coffee; profile: TasteProfile | null; best: boolean }) {
  const community = communityRating(coffee.id);
  const mine = s.cups.filter((x) => x.coffeeId === coffee.id);
  const m = match(coffee, profile);
  //   keeps each part on one line, so the line only wraps at a " · ".
  const yours = mine.length ? `You ★ ${(mine.reduce((t, x) => t + x.stars, 0) / mine.length).toFixed(1)}` : m !== null ? `${m}% match` : null;
  return (
    <span className="p-result__verdict">
      {community ? <><Star size={best ? 16 : 12} />{community.average.toFixed(1)} · {community.count}{' '}ratings</> : !coffee.isCustom && 'New on Pico'}
      {yours && (community || !coffee.isCustom ? ` · ${yours}` : yours)}
    </span>
  );
}

export function Scan({ s }: { s: ProtoState }) {
  const [phase, setPhase] = useState<ScanPhase>({ kind: 'idle' });
  const [camera, setCamera] = useState<CameraState>('pending');
  const [liveReading, setLiveReading] = useState(false);
  const [missed, setMissed] = useState<Shot | null>(null); // the last live read that found nothing
  const cam = useRef<LiveScanHandle>(null);
  const shutterInput = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const left = FREE_SCANS - s.scansUsed;
  const profile = useMemo(() => currentProfile(s), [s]);
  useEffect(preloadLabelReader, []);

  if (ACCOUNTS && !s.user && left <= 0 && phase.kind === 'idle') {
    return (
      <div className="p-scan">
        <button className="p-scan__close" onClick={back} aria-label="Close"><CloseIcon /></button>
        <div className="p-wall">
          <span className="p-wall__count">{FREE_SCANS}/{FREE_SCANS}</span>
          <h1>You’ve used your free scans</h1>
          <p>Create a free account to keep scanning. Your journal and taste profile stay safe on every device.</p>
          <button className="p-btn p-btn--amber" onClick={() => go('/signup?reason=scans&next=/scan')}>Create free account</button>
          <button className="p-btn p-btn--ghost-dark" onClick={() => go('/discover')}>Browse coffees instead</button>
        </div>
      </div>
    );
  }

  const start = () => (spendScan() ? true : (go('/signup?reason=scans&next=/scan'), false));
  // The scan ended at a coffee: its photo goes into the person's collection.
  const open = (coffee: Coffee, shot?: Shot) => {
    if (shot) void addScanPhoto({ coffeeId: coffee.id, blob: shot.photo });
    go(`/coffee/${coffee.id}`);
  };
  const addNow = (shot?: Shot, wasMissed = false) => setPhase({ kind: 'add', shot, missed: wasMissed });

  // Shutter frame, library photo or fallback camera photo: the same read as the live scan, once.
  const readPhoto = async (photo: string) => {
    setPhase({ kind: 'reading', photo });
    let shot: Shot = { photo, text: '' };
    try {
      const read = await readLabel(photo);
      shot = { photo, text: read.text };
      const matches = matchCoffeesFromText(read.text, allCoffees());
      if (liveDecision(matches) === 'open') { open(matches[0].coffee, shot); return; }
      const coffees = matches.map((m) => m.coffee);
      // Bag artwork drags Tesseract's confidence down even on good reads, so a match always wins over "blurry".
      if (!coffees.length && isPoorRead(read)) { setPhase({ kind: 'poor', shot }); return; }
      const draft = coffees.length ? null : parseLabel(read.text, allCoffees());
      if (!coffees.length && !draft) { addNow(shot, true); return; }
      setPhase({ kind: 'results', shot, coffees, draft });
    } catch {
      addNow(shot, true);
    }
  };
  const onFile = async (file?: File) => {
    if (!file || !start()) return;
    try {
      await readPhoto(await resizePhoto(file));
    } catch {
      addNow(undefined, true);
    }
  };
  const shutter = () => {
    if (camera === 'off') { shutterInput.current?.click(); return; }
    const photo = cam.current?.grab();
    if (photo && start()) void readPhoto(photo);
  };
  const sample = () => {
    if (!start()) return;
    setPhase({ kind: 'reading' });
    const pool = allCoffees().filter((c) => c.imageUrl);
    const hit = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => setPhase({ kind: 'results', coffees: [hit, ...getSimilarToCoffee(hit, [], 2).map((x) => x.coffee)] }), 1200);
  };
  const again = () => { setMissed(null); setPhase({ kind: 'idle' }); };

  const live = phase.kind === 'idle' || phase.kind === 'reading' || phase.kind === 'poor';
  const still = phase.kind === 'reading' ? phase.photo : phase.kind === 'poor' || phase.kind === 'results' || phase.kind === 'add' ? phase.shot?.photo : undefined;
  const busy = phase.kind === 'reading' || liveReading;
  const pill = phase.kind === 'reading' ? 'Reading the label…'
    : camera === 'pending' ? 'Opening the camera…'
    : camera === 'off' ? 'Take a photo of the front of the bag'
    : liveReading ? 'Reading…' : 'Point at the front of the bag';
  const sheet = phase.kind === 'poor' || phase.kind === 'results' || phase.kind === 'add';

  return (
    <div className="p-scan p-scan--cam">
      <button className="p-scan__close" onClick={closeScan} aria-label="Close"><CloseIcon /></button>
      {ACCOUNTS && !s.user && <span className="p-scan__left">{left} of {FREE_SCANS} free scans left</span>}
      <div className="p-cam" data-off={(live && camera === 'off') || undefined}>
        {/* The camera stays on through reading and a blurry read; it stops on a result, on leaving or in a hidden tab. */}
        {live && (
          <LiveScan ref={cam} autoRead={phase.kind === 'idle'} onCamera={setCamera} onReading={setLiveReading}
            onMiss={setMissed}
            onResult={(r) => {
              if (!start()) return;
              if (r.kind === 'open') open(r.coffee, r.shot);
              else setPhase({ kind: 'results', coffees: r.coffees, shot: r.shot, draft: r.draft ?? null });
            }} />
        )}
        {still && <img className="p-cam__still" src={still} alt="" />}
        {!sheet && <p className="p-cam__pill" role="status" data-busy={busy || undefined}>{pill}</p>}
      </div>

      <input ref={shutterInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={library} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {!sheet && (
        <div className="p-cam__controls">
          {missed && phase.kind === 'idle' && (
            <button className="p-btn p-btn--ghost-dark" onClick={() => addNow(missed, true)}>Can’t find it? Add it now</button>
          )}
          <div className="p-cam__row">
            <button className="p-cam__library" disabled={phase.kind === 'reading'} onClick={() => library.current?.click()} aria-label="Choose from library"><LibraryIcon /></button>
            <button className="p-scan__shutter" disabled={phase.kind === 'reading' || camera === 'pending'} onClick={shutter} aria-label="Take photo"><span /></button>
            <span />
          </div>
          <button className="p-link p-link--light" disabled={phase.kind === 'reading'} onClick={sample}>No bag at hand? Try a sample scan</button>
          <button className="p-link p-link--light" disabled={phase.kind === 'reading'} onClick={() => go('/menu')}>At a café? Scan the menu</button>
        </div>
      )}

      {phase.kind === 'poor' && (
        <div className="p-scan__sheet">
          <PoorRead onFile={onFile} onRetake={again} onAdd={() => addNow(phase.shot, true)} />
        </div>
      )}
      {phase.kind === 'add' && (
        <div className="p-scan__sheet p-results">
          <h1>{phase.missed ? 'Not in Pico yet. Add it now' : 'Add this coffee'}</h1>
          <LabelAnswer draft={parseLabel(phase.shot?.text ?? '', allCoffees(), { partial: true })} photo={phase.shot?.photo} profile={profile}
            onRetry={again} onSaved={(id) => { if (phase.shot) void addScanPhoto({ coffeeId: id, blob: phase.shot.photo }); }} />
          <p className="p-scan__note">Your photo stays on this phone.</p>
        </div>
      )}
      {phase.kind === 'results' && phase.draft && (
        <div className="p-scan__sheet p-results">
          <h1>Not in Pico yet. Here’s what the label says</h1>
          <LabelAnswer draft={phase.draft} photo={phase.shot?.photo} profile={profile} onRetry={again}
            onSaved={(id) => { if (phase.shot) void addScanPhoto({ coffeeId: id, blob: phase.shot.photo }); }} />
        </div>
      )}
      {phase.kind === 'results' && !phase.draft && (
        <div className="p-scan__sheet p-results">
          <h1>{phase.coffees.length ? 'Is it one of these?' : 'We couldn’t find this bag'}</h1>
          {phase.coffees.map((c, i) => (
            <button key={c.id} className="p-result" data-best={i === 0 || undefined} onClick={() => open(c, phase.shot)}>
              <span className="p-result__img"><Bag coffee={c} w={240} /></span>
              <span className="p-result__text">
                {i === 0 && <span className="p-result__tag">Most likely</span>}
                <b>{c.name}</b>
                <span>{c.roaster} · {c.origin}</span>
                <ResultVerdict s={s} coffee={c} profile={profile} best={i === 0} />
              </span>
              <ChevronRight />
            </button>
          ))}
          <button className="p-result p-result--add" onClick={() => addNow(phase.shot, !phase.coffees.length)}>
            <span className="p-result__img"><PlusIcon /></span>
            <span className="p-result__text"><b>Not found, add it now</b><span>Saved to your journal</span></span>
          </button>
          <button className="p-link p-link--light" onClick={again}>Scan another bag</button>
        </div>
      )}
    </div>
  );
}
