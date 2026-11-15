import { describe, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { connectAuth } from './auth';
import { createStore } from './store/store';
import { createSync } from './sync/engine';
import { createFakeRemote } from './sync/fake-remote';
import { memoryStorage } from './test-utils';

type Listener = (event: string, session: Session | null) => void;

function fakeClient() {
  let listener: Listener = () => {};
  const auth = {
    onAuthStateChange: (l: Listener) => { listener = l; return { data: { subscription: { unsubscribe: () => {} } } }; },
    signOut: vi.fn(async () => ({ error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
    verifyOtp: vi.fn(async () => ({ data: {}, error: null })),
  };
  return { client: { auth } as unknown as Pick<SupabaseClient, 'auth'>, auth, emit: (e: string, s: Session | null) => listener(e, s) };
}

const session = (id: string, email: string) =>
  ({ user: { id, email, user_metadata: {}, created_at: '2026-11-15T10:00:00Z' } }) as unknown as Session;

describe('auth', () => {
  it('signs the store in from a session, with a name from the email', () => {
    const store = createStore(memoryStorage());
    const { client, emit } = fakeClient();
    connectAuth(store, client);
    emit('SIGNED_IN', session('u1', 'lea.berg@example.com'));
    expect(store.getState().user).toMatchObject({ id: 'u1', displayName: 'Lea' });
  });

  it('keeps everything and asks to sign in again when the session expires on its own', () => {
    const store = createStore(memoryStorage());
    const { client, emit } = fakeClient();
    connectAuth(store, client);
    emit('SIGNED_IN', session('u1', 'lea@example.com'));
    store.addCup('fixture-kenya', 5);
    emit('SIGNED_OUT', null);
    expect(store.getState()).toMatchObject({ signInNeeded: true, user: { id: 'u1' } });
    expect(store.getState().cups).toHaveLength(1);
    emit('SIGNED_IN', session('u1', 'lea@example.com'));
    expect(store.getState().signInNeeded).toBe(false);
  });

  it('turns away a second account while the first has cups that are not backed up', () => {
    const store = createStore(memoryStorage());
    const { client, auth, emit } = fakeClient();
    const events: string[] = [];
    connectAuth(store, client, (e) => events.push(e.kind));
    emit('SIGNED_IN', session('u1', 'lea@example.com'));
    store.addCup('fixture-kenya', 5);
    emit('SIGNED_OUT', null);
    emit('SIGNED_IN', session('u2', 'ben@example.com'));
    expect(events).toEqual(['signed-in', 'conflict']);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(store.getState().user?.id).toBe('u1');
  });

  it('ends the session only after the cups are backed up', async () => {
    const remote = createFakeRemote();
    const store = createStore(memoryStorage());
    const sync = createSync(store, remote);
    const { client, auth, emit } = fakeClient();
    const a = connectAuth(store, client);
    emit('SIGNED_IN', session('u1', 'lea@example.com'));
    store.addCup('fixture-kenya', 5);
    remote.setOffline(true);
    expect(await a.signOut(sync)).toEqual({ ok: false, pending: 1 });
    expect(auth.signOut).not.toHaveBeenCalled();
    remote.setOffline(false);
    expect(await a.signOut(sync)).toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalledWith();
    emit('SIGNED_OUT', null); // our own sign-out: no "sign in again" prompt
    expect(store.getState()).toMatchObject({ user: null, signInNeeded: false, cups: [] });
  });

  it('comes back from Google on the route it left, without ?code in the address bar', async () => {
    const store = createStore(memoryStorage());
    const first = fakeClient();
    window.location.hash = '#/coffee/fixture-kenya';
    await connectAuth(store, first.client).signInWithGoogle();
    expect(first.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
    history.replaceState(null, '', '/v2.html?code=abc');
    connectAuth(store, fakeClient().client);
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#/coffee/fixture-kenya');
  });
});
