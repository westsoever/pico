import type { ReactNode } from 'react';
import type { Coffee, SimilarCoffee } from '../types/coffee';
import { formatMatchPercent } from '../lib/similarity';
import { CoffeeImage } from './CoffeeImage';
import { StarDisplay } from './StarRating';
import { PicoMark } from './ui/Icons';

function Thumb({ src, className }: { src?: string; className: string }) {
  return (
    <CoffeeImage
      src={src}
      alt=""
      loading="lazy"
      width={64}
      className={`${className} shrink-0 bg-white object-contain`}
      fallback={
        <div className={`${className} flex shrink-0 items-center justify-center bg-pico-tinted text-pico-accent`} aria-hidden="true">
          <PicoMark className="h-1/2 w-1/2" />
        </div>
      }
    />
  );
}

/** Compact list row: thumbnail, name, roaster · origin. */
export function CoffeeCard({
  name,
  roaster,
  origin,
  stars,
  imageUrl,
  detail,
  onClick,
}: {
  name: string;
  roaster: string;
  origin: string;
  stars?: number;
  imageUrl?: string;
  detail?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card card-interactive flex w-full items-center gap-3 p-3 text-left"
    >
      <Thumb src={imageUrl} className="h-14 w-14 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-pico-ink">{name}</p>
        <p className="truncate text-sm text-pico-muted">
          {roaster} · {origin}
        </p>
        {detail && <p className="mt-0.5 text-xs font-medium text-pico-accent">{detail}</p>}
        {stars !== undefined && (
          <div className="mt-0.5">
            <StarDisplay value={stars} />
          </div>
        )}
      </div>
    </button>
  );
}

/** Grid card with the bag shot, for browsing. */
export function CoffeeTile({
  coffee,
  badge,
  onClick,
}: {
  coffee: Coffee;
  badge?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card card-interactive flex h-full w-full flex-col overflow-hidden text-left"
    >
      <div className="relative">
        <CoffeeImage
          src={coffee.imageUrl}
          alt=""
          loading="lazy"
          width={220}
          className="aspect-square w-full bg-white object-contain p-2"
          fallback={
            <div className="flex aspect-square w-full items-center justify-center bg-pico-tinted text-pico-accent" aria-hidden="true">
              <PicoMark className="h-10 w-10" />
            </div>
          }
        />
        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-pico-raised/95 px-2 py-0.5 text-xs font-semibold text-pico-brand-strong shadow-sm">
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="font-semibold leading-snug text-pico-ink">{coffee.name}</p>
        <p className="mt-0.5 truncate text-sm text-pico-muted">{coffee.roaster}</p>
        <p className="mt-auto pt-1.5 text-xs font-medium capitalize text-pico-accent">
          {coffee.origin} · {coffee.process}
        </p>
      </div>
    </button>
  );
}

export function CoffeeGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>;
}

interface SimilarListProps {
  items: SimilarCoffee[];
  onSelect: (coffeeId: string) => void;
  title?: string;
}

export function SimilarList({ items, onSelect, title = 'Similar coffees' }: SimilarListProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="similar-coffees-heading">
      <div>
        <h2 id="similar-coffees-heading" className="section-title">{title}</h2>
        <p className="mt-1 text-sm text-pico-muted">Close in origin, process, and flavor.</p>
      </div>
      <CoffeeGrid>
        {items.map(({ coffee, score }) => (
          <li key={coffee.id}>
            <CoffeeTile
              coffee={coffee}
              badge={`${formatMatchPercent(score)}% similar`}
              onClick={() => onSelect(coffee.id)}
            />
          </li>
        ))}
      </CoffeeGrid>
    </section>
  );
}
