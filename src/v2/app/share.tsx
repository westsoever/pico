import { useState, type CSSProperties, type ReactNode } from 'react';
import { FLAVOR_TAG_LABELS, type FlavorTag } from '../../types/coffee';
import { allCoffees, coffeeById, totalsByCoffee, type ProtoState } from './state';
import { CloseIcon, ShareIcon } from './icons';
import bagWidths from './bag-widths.json';
import { Bag, Stars } from './parts';
import { back, go } from './routing';

export function Wrapped({ s, q }: { s: ProtoState; q: URLSearchParams }) {
  const [slide, setSlide] = useState(0);
  const latest = s.cups[0]?.ratedAt.slice(0, 7);
  const ym = q.get('m') ?? latest ?? new Date().toISOString().slice(0, 7);
  const cups = s.cups.filter((c) => c.ratedAt.startsWith(ym));
  const label = new Date(`${ym}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long' });
  const close = () => go('/journal');
  if (!cups.length) {
    return (
      <div className="p-wrapped" data-slide="0">
        <button className="p-scan__close" onClick={close} aria-label="Close"><CloseIcon /></button>
        <div className="p-wrapped__body"><span className="p-eyebrow">Wrapped</span><h1>Your first Pico month wraps on the 1st.</h1><p>Log a few cups and come back.</p></div>
      </div>
    );
  }
  const totals = totalsByCoffee(cups);
  const top = [...totals].sort((a, b) => b.cups.length - a.cups.length || b.average - a.average)[0];
  const tagCount = new Map<FlavorTag, number>();
  cups.forEach((c) => c.flavorTags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)));
  const topTag = [...tagCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const roasters = [...new Set(cups.map((c) => coffeeById(c.coffeeId)?.roaster).filter(Boolean))];
  const origins = [...new Set(totals.map((t) => t.coffee.origin))];
  const avg = cups.reduce((t, c) => t + c.stars, 0) / cups.length;
  const slides: ReactNode[] = [
    <><span className="p-eyebrow">Pico Wrapped</span><h1>Your {label} in coffee</h1><p>Tap to start</p></>,
    <><span className="p-wrapped__big">{cups.length}</span><h1>cups logged</h1><p>{totals.length} different coffees, {avg.toFixed(1)} stars on average.</p></>,
    <><span className="p-eyebrow">Your coffee of the month</span><span className="p-wrapped__bag"><Bag coffee={top.coffee} w={500} /></span><h1>{top.coffee.name}</h1><p>{top.coffee.roaster} · {top.cups.length} {top.cups.length === 1 ? "cup" : "cups"} · <Stars n={top.average} /></p></>,
    <><span className="p-eyebrow">Your flavor</span><span className="p-wrapped__big p-wrapped__big--word">{topTag ? FLAVOR_TAG_LABELS[topTag] : '—'}</span><p>Then {origins.slice(0, 3).join(', ')}.</p></>,
    <><span className="p-wrapped__big">{roasters.length}</span><h1>roasters</h1><p>{roasters.slice(0, 4).join(', ')}{roasters.length > 4 ? ' and more' : ''}</p></>,
    <><span className="p-eyebrow">That’s your {label}</span><h1>Share it?</h1><button className="p-btn p-btn--amber" onClick={(e) => { e.stopPropagation(); go(`/share/month/${ym}`); }}><ShareIcon /> Share my month</button></>,
  ];
  return (
    <div className="p-wrapped" data-slide={slide % 3} onClick={() => (slide < slides.length - 1 ? setSlide(slide + 1) : close())}>
      <div className="p-wrapped__bars">{slides.map((_, i) => <span key={i} data-on={i <= slide || undefined} />)}</div>
      <button className="p-scan__close" onClick={(e) => { e.stopPropagation(); close(); }} aria-label="Close"><CloseIcon /></button>
      <div className="p-wrapped__body" key={slide}>{slides[slide]}</div>
    </div>
  );
}

export function Share({ s, kind, id }: { s: ProtoState; kind: string; id: string }) {
  const cup = kind === 'cup' ? s.cups.find((c) => c.id === id) : undefined;
  const coffee = coffeeById(cup?.coffeeId ?? (kind === 'coffee' ? id : s.cups[0]?.coffeeId ?? allCoffees()[0].id));
  if (!coffee) return null;
  const title = kind === 'month' ? `My ${new Date(`${id}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long' })} in coffee`
    : kind === 'profile' ? `${s.user?.displayName ?? 'My'} taste on Pico` : coffee.name;
  // shortcut: shares a link + text only; v2 renders the card to a PNG (canvas) and shares the file.
  const share = async () => {
    const data = { title, text: `${title} · ${coffee.roaster}`, url: `https://westsoever.github.io/pico/#/coffee/${coffee.id}` };
    try { await navigator.share?.(data); } catch { /* cancelled */ }
  };
  return (
    <div className="p-sheet-page p-share">
      <button className="p-glass p-glass--round p-sheet-page__close" onClick={back} aria-label="Close"><CloseIcon /></button>
      <div className="p-card">
        {/* Enlarge cutouts to trim their transparent margin, but never past the 12px-inset box (wide boxes stay put). */}
        <span className="p-card__bag" style={{ '--trim': Math.min(1.4, 1 / ((bagWidths as Record<string, number>)[coffee.id] ?? 1)) } as CSSProperties}>
          <Bag coffee={coffee} w={500} />
        </span>
        <span className="p-card__eyebrow">{kind === 'month' || kind === 'profile' ? title : coffee.roaster}</span>
        <span className="p-card__name">{kind === 'month' ? `${s.cups.filter((c) => c.ratedAt.startsWith(id)).length} cups · top: ${coffee.name}` : coffee.name}</span>
        {cup && <span className="p-card__stars"><Stars n={cup.stars} size={18} /></span>}
        {cup?.note && <span className="p-card__note">“{cup.note}”</span>}
        <span className="p-card__foot">{(coffee.tastingNotes ?? []).slice(0, 3).join(' · ')}<b>pico</b></span>
      </div>
      <button className="p-btn p-btn--dark" onClick={share}><ShareIcon /> Share</button>
      <span className="p-fine">Opens Instagram, Messages and the rest. The link opens this coffee in Pico.</span>
    </div>
  );
}
