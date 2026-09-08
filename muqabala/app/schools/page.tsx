import Link from 'next/link';
import { requireSchoolsEnabled } from '@/lib/schools/access';
import {SchoolsPilotContact} from '@/components/schools/PilotContact';
export default function SchoolsPage() {
  requireSchoolsEnabled();
  return <><section className="schools-landing-hero"><div className="schools-hero-copy"><p>Muqabala for Schools and Colleges</p><h1>Interview practice for every student. Evidence for every adviser.</h1>
    <p>Assign three role-relevant questions to a class. Students practise in private and improve on retry. You review and comment.</p>
    <div className="schools-actions"><a className="schools-button" href="#start-pilot">Start a pilot</a><a href="#sample-report">See a sample report</a></div></div>
    <figure className="schools-cohort-example" aria-labelledby="cohort-example-title"><div className="schools-example-heading"><p className="schools-eyebrow">Your adviser workspace</p><h2 id="cohort-example-title">One class. Your next review.</h2><p>Project group · Working with others</p></div>
      <dl className="schools-cohort-counts"><div><dt>Enrolled</dt><dd>4</dd></div><div><dt>Submitted</dt><dd>3</dd></div><div><dt>Not reviewed</dt><dd>1</dd></div><div><dt>Support requests open</dt><dd>1</dd></div></dl>
      <p className="schools-example-next">Next: review C. D.’s submitted attempt</p>
      <table><caption>Adviser view of this assignment</caption><thead><tr><th scope="col">Student</th><th scope="col">Attempts</th><th scope="col">Adviser view</th></tr></thead><tbody>
        <tr><th scope="row">C. D.</th><td>1</td><td><span className="schools-state schools-state-pending">Not reviewed</span></td></tr>
        <tr><th scope="row">E. F.</th><td>1</td><td>Needs more</td></tr>
        <tr><th scope="row">A. B.</th><td>2</td><td><span className="schools-state">On track</span></td></tr>
        <tr><th scope="row">G. H.</th><td>0</td><td>Not submitted</td></tr>
      </tbody></table><figcaption>Fictional cohort. Initials only. Advisers see submitted work.</figcaption></figure></section>
    <section className="schools-section"><h2>Three steps, with your adviser involved</h2><div className="schools-steps">
      <div><strong>1. Approve the questions</strong><p>Choose a role and three questions. Check what each question asks students to show.</p></div>
      <div><strong>2. Practise and retry</strong><p>Students write their own answers, read feedback and improve on another attempt.</p></div>
      <div><strong>3. Review submitted work</strong><p>Read the answers and their supporting text. Add your view, a comment or a support request.</p></div>
    </div></section>
    <section id="sample-report" className="schools-section"><h2>From an answer to your adviser review</h2><p>A fictional private student report, using initials. This is one question from a three-question assignment, after adviser review.</p>
      <article className="schools-card schools-sample"><p className="schools-eyebrow">Attempt 2 · Reviewed</p><h3>A. B. · Working with others</h3><p>Question: Describe a time you helped a group meet a deadline.</p>
        <blockquote>Our class project was due on Friday. <mark>I made a list of the remaining tasks and checked who could do each one.</mark> We agreed to check progress the next day.</blockquote>
        <dl className="schools-sample-evidence"><div><dt>Situation <span className="schools-state">Present</span></dt><dd><q>Our class project was due on Friday.</q><small>Engine confidence: high</small></dd></div>
          <div><dt>Own action <span className="schools-state">Present</span></dt><dd><q>I made a list of the remaining tasks and checked who could do each one.</q><small>Engine confidence: high</small></dd></div>
          <div className="schools-corrected-element"><dt>Working with others <span className="schools-state">Present</span></dt><dd><q>We agreed to check progress the next day.</q><small>Original engine decision: absent · Confidence: medium</small><p><strong>Adviser correction:</strong> Absent → Present</p><p><strong>Reason:</strong> Agreeing a shared progress check shows the group coordinating its work.</p></dd></div>
          <div><dt>Outcome <span className="schools-state schools-state-pending">Absent</span></dt><dd>The answer does not say what happened by the deadline.<small>Engine confidence: high</small></dd></div></dl>
        <div className="schools-sample-next"><h3>Add this first</h3><p>Explain what happened by Friday. Use what you remember from the project.</p></div>
        <div className="schools-sample-review"><p className="schools-eyebrow">Reviewed against attempt 2</p><h3>Adviser view of this assignment</h3><p><span className="schools-state">On track</span></p><p><strong>Adviser comment:</strong> Clear actions and teamwork. Add what happened by Friday.</p><p>This view belongs to attempt 2. A new submission awaits its own review.</p></div>
      </article></section>
    <section className="schools-section"><h2>How feedback is explained</h2><p>Feedback checks the words in an answer against the agreed rubric. Supporting excerpts show why an element was marked present. Your adviser can correct an element and record a reason.</p><p>Confidence describes the engine's uncertainty about that evidence decision. It does not describe the student.</p></section>
    <section className="schools-section"><h2>Safeguarding and privacy</h2><p>This pilot is for adults aged 18 or over. Answers use text only. Advisers see submitted work in their assigned cohorts. Drafts stay private from advisers.</p><p>Schools answers stay separate from employer recruitment. Enrolment opens after institution setup and its data processing arrangement are complete.</p></section>
    <section className="schools-section"><h2>Teaching language</h2><p>This sample is in English. We confirm one teaching language with your institution before its pilot opens.</p></section>
    <SchoolsPilotContact/><section className="schools-section"><h2>Already enrolled?</h2><Link href="/schools/sign-in">Sign in with email</Link><p><Link href="/schools/enrol">Use a student link or recovery code</Link></p></section></>;
}
