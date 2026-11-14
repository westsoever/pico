import { getCoffeeById } from '../lib/catalog';
import { getRatingForCoffee, getRatedCoffeeIds } from '../lib/storage';
import { getSimilarToCoffee } from '../lib/similarity';
import { ROAST_LEVEL_LABELS, ROAST_STYLE_LABELS, type Coffee, type Rating } from '../types/coffee';
import { CoffeeImage } from './CoffeeImage';
import { FlavorTagList } from './FlavorTagPicker';
import { RateForm } from './RateForm';
import { SimilarList } from './SimilarList';
import { PicoMark } from './ui/Icons';

interface CoffeeDetailProps {
  coffeeId: string;
  pendingPhoto?: string;
  onSave: (rating: Omit<Rating, 'ratedAt'>) => boolean;
  onRemove?: (coffeeId: string) => void;
  onBack: () => void;
  onSelectCoffee: (coffeeId: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const savedDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const SUGGEST_ADDRESS = 'info@sunseekerlabs.dk';

/** A prefilled email so a coffee someone added by hand can reach the shared catalog. */
function suggestCoffeeMailto(coffee: Coffee): string {
  const body = [
    'Please add this coffee to Pico:',
    '',
    `Name: ${coffee.name}`,
    `Roaster: ${coffee.roaster}`,
    `Origin: ${coffee.origin}`,
    `Process: ${coffee.process}`,
    `Roast: ${ROAST_LEVEL_LABELS[coffee.roastLevel]}`,
    coffee.variety && `Variety: ${coffee.variety}`,
    coffee.scaScore !== undefined && `Cupping score: ${coffee.scaScore}`,
    '',
    'A photo of the bag helps, if you can attach one.',
  ].filter((line) => line !== undefined && line !== false);
  const params = new URLSearchParams({ subject: `Add to Pico: ${coffee.name} (${coffee.roaster})`, body: body.join('\n') });
  // mailto wants %20 for spaces, not URLSearchParams' '+'.
  return `mailto:${SUGGEST_ADDRESS}?${params.toString().replace(/\+/g, '%20')}`;
}

export function CoffeeDetail({
  coffeeId,
  pendingPhoto,
  onSave,
  onRemove,
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
    { label: 'Cupping score', value: coffee.scaScore?.toString() },
  ].filter((detail) => detail.value);
  const imageBox = 'aspect-square w-full rounded-[var(--radius-lg)] border border-pico-line bg-pico-tinted';
  const placeholder = (
    <div className={`${imageBox} flex items-center justify-center text-pico-accent`} aria-hidden="true">
      <PicoMark className="h-1/2 w-1/2" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <button type="button" onClick={onBack} className="link mb-4 text-sm no-underline">
          ← Back
        </button>

        {/* Thumbnail beside the title on phones, so the stars are on screen right after a scan. */}
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-4 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
          {photo ? (
            <img src={photo} alt={`${coffee.name} coffee bag label`} className={`${imageBox} object-cover`} />
          ) : (
            <CoffeeImage
              src={coffee.imageUrl}
              alt={`${coffee.name} bag from ${coffee.roaster}`}
              width={224}
              className={`${imageBox} !bg-white object-contain p-2`}
              fallback={placeholder}
            />
          )}

          <header className="min-w-0">
            <p className="eyebrow">{coffee.roaster}</p>
            <h1 className="mt-1 font-pico-display text-[1.75rem] font-bold leading-tight tracking-tight text-pico-ink md:text-4xl">{coffee.name}</h1>
            <p className="mt-1 text-sm text-pico-muted md:text-base">
              {coffee.origin} · <span className="capitalize">{coffee.process}</span>
            </p>
            {coffee.available === false && (
              <p className="tag mt-2">Past coffee · no longer sold by the roaster</p>
            )}
            {coffee.tastingNotes && (
              <p className="mt-2 hidden text-lg font-medium capitalize leading-snug text-pico-brand-strong md:block">
                {coffee.tastingNotes.join(' · ')}
              </p>
            )}
          </header>
        </div>
        {coffee.tastingNotes && (
          <p className="mt-4 font-medium capitalize leading-snug text-pico-brand-strong md:hidden">
            {coffee.tastingNotes.join(' · ')}
          </p>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <section className="card p-5 sm:p-6" aria-labelledby="rate-heading">
          <h2 id="rate-heading" className="section-title">
            {existingRating ? 'Your rating' : 'Rate this coffee'}
          </h2>
          <p className="mb-4 mt-1 text-sm text-pico-muted">
            {existingRating
              ? `Saved ${savedDate.format(new Date(existingRating.ratedAt))}. Change anything and update.`
              : 'Stars are enough. Add notes or a brew recipe if you want.'}
          </p>
          <RateForm
            coffee={coffee}
            existingRating={existingRating}
            photoDataUrl={pendingPhoto}
            onSave={onSave}
            onCancel={onBack}
            onDirtyChange={onDirtyChange}
          />
          {existingRating && onRemove && (
            <button type="button" onClick={() => onRemove(coffee.id)} className="link mt-4 text-sm !text-pico-danger">
              Remove from journal
            </button>
          )}
        </section>

        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="section-title">About this coffee</h2>
          {coffee.description && <p className="mt-3 leading-relaxed text-pico-ink/85">{coffee.description}</p>}
          <div className="mt-3">
            <FlavorTagList tags={coffee.flavorTags} />
          </div>
          <dl className="mt-4 divide-y divide-pico-line text-sm">
            {details.map(({ label, value, capitalize }) => (
              <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5">
                <dt className="text-pico-muted">{label}</dt>
                <dd className={`font-medium text-pico-ink ${capitalize ? 'first-letter:uppercase' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>
          {coffee.sourceUrl && (
            <a
              href={coffee.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-goatcounter-click={`roaster-${coffee.id}`}
              data-goatcounter-title={coffee.name}
              className="link mt-4 inline-flex items-center gap-1 text-sm"
            >
              View at roaster{' '}
              <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          {coffee.isCustom && (
            <p className="mt-4 text-sm text-pico-muted">
              Not in Pico’s catalog yet.{' '}
              <a href={suggestCoffeeMailto(coffee)} className="link">
                Send this coffee to Pico
              </a>{' '}
              so others can find it.
            </p>
          )}
        </section>
      </div>

      <SimilarList items={similar} onSelect={onSelectCoffee} title="Similar coffees" />
    </div>
  );
}
