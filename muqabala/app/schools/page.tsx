import Link from 'next/link';
import { requireSchoolsEnabled } from '@/lib/schools/access';
import {SchoolsPilotContact} from '@/components/schools/PilotContact';
export default function SchoolsPage() {
  requireSchoolsEnabled();
  return <><section className="schools-landing-hero"><div className="schools-hero-copy"><p>Muqabala for Higher Education, Colleges &amp; Career Centres</p><h1>Institutional interview practice for every learner. Evidence for every career adviser.</h1>
    <p>Structure industry-tailored interview assignments across Finance, Technology, Engineering, Healthcare, and Management. Students practise in private and improve on retry. Advisers review, comment, and guide.</p>
    <div className="schools-actions"><a className="schools-button" href="#start-pilot">Enquire about an institutional pilot</a><a href="#sample-report">See a sample report</a></div>
    <aside className="schools-card" aria-label="Existing or invited access"><h2>Already invited or enrolled?</h2><div className="schools-actions"><Link href="/schools/sign-in?role=educator">Educator or administrator sign-in</Link><Link href="/schools/access#student-access">Student access</Link></div><p>Use your invitation to accept access first. An enquiry does not grant access.</p></aside></div>
    <figure className="schools-cohort-example" aria-labelledby="cohort-example-title"><div className="schools-example-heading"><p className="schools-eyebrow">Your adviser workspace</p><h2 id="cohort-example-title">BSc Financial Technology · Cohort 2027</h2><p>Graduate Financial Analyst · Analytical Thinking &amp; Communication</p></div>
      <dl className="schools-cohort-counts"><div><dt>Enrolled</dt><dd>45</dd></div><div><dt>Submitted</dt><dd>38</dd></div><div><dt>Awaiting review</dt><dd>5</dd></div><div><dt>Support requests</dt><dd>2</dd></div></dl>
      <p className="schools-example-next">Next: review C. D.’s submitted attempt</p>
      <table><caption>Adviser view of this assignment</caption><thead><tr><th scope="col">Student</th><th scope="col">Attempts</th><th scope="col">Adviser view</th></tr></thead><tbody>
        <tr><th scope="row">C. D.</th><td>1</td><td><span className="schools-state schools-state-pending">Not reviewed</span></td></tr>
        <tr><th scope="row">E. F.</th><td>1</td><td>Needs more evidence</td></tr>
        <tr><th scope="row">A. B.</th><td>2</td><td><span className="schools-state">On track</span></td></tr>
        <tr><th scope="row">G. H.</th><td>0</td><td>Not submitted</td></tr>
      </tbody></table><figcaption>Fictional cohort. Initials only. Advisers see submitted work.</figcaption></figure></section>
    <section className="schools-section"><h2>Three steps, with your career adviser involved</h2><div className="schools-steps">
      <div><strong>1. Configure the assignment</strong><p>Set target industry, role description, competencies, and 3 to 8 tailored questions.</p></div>
      <div><strong>2. Practise and retry</strong><p>Students write structured answers, receive rubric feedback, and improve across repeat attempts.</p></div>
      <div><strong>3. Review and intervene</strong><p>Inspect submitted evidence, correct rubric decisions, provide written guidance, and resolve support requests.</p></div>
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
    <section className="schools-section"><h2>How feedback is explained</h2><p>Feedback checks the words in an answer against the agreed rubric. Supporting excerpts show why an element was marked present. Your adviser can correct an element and record a reason.</p><p>Confidence describes the engine’s uncertainty about that evidence decision. It does not describe the student.</p></section>
    <section className="schools-section"><h2>Safeguarding and privacy</h2><p>This pilot is for adults aged 18 or over. Answers use text only. Advisers see submitted work in their assigned cohorts. Drafts stay private from advisers.</p><p>Schools answers stay separate from employer recruitment. Enrolment opens after institution setup and its data processing arrangement are complete.</p></section>
    <section className="schools-section"><h2>Teaching language</h2><p>This sample is in English. We confirm one teaching language with your institution before its pilot opens.</p></section>
    <SchoolsPilotContact/><section className="schools-section"><h2>Already invited or enrolled?</h2><Link href="/schools/access">Find your educator or student access route</Link><p><Link href="/schools/enrol">Use a student private link or recovery code</Link></p></section></>;
}
