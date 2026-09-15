import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RecruiterQuestions, type RecruiterQuestionRow } from '@/components/RecruiterQuestions';
import { verifyInterview } from '@/lib/interview-token';
import { createClient, currentUser } from '@/lib/supabase/server';
import styles from '../roles/[roleId]/page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmployerQuestionsPage() {
  const employer = await currentUser();
  if (!employer) redirect('/sign-in?next=/employer/questions');
  const client = await createClient();
  if (!client) return null;
  const { data: packs } = await client.from('screening_packs').select('id,signed_token').eq('employer_id', employer.id);
  const roleIds = (packs ?? []).map((pack) => pack.id);
  const titles = new Map((packs ?? []).map((pack) => [pack.id, verifyInterview(pack.signed_token)?.title ?? 'Role']));
  const { data } = roleIds.length ? await client.from('candidate_role_questions')
    .select('id,role_id,candidate_email,question_text,answer_already_shown,reply_text,replied_at,resolved_at,created_at')
    .in('role_id', roleIds)
    .is('resolved_at', null)
    .order('created_at', { ascending: false }) : { data: [] };
  const questions = (data ?? []).map((question) => ({ ...question, roleTitle: titles.get(question.role_id) || 'Role' })) as RecruiterQuestionRow[];
  return <main className={styles.page}><nav className={styles.breadcrumb}><Link href="/employer">Hiring overview</Link><span>/</span><span>Candidate questions</span></nav><section className={styles.section}><header><div><h1>Candidate questions</h1><p>{questions.length} unresolved across authorised roles.</p></div></header><RecruiterQuestions questions={questions} /></section></main>;
}
