import { useEffect, useRef, useState } from 'react';
import { addCustomCoffee, getAllCoffees, getCoffeeById, searchCoffees } from '../lib/catalog';
import {
  isRoasterOnlyMatch,
  matchCoffeesFromText,
  normalizeLabelText,
  searchTermsFromText,
  type LabelMatch,
} from '../lib/label-match';
import { preloadLabelReader, readLabelText } from '../lib/label-ocr';
import { loadUserData } from '../lib/storage';
import type { ManualCoffeeInput } from '../types/coffee';
import { CameraCapture } from './CameraCapture';
import { PageHeader } from './Layout';
import { ManualCoffeeForm } from './ManualCoffeeForm';
import { CoffeeCard, CoffeeGrid, CoffeeTile } from './SimilarList';
import { SearchIcon } from './ui/Icons';

interface ScanViewProps {
  onSelectCoffee: (coffeeId: string, photoDataUrl?: string, isNewCustom?: boolean) => void;
  addRequestKey?: string | number;
}

type ScanState =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'matches'; matches: LabelMatch[]; terms: string[] }
  | { kind: 'no-match'; terms: string[] }
  | { kind: 'no-text' }
  | { kind: 'error' };

const PAGE_SIZE = 24;

function matchSummary(match: LabelMatch): string {
  if (isRoasterOnlyMatch(match)) return 'Roaster match only · check the coffee name';
  return `Matched ${match.matched.slice(0, 3).join(', ')}`;
}

export function ScanView({ onSelectCoffee, addRequestKey }: ScanViewProps) {
  const [query, setQuery] = useState('');
  const [roaster, setRoaster] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [scan, setScan] = useState<ScanState>({ kind: 'idle' });
  const [showManualForm, setShowManualForm] = useState(false);
  const [shouldFocusManualForm, setShouldFocusManualForm] = useState(false);
  const [addError, setAddError] = useState('');
  const manualPanelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const scanRequestRef = useRef(0);

  useEffect(() => {
    const requests = scanRequestRef;
    return () => {
      requests.current += 1;
    };
  }, []);

  useEffect(() => {
    if (addRequestKey === undefined) return;
    setShowManualForm(true);
    setShouldFocusManualForm(true);
  }, [addRequestKey]);

  useEffect(() => {
    if (!showManualForm || !shouldFocusManualForm) return;
    manualPanelRef.current?.focus();
    manualPanelRef.current?.scrollIntoView?.({ block: 'start' });
    setShouldFocusManualForm(false);
  }, [shouldFocusManualForm, showManualForm]);

  const allCoffees = getAllCoffees();
  const roasterCounts = new Map<string, number>();
  for (const coffee of allCoffees) roasterCounts.set(coffee.roaster, (roasterCounts.get(coffee.roaster) ?? 0) + 1);
  const roasters = [...roasterCounts.keys()].sort((a, b) => a.localeCompare(b));

  const recentRatings = loadUserData().ratings
    .slice()
    .sort((a, b) => Date.parse(b.ratedAt) - Date.parse(a.ratedAt))
    .slice(0, 3)
    .flatMap((rating) => {
      const coffee = getCoffeeById(rating.coffeeId);
      return coffee ? [{ coffee, rating }] : [];
    });
  const isSearching = query.trim().length > 0;
  const matching = (isSearching ? searchCoffees(query, allCoffees.length) : allCoffees)
    .filter((coffee) => roaster === 'all' || coffee.roaster === roaster);
  const results = matching.slice(0, visibleCount);
  const bestMatch = scan.kind === 'matches' ? scan.matches[0] : undefined;
  const labelRoaster = bestMatch?.matched.includes(bestMatch.coffee.roaster) ? bestMatch.coffee.roaster : undefined;

  const readLabel = async (dataUrl: string) => {
    const requestId = ++scanRequestRef.current;
    setScan({ kind: 'reading' });
    try {
      const text = await readLabelText(dataUrl);
      if (requestId !== scanRequestRef.current) return;
      if (!normalizeLabelText(text)) {
        setScan({ kind: 'no-text' });
        return;
      }
      const coffees = getAllCoffees();
      const matches = matchCoffeesFromText(text, coffees);
      const terms = searchTermsFromText(text, coffees);
      setScan(matches.length > 0 ? { kind: 'matches', matches, terms } : { kind: 'no-match', terms });
    } catch {
      if (requestId === scanRequestRef.current) setScan({ kind: 'error' });
    }
  };

  const handleCapture = (dataUrl: string | undefined, readableDataUrl?: string) => {
    setPhotoDataUrl(dataUrl);
    if (dataUrl) {
      void readLabel(readableDataUrl ?? dataUrl);
    } else {
      scanRequestRef.current += 1;
      setScan({ kind: 'idle' });
    }
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  };

  const openSearch = (terms: string[] = []) => {
    updateQuery(terms.join(' '));
    setRoaster('all');
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView?.({ block: 'center' });
  };

  const openManualForm = () => {
    setShowManualForm(true);
    setShouldFocusManualForm(true);
  };

  const handleManualSubmit = (input: ManualCoffeeInput) => {
    try {
      const coffee = addCustomCoffee(input);
      setAddError('');
      onSelectCoffee(coffee.id, photoDataUrl, true);
    } catch {
      setAddError('Could not add this coffee. Check your browser storage and try again.');
    }
  };

  const fallbackActions = (searchLabel: string, terms: string[] = []) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => openSearch(terms)} className="btn btn-secondary">
        {searchLabel}
      </button>
      <button type="button" onClick={openManualForm} className="btn btn-secondary">
        Add it
      </button>
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="max-w-xl">
        <PageHeader title="Discover" subtitle="What are you drinking? Scan the bag and Pico finds it." />
        {/* Start the ~7 MB OCR download as soon as the scan button is touched, while the camera is open. */}
        <div onPointerDown={preloadLabelReader} onFocus={preloadLabelReader}>
          <CameraCapture
            title="Scan a coffee bag"
            hint="Take a photo of the label, or choose one"
            photoDataUrl={photoDataUrl}
            onCapture={handleCapture}
          />
        </div>
        <p className="mt-2 text-xs text-pico-muted">
          Pico reads the label on this device. The photo is never uploaded.
        </p>

        <section aria-live="polite" aria-label="Label scan results" className="mt-5 space-y-3 empty:hidden">
          {scan.kind === 'reading' && (
            <p role="status" className="card flex items-center gap-3 p-4 text-sm font-medium text-pico-brand-strong">
              <span aria-hidden="true" className="h-3 w-3 animate-pulse rounded-full bg-pico-accent" />
              Reading label… The first scan takes longer while the reader loads.
            </p>
          )}

          {scan.kind === 'matches' && (
            <>
              <h2 className="section-title">Is it one of these?</h2>
              <ul className="space-y-2">
                {scan.matches.map((match) => (
                  <li key={match.coffee.id}>
                    <CoffeeCard
                      name={match.coffee.name}
                      roaster={match.coffee.roaster}
                      origin={match.coffee.origin}
                      imageUrl={match.coffee.imageUrl}
                      detail={matchSummary(match)}
                      onClick={() => onSelectCoffee(match.coffee.id, photoDataUrl)}
                    />
                  </li>
                ))}
              </ul>
              {fallbackActions('None of these', scan.terms)}
            </>
          )}

          {scan.kind === 'no-match' && (
            <>
              <p className="text-sm text-pico-muted">
                Pico read the label but did not find this coffee in the catalog.
              </p>
              {fallbackActions('Search the catalog', scan.terms)}
            </>
          )}

          {scan.kind === 'no-text' && (
            <>
              <p className="text-sm text-pico-muted">
                No text could be read from this photo. Try again closer to the label and in good light, or search instead.
              </p>
              {fallbackActions('Search instead')}
            </>
          )}

          {scan.kind === 'error' && (
            <>
              <p className="text-sm text-pico-muted">
                The label reader could not start. It needs a connection the first time it runs. You can search instead.
              </p>
              {fallbackActions('Search instead')}
            </>
          )}
        </section>

        {!showManualForm && (
          <p className="mt-4 text-sm text-pico-muted">
            Not in the catalog?{' '}
            <button type="button" onClick={openManualForm} className="link">
              Add a coffee
            </button>
          </p>
        )}

        {showManualForm && (
          <section
            id="add-coffee-panel"
            ref={manualPanelRef}
            tabIndex={-1}
            aria-labelledby="add-coffee-heading"
            className="mt-6 space-y-3 scroll-mt-4 focus:outline-none"
          >
            <div>
              <h2 id="add-coffee-heading" className="section-title">Add from the bag</h2>
              <p className="mt-1 text-sm text-pico-muted">
                {photoDataUrl
                  ? 'Copy the details from the label. Your label photo is saved with the rating.'
                  : 'Copy the details from the label.'}
              </p>
            </div>
            {addError && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-pico-danger">
                {addError}
              </p>
            )}
            <ManualCoffeeForm
              initialRoaster={labelRoaster}
              onSubmit={handleManualSubmit}
              onCancel={() => setShowManualForm(false)}
            />
          </section>
        )}
      </div>

      {recentRatings.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-3">
          <h2 id="recent-heading" className="section-title">Recently rated</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentRatings.map(({ coffee, rating }) => (
              <li key={coffee.id}>
                <CoffeeCard
                  name={coffee.name}
                  roaster={coffee.roaster}
                  origin={coffee.origin}
                  stars={rating.stars}
                  imageUrl={coffee.imageUrl}
                  onClick={() => onSelectCoffee(coffee.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="browse-heading" className="space-y-4">
        <div>
          <h2 id="browse-heading" className="section-title">Browse coffees</h2>
          <p className="mt-1 text-sm text-pico-muted">
            {allCoffees.length} coffees from {roasters.length} Danish roasters.
          </p>
        </div>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-pico-subtle">
            <SearchIcon className="h-5 w-5" />
          </span>
          <label htmlFor="coffee-search" className="sr-only">Search coffee catalog</label>
          <input
            id="coffee-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search coffee, roaster, origin, flavor…"
            className="field !pl-11"
            autoComplete="off"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by roaster">
          {['all', ...roasters].map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={roaster === name}
              onClick={() => {
                setRoaster(name);
                setVisibleCount(PAGE_SIZE);
              }}
              className="chip"
            >
              {name === 'all' ? 'All roasters' : name}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-pico-muted" aria-live="polite">
            {matching.length} {matching.length === 1 ? 'coffee' : 'coffees'}
          </p>
          {(query || roaster !== 'all') && (
            <button
              type="button"
              onClick={() => {
                updateQuery('');
                setRoaster('all');
              }}
              className="link text-sm"
            >
              Clear
            </button>
          )}
        </div>
        {results.length > 0 ? (
          <>
            <CoffeeGrid>
              {results.map((coffee) => (
                <li key={coffee.id}>
                  <CoffeeTile
                    coffee={coffee}
                    badge={coffee.available === false ? 'Past coffee' : undefined}
                    onClick={() => onSelectCoffee(coffee.id, photoDataUrl)}
                  />
                </li>
              ))}
            </CoffeeGrid>
            {matching.length > results.length && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  className="btn btn-secondary"
                >
                  Show more coffees
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-pico-line-strong px-5 py-8 text-center">
            <p className="font-semibold text-pico-ink">No coffees found</p>
            <p className="mt-1 text-sm text-pico-muted">Try another search, or add this coffee yourself.</p>
            <button type="button" onClick={openManualForm} className="btn btn-secondary mt-4">
              Add a coffee
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
