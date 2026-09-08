'use client';
import {useState} from 'react';
import {SchoolsManagementForm} from './ManagementForm';
export function SchoolsEnrolmentPanel({cohortId,students,initialOpen,initialCode}:{cohortId:string;students:{student_user_id:string;display_name:string}[];initialOpen:boolean;initialCode:string}) {
  const [open,setOpen]=useState(initialOpen);const [code,setCode]=useState(initialCode);
  const [purpose,setPurpose]=useState('enrolment');const [mode,setMode]=useState('email');
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [studentId,setStudentId]=useState('');
  const [checked,setChecked]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [link,setLink]=useState('');
  const [batchLinks,setBatchLinks]=useState<{email:string;path:string}[]>([]);
  return <details className="schools-card"><summary>Student enrolment and recovery</summary>
    <p>Enrolment is {open?'open':'closed'}. Cohort code: <code>{code}</code>.</p>
    <div className="schools-actions">{[{label:open?'Close enrolment':'Open enrolment',open:!open,rotate:false},{label:'Rotate cohort code',open,rotate:true}].map(action=><button key={action.label} disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{
      const response=await fetch('/api/schools/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'enrolment',payload:{cohortId,open:action.open,rotate:action.rotate}})});
      const body=await response.json();if(!response.ok)throw new Error(body.error);setOpen(body.result.enrolment_open);setCode(body.result.enrolment_code);setMessage('Enrolment settings saved.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not save settings.');}finally{setBusy(false);}}}>{action.label}</button>)}</div>
    <p>Give each student their own link privately. Links expire and can be used once.</p>
    <form method="post" onSubmit={async event=>{event.preventDefault();setBusy(true);setLink('');setMessage('');try{
      const response=await fetch('/api/schools/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'issue',cohortId,purpose,
        mode:purpose==='recovery'?'pseudonymous':mode,displayName:purpose==='recovery'?(students.find(student=>student.student_user_id===studentId)?.display_name??'Student'):name,
        ...(purpose==='recovery'?{studentId}:mode==='email'?{email}:{}),identityChecked:checked})});
      const body=await response.json();if(!response.ok)throw new Error(body.error);setLink(window.location.origin+body.path);setMessage('Link created. Give it only to this student.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not create the link.');}finally{setBusy(false);}}}>
      <label>Action<select value={purpose} onChange={event=>{setPurpose(event.target.value);setChecked(false);setLink('');}}><option value="enrolment">Enrol a student</option><option value="recovery">Recover an email-free account</option></select></label>
      {purpose==='enrolment'?<><label>Student display name<input value={name} onChange={event=>setName(event.target.value)} required maxLength={100}/></label>
        <label>Account method<select value={mode} onChange={event=>setMode(event.target.value)}><option value="email">Institution email</option><option value="pseudonymous">Email-free account</option></select></label>
        {mode==='email'&&<label>Student email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} required/></label>}</>:
        <><label>Student<select value={studentId} onChange={event=>setStudentId(event.target.value)} required><option value="">Choose a student</option>{students.map(student=><option value={student.student_user_id} key={student.student_user_id}>{student.display_name}</option>)}</select></label>
          <label><input type="checkbox" required checked={checked} onChange={event=>setChecked(event.target.checked)}/> I verified this student's identity using our institution's recovery procedure</label></>}
      <button disabled={busy}>Create private student link</button>
    </form><p role="status">{message}</p>{link&&<label>Copy this private link<input readOnly value={link} onFocus={event=>event.target.select()}/></label>}
    <details><summary>Add students by email</summary><form method="post" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setMessage('');setBatchLinks([]);try{
      const response=await fetch('/api/schools/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'issue_batch',cohortId,contacts:String(form.get('contacts')??'')})});const body=await response.json();if(!response.ok)throw new Error(body.error??'Could not create links.');setBatchLinks(body.links);setMessage(body.failed.length?'Links could not be created for: '+body.failed.join(', '):'Private links created. Give each link only to its named recipient.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not create links.');}finally{setBusy(false);}}}>
      <label>Institution emails, one per line<textarea name="contacts" required maxLength={8000}/></label><button disabled={busy}>Create student links</button></form>
      {batchLinks.map(item=><label key={item.email}>{item.email}<input readOnly value={typeof window==='undefined'?item.path:window.location.origin+item.path} onFocus={event=>event.target.select()}/></label>)}
    </details>
    <details><summary>Remove access or archive this cohort</summary><p>Removing a student ends access now. Their records stay until retention removes them. Archiving closes enrolment and starts the archived retention period.</p>
      <SchoolsManagementForm operation="remove_member" fixed={{cohortId}} button="Remove student access" fields={[{name:'studentId',label:'Student to remove',options:students.map(s=>({value:s.student_user_id,label:s.display_name}))}]}/>
      <SchoolsManagementForm operation="archive_cohort" fixed={{cohortId}} button="Archive cohort" fields={[]}/>
    </details>
  </details>;
}
