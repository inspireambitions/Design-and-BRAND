-- The provider receipt and reminder clock must commit together. This also
-- protects workers from older deployments during the release transition.
create or replace function public.stamp_accepted_employer_message()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status <> 'accepted' or old.status = 'accepted' then return new; end if;
  if new.accepted_at is null then
    raise exception 'employer_message_acceptance_time_missing';
  end if;
  if new.kind = 'shortlist' then return new; end if;
  update public.role_invites
  set invited_at = case when new.kind = 'invite' then coalesce(invited_at, new.accepted_at) else invited_at end,
      first_reminder_at = case when new.kind = 'reminder_1' then coalesce(first_reminder_at, new.accepted_at) else first_reminder_at end,
      second_reminder_at = case when new.kind = 'reminder_2' then coalesce(second_reminder_at, new.accepted_at) else second_reminder_at end,
      completion_reminder_at = case when new.kind = 'completion' then coalesce(completion_reminder_at, new.accepted_at) else completion_reminder_at end
  where id = new.invite_id and role_id = new.role_id;
  if not found then raise exception 'employer_message_invite_scope_missing'; end if;
  return new;
end;
$$;

revoke all on function public.stamp_accepted_employer_message() from public, anon, authenticated;
grant execute on function public.stamp_accepted_employer_message() to service_role;

create trigger employer_message_acceptance_stamp
  before update of status on public.employer_message_outbox
  for each row execute function public.stamp_accepted_employer_message();
