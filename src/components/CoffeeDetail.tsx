import { getCoffeeById } from '../lib/catalog';
import { getRatingForCoffee, getRatedCoffeeIds } from '../lib/storage';
import { getSimilarToCoffee } from '../lib/similarity';
import {
  BREW_METHOD_OPTIONS,
  GRIND_SIZE_OPTIONS,
  ROAST_LEVEL_LABELS,
  ROAST_STYLE_LABELS,
  type Rating,
} from '../types/coffee';
import { CoffeeImage } from './CoffeeImage';
import { FlavorTagList } from './FlavorTagPicker';
import { RateForm } from './RateForm';
import { SimilarList } from './SimilarList';
import { StarDisplay } from './StarRating';
import { PicoMark } from './ui/Icons';

interface CoffeeDetailProps {
  coffeeId: string;
  pendingPhoto?: string;
  onSave: (rating: Omit<Rating, 'ratedAt'>) => boolean;
  onBack: () => void;
  onSelectCoffee: (coffeeId: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function CoffeeDetail({
  coffeeId,
  pendingPhoto,
  onSave,
  onBack,
  onSelectCoffee,
  onDirtyChange,
}: CoffeeDetailProps) {
  const coffee = getCoffeeById(coffeeId);
  const existingRating = getRatingForCoffee(coffeeId);
  const ratedIds = getRatedCoffeeIds();

  if (!coffee) {
    return (
      <div className="text-center">
        <p className="text-[#766257]">Coffee not found.</p>
        <button type="button" onClick={onBack} className="mt-4 text-[#6b3a2a] underline">
          Go back
        </button>
      </div>
    );
  }

  const similar = getSimilarToCoffee(coffee, ratedIds, 5);
  const photo = pendingPhoto ?? existingRating?.photoDataUrl;
  const brew = existingRating?.brew;
  const brewSummary = brew
    ? [
        BREW_METHOD_OPTIONS.find((option) => option.value === brew.method)?.label,
        brew.doseGrams !== undefined ? `${brew.doseGrams} g coffee` : undefined,
        brew.waterGrams !== undefined ? `${brew.waterGrams} g water` : undefined,
        brew.yieldGrams !== undefined ? `${brew.yieldGrams} g yield` : undefined,
        brew.temperatureCelsius !== undefined ? `${brew.temperatureCelsius} °C` : undefined,
        GRIND_SIZE_OPTIONS.find((option) => option.value === brew.grind)?.label,
        brew.brewTimeSeconds !== undefined ? `${brew.brewTimeSeconds} sec` : undefined,
      ].filter(Boolean)
    : [];
  const roast = [
    `${ROAST_LEVEL_LABELS[coffee.roastLevel]} roast`,
    coffee.roastStyle && ROAST_STYLE_LABELS[coffee.roastStyle],
  ]
    .filter(Boolean)
    .join(' · ');
  const details = [
    { label: 'Origin', value: [coffee.origin, coffee.region].filter(Boolean).join(', ') },
    { label: 'Producer', value: coffee.producer },
    { label: 'Variety', value: coffee.variety },
    { label: 'Altitude', value: coffee.altitude },
    { label: 'Process', value: coffee.process, capitalize: true },
    { label: 'Roast', value: roast },
    { label: "Roaster's notes", value: coffee.tastingNotes?.join(', '), capitalize: true },
    { label: 'Roaster', value: [coffee.roaster, coffee.roasterCity].filter(Boolean).join(', ') },
    { label: 'SCA score', value: coffee.scaScore?.toString() },
  ].filter((detail) => detail.value);
  const placeholder = (
    <div className="flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f3e8de] to-[#e7d4c4]" aria-hidden="true">
      <PicoMark className="h-12 w-12 text-[#8d5941]" />
    </div>
  );

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <button type="button" onClick={onBack} className="rounded-lg text-sm font-medium text-[#6b3a2a] focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/30">
        ← Back
      </button>

      {photo ? (
        <img
          src={photo}
          alt={`${coffee.name} coffee bag label`}
          className="h-56 w-full rounded-2xl object-cover shadow-sm"
        />
      ) : (
        <CoffeeImage
          src={coffee.imageUrl}
          alt={`${coffee.name} bag from ${coffee.roaster}`}
          className="h-56 w-full rounded-2xl bg-[#f3e8de] object-contain shadow-sm"
          fallback={placeholder}
        />
      )}

      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8b5339]">{coffee.roaster}</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#1c1410]">{coffee.name}</h2>
        {coffee.available === false && (
          <p className="mt-2 inline-block rounded-full bg-[#efe6dd] px-3 py-1 text-xs font-semibold text-[#6f5c51]">
            Past coffee · no longer sold by the roaster
          </p>
        )}
        <p className="mt-4 text-sm leading-6 text-[#6f5c51]">{coffee.description}</p>
        <div className="mt-4">
          <FlavorTagList tags={coffee.flavorTags} />
        </div>
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-[#e3d6ca] bg-[#fbf7f2] p-4 text-sm">
          {details.map(({ label, value, capitalize }) => (
            <div key={label} className="contents">
              <dt className="font-medium text-[#8b5339]">{label}</dt>
              <dd className={`text-[#1c1410] ${capitalize ? 'first-letter:uppercase' : ''}`}>{value}</dd>
            </div>
          ))}
        </dl>
        {coffee.sourceUrl && (
          <a
            href={coffee.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-[#6b3a2a] underline decoration-[#c4956a] underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/30"
          >
            View at roaster{' '}
            <span aria-hidden="true">↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </header>

      {existingRating && (
        <section className="rounded-2xl border border-[#e3d6ca] bg-[#fbf7f2] p-5" aria-labelledby="saved-rating-heading">
          <div className="flex items-center justify-between gap-3">
            <h3 id="saved-rating-heading" className="font-semibold text-[#1c1410]">Your saved rating</h3>
            <StarDisplay value={existingRating.stars} size="lg" />
          </div>
          {existingRating.note && (
            <p className="mt-3 text-sm leading-6 text-[#6f5c51]">{existingRating.note}</p>
          )}
          {existingRating.flavorTags.length > 0 && (
            <div className="mt-3"><FlavorTagList tags={existingRating.flavorTags} /></div>
          )}
          {brewSummary.length > 0 && (
            <p className="mt-3 border-t border-[#e3d6ca] pt-3 text-xs leading-5 text-[#78675d]">
              <span className="font-semibold text-[#6b3a2a]">Brew:</span> {brewSummary.join(' · ')}
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-[#e3d6ca] bg-white p-4 shadow-sm" aria-labelledby="rate-heading">
        <h3 id="rate-heading" className="mb-1 text-xl font-semibold text-[#1c1410]">
          {existingRating ? 'Update your rating' : 'Rate this coffee'}
        </h3>
        <p className="mb-5 text-sm text-[#766257]">A quick impression is enough. Add brew details only if useful.</p>
        <RateForm
          coffee={coffee}
          existingRating={existingRating}
          photoDataUrl={pendingPhoto}
          onSave={onSave}
          onCancel={onBack}
          onDirtyChange={onDirtyChange}
        />
      </section>

      <SimilarList
        items={similar}
        onSelect={onSelectCoffee}
        title="Similar coffees"
      />
    </div>
  );
}
