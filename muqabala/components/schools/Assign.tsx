'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Question={id:string;role_id:string;question_text:string;rubric:{id:string;label:string;description:string}[]};
export function SchoolsAssign({cohortId,questions}:{cohortId:string;questions:Question[]}){
  const roles=[...new Set(questions.map(q=>q.role_id))];
  const [role,setRole]=useState(roles[0]??'');
  const pool=questions.filter(q=>q.role_id===role);
  const [chosen,setChosen]=useState<string[]>(pool.slice(0,3).map(q=>q.id));
  const [due,setDue]=useState(new Date(Date.now()+7*86400000).toISOString().slice(0,10));
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const router=useRouter();
  return <form className="schools-card" onSubmit={async event=>{event.preventDefault();setBusy(true);try{
    const response=await fetch('/api/schools/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'assignment',payload:{cohortId,roleId:role,questionIds:chosen,dueAt:new Date(due+'T23:59:00Z').toISOString()}})});
    const body=await response.json();if(!response.ok)throw new Error(body.error);router.push('/schools/cohorts/'+cohortId);
  }catch(error){setMessage(error instanceof Error?error.message:'Could not assign.');}finally{setBusy(false);}}}>
    <label>Role<select value={role} onChange={e=>{setRole(e.target.value);setChosen(questions.filter(q=>q.role_id===e.target.value).slice(0,3).map(q=>q.id));}}>
      {roles.map(r=><option key={r}>{r}</option>)}</select></label>
    {pool.length<3&&<p>Approve at least three questions for this role before assigning.</p>}
    {[0,1,2].map(index=>{const question=pool.find(q=>q.id===chosen[index]);return <fieldset key={index}><legend>Question {index+1}</legend>
      <select aria-label={'Choose question '+(index+1)} value={chosen[index]??''} onChange={e=>{const next=[...chosen];next[index]=e.target.value;setChosen(next);}}>
        <option value="">Choose a question</option>{pool.map(q=><option key={q.id} value={q.id}>{q.question_text}</option>)}</select>
      {question&&<ul>{question.rubric.map(element=><li key={element.id}><strong>{element.label}</strong>: {element.description}</li>)}</ul>}</fieldset>;})}
    <label>Due date, end of day UTC<input type="date" value={due} onChange={e=>setDue(e.target.value)} required/></label>
    <button disabled={busy||chosen.length!==3||new Set(chosen).size!==3}>Approve these questions and assign</button><p role="status">{message}</p></form>;
}
export function SchoolsQuestionEditor({cohortId,roles}:{cohortId:string;roles:{id:string;title:string}[]}){
  const [message,setMessage]=useState('');const router=useRouter();
  return <details className="schools-card"><summary>Approve a question for the bank</summary><form onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);
    const payload={cohortId,roleId:form.get('role'),text:form.get('question'),followUp:form.get('followUp'),
      rubric:[0,1,2,3].map(i=>({id:'e'+i,label:String(form.get('label'+i)),description:String(form.get('description'+i))}))};
    try{const response=await fetch('/api/schools/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'question',payload})});const body=await response.json();
      if(!response.ok)throw new Error(body.error);setMessage('Question version saved.');router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'Could not save.');}}}>
    <label>Role<select name="role">{roles.map(role=><option key={role.id} value={role.id}>{role.title}</option>)}</select></label>
    <label>Question<textarea name="question" required maxLength={1200}/></label>
    {[0,1,2,3].map(i=><fieldset key={i}><legend>Rubric element {i+1}</legend><label>Element name<input name={'label'+i} required maxLength={200}/></label>
      <label>Evidence to look for<textarea name={'description'+i} required maxLength={600}/></label></fieldset>)}
    <label>Follow-up if the student cannot think of an example<textarea name="followUp" required maxLength={800}/></label>
    <p>Describe evidence in an answer. Never assess the student's personal traits or supply a finished answer.</p>
    <button>Approve question version</button><p role="status">{message}</p></form></details>;
}
