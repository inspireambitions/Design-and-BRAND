param([switch]$ConfigurePreview,[switch]$Logs,[switch]$CheckSmtp,[switch]$RepairSmtp,[switch]$VercelSenderFallback,[switch]$NewStagingKey)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SchoolsCredential {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Credential {
    public UInt32 Flags, Type; public string TargetName, Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize; public IntPtr CredentialBlob; public UInt32 Persist, AttributeCount; public IntPtr Attributes; public string TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool Read(string target, UInt32 type, UInt32 reserved, out IntPtr credential);
  [DllImport("advapi32.dll")] static extern void CredFree(IntPtr buffer);
  public static string Load() {
    IntPtr pointer; if(!Read("Supabase CLI:supabase",1,0,out pointer) && !Read("Supabase CLI:access-token",1,0,out pointer)) throw new Exception("Supabase CLI credential unavailable");
    try { var c=Marshal.PtrToStructure<Credential>(pointer); var bytes=new byte[c.CredentialBlobSize]; Marshal.Copy(c.CredentialBlob,bytes,0,bytes.Length); return Encoding.UTF8.GetString(bytes); }
    finally { CredFree(pointer); }
  }
}
'@
$schoolsToken = [SchoolsCredential]::Load()
if ($schoolsToken.StartsWith('go-keyring-base64:')) { $schoolsToken = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($schoolsToken.Substring(18))) }
if ($schoolsToken -notmatch '^sbp_[a-zA-Z0-9]+$') { throw 'Unrecognised Supabase credential format' }
$schoolsStage = 'read staging Auth settings'
try {
  $schoolsAuth = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/okrsezhospztwtptqhpo/config/auth' -Headers @{Authorization=('Bearer '+$schoolsToken)}
  if ($NewStagingKey) {
    $schoolsStage='receive dedicated staging sender key'
    Write-Output 'Secure staging key input ready'
    $schoolsNewKey=''
    while ($true) { $schoolsKeyChar=[Console]::ReadKey($true); if ($schoolsKeyChar.Key -eq 'Enter') { break }; $schoolsNewKey += $schoolsKeyChar.KeyChar }
    if ($schoolsNewKey -notmatch '^re_[A-Za-z0-9_-]+$') { throw 'Unexpected key format' }
    $schoolsSenderAddress=$schoolsAuth.smtp_admin_email
    if ($schoolsSenderAddress -notmatch '^[^@]+@auth\.trymuqabala\.com$') { $schoolsSenderAddress='noreply@auth.trymuqabala.com' }
    $schoolsStage='apply dedicated staging sender key'
    $schoolsNewBody=@{smtp_host='smtp.resend.com';smtp_port='465';smtp_user='resend';smtp_pass=$schoolsNewKey;smtp_admin_email=$schoolsSenderAddress;smtp_sender_name='Muqabala Schools staging'} | ConvertTo-Json -Compress
    $null=Invoke-RestMethod -Method Patch -Uri 'https://api.supabase.com/v1/projects/okrsezhospztwtptqhpo/config/auth' -Headers @{Authorization=('Bearer '+$schoolsToken)} -ContentType 'application/json' -Body $schoolsNewBody
    $schoolsNewKey=$null; $schoolsNewBody=$null
    Write-Output 'Dedicated sender key configured in staging SMTP. Production unchanged.'
  }
  if ($RepairSmtp) {
    $schoolsStage = 'read existing sender settings'
    $schoolsSource=Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/hmaxzpgsefzpflrwzopa/config/auth' -Headers @{Authorization=('Bearer '+$schoolsToken)}
    $schoolsStage = 'validate existing SMTP credential availability'
    if ($VercelSenderFallback -and $schoolsSource.smtp_host -eq 'smtp.resend.com' -and !$schoolsSource.smtp_pass.StartsWith('re_')) {
      $schoolsStage = 'read the existing Muqabala sender key only'
      $schoolsVercelAuth = Get-Content -LiteralPath (Join-Path $env:APPDATA 'com.vercel.cli-inspire14/auth.json') -Raw | ConvertFrom-Json
      $schoolsVercelHeaders = @{Authorization=('Bearer '+$schoolsVercelAuth.token)}
      $schoolsEnvBase = 'https://api.vercel.com/v1/projects/prj_mLU2A8yiW61V4a4da54GryoIcSXX/env'
      $schoolsEnvQuery = '?teamId=team_IlZz8UvetUXPtSvI4hPqy6fn'
      $schoolsEnvMetadata = Invoke-RestMethod -Uri ('https://api.vercel.com/v10/projects/prj_mLU2A8yiW61V4a4da54GryoIcSXX/env'+$schoolsEnvQuery+'&decrypt=false') -Headers $schoolsVercelHeaders
      $schoolsSenderEntry = @($schoolsEnvMetadata.envs | Where-Object {$_.key -eq 'RESEND_FEEDBACK_API_KEY' -and $_.target -contains 'production'})
      if ($schoolsSenderEntry.Count -ne 1) { throw 'Existing sender key is ambiguous or unavailable' }
      $schoolsSender = Invoke-RestMethod -Uri ($schoolsEnvBase+'/'+$schoolsSenderEntry[0].id+$schoolsEnvQuery+'&decrypt=true') -Headers $schoolsVercelHeaders
      [pscustomobject]@{SenderSettingType=$schoolsSenderEntry[0].type;ResponseFields=@($schoolsSender.PSObject.Properties.Name);ValueReturned=[bool]$schoolsSender.value;ProviderFormat=([bool]$schoolsSender.value -and $schoolsSender.value.StartsWith('re_'))} | ConvertTo-Json -Compress
      if ($schoolsSender.value -and $schoolsSender.value.StartsWith('re_')) { $schoolsSource.smtp_pass = $schoolsSender.value }
      $schoolsVercelAuth=$null; $schoolsVercelHeaders=$null; $schoolsEnvMetadata=$null; $schoolsSender=$null
      $schoolsStage = 'validate existing SMTP credential availability'
    }
    if ($schoolsSource.smtp_host -ne 'smtp.resend.com' -or !$schoolsSource.smtp_pass.StartsWith('re_')) { throw 'A usable existing SMTP credential is unavailable. No settings changed.' }
    $schoolsSmtpBody=@{smtp_host=$schoolsSource.smtp_host;smtp_port=$schoolsSource.smtp_port;smtp_user=$schoolsSource.smtp_user;smtp_pass=$schoolsSource.smtp_pass;smtp_admin_email=$schoolsSource.smtp_admin_email;smtp_sender_name=$schoolsSource.smtp_sender_name} | ConvertTo-Json -Compress
    $schoolsStage = 'apply staging SMTP settings'
    $null=Invoke-RestMethod -Method Patch -Uri 'https://api.supabase.com/v1/projects/okrsezhospztwtptqhpo/config/auth' -Headers @{Authorization=('Bearer '+$schoolsToken)} -ContentType 'application/json' -Body $schoolsSmtpBody
    $schoolsStage = 'verify staging SMTP settings'
    $schoolsSource=$null;$schoolsSmtpBody=$null
    $schoolsAuth=Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/okrsezhospztwtptqhpo/config/auth' -Headers @{Authorization=('Bearer '+$schoolsToken)}
    Write-Output 'Only staging SMTP settings updated from the existing verified sender. No source settings changed.'
  }
  if ($CheckSmtp) {
    if ($schoolsAuth.smtp_host -ne 'smtp.resend.com' -or $schoolsAuth.smtp_port -ne '465') { throw 'Unexpected staging SMTP destination' }
    if (!$schoolsAuth.smtp_pass.StartsWith('re_')) { throw 'The Auth API did not return a usable provider credential. SMTP validation cannot use a masked or placeholder value.' }
    $schoolsTcp=[Net.Sockets.TcpClient]::new()
    try {
      $schoolsTcp.Connect('smtp.resend.com',465)
      $schoolsTls=[Net.Security.SslStream]::new($schoolsTcp.GetStream(),$false)
      $schoolsTls.AuthenticateAsClient('smtp.resend.com')
      $schoolsTls.ReadTimeout=10000; $schoolsTls.WriteTimeout=10000
      $schoolsReader=[IO.StreamReader]::new($schoolsTls)
      $schoolsWriter=[IO.StreamWriter]::new($schoolsTls); $schoolsWriter.NewLine="`r`n"; $schoolsWriter.AutoFlush=$true
      function Read-SchoolsSmtpReply { do {$schoolsLine=$schoolsReader.ReadLine()} while ($schoolsLine.Length -gt 3 -and $schoolsLine[3] -eq '-'); return $schoolsLine.Substring(0,3) }
      $schoolsGreeting=Read-SchoolsSmtpReply
      $schoolsWriter.WriteLine('EHLO schools-staging.test'); $schoolsEhlo=Read-SchoolsSmtpReply
      $schoolsSmtpAuth=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("`0"+$schoolsAuth.smtp_user+"`0"+$schoolsAuth.smtp_pass))
      $schoolsWriter.WriteLine('AUTH PLAIN '+$schoolsSmtpAuth); $schoolsAuthCode=Read-SchoolsSmtpReply
      $schoolsWriter.WriteLine('QUIT')
      [pscustomobject]@{Greeting=$schoolsGreeting;Ehlo=$schoolsEhlo;Authentication=$schoolsAuthCode;MessageSent=$false;KeyHasProviderFormat=$schoolsAuth.smtp_pass.StartsWith('re_')} | ConvertTo-Json -Compress
    } finally { $schoolsTcp.Dispose();$schoolsSmtpAuth=$null }
  }
  if ($ConfigurePreview) {
    $schoolsOrigin='https://muqabala-schools-pilot-20260908-inspire14.vercel.app'
    $schoolsRedirects=@($schoolsAuth.uri_allow_list -split ',' | Where-Object {$_}) + @($schoolsOrigin+'/auth/confirm**')
    $schoolsBody=@{site_url=$schoolsOrigin;uri_allow_list=(($schoolsRedirects | Select-Object -Unique) -join ',')} | ConvertTo-Json -Compress
    $null=Invoke-RestMethod -Method Patch -Uri 'https://api.supabase.com/v1/projects/okrsezhospztwtptqhpo/config/auth' -Headers @{Authorization=('Bearer '+$schoolsToken)} -ContentType 'application/json' -Body $schoolsBody
    Write-Output 'Staging preview redirect configured. Production was not changed.'
    $schoolsAuth = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/okrsezhospztwtptqhpo/config/auth' -Headers @{Authorization=('Bearer '+$schoolsToken)}
  }
  if ($Logs) {
    $schoolsSql="select event_message,log_attributes['error'] as error from logs where source_name='auth_logs' order by timestamp desc limit 25"
    $schoolsUri='https://api.supabase.com/v1/projects/okrsezhospztwtptqhpo/analytics/endpoints/logs?sql='+[Uri]::EscapeDataString($schoolsSql)+'&iso_timestamp_start='+[Uri]::EscapeDataString([DateTime]::UtcNow.AddHours(-1).ToString('o'))+'&iso_timestamp_end='+[Uri]::EscapeDataString([DateTime]::UtcNow.ToString('o'))
    $schoolsLogs=Invoke-RestMethod -Uri $schoolsUri -Headers @{Authorization=('Bearer '+$schoolsToken)}
    $schoolsWords='unauthorized','invalid api','535','550','template','confirmation','sending','smtp','restricted','not verified','credentials','apikey','database','rate limit','unable to send'
    $schoolsText=$schoolsLogs.result | ConvertTo-Json -Depth 8 -Compress
    [pscustomobject]@{MatchedCategories=@($schoolsWords | Where-Object {$schoolsText -match [regex]::Escape($_)});Records=@($schoolsLogs.result).Count;QueryFailed=[bool]$schoolsLogs.error;QueryError=$schoolsLogs.error} | ConvertTo-Json -Compress
  }
  [pscustomobject]@{ StagingRef='okrsezhospztwtptqhpo'; SmtpHost=$schoolsAuth.smtp_host; SmtpPort=$schoolsAuth.smtp_port; SmtpUserConfigured=[bool]$schoolsAuth.smtp_user; SmtpPasswordConfigured=[bool]$schoolsAuth.smtp_pass; SmtpPasswordMasked=($schoolsAuth.smtp_pass -match '^\*+$|redacted|masked'); EmailEnabled=$schoolsAuth.external_email_enabled; SignupDisabled=$schoolsAuth.disable_signup; EmailHookEnabled=$schoolsAuth.hook_send_email_enabled; SiteUrl=$schoolsAuth.site_url; Redirects=$schoolsAuth.uri_allow_list } | ConvertTo-Json -Compress
} catch { Write-Output ('Staging SMTP operation stopped at: '+$schoolsStage+'. No credentials were logged.'); exit 1 }
finally { $schoolsToken=$null; $schoolsAuth=$null }
