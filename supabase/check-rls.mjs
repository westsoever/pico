// Runs supabase/migrations/0001_init.sql in PGlite with a stub of Supabase's auth schema and roles,
// then checks RLS with two accounts, last-write-wins, and the public community rating.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const sql = readFileSync(process.argv[2], 'utf8');
const db = new PGlite();
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`);
await db.exec(sql);
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
const ids = [A, B, '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d'];
for (const id of ids) await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, id.slice(-1) + '.person@example.com']);
ok((await db.query(`select count(*)::int n from public.profiles`)).rows[0].n === 4, 'profile row made for each new account');
const as = async (user, q, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'anon'};`);
  try { return await db.query(q, params); } finally { await db.exec('reset role'); }
};
const cup = (id, user, coffee, stars, t) => as(user,
  `insert into public.cups (id, user_id, coffee_id, stars, rated_at, client_updated_at) values ($1,$2,$3,$4,$5,$5)
   on conflict (id) do update set stars = excluded.stars, client_updated_at = excluded.client_updated_at`, [id, user, coffee, stars, t]);
await cup('a1', A, 'kenya', 5, '2026-11-15T10:00:00Z');
ok((await as(B, `select * from public.cups`)).rows.length === 0, 'B cannot read A\'s cups');
ok((await as(B, `update public.cups set note = 'hacked' where id = 'a1' returning id`)).rows.length === 0, 'B cannot update A\'s cup');
let err = null; try { await as(B, `insert into public.cups (id, user_id, coffee_id, stars, rated_at, client_updated_at) values ('b2', '${A}', 'kenya', 1, now(), now())`); } catch (e) { err = e.message; }
ok(/row-level security/.test(err ?? ''), 'B cannot insert a cup as A: ' + err);
err = null; try { await cup('a1', B, 'kenya', 1, '2026-11-16T10:00:00Z'); } catch (e) { err = e.message; }
ok(err !== null && (await as(A, `select stars from public.cups where id='a1'`)).rows[0].stars === 5, 'B cannot overwrite A\'s cup through an upsert on the same id');
err = null; try { await as(B, `delete from public.cups`); } catch (e) { err = e.message; }
ok((await as(A, `select count(*)::int n from public.cups`)).rows[0].n === 1, 'no hard delete (soft deletes only)');
await cup('a1', A, 'kenya', 2, '2026-11-15T09:00:00Z');
ok((await as(A, `select stars from public.cups where id='a1'`)).rows[0].stars === 5, 'older write is skipped (last write wins)');
await cup('a1', A, 'kenya', 4, '2026-11-15T12:00:00Z');
ok((await as(A, `select stars from public.cups where id='a1'`)).rows[0].stars === 4, 'newer write is applied');
await as(A, `insert into public.saved_coffees (user_id, coffee_id, saved_at, client_updated_at) values ($1, 'kenya', now(), now())`, [A]);
await as(B, `insert into public.saved_coffees (user_id, coffee_id, saved_at, client_updated_at) values ($1, 'kenya', now(), now())`, [B]);
ok(true, 'two users can save the same coffee (saved key is user + coffee)');
err = null; try { await as(null, `select * from public.cups`); } catch (e) { err = e.message; }
ok(/permission denied/.test(err ?? ''), 'signed-out visitor cannot read cups: ' + err);
await cup('b1', B, 'kenya', 3, '2026-11-15T10:00:00Z');
await cup('b2', B, 'kenya', 5, '2026-11-15T10:01:00Z');
ok((await as(null, `select * from public.community_ratings()`)).rows.length === 0, 'no community rating below 3 raters');
await cup('c1', ids[2], 'kenya', 4, '2026-11-15T10:00:00Z');
await cup('c2', ids[2], 'custom-x', 5, '2026-11-15T10:00:00Z');
await cup('d1', ids[3], 'kenya', 1, '2026-11-15T10:00:00Z');
await as(ids[3], `update public.cups set deleted_at = now(), client_updated_at = '2026-11-15T13:00:00Z' where id = 'd1'`);
const rows = (await as(null, `select * from public.community_ratings()`)).rows;
ok(rows.length === 1 && rows[0].coffee_id === 'kenya' && rows[0].raters === 3 && Number(rows[0].average) === 4.00,
  'community: 3 raters (A 4, B avg 4, C 4), deleted cup and custom coffee left out: ' + JSON.stringify(rows));
ok(Object.keys(rows[0]).join() === 'coffee_id,average,raters', 'community rating exposes no user ids');
