// Dev-only v2 entry (v2.html, not in the production build). Boots the real store, sync and sign-in;
// the screens move here from prototype/ once their design is settled. v1 (index.html, src/main.tsx) is untouched.
import { connectAuth } from './auth';
import { createStore } from './store/store';
import { createSync, startAutoSync } from './sync/engine';
import { createFakeRemote } from './sync/fake-remote';
import { createSupabaseRemote, loadSupabase } from './sync/supabase-remote';

const store = createStore();
const client = await loadSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
// No project configured: an in-memory server stands in, so everything runs on the phone alone.
const remote = client ? createSupabaseRemote(client) : createFakeRemote();
const sync = createSync(store, remote);
let auth: ReturnType<typeof connectAuth> | null = null;
if (client) {
  await client.auth.getSession(); // lets supabase-js finish a returning Google ?code exchange first
  auth = connectAuth(store, client, (e) => { if (e.kind === 'conflict') console.warn(e.error.message); });
}
startAutoSync(store, sync);

// Until the screens land: a one-line status, and handles for checking things in the console.
const status = document.getElementById('status')!;
const render = () => {
  const s = store.getState();
  status.textContent = `${client ? 'Supabase' : 'Phone only (no Supabase config)'} · ${s.user ? `signed in as ${s.user.displayName}` : 'signed out'}`
    + ` · ${s.cups.length} cups · ${s.outbox.length} waiting to sync${s.signInNeeded ? ' · sign in again to back up your cups' : ''}${s.saveFailed ? ' · couldn’t save on this phone' : ''}`;
};
store.subscribe(render);
render();
Object.assign(window, { pico: { store, sync, auth }, supabase: client });
