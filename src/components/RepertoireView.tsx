import { useMemo, useState } from 'react';
import { getCoffeeById } from '../lib/catalog';
import { loadUserData } from '../lib/storage';
import { BREW_METHOD_OPTIONS, FLAVOR_TAG_LABELS, ROAST_LEVEL_LABELS } from '../types/coffee';
import type { Coffee, Rating, RoastLevel } from '../types/coffee';
import { PicoMark } from './ui/Icons';

interface RepertoireViewProps {
  onSelectCoffee: (coffeeId: string) => void;
  refreshKey: number;
  onDiscover?: () => void;
}

type JournalEntry = {
  coffee: Coffee;
  rating: Rating;
};

type Filter = 'all' | 'favorites' | 'photos' | RoastLevel;
type Sort = 'newest' | 'highest' | 'name';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All entries' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'photos', label: 'With photos' },
  { value: 'light', label: 'Light roast' },
  { value: 'medium', label: 'Medium roast' },
  { value: 'dark', label: 'Dark roast' },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unknown' : dateFormatter.format(date);
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function JournalEntryCard({
  entry,
  onSelect,
}: {
  entry: JournalEntry;
  onSelect: (coffeeId: string) => void;
}) {
  const { coffee, rating } = entry;
  const summaryTags = rating.flavorTags.length > 0 ? rating.flavorTags : coffee.flavorTags;
  const brewMethod = BREW_METHOD_OPTIONS.find((option) => option.value === rating.brew?.method)?.label;
  const brewSnapshot = [
    brewMethod,
    rating.brew?.doseGrams !== undefined ? `${rating.brew.doseGrams} g` : undefined,
    rating.brew?.waterGrams !== undefined ? `${rating.brew.waterGrams} g water` : undefined,
    rating.brew?.brewTimeSeconds !== undefined ? `${rating.brew.brewTimeSeconds} sec` : undefined,
  ].filter(Boolean);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(coffee.id)}
        className="group block w-full overflow-hidden rounded-[1.5rem] border border-[#e5d9cc] bg-[#fffdf9] text-left shadow-[0_12px_35px_rgba(71,45,30,0.07)] transition hover:-translate-y-0.5 hover:border-[#bd9275] hover:shadow-[0_16px_40px_rgba(71,45,30,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#784c37] focus-visible:ring-offset-2"
      >
        <div className="grid sm:grid-cols-[12rem_1fr]">
          <div className="relative min-h-48 overflow-hidden bg-[#3d2a21] sm:min-h-full">
            {rating.photoDataUrl ? (
              <img
                src={rating.photoDataUrl}
                alt={`${coffee.name} journal photo`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_25%_20%,#b97d58_0,transparent_28%),linear-gradient(145deg,#6e4937,#281b16)]">
                <svg aria-hidden="true" viewBox="0 0 64 64" className="h-20 w-20 rotate-12 text-[#f4dfc7]/80" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M45.5 9.5C33 3.5 15.8 12.8 10.8 27.8 5.6 43.2 15.1 55 29.6 54.7c14.8-.3 25.5-14.1 24-28.8-.8-7.6-3.8-13.3-8.1-16.4Z" />
                  <path d="M43.7 10.2c-1.2 12.5-8.6 15.1-16 21.6-6.3 5.6-8 13.8-4.8 21.8" />
                </svg>
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-full bg-[#1d1511]/70 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-white backdrop-blur">
              {ROAST_LEVEL_LABELS[coffee.roastLevel]} roast
            </span>
          </div>

          <div className="flex min-w-0 flex-col p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#a26543]">
                  {formatDate(rating.ratedAt)}
                </p>
                <h3 className="mt-1 truncate font-serif text-xl font-semibold text-[#2a1c16]">
                  {coffee.name}
                </h3>
                <p className="mt-0.5 truncate text-sm text-[#7d675b]">{coffee.roaster}</p>
              </div>
              <div
                className="shrink-0 rounded-full bg-[#f4e6d6] px-2.5 py-1 text-sm font-bold text-[#7a472e]"
                aria-label={`${rating.stars} out of 5 stars`}
              >
                {rating.stars.toFixed(1)} <span aria-hidden="true">★</span>
              </div>
            </div>

            {rating.note ? (
              <p className="mt-4 line-clamp-3 text-[0.95rem] leading-6 text-[#4d3b32]">
                “{rating.note}”
              </p>
            ) : (
              <p className="mt-4 text-sm italic text-[#78675d]">No tasting note saved.</p>
            )}

            <div className="mt-5 border-t border-[#eee4da] pt-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#76513f]">
                Brew snapshot
              </p>
              <p className="mt-1.5 text-sm font-medium capitalize text-[#49362c]">
                {brewSnapshot.length > 0 ? brewSnapshot.join(' · ') : (
                  <>
                    {coffee.origin} <span className="text-[#c4aa99]">·</span> {coffee.process}{' '}
                    <span className="text-[#c4aa99]">·</span> {ROAST_LEVEL_LABELS[coffee.roastLevel]}
                  </>
                )}
              </p>
              {summaryTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {summaryTags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-[#f6f0e9] px-2.5 py-1 text-xs text-[#755747]">
                      {FLAVOR_TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

export function RepertoireView({ onSelectCoffee, refreshKey, onDiscover }: RepertoireViewProps) {
  void refreshKey;
  const { ratings } = loadUserData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');

  const entries = useMemo(
    () =>
      ratings.flatMap((rating): JournalEntry[] => {
        const coffee = getCoffeeById(rating.coffeeId);
        return coffee ? [{ coffee, rating }] : [];
      }),
    [ratings],
  );

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = entries.filter(({ coffee, rating }) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'favorites' && rating.stars >= 4) ||
        (filter === 'photos' && Boolean(rating.photoDataUrl)) ||
        coffee.roastLevel === filter;
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      const summaryTags = rating.flavorTags.length > 0 ? rating.flavorTags : coffee.flavorTags;
      return [
        coffee.name,
        coffee.roaster,
        coffee.origin,
        coffee.process,
        coffee.roastLevel,
        rating.note,
        ...summaryTags.map((tag) => FLAVOR_TAG_LABELS[tag]),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return result.sort((a, b) => {
      if (sort === 'highest') return b.rating.stars - a.rating.stars;
      if (sort === 'name') return a.coffee.name.localeCompare(b.coffee.name);
      return new Date(b.rating.ratedAt).getTime() - new Date(a.rating.ratedAt).getTime();
    });
  }, [entries, filter, query, sort]);

  if (entries.length === 0) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center py-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#efe0d1] text-[#704630] shadow-[inset_0_0_0_8px_#f8f1ea]">
          <PicoMark className="h-9 w-9" />
        </div>
        <p className="mt-6 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#a26543]">Your journal</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-[#2b1d17]">
          Remember coffees you love
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[#816c60]">
          Photograph, rate, and note your first coffee. Your tastiest discoveries will live here.
        </p>
        {onDiscover && (
          <button
            type="button"
            onClick={onDiscover}
            className="mt-7 rounded-full bg-[#683d2b] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(77,42,27,0.22)] transition hover:bg-[#512f22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#784c37] focus-visible:ring-offset-2"
          >
            Discover a coffee
          </button>
        )}
      </section>
    );
  }

  const averageRating = ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length;
  const photoCount = ratings.filter((rating) => rating.photoDataUrl).length;

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-[#38251d] px-6 py-7 text-[#fffaf4] shadow-[0_16px_45px_rgba(55,33,24,0.16)] sm:px-8">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[38px] border-[#9d6849]/20" />
        <div className="relative">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#dbad8e]">Coffee, remembered</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Your journal</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#d7c6bc]">
                A living record of the coffees worth coming back to.
              </p>
            </div>
            <dl className="flex gap-6">
              <div>
                <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-[#bca69a]">Entries</dt>
                <dd className="mt-1 text-xl font-semibold">{entries.length}</dd>
              </div>
              <div>
                <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-[#bca69a]">Average</dt>
                <dd className="mt-1 text-xl font-semibold">{averageRating.toFixed(1)}★</dd>
              </div>
              <div>
                <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-[#bca69a]">Photos</dt>
                <dd className="mt-1 text-xl font-semibold">{photoCount}</dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <section aria-label="Journal controls" className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Search journal</span>
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#78675d]">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search coffees, origins, notes…"
              className="h-12 w-full rounded-2xl border border-[#e3d7cc] bg-[#fffdf9] pl-11 pr-4 text-sm text-[#33231c] shadow-sm outline-none placeholder:text-[#766257] focus:border-[#9d6a4e] focus:ring-2 focus:ring-[#9d6a4e]/15"
            />
          </label>
          <label>
            <span className="sr-only">Filter journal</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="h-12 w-full rounded-2xl border border-[#e3d7cc] bg-[#fffdf9] px-4 text-sm font-medium text-[#60483b] shadow-sm outline-none focus:border-[#9d6a4e] sm:w-auto"
            >
              {FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort journal</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="h-12 w-full rounded-2xl border border-[#e3d7cc] bg-[#fffdf9] px-4 text-sm font-medium text-[#60483b] shadow-sm outline-none focus:border-[#9d6a4e] sm:w-auto"
            >
              <option value="newest">Newest first</option>
              <option value="highest">Highest rated</option>
              <option value="name">Coffee name</option>
            </select>
          </label>
        </div>
        <p className="px-1 text-xs text-[#78675d]" aria-live="polite">
          Showing {visibleEntries.length} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </p>
      </section>

      {visibleEntries.length > 0 ? (
        <ul className="grid gap-5 lg:grid-cols-2">
          {visibleEntries.map((entry) => (
            <JournalEntryCard key={entry.rating.coffeeId} entry={entry} onSelect={onSelectCoffee} />
          ))}
        </ul>
      ) : (
        <section className="rounded-[1.5rem] border border-dashed border-[#d9c7b9] bg-[#fffaf4] px-6 py-10 text-center">
          <h3 className="font-serif text-xl font-semibold text-[#34231c]">No journal entries match</h3>
          <p className="mt-2 text-sm text-[#856f62]">Try another search, or reset your filters.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
            className="mt-5 rounded-full border border-[#9b6c52] px-5 py-2.5 text-sm font-semibold text-[#704832] hover:bg-[#f3e6da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#784c37]"
          >
            Clear filters
          </button>
        </section>
      )}
    </div>
  );
}
