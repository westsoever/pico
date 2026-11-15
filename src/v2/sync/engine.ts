import type { Store } from '../store/store';
import type { Remote } from './remote';

/**
 * One sync pass: push the outbox, then pull what changed on the server since the last pull.
 * Calls made while a pass runs share one follow-up pass, so writes during a sync are never skipped.
 */
export function createSync(store: Store, remote: Remote) {
  let running: Promise<void> | null = null;
  let again = false;

  async function pass() {
    const user = store.getState().user;
    if (!user) return;
    const { entries, changes } = store.pending();
    if (entries.length > 0) {
      await remote.push(user.id, changes);
      store.confirmPushed(entries);
    }
    const { changes: incoming, cursor } = await remote.pull(user.id, store.getState().lastPulledAt);
    store.applyRemote(incoming, cursor);
  }

  return function sync(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await pass();
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  };
}

/**
 * Background sync in the app: on start, when the tab comes back, when the phone gets online,
 * and 2 s after a write. Failures just wait for the next trigger; the outbox keeps the rows.
 */
export function startAutoSync(store: Store, sync: () => Promise<void>, delayMs = 2000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => { sync().catch(() => { /* offline: retried on the next trigger */ }); };
  const onVisible = () => { if (document.visibilityState === 'visible') run(); };
  const unsubscribe = store.subscribe(() => {
    if (store.getState().outbox.length === 0) return;
    clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  });
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);
  run();
  return () => {
    clearTimeout(timer);
    unsubscribe();
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
