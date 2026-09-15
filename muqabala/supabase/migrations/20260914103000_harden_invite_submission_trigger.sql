-- mark_invite_submitted is a trigger-only SECURITY DEFINER function. PostgreSQL
-- grants EXECUTE on new functions to PUBLIC unless it is explicitly revoked.
-- The interviews trigger keeps working as the function owner; browser JWT roles
-- and PostgREST never need direct execution rights.
revoke all on function public.mark_invite_submitted() from public;
revoke all on function public.mark_invite_submitted() from anon, authenticated;
grant execute on function public.mark_invite_submitted() to service_role;
