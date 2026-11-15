import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllCoffees } from '../../lib/catalog';
import { getSimilarToCoffee } from '../../lib/similarity';
import { matchCoffeesFromText } from '../../lib/label-match';
import { parseLabel, type LabelDraft } from '../../lib/label-parse';
import { LabelAnswer } from './features/LabelAnswer';
import { preloadLabelReader, readLabel } from '../../lib/label-ocr';
import { isPoorRead } from '../../lib/menu-pick';
import { PoorRead } from './features/MenuPick';
import { LiveScan } from './features/LiveScan';
import { resizePhoto } from '../../components/CameraCapture';
import { type Coffee, type TasteProfile } from '../../types/coffee';
import { ACCOUNTS, FREE_SCANS, currentProfile, spendScan, communityRating, type ProtoState } from './state';
import { ChevronRight, CloseIcon, PlusIcon, Star } from './icons';
import { Bag } from './parts';
import { back, closeScan, go } from './routing';
import { match } from './util';

type ScanPhase = { kind: 'idle' } | { kind: 'reading' } | { kind: 'poor' } | { kind: 'results'; coffees: Coffee[]; photo?: string; draft?: LabelDraft | null };

// Scan result answer line: community rating, then your own stars or your match. Unfloored match: this is the decision moment.
function ResultVerdict({ s, coffee, profile, best }: { s: ProtoState; coffee: Coffee; profile: TasteProfile | null; best: boolean }) {
  const community = communityRating(coffee.id);
  const mine = s.cups.filter((x) => x.coffeeId === coffee.id);
  const m = match(coffee, profile);
  //   keeps each part on one line, so the line only wraps at a " · ".
  const yours = mine.length ? `You ★ ${(mine.reduce((t, x) => t + x.stars, 0) / mine.length).toFixed(1)}` : m !== null ? `${m}% match` : null;
  return (
    <span className="p-result__verdict">
      {community ? <><Star size={best ? 16 : 12} />{community.average.toFixed(1)} · {community.count}{' '}ratings</> : 'New on Pico'}
      {yours && ` · ${yours}`}
    </span>
  );
}

export function Scan({ s }: { s: ProtoState }) {
  const [phase, setPhase] = useState<ScanPhase>({ kind: 'idle' });
  const [live, setLive] = useState(true); // live camera scan; off after its fallback or a shutter tap
  const input = useRef<HTMLInputElement>(null);
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
  const onFile = async (file?: File) => {
    if (!file || !start()) return;
    setPhase({ kind: 'reading' });
    try {
      const photo = await resizePhoto(file);
      const read = await readLabel(photo);
      const text = read.text;
      const coffees = matchCoffeesFromText(text, getAllCoffees()).map((m) => m.coffee);
      // Bag artwork drags Tesseract's confidence down even on good reads, so a match always wins over "blurry".
      if (!coffees.length && isPoorRead(read)) { setPhase({ kind: 'poor' }); return; }
      setPhase({ kind: 'results', photo, coffees, draft: coffees.length ? null : parseLabel(text, getAllCoffees()) });
    } catch {
      setPhase({ kind: 'results', coffees: [] });
    }
  };
  const sample = () => {
    if (!start()) return;
    setPhase({ kind: 'reading' });
    const pool = getAllCoffees().filter((c) => c.imageUrl);
    const hit = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => setPhase({ kind: 'results', coffees: [hit, ...getSimilarToCoffee(hit, [], 2).map((x) => x.coffee)] }), 1200);
  };

  return (
    <div className="p-scan">
      <button className="p-scan__close" onClick={closeScan} aria-label="Close"><CloseIcon /></button>
      {ACCOUNTS && !s.user && <span className="p-scan__left">{left} of {FREE_SCANS} free scans left</span>}
      {phase.kind === 'poor' && <PoorRead onFile={onFile} />}
      {(phase.kind === 'idle' || phase.kind === 'reading') && (
        <>
          <div className="p-scan__frame" data-busy={phase.kind === 'reading' || undefined}>
            <span /><span /><span /><span />
            <LiveScan active={live && phase.kind === 'idle'} onStop={() => setLive(false)} onResult={(r) => {
              if (!start()) return;
              if (r.kind === 'open') go(`/coffee/${r.coffee.id}`);
              else setPhase({ kind: 'results', coffees: r.coffees, photo: r.photo, draft: r.draft ?? null });
            }} />
            <p>{phase.kind === 'reading' ? 'Reading the label…' : live ? 'Point at the front of the bag' : 'Tap to scan'}</p>
          </div>
          <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="p-scan__shutter" disabled={phase.kind === 'reading'} onClick={() => { setLive(false); input.current?.click(); }} aria-label="Take photo"><span /></button>
          <button className="p-link p-link--light" disabled={phase.kind === 'reading'} onClick={sample}>No bag at hand? Try a sample scan</button>
          <button className="p-link p-link--light" disabled={phase.kind === 'reading'} onClick={() => go('/menu')}>At a café? Scan the menu</button>
        </>
      )}
      {phase.kind === 'results' && phase.draft && (
        <div className="p-results">
          <h1>Not in Pico yet. Here’s what the label says</h1>
          <LabelAnswer draft={phase.draft} photo={phase.photo} profile={profile} onRetry={() => setPhase({ kind: 'idle' })} />
        </div>
      )}
      {phase.kind === 'results' && !phase.draft && (
        <div className="p-results">
          <h1>{phase.coffees.length ? 'Is it one of these?' : 'We couldn’t find this bag'}</h1>
          {phase.coffees.map((c, i) => (
            <button key={c.id} className="p-result" data-best={i === 0 || undefined} onClick={() => go(`/coffee/${c.id}`)}>
              <span className="p-result__img"><Bag coffee={c} w={160} /></span>
              <span className="p-result__text">
                {i === 0 && <span className="p-result__tag">Most likely</span>}
                <b>{c.name}</b>
                <span>{c.roaster} · {c.origin}</span>
                <ResultVerdict s={s} coffee={c} profile={profile} best={i === 0} />
              </span>
              <ChevronRight />
            </button>
          ))}
          {/* The /add form doesn't save yet, so it waits for accounts. */}
          {ACCOUNTS && (
            <button className="p-result p-result--add" onClick={() => go(s.user ? '/add' : '/signup?reason=add&next=/add')}>
              <span className="p-result__img"><PlusIcon /></span>
              <span className="p-result__text"><b>Not here? Add it by hand</b><span>Saved to your journal, and you can send it to Pico</span></span>
            </button>
          )}
          <button className="p-link p-link--light" onClick={() => setPhase({ kind: 'idle' })}>Scan another bag</button>
        </div>
      )}
    </div>
  );
}
