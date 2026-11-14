import { useEffect, useRef, useState } from 'react';
import {
  BREW_METHOD_OPTIONS,
  GRIND_SIZE_OPTIONS,
  type BrewJournal,
  type BrewMethod,
  type Coffee,
  type FlavorTag,
  type GrindSize,
  type Rating,
} from '../types/coffee';
import { StarRating } from './StarRating';
import { FlavorTagPicker } from './FlavorTagPicker';

interface RateFormProps {
  coffee: Coffee;
  existingRating?: Rating;
  photoDataUrl?: string;
  onSave: (rating: Omit<Rating, 'ratedAt'>) => boolean;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function RateForm(props: RateFormProps) {
  return <RateFormFields key={props.coffee.id} {...props} />;
}

function RateFormFields({
  coffee,
  existingRating,
  photoDataUrl,
  onSave,
  onCancel,
  onDirtyChange,
}: RateFormProps) {
  const savedBrew = existingRating?.brew;
  const [stars, setStars] = useState(existingRating?.stars ?? 0);
  const [flavorTags, setFlavorTags] = useState<FlavorTag[]>(
    existingRating?.flavorTags ?? coffee.flavorTags.slice(0, 3),
  );
  const [note, setNote] = useState(existingRating?.note ?? '');
  const [showBrewDetails, setShowBrewDetails] = useState(Boolean(savedBrew));
  const [method, setMethod] = useState(savedBrew?.method ?? '');
  const [doseGrams, setDoseGrams] = useState(savedBrew?.doseGrams?.toString() ?? '');
  const [waterGrams, setWaterGrams] = useState(savedBrew?.waterGrams?.toString() ?? '');
  const [yieldGrams, setYieldGrams] = useState(savedBrew?.yieldGrams?.toString() ?? '');
  const [temperatureCelsius, setTemperatureCelsius] = useState(
    savedBrew?.temperatureCelsius?.toString() ?? '',
  );
  const [grind, setGrind] = useState(savedBrew?.grind ?? '');
  const [brewTimeSeconds, setBrewTimeSeconds] = useState(savedBrew?.brewTimeSeconds?.toString() ?? '');

  const draftSignature = JSON.stringify({
    stars,
    flavorTags,
    note,
    method,
    doseGrams,
    waterGrams,
    yieldGrams,
    temperatureCelsius,
    grind,
    brewTimeSeconds,
  });
  const initialSignature = useRef(draftSignature);
  const isDirty = draftSignature !== initialSignature.current;
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChangeRef.current?.(false);
    },
    [],
  );

  const numberOrUndefined = (value: string) => value.trim() ? Number(value) : undefined;
  const numericFields = [
    numberOrUndefined(doseGrams),
    numberOrUndefined(waterGrams),
    numberOrUndefined(yieldGrams),
    numberOrUndefined(brewTimeSeconds),
  ];
  const temperature = numberOrUndefined(temperatureCelsius);
  const brewDetailsInvalid =
    numericFields.some((value) => value !== undefined && (!Number.isFinite(value) || value <= 0)) ||
    (temperature !== undefined && (!Number.isFinite(temperature) || temperature < 0 || temperature > 100));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (stars === 0 || brewDetailsInvalid) return;
    const brew: BrewJournal = {
      method: (method || undefined) as BrewMethod | undefined,
      doseGrams: numberOrUndefined(doseGrams),
      waterGrams: numberOrUndefined(waterGrams),
      yieldGrams: numberOrUndefined(yieldGrams),
      temperatureCelsius: temperature,
      grind: (grind || undefined) as GrindSize | undefined,
      brewTimeSeconds: numberOrUndefined(brewTimeSeconds),
    };
    const hasBrewDetails = Object.values(brew).some((value) => value !== undefined);
    const rating = {
      coffeeId: coffee.id,
      stars,
      flavorTags,
      note: note.trim(),
      photoDataUrl: photoDataUrl ?? existingRating?.photoDataUrl,
      ...(hasBrewDetails ? { brew } : {}),
    };
    if (onSave(rating)) {
      initialSignature.current = draftSignature;
      onDirtyChangeRef.current?.(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="field-label">Stars</p>
        <StarRating value={stars} onChange={setStars} />
        {stars === 0 && <p className="mt-1 text-xs text-pico-muted">Tap a star to rate.</p>}
      </div>

      <div>
        <p className="field-label">What stood out?</p>
        <FlavorTagPicker selected={flavorTags} onChange={setFlavorTags} />
      </div>

      <div>
        <label htmlFor="note" className="field-label">
          Tasting note <span className="font-normal text-pico-muted">(optional)</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What would you want to remember?"
          className="field py-3"
        />
      </div>

      <div className="border-t border-pico-line pt-4">
        <button
          type="button"
          aria-expanded={showBrewDetails}
          aria-controls="brew-details"
          aria-disabled={showBrewDetails && brewDetailsInvalid}
          onClick={() => {
            if (showBrewDetails && brewDetailsInvalid) return;
            setShowBrewDetails((shown) => !shown);
          }}
          className="flex min-h-11 w-full items-center justify-between rounded-lg text-left font-semibold text-pico-ink"
        >
          <span>
            Brew details <span className="ml-1 text-sm font-normal text-pico-muted">(optional)</span>
          </span>
          <span aria-hidden="true" className="text-xl text-pico-accent">{showBrewDetails ? '−' : '+'}</span>
        </button>
        <p className="text-xs text-pico-muted">
          {showBrewDetails && brewDetailsInvalid
            ? 'Fix the recipe values before closing brew details.'
            : 'Keep a recipe worth repeating.'}
        </p>

        {showBrewDetails && (
          <div id="brew-details" className="mt-4 space-y-4 rounded-[var(--radius-md)] bg-pico-tinted/60 p-4">
            <div>
              <label htmlFor="brew-method" className="field-label">Method</label>
              <select id="brew-method" value={method} onChange={(e) => setMethod(e.target.value)} className="field">
                <option value="">Choose a method</option>
                {BREW_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <BrewNumberField id="brew-dose" label="Coffee dose" unit="g" value={doseGrams} onChange={setDoseGrams} />
              <BrewNumberField id="brew-water" label="Water" unit="g" value={waterGrams} onChange={setWaterGrams} />
              <BrewNumberField id="brew-yield" label="Yield" unit="g" value={yieldGrams} onChange={setYieldGrams} />
              <BrewNumberField id="brew-temperature" label="Temperature" unit="°C" value={temperatureCelsius} onChange={setTemperatureCelsius} max={100} />
              <div>
                <label htmlFor="brew-grind" className="field-label">Grind size</label>
                <select id="brew-grind" value={grind} onChange={(e) => setGrind(e.target.value)} className="field">
                  <option value="">Choose a grind</option>
                  {GRIND_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <BrewNumberField id="brew-time" label="Brew time" unit="sec" value={brewTimeSeconds} onChange={setBrewTimeSeconds} />
            </div>
            {brewDetailsInvalid && (
              <p role="alert" className="text-sm text-pico-danger">
                Use positive numbers for recipe amounts and time; temperature must be 0–100 °C.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-pico-line pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            if (!isDirty || window.confirm('Discard your unsaved rating?')) onCancel();
          }}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={stars === 0 || brewDetailsInvalid}
          className="btn btn-primary sm:min-w-44"
        >
          {existingRating ? 'Update rating' : 'Save to journal'}
        </button>
      </div>
    </form>
  );
}

function BrewNumberField({
  id,
  label,
  unit,
  value,
  onChange,
  max,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={0}
          max={max}
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field !pr-12"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-pico-muted">{unit}</span>
      </div>
    </div>
  );
}
