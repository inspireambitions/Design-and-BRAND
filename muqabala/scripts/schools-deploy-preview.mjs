import {spawn} from 'node:child_process';
import {hkdfSync} from 'node:crypto';
import {stagingEnvironment} from './schools-staging-env.mjs';
const c=stagingEnvironment();
if(new URL(c.SUPABASE_URL).hostname!=='okrsezhospztwtptqhpo.supabase.co')throw new Error('Staging-only deployment guard failed');
// Stable only for this synthetic staging branch. Rotating its JWT secret requires reissuing queued staff invitations.
const stagingSecret=Buffer.from(hkdfSync('sha256',c.SUPABASE_JWT_SECRET,'okrsezhospztwtptqhpo','schools-synthetic-preview-v1',32)).toString('hex');
const settings={SCHOOLS_ENABLED:'true',SCHOOLS_FEEDBACK_MODEL:'gpt-4.1-mini',NEXT_PUBLIC_SUPABASE_URL:c.SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:c.SUPABASE_PUBLISHABLE_KEY||c.SUPABASE_ANON_KEY,SUPABASE_SECRET_KEY:c.SUPABASE_SERVICE_ROLE_KEY,APP_ORIGIN:'https://muqabala-schools-pilot-20260908-inspire14.vercel.app',INTERVIEW_SECRET:stagingSecret};
const args=[process.env.SCHOOLS_QA_VERCEL_CLI,'deploy','..','--yes','--target','preview','--scope','inspire14','--global-config',process.env.APPDATA+'/com.vercel.cli-inspire14'];
// Vercel requires provider metadata to attach branch-specific preview settings.
args.push('--meta','githubDeployment=1','--meta','githubCommitRef=codex/schools-pilot-20260908');
for(const key of Object.keys(settings))args.push('--env',key,'--build-env',key);
const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true,env:{...process.env,...settings,VERCEL_PROJECT_ID:'prj_mLU2A8yiW61V4a4da54GryoIcSXX',VERCEL_ORG_ID:'team_IlZz8UvetUXPtSvI4hPqy6fn'}});
child.on('exit',code=>process.exit(code??1));
