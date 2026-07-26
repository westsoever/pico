import type { FlavorTag } from '../types/coffee';
import { FLAVOR_TAGS, FLAVOR_TAG_LABELS } from '../types/coffee';

interface FlavorTagPickerProps {
  selected: FlavorTag[];
  onChange: (tags: FlavorTag[]) => void;
}

export function FlavorTagPicker({ selected, onChange }: FlavorTagPickerProps) {
  const toggle = (tag: FlavorTag) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Flavor tags">
      {FLAVOR_TAGS.map((tag) => {
        const isSelected = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={isSelected}
            onClick={() => toggle(tag)}
            className={`min-h-10 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/40 ${
              isSelected
                ? 'border-[#6b3a2a] bg-[#6b3a2a] text-white'
                : 'border-[#dfd2c7] bg-[#f8f3ee] text-[#6b3a2a] hover:border-[#b99178] hover:bg-[#f1e8df]'
            }`}
          >
            {FLAVOR_TAG_LABELS[tag]}
          </button>
        );
      })}
    </div>
  );
}

export function FlavorTagList({ tags }: { tags: FlavorTag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-[#ede5dc] px-2.5 py-0.5 text-xs font-medium text-[#6b3a2a]"
        >
          {FLAVOR_TAG_LABELS[tag]}
        </span>
      ))}
    </div>
  );
}
