import { loadUserData } from '../lib/storage';
import { formatMatchPercent, getSimilarCoffees } from '../lib/similarity';
import { hasTasteSignal } from '../lib/taste-profile';
import { FLAVOR_TAG_LABELS, ROAST_LEVEL_LABELS } from '../types/coffee';
import type { FlavorTag, SimilarCoffee, TasteProfile } from '../types/coffee';
import { PageHeader } from './Layout';
import { CoffeeCard } from './SimilarList';
import { TasteIcon } from './ui/Icons';

interface YouViewProps {
  onSelectCoffee: (coffeeId: string) => void;
  refreshKey: number;
  onDiscover?: () => void;
  onAddCoffee?: () => void;
}

function TasteBar({ tag, strength }: { tag: FlavorTag; strength: number }) {
  const percentage = Math.round(Math.max(0, Math.min(1, strength)) * 100);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-pico-ink">{FLAVOR_TAG_LABELS[tag]}</span>
        <span className="text-xs tabular-nums text-pico-muted">{percentage}%</span>
      </div>
      <div
        role="meter"
        aria-label={`${FLAVOR_TAG_LABELS[tag]} preference strength`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={`${percentage} percent`}
        className="h-2 overflow-hidden rounded-full bg-pico-tinted"
      >
        <div className="h-full rounded-full bg-pico-accent" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function recommendationReason(item: SimilarCoffee, profile: TasteProfile) {
  const { coffee } = item;
  const flavorMatches = coffee.flavorTags
    .filter((tag) => (profile.tagWeights[tag] ?? 0) > 0)
    .sort((a, b) => (profile.tagWeights[b] ?? 0) - (profile.tagWeights[a] ?? 0))
    .slice(0, 2)
    .map((tag) => FLAVOR_TAG_LABELS[tag].toLowerCase());

  if (flavorMatches.length > 0) {
    const preferenceMatch = profile.topOrigins.includes(coffee.origin)
      ? `, from ${coffee.origin}`
      : profile.topProcesses.includes(coffee.process)
        ? `, ${coffee.process}`
        : '';
    return `${flavorMatches.join(' and ')}${preferenceMatch}`.replace(/^./, (c) => c.toUpperCase());
  }
  if (profile.topOrigins.includes(coffee.origin)) return `From ${coffee.origin}, like coffees you rated highly`;
  return 'Something a little different';
}

export function YouView({ onSelectCoffee, refreshKey, onDiscover, onAddCoffee }: YouViewProps) {
  void refreshKey;
  const { tasteProfile, ratings } = loadUserData();

  if (!tasteProfile || ratings.length === 0) {
    return (
      <>
        <PageHeader title="Taste" />
        <section className="card mx-auto max-w-md px-6 py-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pico-tinted text-pico-accent">
            <TasteIcon className="h-8 w-8" />
          </div>
          <h2 className="section-title mt-5">Your taste profile starts here</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-pico-muted">
            Rate a few coffees and Pico shows the flavors and origins you reach for, and what to try next.
          </p>
          {onDiscover && (
            <button type="button" onClick={onDiscover} className="btn btn-primary mt-6">
              Find your first coffee
            </button>
          )}
        </section>
      </>
    );
  }

  const topTags = (Object.entries(tasteProfile.tagWeights) as [FlavorTag, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const hasPositiveSignal = hasTasteSignal(tasteProfile);
  const ratedIds = ratings.map((r) => r.coffeeId);
  const recommendations = hasPositiveSignal ? getSimilarCoffees(tasteProfile, ratedIds, 6) : [];
  const profileMaturity =
    tasteProfile.ratingCount >= 8 ? 'Well defined' : tasteProfile.ratingCount >= 4 ? 'Taking shape' : 'Still learning';
  const leanings = [
    { label: 'Origins', values: tasteProfile.topOrigins },
    { label: 'Process', values: tasteProfile.topProcesses },
    { label: 'Roast', values: tasteProfile.topRoastLevels.map((roast) => ROAST_LEVEL_LABELS[roast]) },
  ].filter(({ values }) => values.length > 0);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Taste"
        subtitle={`From ${tasteProfile.ratingCount} ${tasteProfile.ratingCount === 1 ? 'rating' : 'ratings'} · ${tasteProfile.avgRating.toFixed(1)}★ average · ${profileMaturity}`}
      />

      {hasPositiveSignal ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card p-5" aria-labelledby="flavor-heading">
            <h2 id="flavor-heading" className="section-title">Flavors you love</h2>
            <p className="mt-1 text-sm text-pico-muted">From coffees you rated 4★ or higher.</p>
            {topTags.length > 0 ? (
              <div className="mt-5 space-y-4">
                {topTags.map(([tag, weight]) => (
                  <TasteBar key={tag} tag={tag} strength={weight} />
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-pico-muted">Pick flavor tags when you rate to fill this in.</p>
            )}
          </section>

          <section className="card p-5" aria-labelledby="leaning-heading">
            <h2 id="leaning-heading" className="section-title">You lean towards</h2>
            <dl className="mt-4 space-y-4">
              {leanings.map(({ label, values }) => (
                <div key={label}>
                  <dt className="eyebrow">{label}</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {values.map((value) => (
                      <span key={value} className="tag capitalize !text-sm">{value}</span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : (
        <p className="card p-5 text-sm text-pico-muted">
          A coffee you rate 4★ or higher starts shaping your profile.
        </p>
      )}

      <section aria-labelledby="next-heading" className="space-y-4">
        <div>
          <h2 id="next-heading" className="section-title">Try next</h2>
          <p className="mt-1 text-sm text-pico-muted">Coffees you have not rated, closest to your taste first.</p>
        </div>
        {recommendations.length > 0 ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {recommendations.map((item) => (
              <li key={item.coffee.id}>
                <CoffeeCard
                  name={item.coffee.name}
                  roaster={item.coffee.roaster}
                  origin={item.coffee.origin}
                  imageUrl={item.coffee.imageUrl}
                  detail={`${formatMatchPercent(item.score)}% match · ${recommendationReason(item, tasteProfile)}`}
                  onClick={() => onSelectCoffee(item.coffee.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-pico-line-strong px-5 py-8 text-center">
            <p className="font-semibold text-pico-ink">
              {hasPositiveSignal ? 'You have tried the whole catalog' : 'Nothing to suggest yet'}
            </p>
            <p className="mt-1 text-sm text-pico-muted">Add a coffee you are drinking to keep teaching Pico.</p>
            {(onAddCoffee || onDiscover) && (
              <button type="button" onClick={onAddCoffee ?? onDiscover} className="btn btn-secondary mt-4">
                Add a coffee
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
