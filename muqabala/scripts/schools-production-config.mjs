import './schools-qa-errors.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
// Run only after approval of production Schools configuration. Never log input values.
if(!process.argv.includes('--approved-production-activation'))throw new Error('Explicit production activation approval is required');
const sender=process.env.SCHOOLS_QA_SENDER;delete process.env.SCHOOLS_QA_SENDER;
if(!/^re_[A-Za-z0-9_-]+$/.test(sender??''))throw new Error('Dedicated production sender key required');
const auth=JSON.parse(readFileSync(join(process.env.APPDATA,'com.vercel.cli-inspire14/auth.json'),'utf8'));
const url='https://api.vercel.com/v10/projects/prj_mLU2A8yiW61V4a4da54GryoIcSXX/env?teamId=team_IlZz8UvetUXPtSvI4hPqy6fn';
const headers={Authorization:'Bearer '+auth.token,'Content-Type':'application/json'};
const response=await fetch(url+'&decrypt=false',{headers});if(!response.ok)throw new Error('Production metadata unavailable');const envs=(await response.json()).envs;
for(const name of ['CRON_SECRET','OPENAI_API_KEY','INTERVIEW_SECRET'])if(!envs.some(e=>e.key===name&&e.target.includes('production')))throw new Error('Production prerequisite missing');
// Fail closed on a repeat, rather than rotating a key used by pending invitations.
if(envs.some(e=>e.target.includes('production')&&['SCHOOLS_DATA_KEY','SCHOOLS_RESEND_API_KEY'].includes(e.key)))throw new Error('Existing Schools production keys require preservation');
const settings={SCHOOLS_ENABLED:'true',SCHOOLS_FEEDBACK_MODEL:'gpt-4.1-mini',SCHOOLS_EMAIL_FROM:'Muqabala Schools <hello@auth.trymuqabala.com>',SCHOOLS_RESEND_API_KEY:sender,SCHOOLS_DATA_KEY:randomBytes(32).toString('base64')};
const saved=await fetch(url+'&upsert=true',{method:'POST',headers,body:JSON.stringify(Object.entries(settings).map(([key,value])=>({key,value,target:['production'],type:/KEY/.test(key)?'sensitive':'plain'})))});
if(!saved.ok)throw new Error('Production configuration failed');const body=await saved.json();if(body.error||body.failed?.length)throw new Error('Production configuration requires verification');
console.log(JSON.stringify({configured:Object.keys(settings),production:true,valuesPrinted:false,existingProductSecretsChanged:false}));
