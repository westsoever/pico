// Accounts are real only once a Supabase project is configured and sign-up calls auth.ts. Until then the live
// site must not promise sign-in, backups or "every device": everything stays on the phone.

interface Env { DEV?: boolean; VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }

/** Supabase config is present, so sign-in and backup can work. For the real wiring (NEXT.md step b). */
export const accountsLive = (env: Env) => Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

/**
 * Show the prototype's account screens and prompts: only in dev or with ?proto, where the fake flows stay reviewable.
 * Supabase config alone must not turn them on, because the prototype's sign-up is fake. Make this follow
 * accountsLive() only once the sign-up screen calls auth.ts.
 */
export const showAccounts = (env: Env, search: string) => Boolean(env.DEV) || new URLSearchParams(search).has('proto');

export const ACCOUNTS_LIVE = accountsLive(import.meta.env);
