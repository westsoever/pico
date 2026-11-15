import { useState, type ReactNode } from 'react';
import { preloadLabelReader } from '../../lib/label-ocr';
import { sizedImageUrl } from '../../components/CoffeeImage';
import { type Coffee } from '../../types/coffee';
import { ACCOUNTS, isSaved, toggleSaved, type ProtoState } from './state';
import { BookmarkIcon, CameraIcon, DiscoverIcon, JournalIcon, PersonIcon, SparkIcon, Star, TasteIcon } from './icons';
// From image-kinds.py: cutouts and bags on plain white are shown contained; photos fill their frame.
import imageKinds from './image-kinds.json';
import { go } from './routing';
import { pendingSave, tileLine } from './util';

// `photo`: the person's own photo of this coffee (store/photos.ts), shown instead of the catalog picture.
export function Bag({ coffee, w = 300, photo }: { coffee: Coffee; w?: number; photo?: string }) {
  const [failed, setFailed] = useState(false);
  if (photo) return <img className="p-img-photo" src={photo} alt="" />;
  if (!coffee.imageUrl || failed) {
    return <span className="p-bag-fallback">{coffee.roaster.split(' ').map((s) => s[0]).join('').slice(0, 2)}</span>;
  }
  const kind = (imageKinds as Record<string, string>)[coffee.id];
  const contained = kind === 'cutout' || kind === 'plain'; // plain white is multiplied away, like transparency
  return <img className={contained ? 'p-img-bag' : 'p-img-photo'} src={sizedImageUrl(coffee.imageUrl, w)} alt="" loading={w >= 500 ? "eager" : "lazy"} onError={() => setFailed(true)} />;
}

export function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return <span className="p-mini-stars">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} on={i <= Math.round(n)} />)}</span>;
}

// Same person icon signed in or out (owner: no initial).
export function Avatar() {
  return (
    <button className="p-avatar" data-out onClick={() => go('/account')} aria-label="Account">
      <PersonIcon />
    </button>
  );
}

export function SaveButton({ s, coffeeId, className }: { s: ProtoState; coffeeId: string; className: string }) {
  const on = isSaved(coffeeId);
  const tap = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (s.user || !ACCOUNTS) return toggleSaved(coffeeId); // no accounts yet: saved on the phone, like cups
    pendingSave.id = coffeeId;
    go(`/signup?reason=save&next=${encodeURIComponent(`/coffee/${coffeeId}`)}`);
  };
  return (
    <button className={`p-glass p-glass--round p-save ${className}`} data-on={on || undefined} onClick={tap} aria-pressed={on} aria-label={on ? 'Remove from Saved' : 'Save to try later'}>
      <BookmarkIcon on={on} />
    </button>
  );
}

// "Journal" and "Saved" as two large titles; the inactive one is quiet but tappable.
export function JournalTitle({ on }: { on: 'journal' | 'saved' }) {
  return (
    <span className="p-titletabs" role="tablist">
      <button role="tab" aria-selected={on === 'journal'} data-on={on === 'journal' || undefined} onClick={() => go('/journal')}>Journal</button>
      <button role="tab" aria-selected={on === 'saved'} data-on={on === 'saved' || undefined} onClick={() => go('/saved')}>Saved</button>
    </span>
  );
}

// Titles stand alone: no stat or count eyebrow above them (stats go in a quiet .p-footstat line at the bottom).
// Same header on every tab, so the avatar sits in the same spot; `aside` goes left of it without moving it.
export function Head({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <header className="p-head">
      <h1 className="p-title">{title}</h1>
      <span className="p-head__end">{aside}<Avatar /></span>
    </header>
  );
}

export function Nav({ active }: { active: 'discover' | 'journal' | 'taste' | '' }) {
  const items = [
    { key: 'discover', icon: <DiscoverIcon />, label: 'Discover' },
    { key: 'journal', icon: <JournalIcon />, label: 'Journal' },
    { key: 'taste', icon: <TasteIcon />, label: 'Taste' },
  ] as const;
  return (
    <nav className="p-nav">
      <div className="p-nav__pill">
        {items.map((it) => (
          <button key={it.key} className="p-nav__item" data-on={it.key === active || undefined} aria-current={it.key === active ? 'page' : undefined}
            onClick={() => (window.location.hash === `#/${it.key}` ? window.scrollTo({ top: 0, behavior: 'smooth' }) : go(`/${it.key}`))}>
            {it.icon}
            <span className="p-nav__label">{it.label}</span>
          </button>
        ))}
      </div>
      <button className="p-nav__scan" aria-label="Scan a bag" onPointerDown={preloadLabelReader} onClick={() => go('/scan')}>
        <CameraIcon />
      </button>
    </nav>
  );
}

export function Tile({ coffee, badge, onClick, photo }: { coffee: Coffee; badge?: ReactNode; onClick: () => void; photo?: string }) {
  return (
    <button className="p-tile" onClick={onClick}>
      <span className="p-tile__img">
        <Bag coffee={coffee} w={300} photo={photo} />
        {badge && <span className="p-glass p-tile__badge">{badge}</span>}
      </span>
      <span className="p-tile__name">{coffee.name}</span>
      <span className="p-tile__roaster">{coffee.roaster}</span>
      <span className="p-tile__taste">{tileLine(coffee)}</span>
    </button>
  );
}

export function Empty({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="p-empty">
      <span className="p-empty__mark"><SparkIcon /></span>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="p-empty__actions">{children}</div>
    </div>
  );
}
