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
            className="chip"
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
          className="tag"
        >
          {FLAVOR_TAG_LABELS[tag]}
        </span>
      ))}
    </div>
  );
}
