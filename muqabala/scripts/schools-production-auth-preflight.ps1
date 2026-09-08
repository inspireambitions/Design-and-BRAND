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

  $config=Invoke-RestMethod -Method Get -Uri 'https://api.supabase.com/v1/projects/hmaxzpgsefzpflrwzopa/config/auth' -Headers @{Authorization=('Bearer '+$schoolsWorkerToken)}
  @{siteUrl=$config.site_url;smtpHost=$config.smtp_host;smtpSender=$config.smtp_admin_email;smtpConfigured=[bool]($config.smtp_host -and $config.smtp_user -and $config.smtp_pass);redirectCount=@($config.uri_allow_list -split ',').Count}|ConvertTo-Json -Compress
}catch{Write-Output '{"failed":true,"stage":"production auth metadata","privateDetailsSuppressed":true}';exit 1}
finally{$schoolsWorkerToken=$null;$config=$null}
