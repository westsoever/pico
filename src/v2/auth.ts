// Sign-in for v2: Google (PKCE redirect) or an email one-time code. No passwords.
// auth.ts owns the Supabase session; the store only hears setUser / markSignInNeeded / signOut.
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { AccountConflictError, type SignOutResult, type Store } from './store/store';
import type { User } from './store/state';

const RETURN_KEY = 'pico-auth-return';

type AuthClient = Pick<SupabaseClient, 'auth'>;

export type AuthEvent =
  | { kind: 'signed-in'; user: User }
  /** Someone else signed in while this phone holds another account's cups that aren't backed up. */
  | { kind: 'conflict'; error: AccountConflictError };

export function userFromSession(session: Session): User {
  const u = session.user;
  const meta = u.user_metadata ?? {};
  const fromEmail = (u.email ?? '').split('@')[0].split(/[._-]/)[0];
  return {
    id: u.id,
    displayName: meta.full_name || meta.name || (fromEmail ? fromEmail[0].toUpperCase() + fromEmail.slice(1) : 'Coffee friend'),
    createdAt: u.created_at,
  };
}

/**
 * Wires the Supabase session to the store. Call once at start, after `await client.auth.getSession()`,
 * so supabase-js has already exchanged a returning Google ?code before this strips it from the address bar.
 */
export function connectAuth(store: Store, client: AuthClient, onEvent: (e: AuthEvent) => void = () => {}) {
  let signingOut = false;
  restoreRoute();

  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (session) {
      const user = userFromSession(session);
      try {
        store.setUser(user);
        onEvent({ kind: 'signed-in', user });
      } catch (e) {
        if (!(e instanceof AccountConflictError)) throw e;
        // Never merge two people's cups. Drop the new session; the screen offers "sign in as <name>" or,
        // after an explicit confirm, store.discardAccount() and then this account.
        void client.auth.signOut({ scope: 'local' });
        onEvent({ kind: 'conflict', error: e });
      }
    } else if (event === 'SIGNED_OUT' && !signingOut && store.getState().user) {
      // Not our sign-out: the session expired or its refresh failed. Keep everything, ask to sign in again.
      store.markSignInNeeded();
    }
  });

  return {
    stop: () => data.subscription.unsubscribe(),

    /** Google: leaves the page and comes back with ?code=…; the current #/route is restored afterwards. */
    async signInWithGoogle() {
      try { sessionStorage.setItem(RETURN_KEY, window.location.hash); } catch { /* private mode: lands on the start screen */ }
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
    },

    /** Email step 1: sends the 6-digit code (the Magic Link email template must show {{ .Token }}). */
    async sendEmailCode(email: string) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
    },

    /** Email step 2: no redirect at all, so hash routing is never involved. */
    async verifyEmailCode(email: string, code: string) {
      const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw error;
    },

    /** Backs up first; only a clean push ends the session and clears this phone (see store.signOut). */
    async signOut(sync: () => Promise<void>): Promise<SignOutResult> {
      signingOut = true;
      try {
        const result = await store.signOut(sync);
        if (result.ok) await client.auth.signOut();
        return result;
      } finally {
        signingOut = false;
      }
    },
  };
}

/** After the Google round trip: drop ?code from the address bar and go back to the route the person left from. */
function restoreRoute() {
  let hash: string | null = null;
  try {
    hash = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch { /* nothing saved */ }
  const url = new URL(window.location.href);
  if (!url.searchParams.has('code') && hash === null) return;
  url.searchParams.delete('code');
  history.replaceState(null, '', url.pathname + url.search + (hash || url.hash));
}
