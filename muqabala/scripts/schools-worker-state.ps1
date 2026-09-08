param([ValidateSet('Preflight','Inspect','Replay','Cleanup','Assignment','AssignmentInspect','AssignmentCleanup')][string]$Mode,[string]$InviteId='')
$ErrorActionPreference='Stop'
# Read one existing CLI credential. It stays inside this process.
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SchoolsWorkerCredential {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Credential {
    public UInt32 Flags, Type; public string TargetName, Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize; public IntPtr CredentialBlob; public UInt32 Persist, AttributeCount; public IntPtr Attributes; public string TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool Read(string target, UInt32 type, UInt32 reserved, out IntPtr credential);
  [DllImport("advapi32.dll")] static extern void CredFree(IntPtr buffer);
  public static string Load() {
    IntPtr pointer; if(!Read("Supabase CLI:supabase",1,0,out pointer) && !Read("Supabase CLI:access-token",1,0,out pointer)) throw new Exception("CLI credential unavailable");
    try { var c=Marshal.PtrToStructure<Credential>(pointer); var bytes=new byte[c.CredentialBlobSize]; Marshal.Copy(c.CredentialBlob,bytes,0,bytes.Length); return Encoding.UTF8.GetString(bytes); }
    finally { CredFree(pointer); }
  }
}
'@
try {
  $schoolsWorkerToken=[SchoolsWorkerCredential]::Load()
  if($schoolsWorkerToken.StartsWith('go-keyring-base64:')){$schoolsWorkerToken=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($schoolsWorkerToken.Substring(18)))}
  if($schoolsWorkerToken -notmatch '^sbp_[a-zA-Z0-9]+$'){throw 'Invalid CLI credential format'}
  if($Mode -ne 'Preflight' -and $InviteId -notmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'){throw 'Invalid synthetic invitation identifier'}
  if($Mode -eq 'Replay'){
    $schoolsWorkerEnvelope=[Console]::In.ReadToEnd().Trim()
    if($schoolsWorkerEnvelope -notmatch '^s1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' -or $schoolsWorkerEnvelope.Length -gt 12000){throw 'Invalid encrypted fixture'}
  }
  $schoolsWorkerSql=switch($Mode){
    'Preflight' {"select count(*)::int as pending from schools_private.mail_outbox where status in ('queued','sending');"}
    'Inspect' {"select id,status,attempts,provider_message_id,sent_at from schools_private.mail_outbox where kind='staff' and payload_id='$InviteId';"}
    'Replay' {"update schools_private.mail_outbox set status='queued',next_at=now(),sent_at=null,provider_message_id=null,encrypted_message='$schoolsWorkerEnvelope' where kind='staff' and payload_id='$InviteId' and status='sent' and first_attempted_at>now()-interval '1 hour' returning id;"}
    'Cleanup' {"begin; delete from schools_private.mail_outbox where kind='staff' and payload_id='$InviteId'; delete from schools_private.staff_invites where id='$InviteId' and accepted_at is null; commit;"}
    'Assignment' {"insert into schools_private.mail_outbox(institution_id,recipient_user_id,kind,payload_id) select c.institution_id,u.id,'assignment',a.id from schools_assignments a join schools_cohorts c on c.id=a.cohort_id join schools_institutions i on i.id=c.institution_id join schools_cohort_members m on m.cohort_id=c.id join auth.users u on u.id=m.student_user_id where a.id='$InviteId' and a.published_at is not null and a.due_at>now() and m.status='active' and u.email='inspireambition.com@gmail.com' and i.name like 'Synthetic%' returning id;"}
    'AssignmentInspect' {"select m.id,m.status,m.attempts,m.provider_message_id from schools_private.mail_outbox m join auth.users u on u.id=m.recipient_user_id where m.kind='assignment' and m.id='$InviteId' and u.email='inspireambition.com@gmail.com';"}
    'AssignmentCleanup' {"delete from schools_private.mail_outbox m using auth.users u where m.id='$InviteId' and m.kind='assignment' and m.recipient_user_id=u.id and u.email='inspireambition.com@gmail.com';"}
  }
  $schoolsWorkerResult=Invoke-RestMethod -Method Post -Uri 'https://api.supabase.com/v1/projects/okrsezhospztwtptqhpo/database/query' -Headers @{Authorization=('Bearer '+$schoolsWorkerToken)} -ContentType 'application/json' -Body (@{query=$schoolsWorkerSql}|ConvertTo-Json -Compress)
  ConvertTo-Json -InputObject @($schoolsWorkerResult) -Depth 4 -Compress
}catch{Write-Output '{"failed":true,"stage":"staging worker state","detail":"Private details suppressed"}';exit 1}
finally{$schoolsWorkerToken=$null}
