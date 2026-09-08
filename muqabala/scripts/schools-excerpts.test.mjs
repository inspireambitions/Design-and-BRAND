import test from 'node:test';
import assert from 'node:assert/strict';
import {answerExcerpts,resolveSchoolsFeedback,calculateEvidence} from '../lib/schools/evidence.ts';
const rubric=Array.from({length:4},(_,i)=>({id:'e'+i,label:'Element '+i,description:'Observed answer evidence'}));
const provider=()=>({questions:[0,1,2].map(questionIndex=>({questionIndex,improvement:'Describe the result.',elements:[0,1,2,3].map(i=>({id:'e'+i,present:i===0,firstExcerpt:i===0?0:null,lastExcerpt:i===0?1:null,confidence:'medium'}))}))});
test('source selection preserves spelling, punctuation and whitespace exactly',()=>{
  const answer='  I help team.\n  We was finish early!  ';
  const excerpts=answerExcerpts(answer);assert.equal(excerpts.length,2);
  for(const e of excerpts)assert.equal(answer.slice(e.start,e.end),e.text);
  const feedback=resolveSchoolsFeedback(provider(),Array(3).fill(answer));
  assert.equal(feedback.questions[0].elements[0].supportingText,'I help team.\n  We was finish early!');
  assert.equal(calculateEvidence(feedback,Array(3).fill(answer),Array(3).fill(rubric)).covered,3);
});
test('invented, reversed and absent excerpt selections cannot produce evidence',()=>{
  for(const [first,last,present] of [[0,4,true],[1,0,true],[null,0,true],[0,0,false]]){
    const raw=provider();Object.assign(raw.questions[0].elements[0],{firstExcerpt:first,lastExcerpt:last,present});
    assert.throws(()=>resolveSchoolsFeedback(raw,Array(3).fill('I helped. We finished.')));
  }
});
test('long unpunctuated answers remain selectable without rewritten text',()=>{
  const answer=('A useful detail '.repeat(600)).trim();const excerpts=answerExcerpts(answer);
  assert(excerpts.length>1);assert(excerpts.every(e=>e.text.length<=1200&&answer.slice(e.start,e.end)===e.text));
  assert.equal(excerpts[0].start,0);assert.equal(excerpts.at(-1).end,answer.length);
});
