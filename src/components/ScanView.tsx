import { useEffect, useRef, useState } from 'react';
import { addCustomCoffee, getCatalogCoffees, getCoffeeById, searchCoffees } from '../lib/catalog';
import { loadUserData } from '../lib/storage';
import type { ManualCoffeeInput, RoastLevel } from '../types/coffee';
import { CameraCapture } from './CameraCapture';
import { ManualCoffeeForm } from './ManualCoffeeForm';
import { CoffeeCard } from './SimilarList';
import { SearchIcon } from './ui/Icons';

interface ScanViewProps {
  onSelectCoffee: (coffeeId: string, photoDataUrl?: string, isNewCustom?: boolean) => void;
  addRequestKey?: string | number;
}

export function ScanView({ onSelectCoffee, addRequestKey }: ScanViewProps) {
  const [query, setQuery] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [showManualForm, setShowManualForm] = useState(false);
  const [showAddCoffee, setShowAddCoffee] = useState(false);
  const [shouldFocusAddPanel, setShouldFocusAddPanel] = useState(false);
  const [addError, setAddError] = useState('');
  const [roastFilter, setRoastFilter] = useState<RoastLevel | 'all'>('all');
  const addPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (addRequestKey === undefined) return;
    setShowAddCoffee(true);
    setShouldFocusAddPanel(true);
  }, [addRequestKey]);

  useEffect(() => {
    if (!showAddCoffee || !shouldFocusAddPanel) return;
    addPanelRef.current?.focus();
    setShouldFocusAddPanel(false);
  }, [shouldFocusAddPanel, showAddCoffee]);
  const recentRatings = loadUserData().ratings
    .slice()
    .sort((a, b) => Date.parse(b.ratedAt) - Date.parse(a.ratedAt))
    .slice(0, 2)
    .flatMap((rating) => {
      const coffee = getCoffeeById(rating.coffeeId);
      return coffee ? [{ coffee, rating }] : [];
    });
  const searchResults = query.trim() ? searchCoffees(query, 20) : getCatalogCoffees();
  const results = searchResults
    .filter((coffee) => roastFilter === 'all' || coffee.roastLevel === roastFilter)
    .slice(0, query.trim() ? 20 : 8);

  const handleManualSubmit = (input: ManualCoffeeInput) => {
    try {
      const coffee = addCustomCoffee(input);
      setAddError('');
      onSelectCoffee(coffee.id, photoDataUrl, true);
    } catch {
      setAddError('Could not add this coffee. Check your browser storage and try again.');
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <header className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b5339]">Discover</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#1c1410]">Find a coffee worth remembering.</h2>
          <p className="mt-2 text-sm leading-6 text-[#78675d]">
            Search our curated catalog, or add a bag from its label.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={showAddCoffee}
          aria-controls="add-coffee-panel"
          onClick={() => setShowAddCoffee((open) => !open)}
          className="w-full rounded-2xl bg-[#6b3a2a] px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#582f22] focus:outline-none focus:ring-2 focus:ring-[#6b3a2a] focus:ring-offset-2"
        >
          {showAddCoffee ? 'Close add coffee' : '+ Add coffee'}
        </button>
      </header>

      {showAddCoffee && (
        <section
          id="add-coffee-panel"
          ref={addPanelRef}
          tabIndex={-1}
          className="space-y-4 rounded-2xl border border-[#e5d9ce] bg-[#fbf7f2] p-4 focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/30"
        >
          <div>
            <h3 className="font-semibold text-[#1c1410]">Add from the bag</h3>
            <p className="mt-1 text-sm leading-5 text-[#78675d]">
              A label photo is saved with your rating; Pico does not read or identify the coffee from the image yet.
            </p>
          </div>
          <CameraCapture
            photoDataUrl={photoDataUrl}
            onCapture={(dataUrl) => {
              setPhotoDataUrl(dataUrl);
              if (dataUrl) setShowManualForm(true);
            }}
          />
          {!showManualForm && (
            <button
              type="button"
              onClick={() => setShowManualForm(true)}
            className="w-full rounded-xl border border-[#cdbbae] bg-white py-3 font-medium text-[#6b3a2a] transition hover:border-[#8b5339] focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/30"
            >
              Enter label details
            </button>
          )}
        </section>
      )}

      {showAddCoffee && showManualForm && (
        <section>
          {addError && (
            <p role="alert" className="mb-3 rounded-xl bg-[#fbe9e7] px-4 py-3 text-sm text-[#8f2925]">
              {addError}
            </p>
          )}
          <ManualCoffeeForm
            onSubmit={handleManualSubmit}
            onCancel={() => setShowManualForm(false)}
          />
        </section>
      )}

      {recentRatings.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b5339]">Pick up where you left off</p>
            <h3 id="recent-heading" className="mt-1 text-xl font-semibold text-[#1c1410]">Recently rated</h3>
          </div>
          <ul className="space-y-2">
            {recentRatings.map(({ coffee, rating }) => (
              <li key={coffee.id}>
                <CoffeeCard
                  name={coffee.name}
                  roaster={coffee.roaster}
                  origin={coffee.origin}
                  stars={rating.stars}
                  onClick={() => onSelectCoffee(coffee.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="browse-heading" className="space-y-4">
        <div>
          <h3 id="browse-heading" className="text-xl font-semibold text-[#1c1410]">Browse coffees</h3>
          <p className="mt-1 text-sm text-[#766257]">A curated starting point for your next coffee.</p>
        </div>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-3.5 text-[#766257]">
            <SearchIcon className="h-5 w-5" />
          </span>
          <label htmlFor="coffee-search" className="sr-only">Search coffee catalog</label>
          <input
            id="coffee-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coffee, roaster, origin…"
            className="w-full rounded-2xl border border-[#ded2c7] bg-white py-3 pl-10 pr-4 text-[#1c1410] shadow-sm placeholder:text-[#766257] focus:border-[#6b3a2a] focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/20"
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by roast">
          {(['all', 'light', 'medium', 'dark'] as const).map((roast) => (
            <button
              key={roast}
              type="button"
              aria-pressed={roastFilter === roast}
              onClick={() => setRoastFilter(roast)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/30 ${
                roastFilter === roast
                  ? 'border-[#6b3a2a] bg-[#6b3a2a] text-white'
                  : 'border-[#ded2c7] bg-white text-[#6b3a2a] hover:border-[#8b5339]'
              }`}
            >
              {roast === 'all' ? 'All roasts' : roast}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#78675d]" aria-live="polite">
            {query.trim() ? `${results.length} match${results.length === 1 ? '' : 'es'}` : 'Featured catalog'}
          </p>
          {(query || roastFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setRoastFilter('all');
              }}
              className="text-sm font-medium text-[#6b3a2a] underline decoration-[#c4956a] underline-offset-4"
            >
              Clear
            </button>
          )}
        </div>
        {results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((coffee) => (
              <li key={coffee.id}>
                <CoffeeCard
                  name={coffee.name}
                  roaster={coffee.roaster}
                  origin={coffee.origin}
                  onClick={() => onSelectCoffee(coffee.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d8c9bd] px-5 py-8 text-center">
            <p className="font-medium text-[#1c1410]">No coffees found</p>
            <p className="mt-1 text-sm text-[#766257]">Try another search or add this coffee yourself.</p>
            <button
              type="button"
              onClick={() => setShowAddCoffee(true)}
              className="mt-3 font-medium text-[#6b3a2a] underline underline-offset-4"
            >
              Add coffee
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
