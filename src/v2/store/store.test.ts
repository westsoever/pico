import { describe, expect, it } from 'vitest';
import { memoryStorage, userA, userB } from '../test-utils';
import { LOCAL_USER_ID, PROTOTYPE_KEY, STORAGE_KEY } from './state';
import { FREE_SCANS, createStore, currentProfile } from './store';

describe('v2 store', () => {
  it('saves cups signed out on the phone, queued for later', () => {
    const store = createStore(memoryStorage());
    const cup = store.addCup('fixture-ethiopia', 5);
    const s = store.getState();
    expect(s.cups).toEqual([cup]);
    expect(cup.userId).toBe(LOCAL_USER_ID);
    expect(cup.flavorTags).toEqual(['floral', 'citrus', 'bright', 'fruity']); // the coffee's own tags by default
    expect(s.outbox).toEqual([{ table: 'cups', id: cup.id }]);
    expect(currentProfile(s)).not.toBeNull();
    expect(store.pending().entries).toEqual([]); // local rows wait for sign-in
  });

  it('edits a cup and soft-deletes it: hidden from screens, kept as a tombstone for sync', () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    const cup = store.addCup('fixture-kenya', 3);
    store.updateCup(cup.id, { stars: 4, note: 'Better as a V60', brew: { method: 'pour-over' } });
    expect(store.getState().cups[0]).toMatchObject({ stars: 4, note: 'Better as a V60', brew: { method: 'pour-over' } });
    store.deleteCup(cup.id);
    expect(store.getState().cups).toEqual([]);
    const reloaded = createStore(storage);
    expect(reloaded.getState().cups).toEqual([]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).cups[0].deletedAt).toBeTruthy();
    expect(reloaded.getState().outbox).toEqual([{ table: 'cups', id: cup.id }]);
  });

  it('moves signed-out cups into the account on sign-in, and refuses a second account', () => {
    const store = createStore(memoryStorage());
    const cup = store.addCup('fixture-ethiopia', 4);
    store.setUser(userA);
    expect(store.getState().cups[0]).toMatchObject({ id: cup.id, userId: userA.id });
    expect(store.pending().entries.map((e) => e.id)).toEqual([cup.id]);
    expect(store.addCup('fixture-kenya', 5).userId).toBe(userA.id);
    expect(() => store.setUser(userB)).toThrow(/sign out first/);
  });

  it('drops a coffee from Saved when its first cup is logged', () => {
    const store = createStore(memoryStorage());
    store.setUser(userA);
    store.toggleSaved('fixture-kenya');
    expect(store.isSaved('fixture-kenya')).toBe(true);
    store.addCup('fixture-kenya', 4);
    expect(store.isSaved('fixture-kenya')).toBe(false);
    store.toggleSaved('fixture-kenya');
    expect(store.isSaved('fixture-kenya')).toBe(true); // saving again revives the tombstone
  });

  it('allows 5 free scans signed out and unlimited signed in', () => {
    const store = createStore(memoryStorage());
    for (let i = 0; i < FREE_SCANS; i++) expect(store.spendScan()).toBe(true);
    expect(store.spendScan()).toBe(false);
    store.setUser(userA);
    expect(store.spendScan()).toBe(true);
  });

  it('migrates prototype data as signed-out rows, ready to sync', () => {
    const proto = {
      user: { id: 'demo-user', displayName: 'Lea', createdAt: '2026-08-01T09:00:00Z' },
      cups: [{ id: 'c1', userId: 'demo-user', coffeeId: 'fixture-kenya', stars: 4, flavorTags: ['berry'], note: '', ratedAt: '2026-11-01T08:00:00Z' }],
      saved: [{ userId: 'demo-user', coffeeId: 'fixture-brazil', savedAt: '2026-11-02T08:00:00Z' }],
      scansUsed: 2, seenWelcome: true, tasteSeed: { flavors: ['fruity'], roasts: ['light'] }, v1Imported: false,
    };
    const s = createStore(memoryStorage({ [PROTOTYPE_KEY]: JSON.stringify(proto) })).getState();
    expect(s.user).toBeNull();
    expect(s.cups[0]).toMatchObject({ id: 'c1', userId: LOCAL_USER_ID, updatedAt: '2026-11-01T08:00:00Z' });
    expect(s.saved[0]).toMatchObject({ id: 'fixture-brazil', coffeeId: 'fixture-brazil', userId: LOCAL_USER_ID });
    expect(s).toMatchObject({ scansUsed: 2, seenWelcome: true, tasteSeed: proto.tasteSeed });
    expect(s.outbox).toEqual([{ table: 'cups', id: 'c1' }, { table: 'saved', id: 'fixture-brazil' }]);
  });

  it('takes the state another tab saved, so two tabs do not overwrite each other', () => {
    const tab1 = createStore(localStorage);
    const tab2 = createStore(localStorage);
    const cup = tab2.addCup('fixture-kenya', 5);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, storageArea: localStorage }));
    expect(tab1.getState().cups).toEqual([cup]);
    tab1.addCup('fixture-ethiopia', 4); // builds on tab2's cup instead of dropping it
    expect(createStore(localStorage).getState().cups).toHaveLength(2);
  });

  it('drops outbox entries whose row is gone, so the outbox can drain', () => {
    const store = createStore(memoryStorage());
    store.setUser(userA);
    const cup = store.addCup('fixture-kenya', 5);
    store.replaceState({ ...store.getState(), cups: [], outbox: [{ table: 'cups', id: cup.id }] });
    expect(store.pending().entries).toEqual([]);
    expect(store.getState().outbox).toEqual([]);
  });

  it('keeps working in memory and flags it when the phone refuses to save', () => {
    const storage = memoryStorage();
    storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    const store = createStore(storage);
    const cup = store.addCup('fixture-kenya', 5);
    expect(store.getState().cups).toEqual([cup]);
    expect(store.getState().saveFailed).toBe(true);
  });

  it('imports the v1 journal and hand-added coffees once', () => {
    const custom = { id: 'custom-1', name: 'Home roast', roaster: 'Me', origin: 'Peru', process: 'washed', roastLevel: 'medium', flavorTags: ['nutty'], description: '', isCustom: true };
    localStorage.setItem('pico-custom-coffees', JSON.stringify([custom]));
    const storage = memoryStorage({
      'pico-user-data': JSON.stringify({ ratings: [{ coffeeId: 'fixture-kenya', stars: 5, flavorTags: ['berry'], note: 'v1', ratedAt: '2026-06-01T08:00:00Z' }] }),
    });
    const store = createStore(storage);
    store.setUser(userA);
    store.importV1(store.readV1Ratings());
    store.importV1(store.readV1Ratings());
    const s = store.getState();
    expect(s.cups).toHaveLength(1);
    expect(s.cups[0]).toMatchObject({ userId: userA.id, stars: 5, note: 'v1', ratedAt: '2026-06-01T08:00:00Z' });
    expect(s.userCoffees).toHaveLength(1);
    expect(s.userCoffees[0]).toMatchObject({ id: 'custom-1', userId: userA.id, sentToPico: false });
    expect(s.v1Imported).toBe(true);
  });
});
