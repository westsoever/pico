import type { SimilarCoffee } from '../types/coffee';
import { formatMatchPercent } from '../lib/similarity';
import { FlavorTagList } from './FlavorTagPicker';
import { StarDisplay } from './StarRating';
import { PicoMark } from './ui/Icons';

interface SimilarListProps {
  items: SimilarCoffee[];
  onSelect: (coffeeId: string) => void;
  title?: string;
}

export function SimilarList({ items, onSelect, title = 'Similar coffees' }: SimilarListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-[#f8f3ee] p-4 text-sm text-[#766257]">No similar coffees found yet.</p>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="similar-coffees-heading">
      <div>
        <h3 id="similar-coffees-heading" className="text-lg font-semibold text-[#1c1410]">{title}</h3>
        <p className="mt-1 text-sm text-[#766257]">Based on origin, roast, process, and flavor.</p>
      </div>
      <ul className="space-y-2">
        {items.map(({ coffee, score }) => (
          <li key={coffee.id}>
            <button
              type="button"
              onClick={() => onSelect(coffee.id)}
              className="flex w-full items-start gap-3 rounded-2xl border border-[#e3d7cc] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b99178] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1e3d7] text-lg text-[#6b3a2a]" aria-hidden="true">
                <PicoMark className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#1c1410]">{coffee.name}</p>
                    <p className="text-sm text-[#766257]">{coffee.roaster}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#f2ebe4] px-2 py-0.5 text-xs font-semibold text-[#6b3a2a]">
                    {formatMatchPercent(score)}% similar
                  </span>
                </div>
                <div className="mt-1.5">
                  <FlavorTagList tags={coffee.flavorTags.slice(0, 3)} />
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CoffeeCard({
  name,
  roaster,
  origin,
  stars,
  onClick,
}: {
  name: string;
  roaster: string;
  origin: string;
  stars?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-[#e3d7cc] bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#b99178] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/30"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f1e3d7] text-xl text-[#6b3a2a]" aria-hidden="true">
        <PicoMark className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#1c1410]">{name}</p>
        <p className="text-sm text-[#766257]">
          {roaster} · {origin}
        </p>
        {stars !== undefined && (
          <div className="mt-1">
            <StarDisplay value={stars} />
          </div>
        )}
      </div>
      <span aria-hidden="true" className="text-[#8b5339] transition group-hover:translate-x-0.5">→</span>
    </button>
  );
}
