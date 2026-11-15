import { useMemo, useState } from 'react';
import { getCoffeeById } from '../../lib/catalog';
import { scoreSimilarity } from '../../lib/similarity';
import { ACCOUNTS, currentProfile, totalsByCoffee, type Cup, type ProtoState } from './state';
import { CameraIcon, ChevronRight, SparkIcon, Star } from './icons';
import { KeepCupsPrompt } from './coffee';
import { Bag, Empty, Head, JournalTitle, Nav, Stars, Tile } from './parts';
import { go } from './routing';
import { SHOW_WRAPPED, day, month, tileBadge } from './util';

export function Journal({ s, view }: { s: ProtoState; view: string }) {
  // Rate before account: signed-out cups live in s.cups too, so the journal renders either way.
  const totals = useMemo(() => totalsByCoffee(s.cups), [s.cups]);
  if (!s.cups.length) {
    return (
      <div className="p-screen">
        <Head title={<JournalTitle on="journal" />} />
        <Empty title="No cups yet" body="Scan the bag you’re drinking from, give it stars, and it lands here.">
          <button className="p-btn p-btn--amber" onClick={() => go('/scan')}><CameraIcon size={20} /> Scan a bag</button>
          <button className="p-btn p-btn--ghost" onClick={() => go('/discover')}>Browse coffees</button>
        </Empty>
        <Nav active="journal" />
      </div>
    );
  }
  const avg = s.cups.reduce((t, c) => t + c.stars, 0) / s.cups.length;
  const byMonth = new Map<string, Cup[]>();
  for (const c of s.cups) byMonth.set(month(c.ratedAt), [...(byMonth.get(month(c.ratedAt)) ?? []), c]);
  const lastMonth = new Date(); lastMonth.setDate(0);
  const wrapMonth = s.cups.some((c) => month(c.ratedAt) === month(lastMonth.toISOString())) ? lastMonth : null;

  return (
    <div className="p-screen">
      <Head title={<JournalTitle on="journal" />} />
      {!s.user && <KeepCupsPrompt count={s.cups.length} next="/journal" />}
      {SHOW_WRAPPED && wrapMonth && (
        <button className="p-wrapped-banner" onClick={() => go(`/wrapped?m=${wrapMonth.toISOString().slice(0, 7)}`)}>
          <span><SparkIcon /> Your {wrapMonth.toLocaleDateString('en-GB', { month: 'long' })} in coffee</span>
          <ChevronRight />
        </button>
      )}
      <div className="p-seg" role="tablist">
        <button data-on={view !== 'cups' || undefined} onClick={() => go('/journal')}>Coffees</button>
        <button data-on={view === 'cups' || undefined} onClick={() => go('/journal/cups')}>Every cup</button>
      </div>
      {view !== 'cups' ? (
        <>
          <div className="p-grid">
            {totals.map((t) => (
              <Tile key={t.coffee.id} coffee={t.coffee} onClick={() => go(`/coffee/${t.coffee.id}`)}
                badge={<>You <Star size={12} /> {t.average.toFixed(1)}{t.cups.length > 1 && <span className="p-badge-count">×{t.cups.length}</span>}</>} />
            ))}
          </div>
        </>
      ) : (
        [...byMonth.entries()].map(([m, cups]) => (
          <section key={m} className="p-month">
            <h2 className="p-section">{m}</h2>
            {cups.map((c) => {
              const coffee = getCoffeeById(c.coffeeId);
              if (!coffee) return null;
              return (
                <button key={c.id} className="p-cuprow" onClick={() => go(`/coffee/${coffee.id}`)}>
                  <span className="p-cuprow__thumb"><Bag coffee={coffee} w={120} /></span>
                  <span className="p-cuprow__text">
                    <b>{coffee.name}</b>
                    <span>{coffee.roaster}{c.note ? ` · “${c.note}”` : ''}</span>
                  </span>
                  <span className="p-cuprow__right"><Stars n={c.stars} /><span>{day(c.ratedAt)}</span></span>
                </button>
              );
            })}
          </section>
        ))
      )}
      <p className="p-footstat">{s.cups.length} {s.cups.length === 1 ? 'cup' : 'cups'} · {totals.length} {totals.length === 1 ? 'coffee' : 'coffees'} · {avg.toFixed(1)} average</p>
      <Nav active="journal" />
    </div>
  );
}

export function Saved({ s }: { s: ProtoState }) {
  const [sort, setSort] = useState<'recent' | 'match'>('recent');
  const profile = useMemo(() => currentProfile(s), [s]);
  if (ACCOUNTS && !s.user) {
    return (
      <div className="p-screen">
        <Head title={<JournalTitle on="saved" />} />
        <Empty title="Save coffees you want to try" body="Tap the bookmark on any coffee. Your list is kept in your account.">
          <button className="p-btn p-btn--dark" onClick={() => go('/signup?reason=save&next=/saved')}>Create free account</button>
        </Empty>
        <Nav active="journal" />
      </div>
    );
  }
  const items = [...s.saved]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .map((x) => getCoffeeById(x.coffeeId))
    .filter((c) => c !== undefined);
  if (sort === 'match' && profile) items.sort((a, b) => scoreSimilarity(b, profile) - scoreSimilarity(a, profile));
  return (
    <div className="p-screen">
      <Head title={<JournalTitle on="saved" />} />
      {items.length === 0 ? (
        <Empty title="Nothing saved yet" body="Tap the bookmark on any coffee you want to try.">
          <button className="p-btn p-btn--ghost" onClick={() => go('/discover')}>Browse coffees</button>
        </Empty>
      ) : (
        <>
          {profile && (
            <div className="p-chips">
              <button className="p-chip" data-on={sort === 'recent' || undefined} onClick={() => setSort('recent')}>Recently saved</button>
              <button className="p-chip" data-on={sort === 'match' || undefined} onClick={() => setSort('match')}>Best match</button>
            </div>
          )}
          <div className="p-grid">
            {items.map((c) => <Tile key={c.id} coffee={c} badge={tileBadge(s, c, profile)} onClick={() => go(`/coffee/${c.id}`)} />)}
          </div>
          <p className="p-footstat">{items.length} {items.length === 1 ? 'coffee' : 'coffees'} to try</p>
        </>
      )}
      <Nav active="journal" />
    </div>
  );
}
