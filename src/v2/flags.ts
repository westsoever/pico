// Accounts are real only once a Supabase project is configured. Until then the live site must not promise
// sign-in, backups or "every device": everything stays on the phone.

interface Env { DEV?: boolean; VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }

/** Supabase config is present, so sign-in and backup can work. */
export const accountsLive = (env: Env) => Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

/** Show account screens and prompts: with real accounts, or in dev / with ?proto so the fake flows stay reviewable. */
export const showAccounts = (env: Env, search: string) =>
  accountsLive(env) || Boolean(env.DEV) || new URLSearchParams(search).has('proto');

export const ACCOUNTS_LIVE = accountsLive(import.meta.env);
