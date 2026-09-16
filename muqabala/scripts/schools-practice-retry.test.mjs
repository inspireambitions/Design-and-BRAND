import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../components/schools/Practice.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const initial={id:'attempt-1',status:'draft',answers:['First answer','Second answer','Third answer'],revision:1,attempt_number:1,feedback_status:'pending',evidence_detail:null,evidence_covered:null};
function nodes(node,predicate){
  if(Array.isArray(node))return node.flatMap(n=>nodes(n,predicate));
  if(!node||typeof node!=='object')return [];
  return [...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
}
function harness({attempt=initial,retryQuestion=1,closed=false,retryFails=false}={}){
  const slots=[],calls=[],urls=[];let cursor=0,effects=[],view;
  const react={
    useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],next=>{slots[i]=next;}];},
    useRef(value){return react.useState({current:value})[0];},
    useCallback(fn){cursor++;return fn;},
    useEffect(fn,deps){const i=cursor++,old=slots[i];if(!deps||!old||deps.some((d,n)=>d!==old[n]))effects.push(fn);slots[i]=deps;},
  };
  const props={assignmentId:'assignment',cohortId:'cohort',questions:[0,1,2].map(n=>({text:'Question '+n,followUp:'Think of a class project',rubric:[]})),initial:attempt,dueAt:closed?'2000-01-01':'2999-01-01',retryQuestion};
  const exports={};
  vm.runInNewContext(code,{
    exports,Date,URL,AbortSignal,crypto:{randomUUID:()=> 'new-attempt'},setInterval:()=>1,clearInterval(){},requestAnimationFrame:fn=>fn(),
    document:{getElementById:()=>({focus(){}})},
    window:{location:{href:'http://localhost/schools/me/assignment?retry=1&keep=yes#answer'},history:{replaceState:(_state,_title,url)=>urls.push(url)},addEventListener(){},removeEventListener(){}},
    fetch:async(_url,options)=>{const request=JSON.parse(options.body);calls.push(request);const fail=request.operation==='retry'&&retryFails;return {ok:!fail,json:async()=>fail?{error:'Retry unavailable'}:{result:{...initial,id:request.payload.attemptId??'retry-draft',status:request.operation==='submit'?'submitted':'draft',answers:request.payload.answers??initial.answers,revision:2,attempt_number:2}}};},
    require:id=>{
      if(id==='react')return react;
      if(id==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
      if(id==='./Feedback')return {SchoolsFeedback:()=>null};
      throw Error(id);
    },
  });
  const render=()=>{cursor=0;effects=[];view=exports.SchoolsPractice(props);for(const effect of effects)effect();return view;};
  const settle=async()=>{for(let n=0;n<4;n++){await new Promise(resolve=>setImmediate(resolve));render();}return view;};
  return {render,settle,calls,urls,submit:()=>nodes(view,n=>n.type==='button'&&n.props.children==='Submit answers')[0].props.onClick()};
}
test('refreshed retry draft submits without silently opening another draft',async()=>{
  const h=harness();h.render();await h.settle();h.submit();const view=await h.settle();
  assert.deepEqual(h.calls.map(c=>c.operation),['submit']);
  assert.deepEqual(h.urls,['/schools/me/assignment?keep=yes#answer']);
  assert.equal(nodes(view,n=>n.props?.role==='status')[0].props.children,'Your answers have been submitted.');
  assert.equal(nodes(view,n=>n.type==='textarea').every(n=>n.props.disabled),true);
});
test('retry from a submitted answer starts once and subsequent submission stays submitted',async()=>{
  const h=harness({attempt:{...initial,status:'submitted'}});h.render();await h.settle();h.submit();await h.settle();
  assert.deepEqual(h.calls.map(c=>c.operation),['retry','submit']);
  assert.equal(h.urls.length,1);
});
test('empty initial assignment with retry query does not retry after first submission',async()=>{
  const h=harness({attempt:null});h.render();await h.settle();h.submit();await h.settle();
  assert.deepEqual(h.calls.map(c=>c.operation),['submit']);
});
test('closed assignment consumes retry intent without a retry request',async()=>{
  const h=harness({attempt:{...initial,status:'submitted'},closed:true});h.render();await h.settle();
  assert.equal(h.calls.length,0);assert.equal(h.urls.length,1);
});
test('failed automatic retry shows an error without a request loop',async()=>{
  const h=harness({attempt:{...initial,status:'submitted'},retryFails:true});h.render();const view=await h.settle();
  assert.deepEqual(h.calls.map(c=>c.operation),['retry']);
  assert.equal(nodes(view,n=>n.props?.role==='alert')[0].props.children,'Retry unavailable');
});
