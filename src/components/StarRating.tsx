interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'lg';
}

export function StarRating({ value, onChange, size = 'lg' }: StarRatingProps) {
  const starSize = size === 'lg' ? 'text-3xl' : 'text-lg';
  const moveTo = (nextValue: number, group: HTMLDivElement) => {
    const clamped = Math.min(5, Math.max(1, nextValue));
    onChange(clamped);
    group.querySelector<HTMLButtonElement>(`[data-star="${clamped}"]`)?.focus();
  };

  return (
    <div
      className="flex w-fit gap-1"
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
          className={`${starSize} min-h-11 min-w-11 rounded-lg text-[#c17d52] transition hover:bg-[#f5ebe3] focus:outline-none focus:ring-2 focus:ring-[#6b3a2a] active:scale-95`}
          aria-label={`${star} out of 5 stars`}
        >
          <span aria-hidden="true">{star <= value ? '★' : '☆'}</span>
        </button>
      ))}
    </div>
  );
}

export function StarDisplay({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const starSize = size === 'lg' ? 'text-2xl' : 'text-sm';
  return (
    <span className={`${starSize} text-[#c4956a]`} aria-label={`${value} out of 5 stars`}>
      {'★'.repeat(value)}{'☆'.repeat(5 - value)}
    </span>
  );
}
