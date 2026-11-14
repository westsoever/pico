interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
}

function Star({ filled, className }: { filled: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z" />
    </svg>
  );
}

export function StarRating({ value, onChange }: StarRatingProps) {
  const moveTo = (nextValue: number, group: HTMLDivElement) => {
    const clamped = Math.min(5, Math.max(1, nextValue));
    onChange(clamped);
    group.querySelector<HTMLButtonElement>(`[data-star="${clamped}"]`)?.focus();
  };

  return (
    <div
      className="-ml-1.5 flex w-fit"
      role="radiogroup"
      aria-label="Your rating, from 1 to 5 stars"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          moveTo((value || 0) + 1, event.currentTarget);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault();
          moveTo((value || 2) - 1, event.currentTarget);
        } else if (event.key === 'Home') {
          event.preventDefault();
          moveTo(1, event.currentTarget);
        } else if (event.key === 'End') {
          event.preventDefault();
          moveTo(5, event.currentTarget);
        }
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          tabIndex={value === star || (value === 0 && star === 1) ? 0 : -1}
          data-star={star}
          onClick={() => onChange(star)}
          className="flex h-12 w-12 items-center justify-center rounded-lg text-pico-star transition hover:bg-pico-tinted active:scale-95"
          aria-label={`${star} out of 5 stars`}
        >
          <Star filled={star <= value} className="h-9 w-9" />
        </button>
      ))}
    </div>
  );
}

export function StarDisplay({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 text-pico-star" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} filled={star <= value} className="h-4 w-4" />
      ))}
    </span>
  );
}
