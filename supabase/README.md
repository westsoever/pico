# Supabase for Pico v2

`migrations/0001_init.sql` is the whole schema: profiles, cups, saved coffees, hand-added coffees, row-level
security, the last-write-wins trigger, and the public `community_ratings()` function. **It has not been applied
anywhere: no Supabase project exists yet.** The app runs fully on the phone (and an in-memory fake server in
tests) until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.

## Check it without a project (no Docker needed)

`check-rls.mjs` runs the migration in PGlite (Postgres compiled to WebAssembly) with a stub of Supabase's
`auth` schema and the `anon` / `authenticated` roles, then checks two accounts against each other:

```sh
mkdir -p /tmp/pico-pg && cd /tmp/pico-pg && npm init -y >/dev/null && npm i @electric-sql/pglite@0.2.17
cp <repo>/supabase/check-rls.mjs . && node check-rls.mjs <repo>/supabase/migrations/0001_init.sql
```

All 13 lines should say PASS: B can't read, update, overwrite or insert-as A; no hard deletes; older writes are
skipped; signed-out visitors can't read cups; community rating needs 3 raters, skips deleted cups and
hand-added coffees, and exposes no user ids. It is a stand-in: Supabase's real `auth.uid()` reads the JWT.

## The day a project exists (owner)

1. Create the project (EU region). Apply the migration in the SQL editor or with `supabase db push` from a linked folder.
2. Auth → Providers: enable Email (one-time code) and Google (web OAuth client from Google Cloud; its redirect URI
   is the one Supabase shows on the Google provider page). Auth → URL configuration: add the v2 entry URL to the
   redirect allow list.
3. Auth → Email templates → Magic Link: include `{{ .Token }}` so the email shows the 6-digit code.
4. Auth → SMTP: set a custom sender (Resend, Postmark, …) before anyone outside the team signs in. Supabase's
   built-in sender only mails organization members, at 2 emails per hour, and new Free-plan projects can't edit
   email templates on it, so step 3 needs custom SMTP too. Custom SMTP starts at 30 emails per hour (raise it under
   Auth → Rate Limits). Sources: https://supabase.com/docs/guides/auth/auth-smtp,
   https://supabase.com/docs/guides/auth/rate-limits
5. Put the project URL and anon key in `.env.local` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
6. Two-account check on the real project, in the browser console of the v2 entry (or two private windows):
   - Sign in as A, rate a coffee, wait for sync. Sign in as B in the other window.
   - As B: `await supabase.from('cups').select()` returns only B's cups;
     `await supabase.from('cups').update({ note: 'x' }).eq('id', '<A cup id>').select()` returns `[]`;
     inserting a cup with `user_id: '<A id>'` fails with a row-level security error.
   - Signed out: `await supabase.from('cups').select()` fails; `await supabase.rpc('community_ratings')` works.
