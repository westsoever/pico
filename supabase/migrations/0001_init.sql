-- Pico v2: personal data (cups, saved coffees, hand-added coffees) and the public community rating.
-- Shapes follow DATA-MODEL.md and src/v2/store/state.ts. Not applied anywhere yet: no Supabase project exists.
--
-- Sync rules the app relies on (src/v2/sync):
--   * Row ids are made on the phone, so a retried push never duplicates.
--   * Last write wins per row on the phone's `client_updated_at`; the trigger below drops older writes.
--   * Deletes are soft (`deleted_at`), so other phones learn about them. There is no DELETE policy.
--   * Phones pull rows with `updated_at` (server time) after their last cursor.

-- ---------- Profiles ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- A profile row for every new account; the name defaults to the part of the email before the @.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Personal rows ----------

create table public.cups (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coffee_id text not null,                    -- catalog id or a user_coffees id ("custom-…")
  stars smallint not null check (stars between 1 and 5),
  flavor_tags text[] not null default '{}',
  note text not null default '',
  brew jsonb,                                 -- BrewJournal, as in v1
  rated_at timestamptz not null,
  client_updated_at timestamptz not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.saved_coffees (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coffee_id text not null,                    -- also the row id on the phone: one row per user and coffee
  saved_at timestamptz not null,
  client_updated_at timestamptz not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, coffee_id)
);

create table public.user_coffees (
  id text primary key check (id like 'custom-%'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coffee jsonb not null,                      -- the Coffee fields (name, roaster, origin, …), roaster as free text
  sent_to_pico boolean not null default false,
  client_updated_at timestamptz not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index cups_pull on public.cups (user_id, updated_at);
create index saved_coffees_pull on public.saved_coffees (user_id, updated_at);
create index user_coffees_pull on public.user_coffees (user_id, updated_at);
create index cups_community on public.cups (coffee_id, user_id) where deleted_at is null;

-- Last write wins: an update older than (or as old as) the stored row is skipped, so a phone that comes
-- back online with stale edits can't overwrite newer ones. Accepted writes get a fresh server cursor.
-- shortcut: `updated_at` is the transaction's start time, so a long transaction can commit with a cursor
-- older than one a phone already pulled; the client pulls with a few seconds of overlap (merging is idempotent).
create function public.last_write_wins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.client_updated_at <= old.client_updated_at then
    return null; -- skip this row; the newer version stays
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger cups_lww before insert or update on public.cups
  for each row execute function public.last_write_wins();
create trigger saved_coffees_lww before insert or update on public.saved_coffees
  for each row execute function public.last_write_wins();
create trigger user_coffees_lww before insert or update on public.user_coffees
  for each row execute function public.last_write_wins();

-- ---------- Row-level security: each person sees and writes only their own rows ----------

alter table public.profiles enable row level security;
alter table public.cups enable row level security;
alter table public.saved_coffees enable row level security;
alter table public.user_coffees enable row level security;

-- Signed-out visitors get nothing from these tables (they only use community_ratings() below).
revoke all on public.profiles, public.cups, public.saved_coffees, public.user_coffees from anon;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "cups: read own" on public.cups
  for select to authenticated using (user_id = (select auth.uid()));
create policy "cups: insert own" on public.cups
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "cups: update own" on public.cups
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "saved: read own" on public.saved_coffees
  for select to authenticated using (user_id = (select auth.uid()));
create policy "saved: insert own" on public.saved_coffees
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "saved: update own" on public.saved_coffees
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "user coffees: read own" on public.user_coffees
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user coffees: insert own" on public.user_coffees
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user coffees: update own" on public.user_coffees
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- Community rating (public) ----------

-- Per catalog coffee: how many people rated it and the mean of each person's own average.
-- Runs as the owner so it can read all cups, but returns only these three numbers: no user ids, no single cups,
-- and nothing below 3 raters. Hand-added coffees are private and never included.
create function public.community_ratings()
returns table (coffee_id text, average numeric, raters integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.coffee_id, round(avg(r.own_average), 2), count(*)::integer
  from (
    select c.coffee_id, c.user_id, avg(c.stars) as own_average
    from public.cups c
    where c.deleted_at is null and c.coffee_id not like 'custom-%'
    group by c.coffee_id, c.user_id
  ) r
  group by r.coffee_id
  having count(*) >= 3;
$$;

revoke all on function public.community_ratings() from public;
grant execute on function public.community_ratings() to anon, authenticated;
