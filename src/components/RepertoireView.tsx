import { useMemo, useRef, useState } from 'react';
import { getCoffeeById } from '../lib/catalog';
import { exportJournal, importJournal, loadUserData } from '../lib/storage';
import { BREW_METHOD_OPTIONS, FLAVOR_TAG_LABELS } from '../types/coffee';
import type { Coffee, Rating } from '../types/coffee';
import { CoffeeImage } from './CoffeeImage';
import { PageHeader } from './Layout';
import { StarDisplay } from './StarRating';
import { PicoMark, SearchIcon } from './ui/Icons';

interface RepertoireViewProps {
  onSelectCoffee: (coffeeId: string) => void;
  refreshKey: number;
  onDiscover?: () => void;
  onNotice?: (message: string, tone: 'status' | 'error') => void;
}

type JournalEntry = {
  coffee: Coffee;
  rating: Rating;
};

type Filter = 'all' | 'favorites' | 'photos';
type Sort = 'newest' | 'highest' | 'name';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All coffees' },
  { value: 'favorites', label: 'Favorites (4★+)' },
  { value: 'photos', label: 'With photos' },
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

function JournalEntryCard({
  entry,
  onSelect,
}: {
  entry: JournalEntry;
  onSelect: (coffeeId: string) => void;
}) {
  const { coffee, rating } = entry;
  const summaryTags = rating.flavorTags.length > 0 ? rating.flavorTags : coffee.flavorTags;
  const brew = rating.brew;
  const brewLine = brew
    ? [
        BREW_METHOD_OPTIONS.find((option) => option.value === brew.method)?.label,
        brew.doseGrams !== undefined ? `${brew.doseGrams} g` : undefined,
        brew.waterGrams !== undefined ? `${brew.waterGrams} g water` : undefined,
        brew.brewTimeSeconds !== undefined ? `${brew.brewTimeSeconds} s` : undefined,
      ].filter(Boolean).join(' · ')
    : '';
  const thumb = 'h-20 w-20 shrink-0 rounded-xl bg-pico-tinted';
  const fallback = (
    <div className={`${thumb} flex items-center justify-center text-pico-accent`} aria-hidden="true">
      <PicoMark className="h-8 w-8" />
    </div>
  );

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(coffee.id)}
        className="card card-interactive flex w-full gap-4 p-3 text-left sm:p-4"
      >
        {rating.photoDataUrl ? (
          <img src={rating.photoDataUrl} alt={`${coffee.name} journal photo`} loading="lazy" className={`${thumb} object-cover`} />
        ) : (
          <CoffeeImage src={coffee.imageUrl} alt="" loading="lazy" width={80} className={`${thumb} !bg-white object-contain p-1`} fallback={fallback} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-pico-ink">{coffee.name}</h3>
              <p className="truncate text-sm text-pico-muted">{coffee.roaster}</p>
            </div>
            <StarDisplay value={rating.stars} />
          </div>
          {rating.note && (
            <p className="mt-1.5 line-clamp-2 text-sm text-pico-ink/85">“{rating.note}”</p>
          )}
          <p className="mt-1.5 text-xs text-pico-muted">
            {formatDate(rating.ratedAt)}
            {brewLine && <> · {brewLine}</>}
            {!rating.note && summaryTags.length > 0 && (
              <> · {summaryTags.slice(0, 3).map((tag) => FLAVOR_TAG_LABELS[tag]).join(', ')}</>
            )}
          </p>
        </div>
      </button>
    </li>
  );
}

const HOME_HINT_KEY = 'pico-home-screen-hint-dismissed';

/** Safari on iPhone/iPad wipes a site's storage after 7 days without a visit, unless it runs from the Home Screen. */
function HomeScreenHint() {
  // navigator.standalone exists only on iOS/iPadOS, and is false outside Home Screen mode.
  const inIosBrowser = (navigator as Navigator & { standalone?: boolean }).standalone === false;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(HOME_HINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!inIosBrowser || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(HOME_HINT_KEY, '1');
    } catch {
      // Dismissal only lasts this visit when storage is unavailable.
    }
  };

  return (
    <section aria-label="Keep your journal" className="card mb-5 p-4">
      <h2 className="font-semibold text-pico-ink">Keep your journal safe</h2>
      <p className="mt-1 text-sm text-pico-muted">
        Safari deletes a website’s data after 7 days without a visit. Add Pico to your Home Screen to keep
        your journal: tap Share, then “Add to Home Screen”.
      </p>
      <button type="button" onClick={dismiss} className="btn btn-secondary mt-3">
        Got it
      </button>
    </section>
  );
}

function JournalBackup({
  canExport,
  onImported,
  onNotice,
}: {
  canExport: boolean;
  onImported: () => void;
  onNotice?: (message: string, tone: 'status' | 'error') => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  const saveBackup = () => {
    const url = URL.createObjectURL(new Blob([exportJournal()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pico-journal-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    // Revoking right away can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const restoreBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { ratings, coffees } = importJournal(await file.text());
      onImported();
      onNotice?.(
        ratings === 0 && coffees === 0
          ? 'Your journal already has everything in this backup.'
          : `Restored ${ratings} ${ratings === 1 ? 'rating' : 'ratings'} from your backup.`,
        'status',
      );
    } catch (error) {
      const storageFull = error instanceof DOMException && error.name === 'QuotaExceededError';
      onNotice?.(
        storageFull
          ? 'Not enough storage on this phone to restore this backup.'
          : error instanceof Error && error.message.startsWith('This file')
            ? error.message
            : 'Could not restore this backup.',
        'error',
      );
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {canExport && (
        <button type="button" onClick={saveBackup} className="btn btn-secondary">
          Save backup
        </button>
      )}
      <button type="button" onClick={() => fileInput.current?.click()} className="btn btn-secondary">
        Restore backup
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Backup file"
        onChange={(event) => void restoreBackup(event.target.files?.[0])}
      />
    </div>
  );
}

export function RepertoireView({ onSelectCoffee, refreshKey, onDiscover, onNotice }: RepertoireViewProps) {
  void refreshKey;
  const [, setImportCount] = useState(0);
  const onImported = () => setImportCount((count) => count + 1);
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
        (filter === 'photos' && Boolean(rating.photoDataUrl));
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      const summaryTags = rating.flavorTags.length > 0 ? rating.flavorTags : coffee.flavorTags;
      return [
        coffee.name,
        coffee.roaster,
        coffee.origin,
        coffee.process,
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
      <>
        <PageHeader title="Journal" />
        <section className="card mx-auto max-w-md px-6 py-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pico-tinted text-pico-accent">
            <PicoMark className="h-8 w-8" />
          </div>
          <h2 className="section-title mt-5">Remember the coffees you love</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-pico-muted">
            Rate your first coffee and it shows up here, with your notes and photo.
          </p>
          {onDiscover && (
            <button type="button" onClick={onDiscover} className="btn btn-primary mt-6">
              Find a coffee
            </button>
          )}
          <p className="mt-6 text-sm text-pico-muted">Moving from another phone?</p>
          <div className="mt-2">
            <JournalBackup canExport={false} onImported={onImported} onNotice={onNotice} />
          </div>
        </section>
      </>
    );
  }

  const average = entries.reduce((sum, { rating }) => sum + rating.stars, 0) / entries.length;
  const isFiltered = query.trim() !== '' || filter !== 'all';

  return (
    <div>
      <PageHeader
        title="Journal"
        subtitle={`${entries.length} ${entries.length === 1 ? 'coffee' : 'coffees'} rated · ${average.toFixed(1)}★ on average`}
      />

      <HomeScreenHint />

      <section aria-label="Journal controls" className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Search journal</span>
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-pico-subtle">
            <SearchIcon className="h-5 w-5" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search coffees, notes, flavors…"
            className="field !pl-11"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="sr-only">Filter journal</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="field">
              {FILTERS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort journal</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="field">
              <option value="newest">Newest first</option>
              <option value="highest">Highest rated</option>
              <option value="name">By name</option>
            </select>
          </label>
        </div>
        {isFiltered && (
          <p className="text-sm text-pico-muted" aria-live="polite">
            Showing {visibleEntries.length} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        )}
      </section>

      {visibleEntries.length > 0 ? (
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {visibleEntries.map((entry) => (
            <JournalEntryCard key={entry.coffee.id} entry={entry} onSelect={onSelectCoffee} />
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-dashed border-pico-line-strong px-5 py-8 text-center">
          <h3 className="font-semibold text-pico-ink">No journal entries match</h3>
          <p className="mt-1 text-sm text-pico-muted">Try another word or filter.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
            className="btn btn-secondary mt-4"
          >
            Clear filters
          </button>
        </div>
      )}

      <section aria-label="Back up your journal" className="mt-10 border-t border-pico-line pt-6 text-center">
        <h2 className="section-title">Back up your journal</h2>
        <p className="mx-auto mt-1 mb-4 max-w-sm text-sm text-pico-muted">
          Your journal lives only on this phone. Save a backup file now and then, and restore it on any phone.
        </p>
        <JournalBackup canExport onImported={onImported} onNotice={onNotice} />
      </section>
    </div>
  );
}
