// Pico's own icon style (stroke 1.8, 24 grid), inline so the prototype needs no icon library.
import type { ReactNode } from 'react';

const Svg = ({ children, size = 22, fill = 'none' }: { children: ReactNode; size?: number; fill?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const DiscoverIcon = () => <Svg><circle cx="12" cy="12" r="8.25" /><path d="m14.7 9.3-1.5 3.9-3.9 1.5 1.5-3.9 3.9-1.5Z" /></Svg>;
export const JournalIcon = () => <Svg><path d="M6.25 4.25h10.5a1.5 1.5 0 0 1 1.5 1.5v14H7.75a2 2 0 0 1-2-2v-12a1.5 1.5 0 0 1 .5-1.12" /><path d="M8.75 4.25v15.5M11.75 8.25h3.5M11.75 11.25h3.5" /></Svg>;
export const TasteIcon = () => <Svg><path d="M4.75 9.25h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-4.5Z" /><path d="M15.75 10.25h1.5a2.5 2.5 0 0 1 0 5h-1.9M8.75 3.75c-.6.8-.6 1.7 0 2.5M12.25 3.75c-.6.8-.6 1.7 0 2.5" /></Svg>;
export const SearchIcon = () => <Svg><circle cx="10.75" cy="10.75" r="6.5" /><path d="m15.5 15.5 4 4" /></Svg>;
export const CameraIcon = ({ size = 26 }: { size?: number }) => <Svg size={size}><path d="M4.25 8.25a1.5 1.5 0 0 1 1.5-1.5h2.1l1.4-2h5.5l1.4 2h2.1a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5.75a1.5 1.5 0 0 1-1.5-1.5v-9.5Z" /><circle cx="12" cy="13" r="3.5" /></Svg>;
export const BackIcon = () => <Svg><path d="m14.5 5.5-6.5 6.5 6.5 6.5" /></Svg>;
export const CloseIcon = () => <Svg><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const ArrowUpRight = ({ size = 22 }: { size?: number }) => <Svg size={size}><path d="M7 17 17 7M8.5 7H17v8.5" /></Svg>;
export const CheckIcon = () => <Svg size={20}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const ShareIcon = () => <Svg><path d="M12 3.75v11M8 7.5l4-3.75 4 3.75M6.75 11.25H5.5v8.5h13v-8.5h-1.25" /></Svg>;
export const ChevronRight = () => <Svg size={18}><path d="m9.5 6 6 6-6 6" /></Svg>;
export const PlusIcon = () => <Svg size={20}><path d="M12 5v14M5 12h14" /></Svg>;
export const SparkIcon = () => <Svg size={18}><path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8L12 3.5Z" /></Svg>;

export const Star = ({ size = 14, on = true }: { size?: number; on?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path
      d="m12 3.2 2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.8l-5.4 3 1.2-6.1-4.5-4.2 6.1-.7L12 3.2Z"
      fill={on ? 'currentColor' : 'rgba(17,20,24,.14)'}
    />
  </svg>
);

export const StarOutline = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden>
    <path d="m12 3.2 2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.8l-5.4 3 1.2-6.1-4.5-4.2 6.1-.7L12 3.2Z" />
  </svg>
);
export const PersonIcon = () => <Svg><circle cx="12" cy="8.5" r="3.75" /><path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" /></Svg>;
export const BookmarkIcon = ({ on = false }: { on?: boolean }) => <Svg fill={on ? 'currentColor' : 'none'}><path d="M6.75 4.25h10.5v15.5L12 15.9l-5.25 3.85V4.25Z" /></Svg>;
