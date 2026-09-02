-- Employer volume build, section 3: reminders toggle per role.

alter table public.screening_packs
  add column if not exists reminders_enabled boolean not null default true;

-- Employers may switch reminders on and off for their own roles. This is the
-- only column the JWT role can update; everything else stays service role.
drop policy if exists "Employers can update reminder settings" on public.screening_packs;
create policy "Employers can update reminder settings"
  on public.screening_packs for update to authenticated
  using (auth.uid() = employer_id)
  with check (auth.uid() = employer_id);

grant update (reminders_enabled) on public.screening_packs to authenticated;
