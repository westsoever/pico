import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout, type Tab } from './components/Layout';
import { ScanView } from './components/ScanView';
import { CoffeeDetail } from './components/CoffeeDetail';
import { RepertoireView } from './components/RepertoireView';
import { YouView } from './components/YouView';
import { removeCustomCoffee } from './lib/catalog';
import { saveRating } from './lib/storage';
import type { Rating } from './types/coffee';

interface AppRoute {
  tab: Tab;
  coffeeId: string | null;
}

interface Notice {
  message: string;
  tone: 'status' | 'error';
}

const tabPaths: Record<Tab, string> = {
  scan: 'discover',
  repertoire: 'journal',
  you: 'taste',
};

function parseRoute(): AppRoute {
  const path = window.location.hash.replace(/^#\/?/, '');
  const [section, coffeeId] = path.split('/');
  if (section === 'coffee' && coffeeId) {
    const from = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('from');
    const tab: Tab = from === 'journal' ? 'repertoire' : from === 'taste' ? 'you' : 'scan';
    try {
      return { tab, coffeeId: decodeURIComponent(coffeeId.split('?')[0]) };
    } catch {
      return { tab, coffeeId: null };
    }
  }
  if (section === 'journal') return { tab: 'repertoire', coffeeId: null };
  if (section === 'taste') return { tab: 'you', coffeeId: null };
  return { tab: 'scan', coffeeId: null };
}

function tabHash(tab: Tab) {
  return `#/${tabPaths[tab]}`;
}

function App() {
  const [route, setRoute] = useState<AppRoute>(parseRoute);
  const [pendingPhoto, setPendingPhoto] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [addRequestKey, setAddRequestKey] = useState<number | undefined>(undefined);
  const acceptedHash = useRef(window.location.hash || tabHash(route.tab));
  const acceptedHistoryState = useRef(window.history.state);
  const dirtyRef = useRef(false);
  const pendingCustomId = useRef<string | undefined>(undefined);
  const { tab: activeTab, coffeeId: selectedCoffeeId } = route;

  const reportDirty = useCallback((isDirty: boolean) => {
    dirtyRef.current = isDirty;
  }, []);

  const confirmDiscard = useCallback(
    () => !dirtyRef.current || window.confirm('Discard your unsaved rating?'),
    [],
  );

  const discardPendingCustom = useCallback(() => {
    if (!pendingCustomId.current) return;
    try {
      removeCustomCoffee(pendingCustomId.current);
    } catch {
      // Cleanup is best-effort; navigation should never fail because storage is unavailable.
    }
    pendingCustomId.current = undefined;
  }, []);

  const acceptRoute = useCallback((nextRoute: AppRoute) => {
    acceptedHash.current = window.location.hash || tabHash(nextRoute.tab);
    acceptedHistoryState.current = window.history.state;
    reportDirty(false);
    setRoute(nextRoute);
  }, [reportDirty]);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/discover`);
      acceptedHash.current = '#/discover';
      acceptedHistoryState.current = window.history.state;
    }

    const syncRoute = () => {
      if (window.location.hash === acceptedHash.current) return;
      if (!confirmDiscard()) {
        window.history.replaceState(
          acceptedHistoryState.current,
          '',
          `${window.location.pathname}${window.location.search}${acceptedHash.current}`,
        );
        return;
      }
      discardPendingCustom();
      setPendingPhoto(undefined);
      acceptRoute(parseRoute());
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, [acceptRoute, confirmDiscard, discardPendingCustom]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;
    main.scrollTop = 0;
    main.focus({ preventScroll: true });
  }, [route]);

  const navigate = (
    hash: string,
    options: { pendingPhoto?: string; replace?: boolean; detailFrom?: Tab } = {},
  ) => {
    if (hash === window.location.hash) return;
    if (!confirmDiscard()) return;
    if (selectedCoffeeId) discardPendingCustom();

    const nextState = options.detailFrom
      ? { ...window.history.state, picoDetailFrom: options.detailFrom }
      : { ...window.history.state, picoDetailFrom: undefined };
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    if (options.replace) {
      window.history.replaceState(nextState, '', url);
    } else {
      window.history.pushState(nextState, '', url);
    }
    setPendingPhoto(options.pendingPhoto);
    acceptRoute(parseRoute());
  };

  const navigateToTab = (tab: Tab) => {
    navigate(tabHash(tab));
  };

  const handleAddCoffee = () => {
    setAddRequestKey((key) => (key ?? 0) + 1);
    navigateToTab('scan');
  };

  const handleSelectCoffee = (
    coffeeId: string,
    photoDataUrl?: string,
    isNewCustom = false,
  ) => {
    if (selectedCoffeeId && selectedCoffeeId !== coffeeId) {
      discardPendingCustom();
    }
    if (isNewCustom) pendingCustomId.current = coffeeId;
    const from = tabPaths[activeTab];
    navigate(`#/coffee/${encodeURIComponent(coffeeId)}?from=${from}`, {
      pendingPhoto: photoDataUrl,
      detailFrom: activeTab,
    });
  };

  const handleBack = () => {
    if (!confirmDiscard()) return;
    reportDirty(false);
    discardPendingCustom();
    if (window.history.state?.picoDetailFrom === activeTab) {
      window.history.back();
      return;
    }
    navigate(tabHash(activeTab), { replace: true });
  };

  const handleSave = (rating: Omit<Rating, 'ratedAt'>) => {
    try {
      saveRating({ ...rating, ratedAt: new Date().toISOString() });
      pendingCustomId.current = undefined;
      setRefreshKey((k) => k + 1);
      setNotice({ message: 'Saved to your coffee journal.', tone: 'status' });
      reportDirty(false);
      navigate(tabHash('repertoire'));
      return true;
    } catch (error) {
      const storageFull =
        error instanceof DOMException &&
        (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      setNotice({
        message: storageFull
          ? 'Storage is full. Your draft is safe—remove the photo and save again.'
          : 'Could not save your rating. Your draft is still here—please try again.',
        tone: 'error',
      });
      return false;
    }
  };

  const content = selectedCoffeeId ? (
    <CoffeeDetail
      key={selectedCoffeeId}
      coffeeId={selectedCoffeeId}
      pendingPhoto={pendingPhoto}
      onSave={handleSave}
      onBack={handleBack}
      onDirtyChange={reportDirty}
      onSelectCoffee={(id) => {
        handleSelectCoffee(id);
      }}
    />
  ) : activeTab === 'scan' ? (
    <ScanView
      key="scan"
      onSelectCoffee={handleSelectCoffee}
      addRequestKey={addRequestKey}
    />
  ) : activeTab === 'repertoire' ? (
    <RepertoireView
      key="repertoire"
      onSelectCoffee={handleSelectCoffee}
      refreshKey={refreshKey}
      onDiscover={() => navigateToTab('scan')}
    />
  ) : (
    <YouView
      key="you"
      onSelectCoffee={handleSelectCoffee}
      refreshKey={refreshKey}
      onDiscover={() => navigateToTab('scan')}
      onAddCoffee={handleAddCoffee}
    />
  );

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={navigateToTab}
      title={selectedCoffeeId ? 'Coffee details' : undefined}
      subtitle={selectedCoffeeId ? 'Taste, rate, and remember this coffee' : undefined}
    >
      {content}
      {notice && (
        <div
          className="app-toast"
          data-tone={notice.tone}
          role={notice.tone === 'error' ? 'alert' : 'status'}
          aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
        >
          {notice.message}
        </div>
      )}
    </Layout>
  );
}

export default App;
