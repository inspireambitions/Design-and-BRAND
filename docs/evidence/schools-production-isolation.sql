begin;
set local statement_timeout='30s';
do $test$
declare
 u uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 ins uuid[]:=array[gen_random_uuid(),gen_random_uuid()];
 co uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 ass uuid[]:=array[gen_random_uuid(),gen_random_uuid()];
 att uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 q uuid; k integer; j integer; n integer; row_info record; result jsonb;
 rub jsonb:='[{"id":"e0","label":"Situation","description":"Describe the situation"},{"id":"e1","label":"Action","description":"Describe your action"},{"id":"e2","label":"Others","description":"Describe working with others"},{"id":"e3","label":"Outcome","description":"Describe the outcome"}]';
begin
 for k in 1..6 loop
 insert into auth.users(id) values(u[k]);
 insert into schools_sessions(session_id,user_id) values(u[k],u[k]);
 end loop;
 for k in 1..2 loop
 insert into schools_institutions(id,name,country,language) values(ins[k],'Synthetic rollback isolation check','UAE','en');
 insert into schools_institution_members(institution_id,user_id,role,accepted_at) values(ins[k],u[k],'educator',now());
 insert into schools_cohorts(id,institution_id,name,enrolment_code,created_by) values(co[k],ins[k],'Synthetic cohort','QAONLYAA',u[k]);
 insert into schools_cohort_educators(cohort_id,educator_user_id) values(co[k],u[k]);
 insert into schools_cohort_members(cohort_id,student_user_id,display_name,adult_confirmed_at) values(co[k],u[k+2],'Synthetic learner',now());
 insert into schools_assignments(id,cohort_id,role_id,due_at,created_by) values(ass[k],co[k],'Synthetic role',now()+interval '1 day',u[k]);
 for j in 0..2 loop
 q:=gen_random_uuid();
 insert into schools_question_versions(id,institution_id,question_key,version,role_id,language,question_text,rubric,no_example_follow_up,approved_by)
 values(q,ins[k],'synthetic-'||j,1,'Synthetic role','en','Describe a class project.',rub,'What did you do?',u[k]);
 insert into schools_assignment_questions values(ass[k],j,q);
 end loop;
 update schools_assignments set published_at=now() where id=ass[k];
 end loop;
 insert into schools_institution_members(institution_id,user_id,role,accepted_at) values(ins[1],u[6],'institution_admin',now());
 insert into schools_cohorts(id,institution_id,name,enrolment_code,created_by) values(co[3],ins[1],'Unassigned cohort','QAONLYAB',u[1]);
 insert into schools_cohort_members(cohort_id,student_user_id,display_name,adult_confirmed_at) values(co[3],u[4],'Unassigned learner',now());
 update schools_institutions set setup_complete=true,dpa_complete=true,dpa_reference='SYNTHETIC TRANSACTION ROLLED BACK',approved_by=u[6],approved_at=now() where id=any(ins);
 insert into schools_assignment_attempts(id,assignment_id,student_user_id,attempt_number,status,submitted_at)
 values(att[1],ass[1],u[3],1,'submitted',now()),(att[2],ass[1],u[3],2,'draft',null),(att[3],ass[2],u[4],1,'submitted',now());
 perform set_config('request.jwt.claim.sub',u[1]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'session_id',u[1],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.schools_assignment_attempts; if n<>1 then raise exception 'Adviser draft or institution isolation failed'; end if;
 select count(*) into n from public.schools_cohort_members; if n<>1 then raise exception 'Unassigned cohort isolation failed'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',u[3]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'session_id',u[3],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.schools_assignment_attempts; if n<>2 then raise exception 'Student own draft or isolation failed'; end if;
 begin update public.schools_assignment_attempts set evidence_covered=12 where id=att[2]; raise exception 'Client evidence write unexpectedly allowed'; exception when insufficient_privilege then null; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',u[6]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u[6],'session_id',u[6],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.schools_assignment_attempts; if n<>0 then raise exception 'Institution admin answer privacy failed'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',u[5]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u[5],'session_id',u[5],'role','authenticated')::text,true);
 for row_info in select tablename from pg_tables where schemaname='public' and tablename like 'schools_%' loop
 execute 'set local role authenticated';
 begin
 execute format('select count(*) from public.%I',row_info.tablename) into n;
 if n<>0 then raise exception 'Employer read isolation failed: %',row_info.tablename; end if;
 exception when insufficient_privilege then null; end;
 begin
 execute format('delete from public.%I',row_info.tablename);
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Employer write isolation failed: %',row_info.tablename; end if;
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 end loop;
 update schools_cohort_members set status='removed',removed_at=now() where student_user_id=u[3];
 perform set_config('request.jwt.claim.sub',u[3]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'session_id',u[3],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.schools_assignment_attempts; if n<>0 then raise exception 'Removed student still has answer access'; end if;
 execute 'reset role';
 update schools_cohort_members set status='active',removed_at=null where student_user_id=u[3];
 execute 'set local role service_role';
 begin
 result:=public.schools_action(u[3],'draft',jsonb_build_object('assignmentId',ass[2],'answers',jsonb_build_array('a','b','c'),'revision',0),'server');
 raise exception 'Tampered assignment was accepted';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'schools_%' and has_function_privilege('anon',p.oid,'execute')) then raise exception 'Anonymous Schools RPC privilege'; end if;
end $test$;
rollback;
