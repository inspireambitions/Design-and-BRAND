import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RecruiterQuestions, type RecruiterQuestionRow } from '@/components/RecruiterQuestions';
import { verifyStoredInterview } from '@/lib/interview-token';
import { pageCount, pageRange, positivePage } from '@/lib/pagination';
import { createClient, currentUser } from '@/lib/supabase/server';
import styles from '../roles/[roleId]/page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const QUESTION_PAGE_SIZE = 100;

export default async function EmployerQuestionsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const employer = await currentUser();
  if (!employer) redirect('/sign-in?next=/employer/questions');
  const client = await createClient();
  if (!client) return <main className={styles.page}><p role="alert">Candidate questions are temporarily unavailable. <Link href="">Retry</Link></p></main>;
  const query = await searchParams;
  const page = positivePage(query.page);
  const range = pageRange(page, QUESTION_PAGE_SIZE);
  // RLS limits this direct queue read to questions belonging to the signed-in
  // employer. Fetch only the role titles needed for the current page instead
  // of silently capping the employer at a fixed number of roles.
  const questionResult = await client.from('candidate_role_questions')
    .select('id,role_id,candidate_email,question_text,answer_already_shown,reply_text,replied_at,resolved_at,created_at', { count: 'exact' })
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .range(range.from, range.to);
  if (questionResult.error) return <main className={styles.page}><nav className={styles.breadcrumb}><Link href="/employer">Hiring overview</Link><span>/</span><span>Candidate questions</span></nav><section className={styles.section}><header><div><h1>Candidate questions</h1><p>Question activity is temporarily unavailable.</p></div></header><p role="alert">The question queue could not be loaded. <Link href="">Retry</Link></p></section></main>;
  const data = questionResult.data;
  const roleIds = [...new Set((data ?? []).map((question) => question.role_id))];
  const packResult = roleIds.length
    ? await client.from('screening_packs').select('id,signed_token').eq('employer_id', employer.id).in('id', roleIds)
    : { data: [], error: null };
  if (packResult.error) return <main className={styles.page}><nav className={styles.breadcrumb}><Link href="/employer">Hiring overview</Link></nav><p role="alert">Role titles could not be loaded. <Link href="">Retry</Link></p></main>;
  const titles = new Map((packResult.data ?? []).map((pack) => [pack.id, verifyStoredInterview(pack.signed_token)?.title ?? 'Role']));
  const questions = (data ?? []).map((question) => ({ ...question, roleTitle: titles.get(question.role_id) || 'Role' })) as RecruiterQuestionRow[];
  const total = questionResult.count ?? 0;
  const lastPage = pageCount(total, QUESTION_PAGE_SIZE);
  return <main className={styles.page}><nav className={styles.breadcrumb}><Link href="/employer">Hiring overview</Link><span>/</span><span>Candidate questions</span></nav><section className={styles.section}><header><div><h1>Candidate questions</h1><p>{total} unresolved across authorised roles.</p></div></header><RecruiterQuestions questions={questions} />{lastPage > 1 && <nav className={styles.pagination} aria-label="Candidate question pages">{page > 1 ? <Link href={`/employer/questions?page=${page - 1}`}>Newer questions</Link> : <span aria-disabled="true">Newer questions</span>}<span>Page {page} of {lastPage}</span>{page < lastPage ? <Link href={`/employer/questions?page=${page + 1}`}>Older questions</Link> : <span aria-disabled="true">Older questions</span>}</nav>}</section></main>;
}
