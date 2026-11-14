import { getCoffeeById } from '../lib/catalog';
import { getRatingForCoffee, getRatedCoffeeIds } from '../lib/storage';
import { getSimilarToCoffee } from '../lib/similarity';
import { ROAST_LEVEL_LABELS, ROAST_STYLE_LABELS, type Rating } from '../types/coffee';
import { CoffeeImage } from './CoffeeImage';
import { FlavorTagList } from './FlavorTagPicker';
import { RateForm } from './RateForm';
import { SimilarList } from './SimilarList';
import { PicoMark } from './ui/Icons';

interface CoffeeDetailProps {
  coffeeId: string;
  pendingPhoto?: string;
  onSave: (rating: Omit<Rating, 'ratedAt'>) => boolean;
  onBack: () => void;
  onSelectCoffee: (coffeeId: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const savedDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

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
      <div className="py-12 text-center">
        <h1 className="section-title">Coffee not found</h1>
        <p className="mt-2 text-pico-muted">It may have been removed from this browser.</p>
        <button type="button" onClick={onBack} className="btn btn-secondary mt-6">
          Go back
        </button>
      </div>
    );
  }

  const similar = getSimilarToCoffee(coffee, ratedIds, 4);
  const photo = pendingPhoto ?? existingRating?.photoDataUrl;
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
  const imageBox = 'aspect-square w-full rounded-[var(--radius-lg)] border border-pico-line bg-pico-tinted';
  const placeholder = (
    <div className={`${imageBox} flex items-center justify-center text-pico-accent`} aria-hidden="true">
      <PicoMark className="h-16 w-16" />
    </div>
  );

  return (
    <div className="space-y-10">
      <div>
        <button type="button" onClick={onBack} className="link mb-5 text-sm no-underline">
          ← Back
        </button>

        <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-10">
          <div className="mx-auto w-full max-w-[18rem] md:mx-0">
            {photo ? (
              <img src={photo} alt={`${coffee.name} coffee bag label`} className={`${imageBox} object-cover`} />
            ) : (
              <CoffeeImage
                src={coffee.imageUrl}
                alt={`${coffee.name} bag from ${coffee.roaster}`}
                width={288}
                className={`${imageBox} !bg-white object-contain p-3`}
                fallback={placeholder}
              />
            )}
          </div>

          <header className="min-w-0">
            <p className="eyebrow">{coffee.roaster}</p>
            <h1 className="mt-1 font-pico-display text-4xl font-bold leading-tight tracking-tight text-pico-ink">{coffee.name}</h1>
            <p className="mt-2 capitalize text-pico-muted">
              {[coffee.origin, coffee.process, `${coffee.roastLevel} roast`].join(' · ')}
            </p>
            {coffee.available === false && (
              <p className="tag mt-3">Past coffee · no longer sold by the roaster</p>
            )}
            {coffee.tastingNotes && (
              <p className="mt-4 text-lg font-medium capitalize leading-snug text-pico-brand-strong">
                {coffee.tastingNotes.join(' · ')}
              </p>
            )}
            <p className="mt-3 leading-relaxed text-pico-ink/85">{coffee.description}</p>
            <div className="mt-4">
              <FlavorTagList tags={coffee.flavorTags} />
            </div>
            {coffee.sourceUrl && (
              <a
                href={coffee.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link mt-5 inline-flex items-center gap-1 text-sm"
              >
                View at roaster{' '}
                <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </header>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <section className="card p-5 sm:p-6" aria-labelledby="rate-heading">
          <h2 id="rate-heading" className="section-title">
            {existingRating ? 'Your rating' : 'Rate this coffee'}
          </h2>
          <p className="mb-5 mt-1 text-sm text-pico-muted">
            {existingRating
              ? `Saved ${savedDate.format(new Date(existingRating.ratedAt))}. Change anything and update.`
              : 'Stars are enough. Add notes or a brew recipe if you want to remember more.'}
          </p>
          <RateForm
            coffee={coffee}
            existingRating={existingRating}
            photoDataUrl={pendingPhoto}
            onSave={onSave}
            onCancel={onBack}
            onDirtyChange={onDirtyChange}
          />
        </section>

        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="section-title">About this coffee</h2>
          <dl className="mt-4 divide-y divide-pico-line text-sm">
            {details.map(({ label, value, capitalize }) => (
              <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5">
                <dt className="text-pico-muted">{label}</dt>
                <dd className={`font-medium text-pico-ink ${capitalize ? 'first-letter:uppercase' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <SimilarList items={similar} onSelect={onSelectCoffee} title="Similar coffees" />
    </div>
  );
}
