import { describe, expect, it, vi } from 'vitest';
import minRatersSql from '../../../supabase/migrations/0002_community_min_raters.sql?raw';
import { MIN_COMMUNITY_RATERS } from '../store/state';
import { AccountConflictError, createStore } from '../store/store';
import { memoryStorage, userA, userB } from '../test-utils';
import { createSync } from './engine';
import { createFakeRemote } from './fake-remote';

function phone(remote: ReturnType<typeof createFakeRemote>, user = userA) {
  const store = createStore(memoryStorage());
  store.setUser(user);
  return { store, sync: createSync(store, remote) };
}

describe('sync engine', () => {
  it('moves a cup from one phone to another and clears the outbox', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    const b = phone(remote);
    const cup = a.store.addCup('fixture-kenya', 5);
    await a.sync();
    expect(a.store.getState().outbox).toEqual([]);
    await b.sync();
    expect(b.store.getState().cups).toEqual([cup]);
  });

  it('carries a delete to the other phone', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    const b = phone(remote);
    const cup = a.store.addCup('fixture-kenya', 5);
    await a.sync();
    await b.sync();
    b.store.deleteCup(cup.id);
    await b.sync();
    await a.sync();
    expect(a.store.getState().cups).toEqual([]);
  });

  it('keeps the newer edit when two phones change the same cup', async () => {
    vi.useFakeTimers();
    try {
      const remote = createFakeRemote();
      const a = phone(remote);
      const b = phone(remote);
      vi.setSystemTime(new Date('2026-11-15T10:00:00Z'));
      const cup = a.store.addCup('fixture-kenya', 3);
      await a.sync();
      await b.sync();
      vi.setSystemTime(new Date('2026-11-15T10:05:00Z'));
      a.store.updateCup(cup.id, { note: 'older edit' });
      vi.setSystemTime(new Date('2026-11-15T10:06:00Z'));
      b.store.updateCup(cup.id, { note: 'newer edit' });
      await b.sync(); // the newer edit reaches the server first
      await a.sync(); // the older one is refused by the server and replaced on pull
      await b.sync();
      expect(a.store.getState().cups[0].note).toBe('newer edit');
      expect(b.store.getState().cups[0].note).toBe('newer edit');
      expect(a.store.getState().outbox).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps writes made offline and sends them once back online, without duplicates', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    a.store.addCup('fixture-kenya', 4);
    remote.setOffline(true);
    await expect(a.sync()).rejects.toThrow('offline');
    expect(a.store.getState().outbox).toHaveLength(1);
    remote.setOffline(false);
    await a.sync();
    await a.sync();
    expect(a.store.getState().outbox).toEqual([]);
    expect(remote.all()).toHaveLength(1);
  });

  it('keeps a row queued when it changes again while being pushed', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    const cup = a.store.addCup('fixture-kenya', 4);
    const push = remote.push;
    remote.push = async (userId, changes) => {
      await push(userId, changes);
      a.store.updateCup(cup.id, { note: 'typed during the push' });
    };
    await a.sync();
    remote.push = push;
    expect(a.store.getState().outbox).toEqual([{ table: 'cups', id: cup.id }]);
    await a.sync();
    expect(remote.all()[0]).toMatchObject({ note: 'typed during the push' });
  });

  it('merges cups saved signed out into an existing account on sign-in', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    const old = a.store.addCup('fixture-kenya', 5);
    await a.sync();
    const fresh = createStore(memoryStorage());
    const local = fresh.addCup('fixture-ethiopia', 4);
    fresh.setUser(userA);
    await createSync(fresh, remote)();
    expect(fresh.getState().cups.map((c) => c.id).sort()).toEqual([old.id, local.id].sort());
    await a.sync();
    expect(a.store.getState().cups).toHaveLength(2);
  });

  it('signs out only after everything is on the server, then clears the phone for the next person', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    a.store.addCup('fixture-kenya', 5);
    a.store.setState({ seenWelcome: true, tasteSeed: { flavors: ['fruity'], roasts: [] } });
    expect(await a.store.signOut(a.sync)).toEqual({ ok: true });
    const s = a.store.getState();
    expect(s).toMatchObject({ user: null, cups: [], saved: [], outbox: [], tasteSeed: null, lastPulledAt: null, seenWelcome: true });
    a.store.setUser(userB);
    await a.sync();
    expect(a.store.getState().cups).toEqual([]);
  });

  it('keeps the data and stays signed in when sign-out cannot reach the server', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    a.store.addCup('fixture-kenya', 5);
    remote.setOffline(true);
    expect(await a.store.signOut(a.sync)).toEqual({ ok: false, pending: 1 });
    expect(a.store.getState()).toMatchObject({ user: userA });
    expect(a.store.getState().cups).toHaveLength(1);
  });

  it('refuses rows that belong to another user, like row-level security', async () => {
    const remote = createFakeRemote();
    const b = phone(remote, userB);
    const cup = b.store.addCup('fixture-kenya', 5);
    await expect(remote.push(userA.id, { cups: [cup], saved: [], userCoffees: [] })).rejects.toThrow(/not your row/);
    await b.sync();
    expect((await remote.pull(userA.id, null)).changes.cups).toEqual([]);
  });
});

describe('session loss and a second account', () => {
  it('keeps the data and pauses sync when the session runs out, until the same account signs in again', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    a.store.addCup('fixture-kenya', 5);
    a.store.markSignInNeeded();
    await a.sync();
    expect(remote.all()).toEqual([]);
    expect(a.store.getState()).toMatchObject({ signInNeeded: true, user: userA });
    a.store.setUser(userA); // same account: no "sign out first", sync resumes
    await a.sync();
    expect(remote.all()).toHaveLength(1);
    expect(a.store.getState().signInNeeded).toBe(false);
  });

  it('refuses another account while the first one has cups that are not backed up, and keeps them', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    a.store.addCup('fixture-kenya', 5);
    a.store.markSignInNeeded();
    expect(() => a.store.setUser(userB)).toThrow(AccountConflictError);
    expect(a.store.getState()).toMatchObject({ user: userA });
    expect(a.store.getState().cups).toHaveLength(1);
  });

  it('lets another account in once the first is fully backed up, without merging', async () => {
    const remote = createFakeRemote();
    const a = phone(remote);
    a.store.addCup('fixture-kenya', 5);
    await a.sync();
    a.store.setUser(userB);
    await a.sync();
    expect(a.store.getState()).toMatchObject({ user: userB, cups: [] });
    expect((await remote.pull(userB.id, null)).changes.cups).toEqual([]);
  });
});

describe('community ratings', () => {
  it('shows a rating only from MIN_COMMUNITY_RATERS raters, the same number the SQL uses', async () => {
    const remote = createFakeRemote({
      'fixture-kenya': { average: 4, count: MIN_COMMUNITY_RATERS },
      'fixture-ethiopia': { average: 5, count: MIN_COMMUNITY_RATERS - 1 },
    });
    const store = createStore(memoryStorage());
    await createSync(store, remote)();
    expect(store.communityRating('fixture-kenya')).toEqual({ average: 4, count: MIN_COMMUNITY_RATERS });
    expect(store.communityRating('fixture-ethiopia')).toBeNull();
    expect(minRatersSql).toContain(`as $$ select ${MIN_COMMUNITY_RATERS} $$;`);
  });

  it('fetches them signed out, keeps them offline and after sign-out, never for hand-added coffees', async () => {
    const remote = createFakeRemote({ 'fixture-kenya': { average: 4.3, count: 12 } });
    const store = createStore(memoryStorage());
    const sync = createSync(store, remote);
    await sync();
    expect(store.communityRating('fixture-kenya')).toEqual({ average: 4.3, count: 12 });
    expect(store.communityRating('fixture-brazil')).toBeNull();
    expect(store.communityRating('custom-1')).toBeNull();
    remote.setOffline(true);
    await expect(sync()).rejects.toThrow('offline');
    expect(store.communityRating('fixture-kenya')).toEqual({ average: 4.3, count: 12 });
    remote.setOffline(false);
    store.setUser(userA);
    await store.signOut(sync);
    expect(store.communityRating('fixture-kenya')).toEqual({ average: 4.3, count: 12 });
  });
});
