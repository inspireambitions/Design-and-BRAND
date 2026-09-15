import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RecruiterQuestions, type RecruiterQuestionRow } from '@/components/RecruiterQuestions';
import { verifyStoredInterview } from '@/lib/interview-token';
import { createClient, currentUser } from '@/lib/supabase/server';
import styles from '../roles/[roleId]/page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmployerQuestionsPage() {
  const employer = await currentUser();
  if (!employer) redirect('/sign-in?next=/employer/questions');
  const client = await createClient();
  if (!client) return <main className={styles.page}><p role="alert">Candidate questions are temporarily unavailable. <Link href="">Retry</Link></p></main>;
  const { data: packs, error: packError } = await client.from('screening_packs').select('id,signed_token').eq('employer_id', employer.id).limit(500);
  if (packError) return <main className={styles.page}><nav className={styles.breadcrumb}><Link href="/employer">Hiring overview</Link></nav><p role="alert">Roles could not be loaded, so no question count is shown. <Link href="">Retry</Link></p></main>;
  const roleIds = (packs ?? []).map((pack) => pack.id);
  const titles = new Map((packs ?? []).map((pack) => [pack.id, verifyStoredInterview(pack.signed_token)?.title ?? 'Role']));
  const [questionResult, countResult] = roleIds.length ? await Promise.all([
    client.from('candidate_role_questions')
      .select('id,role_id,candidate_email,question_text,answer_already_shown,reply_text,replied_at,resolved_at,created_at')
      .in('role_id', roleIds)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
    client.from('candidate_role_questions').select('id', { count: 'exact', head: true }).in('role_id', roleIds).is('resolved_at', null),
  ]) : [{ data: [], error: null }, { count: 0, error: null }];
  if (questionResult.error || countResult.error) return <main className={styles.page}><nav className={styles.breadcrumb}><Link href="/employer">Hiring overview</Link><span>/</span><span>Candidate questions</span></nav><section className={styles.section}><header><div><h1>Candidate questions</h1><p>Question activity is temporarily unavailable.</p></div></header><p role="alert">The question queue could not be loaded. <Link href="">Retry</Link></p></section></main>;
  const data = questionResult.data;
  const questions = (data ?? []).map((question) => ({ ...question, roleTitle: titles.get(question.role_id) || 'Role' })) as RecruiterQuestionRow[];
  return <main className={styles.page}><nav className={styles.breadcrumb}><Link href="/employer">Hiring overview</Link><span>/</span><span>Candidate questions</span></nav><section className={styles.section}><header><div><h1>Candidate questions</h1><p>{countResult.count ?? 0} unresolved across authorised roles.</p></div></header><RecruiterQuestions questions={questions} />{questions.length === 100 && <p>Showing the 100 most recent unresolved questions.</p>}</section></main>;
}
