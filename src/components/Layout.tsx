import type { ComponentType, ReactNode } from 'react';
import {
  DiscoverIcon,
  JournalIcon,
  PicoMark,
  TasteIcon,
  type IconProps,
} from './ui/Icons';

export type Tab = 'scan' | 'repertoire' | 'you';

export interface LayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

const tabs: { id: Tab; label: string; icon: ComponentType<IconProps> }[] = [
  { id: 'scan', label: 'Discover', icon: DiscoverIcon },
  { id: 'repertoire', label: 'Journal', icon: JournalIcon },
  { id: 'you', label: 'Taste', icon: TasteIcon },
];

/** App frame only: each view renders its own page heading. */
export function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand" aria-label="Pico">
          <PicoMark />
          <span className="app-brand__name" aria-hidden="true">Pico</span>
        </div>
      </header>

      <nav className="app-nav" aria-label="Primary navigation">
        <div className="app-nav__items">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className="app-nav__item"
                data-active={isActive || undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="app-nav__icon">
                  <Icon />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="app-main" id="main-content" tabIndex={-1}>
        <div className="app-main__inner">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
