set local lock_timeout = '5s';
set local statement_timeout = '30s';

create index if not exists interviews_candidate_user_idx
  on public.interviews (candidate_user_id)
  where candidate_user_id is not null;

create index if not exists screening_notification_outbox_recipient_user_idx
  on public.screening_notification_outbox (recipient_user_id);
