alter table public.candidate_evaluation_reports
  add column if not exists interviewer_name text;

alter table public.candidate_evaluation_reports
  drop constraint if exists candidate_evaluation_reports_interviewer_name_length;

alter table public.candidate_evaluation_reports
  add constraint candidate_evaluation_reports_interviewer_name_length
  check (interviewer_name is null or char_length(btrim(interviewer_name)) between 1 and 100);
