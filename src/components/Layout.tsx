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
  /** Overrides the active section name in the page header. */
  title?: string;
  /** Adds supporting context below the page title. */
  subtitle?: string;
  /** Optional control rendered alongside the contextual title. */
  headerAction?: ReactNode;
}

const tabs: {
  id: Tab;
  label: string;
  description: string;
  icon: ComponentType<IconProps>;
}[] = [
  {
    id: 'scan',
    label: 'Discover',
    description: 'Find a coffee worth remembering',
    icon: DiscoverIcon,
  },
  {
    id: 'repertoire',
    label: 'Journal',
    description: 'Your coffees, notes, and ratings',
    icon: JournalIcon,
  },
  {
    id: 'you',
    label: 'Taste',
    description: 'A clearer picture of what you enjoy',
    icon: TasteIcon,
  },
];

export function Layout({
  activeTab,
  onTabChange,
  children,
  title,
  subtitle,
  headerAction,
}: LayoutProps) {
  const activeSection = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand" aria-label="Pico">
          <span className="app-brand__mark">
            <PicoMark />
          </span>
          <span className="app-brand__name">Pico</span>
        </div>

        <div className="app-heading">
          <div className="app-heading__copy">
            <h1>{title ?? activeSection.label}</h1>
            <p>{subtitle ?? activeSection.description}</p>
          </div>
          {headerAction ? <div className="app-heading__action">{headerAction}</div> : null}
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
