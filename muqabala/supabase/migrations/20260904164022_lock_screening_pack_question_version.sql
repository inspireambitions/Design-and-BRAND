-- A candidate must never load one signed question pack and then start against
-- another. The first public read freezes the pack. AI enhancement is allowed
-- only while both this timestamp is null and no interview has started.
alter table public.screening_packs
  add column first_opened_at timestamptz,
  add column enhanced_at timestamptz,
  add column question_source text not null default 'legacy',
  add column question_version text not null default 'legacy',
  add constraint screening_packs_question_source_check
    check (question_source in ('legacy', 'catalogue', 'ai'));

comment on column public.screening_packs.first_opened_at is
  'First candidate-page or share-preview read. Once set, the signed question pack is immutable.';
comment on column public.screening_packs.enhanced_at is
  'Time a validated advert-specific question pack replaced the initial catalogue pack.';
comment on column public.screening_packs.question_source is
  'Internal provenance only: legacy, catalogue, or ai. Never shown to candidates.';
comment on column public.screening_packs.question_version is
  'Internal question-pipeline version stored with the immutable signed pack.';
