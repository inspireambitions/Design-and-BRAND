-- Row Level Security check for role_invites. Run against a real database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/role_invites_rls.sql
-- Creates two employers and one invite each, then proves that employer B,
-- authenticated with a valid JWT, cannot read employer A's invite even when
-- selecting by its exact id or token hash.

begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'employer-a@example.com', now()),
  ('22222222-2222-2222-2222-222222222222', 'employer-b@example.com', now())
on conflict (id) do nothing;

insert into public.screening_packs (id, public_code, signed_token, workplace, expires_at, employer_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rlsA01', 'token-a', 'Employer A', now() + interval '7 days', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rlsB01', 'token-b', 'Employer B', now() + interval '7 days', '22222222-2222-2222-2222-222222222222');

insert into public.role_invites (id, role_id, candidate_ref, email, channel, token_hash, token_cipher) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MQ-AAAAAA', 'a-candidate@example.com', 'email', repeat('a', 64), 'v1.x.y.z'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'MQ-BBBBBB', 'b-candidate@example.com', 'email', repeat('b', 64), 'v1.x.y.z');

-- Act as employer B.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
declare
  own_count integer;
  other_by_id integer;
  other_by_token integer;
begin
  select count(*) into own_count from public.role_invites where role_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  select count(*) into other_by_id from public.role_invites where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  select count(*) into other_by_token from public.role_invites where token_hash = repeat('a', 64);

  if own_count <> 1 then raise exception 'employer B should read exactly one own invite, got %', own_count; end if;
  if other_by_id <> 0 then raise exception 'employer B read employer A invite by id'; end if;
  if other_by_token <> 0 then raise exception 'employer B read employer A invite by token hash'; end if;

  raise notice 'role_invites RLS: pass';
end $$;

rollback;
