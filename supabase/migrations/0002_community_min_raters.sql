-- The community rating threshold in one named place (same number in the app: MIN_COMMUNITY_RATERS in
-- src/v2/store/state.ts). Raise to 5 once Pico has 100 users (owner, 2026-11-15): on a live project that is a
-- new migration doing `create or replace function public.community_min_raters()` with the new number.

create function public.community_min_raters()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3 $$;

grant execute on function public.community_min_raters() to anon, authenticated;

-- Same as in 0001, with the threshold read from community_min_raters() instead of a literal.
create or replace function public.community_ratings()
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
  having count(*) >= public.community_min_raters();
$$;
