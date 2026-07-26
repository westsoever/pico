import { loadUserData } from '../lib/storage';
import { formatMatchPercent, getSimilarCoffees } from '../lib/similarity';
import { FLAVOR_TAG_LABELS, ROAST_LEVEL_LABELS } from '../types/coffee';
import type { FlavorTag, SimilarCoffee, TasteProfile } from '../types/coffee';
import { PicoMark, TasteIcon } from './ui/Icons';

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
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[#453229]">{FLAVOR_TAG_LABELS[tag]}</span>
        <span className="text-xs font-semibold tabular-nums text-[#8f6b58]">{percentage}%</span>
      </div>
      <div
        role="meter"
        aria-label={`${FLAVOR_TAG_LABELS[tag]} preference strength`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={`${percentage} percent`}
        className="h-2.5 overflow-hidden rounded-full bg-[#eadfd5]"
      >
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#bd7650,#75412d)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function PreferenceGroup({
  eyebrow,
  title,
  values,
}: {
  eyebrow: string;
  title: string;
  values: string[];
}) {
  return (
    <div className="rounded-2xl border border-[#e8ddd3] bg-[#fffdf9] p-4 shadow-[0_8px_24px_rgba(71,45,30,0.05)]">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#a06b4c]">{eyebrow}</p>
      <p className="mt-1 font-serif text-lg font-semibold text-[#38271f]">{title}</p>
      {values.length > 0 ? (
        <ol className="mt-4 space-y-2.5">
          {values.slice(0, 3).map((value, index) => (
            <li key={value} className="flex items-center gap-2.5 text-sm capitalize text-[#665044]">
              <span className={`h-1.5 rounded-full bg-[#a66040] ${index === 0 ? 'w-6' : index === 1 ? 'w-4' : 'w-2.5'}`} />
              <span className={index === 0 ? 'font-semibold text-[#3e2c23]' : ''}>{value}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-[#78675d]">Still learning</p>
      )}
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
      ? ` and your preference for ${coffee.origin}`
      : profile.topProcesses.includes(coffee.process)
        ? ` and ${coffee.process} processing`
        : '';
    return `Matches your taste for ${flavorMatches.join(' and ')}${preferenceMatch}.`;
  }
  if (profile.topRoastLevels.includes(coffee.roastLevel)) {
    return `A ${coffee.roastLevel} roast aligned with the coffees you rate highly.`;
  }
  return `A new direction selected from your highest-rated coffees.`;
}

function RecommendationCard({
  item,
  profile,
  onSelect,
}: {
  item: SimilarCoffee;
  profile: TasteProfile;
  onSelect: (coffeeId: string) => void;
}) {
  const { coffee, score } = item;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(coffee.id)}
        className="group flex h-full w-full flex-col rounded-[1.35rem] border border-[#e4d7ca] bg-[#fffdf9] p-5 text-left shadow-[0_10px_30px_rgba(71,45,30,0.06)] transition hover:-translate-y-0.5 hover:border-[#b98769] hover:shadow-[0_14px_34px_rgba(71,45,30,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#784c37] focus-visible:ring-offset-2"
      >
        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#513428] text-[#f6e8da] shadow-inner" aria-hidden="true">
            <PicoMark className="h-5 w-5" />
          </div>
          <span className="rounded-full bg-[#f0e2d5] px-2.5 py-1 text-xs font-bold text-[#75472f]">
            {formatMatchPercent(score)}% match
          </span>
        </div>
        <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#a0694a]">{coffee.roaster}</p>
        <h4 className="mt-1 font-serif text-xl font-semibold text-[#302119]">{coffee.name}</h4>
        <p className="mt-1 text-sm capitalize text-[#806b5f]">
          {coffee.origin} · {coffee.process} · {ROAST_LEVEL_LABELS[coffee.roastLevel]}
        </p>
        <div className="mt-4 flex-1 rounded-xl bg-[#f7f1ea] p-3">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#9a715b]">Why it fits</p>
          <p className="mt-1.5 text-sm leading-5 text-[#5a4438]">{recommendationReason(item, profile)}</p>
        </div>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#79472f]">
          View coffee <span aria-hidden="true" className="transition group-hover:translate-x-0.5">→</span>
        </span>
      </button>
    </li>
  );
}

export function YouView({ onSelectCoffee, refreshKey, onDiscover, onAddCoffee }: YouViewProps) {
  void refreshKey;
  const { tasteProfile, ratings } = loadUserData();

  if (!tasteProfile || ratings.length === 0) {
    return (
      <section className="mx-auto max-w-2xl overflow-hidden rounded-[1.75rem] border border-[#e5d8cc] bg-[#fffdf9] shadow-[0_18px_50px_rgba(71,45,30,0.08)]">
        <div className="relative overflow-hidden bg-[#3a281f] px-7 py-10 text-center text-white">
          <div aria-hidden="true" className="absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#b76f49]/30 blur-2xl" />
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#d7a383]/40 bg-[#5d3a2b] text-[#f5dfd0]">
            <TasteIcon className="h-7 w-7" />
          </div>
          <p className="relative mt-5 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#dcad90]">Your taste</p>
          <h2 className="relative mt-2 font-serif text-3xl font-semibold tracking-tight">Build a taste profile that is yours</h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-[#d8c6bb]">
            Rate your first coffee to reveal the flavors, origins, and roast styles you naturally reach for.
          </p>
        </div>
        <div className="px-7 py-7 text-center">
          <p className="text-sm text-[#7d685c]">Your profile gets clearer as you rate more coffees.</p>
          {onDiscover && (
            <button
              type="button"
              onClick={onDiscover}
              className="mt-5 rounded-full bg-[#6b402d] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(77,42,27,0.2)] transition hover:bg-[#523023] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#784c37] focus-visible:ring-offset-2"
            >
              Find your first coffee
            </button>
          )}
        </div>
      </section>
    );
  }

  const topTags = (Object.entries(tasteProfile.tagWeights) as [FlavorTag, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const hasPositiveSignal =
    topTags.length > 0 ||
    tasteProfile.topOrigins.length > 0 ||
    tasteProfile.topProcesses.length > 0 ||
    tasteProfile.topRoastLevels.length > 0;
  const ratedIds = ratings.map((r) => r.coffeeId);
  const recommendations = hasPositiveSignal
    ? getSimilarCoffees(tasteProfile, ratedIds, 6)
    : [];
  const profileMaturity =
    tasteProfile.ratingCount >= 8 ? 'Well defined' : tasteProfile.ratingCount >= 4 ? 'Taking shape' : 'Learning';
  const roastValues = tasteProfile.topRoastLevels.map((roast) => `${ROAST_LEVEL_LABELS[roast]} roast`);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-[#3a281f] px-6 py-7 text-[#fffaf4] shadow-[0_16px_45px_rgba(55,33,24,0.16)] sm:px-8">
        <div aria-hidden="true" className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#a86142]/20 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#d9a98b]">Taste intelligence</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Your taste, decoded</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#d7c5ba]">
              Patterns from the coffees you enjoyed—not a quiz, just your real palate.
            </p>
          </div>
          <dl className="flex gap-7">
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-[#baa398]">Profile</dt>
              <dd className="mt-1 font-semibold text-[#f5dfd0]">{profileMaturity}</dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-[#baa398]">Rated</dt>
              <dd className="mt-1 font-semibold">{tasteProfile.ratingCount} coffees</dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-[#baa398]">Average</dt>
              <dd className="mt-1 font-semibold">{tasteProfile.avgRating.toFixed(1)}★</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[1.5rem] border border-[#e5d8cc] bg-[#fffdf9] p-6 shadow-[0_12px_35px_rgba(71,45,30,0.06)] sm:p-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#a16648]">Flavor signature</p>
              <h3 className="mt-1 font-serif text-2xl font-semibold text-[#34231c]">What draws you in</h3>
            </div>
            <span className="rounded-full bg-[#f3e7dc] px-3 py-1 text-xs font-semibold text-[#805039]">Relative strength</span>
          </div>
          {topTags.length > 0 ? (
            <div className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {topTags.map(([tag, weight]) => (
                <TasteBar key={tag} tag={tag} strength={weight} />
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-xl bg-[#f7f1eb] p-5">
              <p className="text-sm text-[#735e52]">Add flavor tags to future ratings to map your flavor signature.</p>
              {onDiscover && (
                <button type="button" onClick={onDiscover} className="mt-3 text-sm font-semibold text-[#78472f] underline underline-offset-4">
                  Rate another coffee
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <PreferenceGroup eyebrow="Place" title="Origin pull" values={tasteProfile.topOrigins} />
          <PreferenceGroup eyebrow="Method" title="Process style" values={tasteProfile.topProcesses} />
          <PreferenceGroup eyebrow="Development" title="Roast comfort" values={roastValues} />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#a16648]">Chosen with context</p>
            <h3 className="mt-1 font-serif text-2xl font-semibold text-[#34231c]">Your next coffees</h3>
            <p className="mt-1 text-sm text-[#826d61]">Every recommendation shows the signal behind it.</p>
          </div>
          {onDiscover && (
            <button
              type="button"
              onClick={onDiscover}
              className="rounded-full border border-[#a7765d] px-4 py-2 text-sm font-semibold text-[#704630] transition hover:bg-[#f2e5da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#784c37]"
            >
              Explore all coffee
            </button>
          )}
        </div>

        {recommendations.length > 0 ? (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((item) => (
              <RecommendationCard
                key={item.coffee.id}
                item={item}
                profile={tasteProfile}
                onSelect={onSelectCoffee}
              />
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-[#d8c5b7] bg-[#fffaf4] px-6 py-9 text-center">
            <h4 className="font-serif text-xl font-semibold text-[#38271f]">
              {hasPositiveSignal ? 'You have explored the current catalog' : 'Pico is still learning what you love'}
            </h4>
            <p className="mt-2 text-sm text-[#836e62]">
              {hasPositiveSignal
                ? 'Add another coffee to keep teaching Pico what you love.'
                : 'A coffee you rate 4 stars or higher will start shaping recommendations.'}
            </p>
            {(onAddCoffee || onDiscover) && (
              <button
                type="button"
                onClick={onAddCoffee ?? onDiscover}
                className="mt-5 rounded-full bg-[#6b402d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#523023] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#784c37] focus-visible:ring-offset-2"
              >
                Add a coffee
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
