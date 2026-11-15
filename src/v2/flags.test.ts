import { describe, expect, it } from 'vitest';
import { accountsLive, showAccounts } from './flags';

const config = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'key' };

describe('account flag', () => {
  it('is live only with both Supabase values', () => {
    expect(accountsLive({})).toBe(false);
    expect(accountsLive({ VITE_SUPABASE_URL: config.VITE_SUPABASE_URL })).toBe(false);
    expect(accountsLive({ ...config, VITE_SUPABASE_ANON_KEY: '' })).toBe(false);
    expect(accountsLive(config)).toBe(true);
  });

  it('hides account screens on a production build without config, shows them in dev, with ?proto or when live', () => {
    expect(showAccounts({ DEV: false }, '')).toBe(false);
    expect(showAccounts({ DEV: false }, '?state=regular')).toBe(false);
    expect(showAccounts({ DEV: true }, '')).toBe(true);
    expect(showAccounts({ DEV: false }, '?proto')).toBe(true);
    expect(showAccounts({ DEV: false, ...config }, '')).toBe(true);
  });
});
