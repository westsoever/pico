import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement>;

const iconDefaults = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.8,
  viewBox: '0 0 24 24',
} as const;

export function PicoMark(props: IconProps) {
  return (
    <svg {...iconDefaults} aria-hidden="true" {...props}>
      <path d="M18.7 5.3C15.4 2 9.4 3.4 6.1 6.8c-3.4 3.3-4.8 9.3-1.5 12.6 3.3 3.3 9.3 1.9 12.6-1.5 3.4-3.3 4.8-9.3 1.5-12.6Z" />
      <path d="M16.7 7.2c-1.4 1.1-2.4 2.5-3.1 4.2-.7 1.8-1.8 3.2-3.3 4.3a9 9 0 0 1-4.1 1.6" />
    </svg>
  );
}

export function DiscoverIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="m14.7 9.3-1.5 3.9-3.9 1.5 1.5-3.9 3.9-1.5Z" />
    </svg>
  );
}

export function JournalIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} aria-hidden="true" {...props}>
      <path d="M6.25 4.25h10.5a1.5 1.5 0 0 1 1.5 1.5v14H7.75a2 2 0 0 1-2-2v-12a1.5 1.5 0 0 1 .5-1.12" />
      <path d="M8.75 4.25v15.5M11.75 8.25h3.5M11.75 11.25h3.5" />
    </svg>
  );
}

export function TasteIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} aria-hidden="true" {...props}>
      <path d="M18.7 5.3C15.4 2 9.4 3.4 6.1 6.8c-3.4 3.3-4.8 9.3-1.5 12.6 3.3 3.3 9.3 1.9 12.6-1.5 3.4-3.3 4.8-9.3 1.5-12.6Z" />
      <path d="M16.7 7.2c-1.4 1.1-2.4 2.5-3.1 4.2-.7 1.8-1.8 3.2-3.3 4.3a9 9 0 0 1-4.1 1.6" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} aria-hidden="true" {...props}>
      <circle cx="10.75" cy="10.75" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}
