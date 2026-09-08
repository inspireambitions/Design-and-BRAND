import Link from 'next/link';
import { requireSchoolsEnabled } from '@/lib/schools/access';
import {SchoolsPilotContact} from '@/components/schools/PilotContact';
export default function SchoolsPage() {
  requireSchoolsEnabled();
  return <><section className="schools-landing-hero"><p>Muqabala for Schools and Colleges</p><h1>Interview practice for every student. Evidence for every adviser.</h1>
    <p>Assign three role-relevant questions to a class. Students practise in private and improve on retry. You review and comment.</p>
    <div className="schools-actions"><a className="schools-button" href="#start-pilot">Start a pilot</a><a href="#sample-report">See a sample report</a></div></section>
    <section className="schools-section"><h2>Three steps, with your adviser involved</h2><div className="schools-steps">
      <div><strong>1. Approve the questions</strong><p>Choose a role and three questions. Check what each question asks students to show.</p></div>
      <div><strong>2. Practise and retry</strong><p>Students write their own answers, read feedback and improve on another attempt.</p></div>
      <div><strong>3. Review submitted work</strong><p>Read the answers and their supporting text. Add your view, a comment or a support request.</p></div>
    </div></section>
    <section id="sample-report" className="schools-section"><h2>A private student report</h2><p>Fictional example, using initials. This is one question from a three-question assignment.</p>
      <article className="schools-card schools-sample"><h3>A. B. · Working with others</h3><p>Question: Describe a time you helped a group meet a deadline.</p>
        <blockquote>Our class project was due on Friday. <mark>I made a list of the remaining tasks and checked who could do each one.</mark> We agreed to check progress the next day.</blockquote>
        <dl><dt>Situation</dt><dd>Present: a class project due on Friday.</dd><dt>Own action</dt><dd>Present: made a task list and checked who could help.</dd><dt>Working with others</dt><dd>Present: agreed a progress check.</dd><dt>Outcome</dt><dd>Absent: the answer does not say what happened by the deadline.</dd></dl>
        <h3>Add this first</h3><p>Explain what happened by Friday. Use what you remember from the project.</p>
        <h3>Adviser view of this assignment</h3><p>Not reviewed</p>
      </article></section>
    <section className="schools-section"><h2>How feedback is explained</h2><p>Feedback checks the words in an answer against the agreed rubric. Supporting excerpts show why an element was marked present. Your adviser can correct an element and record a reason.</p><p>Confidence describes the engine's uncertainty about that evidence decision. It does not describe the student.</p></section>
    <section className="schools-section"><h2>Safeguarding and privacy</h2><p>This pilot is for adults aged 18 or over. Answers use text only. Advisers see submitted work in their assigned cohorts. Drafts stay private from advisers.</p><p>Schools answers stay separate from employer recruitment. Enrolment opens after institution setup and its data processing arrangement are complete.</p></section>
    <section className="schools-section"><h2>Teaching language</h2><p>We agree one teaching language with your institution before its pilot opens.</p></section>
    <SchoolsPilotContact/><section className="schools-section"><h2>Already enrolled?</h2><Link href="/schools/sign-in">Sign in with email</Link><p><Link href="/schools/enrol">Use a student link or recovery code</Link></p></section></>;
}
