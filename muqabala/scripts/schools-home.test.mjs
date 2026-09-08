import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolsHomeAction } from '../lib/schools/home-action.ts';
const now=Date.parse('2026-09-08T12:00:00Z');
const due='2026-09-09T12:00:00Z';
const attempt={id:'attempt',status:'submitted',feedback_status:'ready',feedback_opened_at:null,comment_read_revision:null,
  evidence_detail:[{questionIndex:0,elements:[{present:true}]},{questionIndex:1,elements:[{present:false}]},{questionIndex:2,elements:[{present:false}]}]};
test('student cards show one action and keep drafts ahead of earlier reviews',()=>{
  assert.equal(schoolsHomeAction('a',due,undefined,undefined,now).label,'Start your answers');
  assert.equal(schoolsHomeAction('a',due,{...attempt,status:'draft'},{revision:2,comment:'Read this'},now).label,'Continue your answer');
});
test('feedback and unread adviser comments remain discoverable before retry',()=>{
  assert.equal(schoolsHomeAction('a',due,attempt,undefined,now).label,'Read your feedback');
  const opened={...attempt,feedback_opened_at:'2026-09-08T11:00:00Z'};
  assert.equal(schoolsHomeAction('a',due,opened,{revision:2,comment:'Read this'},now).label,"Read your adviser's comment");
  assert.equal(schoolsHomeAction('a',due,{...opened,comment_read_revision:2},{revision:2,comment:'Read this'},now).label,'Retry question 2');
  assert.equal(schoolsHomeAction('a','2026-09-07T12:00:00Z',opened,undefined,now).label,'Read your report');
});
