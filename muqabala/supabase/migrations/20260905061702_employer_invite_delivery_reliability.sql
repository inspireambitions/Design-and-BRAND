-- Keep each invite and its email job in one transaction. The service role
-- calls this only after authenticating the employer; ownership is checked again.
create or replace function public.queue_employer_invites(
  p_role_id uuid, p_employer_id uuid, p_rows jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_pack public.screening_packs%rowtype;
  v_row jsonb;
  v_invite public.role_invites%rowtype;
  v_queued integer := 0;
  v_duplicates integer := 0;
  v_count integer;
begin
  select * into v_pack from public.screening_packs
    where id = p_role_id and employer_id = p_employer_id for update;
  if not found then raise exception 'Role not found' using errcode = '42501'; end if;
  if v_pack.expires_at <= now() then raise exception 'Role closed' using errcode = '22023'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'Invalid candidate list' using errcode = '22023';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    -- WhatsApp has no sender yet. Do not accept contacts we cannot send to.
    if v_row->>'channel' is distinct from 'email' or nullif(v_row->>'email', '') is null then
      raise exception 'Email required' using errcode = '22023';
    end if;
    select * into v_invite from public.role_invites
      where role_id = p_role_id and
        (email = lower(v_row->>'email') or (phone is not null and phone = v_row->>'phone'))
      order by created_at limit 1;
    if not found then
      insert into public.role_invites(role_id, candidate_ref, email, phone, name, channel, token_hash, token_cipher)
      values (p_role_id, v_row->>'candidate_ref', lower(v_row->>'email'), v_row->>'phone',
        v_row->>'name', 'email', v_row->>'token_hash', v_row->>'token_cipher')
      returning * into v_invite;
    end if;
    -- A retry also repairs a legacy invite saved without its outbox job.
    -- Keep the original recipient and token; never rewrite an existing invite.
    insert into public.employer_message_outbox(role_id, invite_id, kind, channel)
      values (p_role_id, v_invite.id, 'invite', 'email')
      on conflict do nothing;
    get diagnostics v_count = row_count;
    v_queued := v_queued + v_count;
    if v_count = 0 then v_duplicates := v_duplicates + 1; end if;
  end loop;
  return jsonb_build_object('queued', v_queued, 'byEmail', v_queued, 'byWhatsApp', 0, 'duplicates', v_duplicates);
end;
$$;
revoke all on function public.queue_employer_invites(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.queue_employer_invites(uuid, uuid, jsonb) to service_role;

create or replace function public.employer_invite_delivery_status(p_role_id uuid, p_employer_id uuid)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from public.screening_packs where id = p_role_id and employer_id = p_employer_id) then
    raise exception 'Role not found' using errcode = '42501';
  end if;
  return (select jsonb_build_object(
    'queued', count(*) filter (where status in ('pending', 'processing')),
    'accepted', count(*) filter (where status = 'accepted'),
    'failed', count(*) filter (where status = 'failed'),
    'cancelled', count(*) filter (where status = 'cancelled')
  ) from public.employer_message_outbox where role_id = p_role_id and kind = 'invite');
end;
$$;
revoke all on function public.employer_invite_delivery_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.employer_invite_delivery_status(uuid, uuid) to service_role;

-- Interrupted senders lose their lease and can be retried with the same job ID.
-- Never leave the final exhausted attempt stuck in processing.
create or replace function public.claim_employer_messages(p_limit integer, p_lease_token uuid, p_role_id uuid default null)
returns setof public.employer_message_outbox
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.employer_message_outbox
    set status = 'failed', locked_until = null, lease_token = null,
      last_error_code = 'attempts_exhausted', updated_at = now()
    where (p_role_id is null or role_id = p_role_id) and attempt_count >= 10
      and (status = 'pending' or (status = 'processing' and locked_until <= now()));
  return query
  with picked as (
    select id from public.employer_message_outbox
    where (p_role_id is null or role_id = p_role_id) and attempt_count < 10
      and ((status = 'pending' and available_at <= now())
        or (status = 'processing' and locked_until <= now()))
    order by available_at, created_at
    limit least(greatest(coalesce(p_limit, 1), 1), 5)
    for update skip locked
  )
  update public.employer_message_outbox o
    set status = 'processing', locked_until = now() + interval '5 minutes',
      lease_token = p_lease_token, attempt_count = o.attempt_count + 1, updated_at = now()
    from picked where o.id = picked.id returning o.*;
end;
$$;
revoke all on function public.claim_employer_messages(integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_employer_messages(integer, uuid, uuid) to service_role;

-- The existing uniqueness index is partial. A target-free conflict clause
-- handles it without PostgREST trying to infer a full unique constraint.
create or replace function public.queue_employer_reminders(p_rows jsonb)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare v_count integer;
begin
  insert into public.employer_message_outbox(role_id, invite_id, kind, channel)
    select r.role_id, r.invite_id, r.kind, 'email'
    from jsonb_to_recordset(p_rows) as r(role_id uuid, invite_id uuid, kind text)
    join public.role_invites i on i.id = r.invite_id and i.role_id = r.role_id
    join public.screening_packs p on p.id = r.role_id
    where r.kind in ('reminder_1', 'reminder_2', 'completion') and i.email is not null
      and i.status in ('invited', 'started') and p.reminders_enabled and p.expires_at > now()
    on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.queue_employer_reminders(jsonb) from public, anon, authenticated;
grant execute on function public.queue_employer_reminders(jsonb) to service_role;

-- Record the schedule marker and job together. A failed insert rolls back
-- the marker so the next run can recover instead of silently losing the email.
create or replace function public.queue_employer_shortlist(p_role_id uuid, p_kind text)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare v_pack public.screening_packs%rowtype;
begin
  if p_kind not in ('48h', 'close') then raise exception 'Invalid shortlist kind'; end if;
  select * into v_pack from public.screening_packs where id = p_role_id for update;
  if not found then return 0; end if;
  if not exists (select 1 from public.interviews where screening_pack_id = p_role_id and submitted_at is not null) then return 0; end if;
  if p_kind = 'close' then
    if v_pack.expires_at > now() or v_pack.shortlist_close_sent_at is not null then return 0; end if;
  else
    if v_pack.expires_at <= now() or v_pack.shortlist_48h_sent_at is not null
      or not exists (select 1 from public.role_invites where role_id = p_role_id and invited_at <= now() - interval '48 hours') then return 0; end if;
  end if;
  insert into public.employer_message_outbox(role_id, kind, channel) values (p_role_id, 'shortlist', 'email');
  if p_kind = 'close' then
    update public.screening_packs set shortlist_close_sent_at = now() where id = p_role_id;
  else
    update public.screening_packs set shortlist_48h_sent_at = now() where id = p_role_id;
  end if;
  return 1;
end;
$$;
revoke all on function public.queue_employer_shortlist(uuid, text) from public, anon, authenticated;
grant execute on function public.queue_employer_shortlist(uuid, text) to service_role;
