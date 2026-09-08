import './schools-qa-errors.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export const previewOrigin='https://muqabala-schools-pilot-20260908-inspire14.vercel.app';
export async function previewAccess({rotate=false}={}){
  const auth=JSON.parse(readFileSync(join(process.env.APPDATA,'com.vercel.cli-inspire14','auth.json'),'utf8'));
  const headers={Authorization:'Bearer '+auth.token,'Content-Type':'application/json'};
  const query='?teamId=team_IlZz8UvetUXPtSvI4hPqy6fn';
  const aliasResponse=await fetch('https://api.vercel.com/v4/aliases/'+new URL(previewOrigin).hostname+query,{headers});
  if(!aliasResponse.ok)throw new Error('Preview alias lookup failed');const alias=await aliasResponse.json();
  if(alias.projectId!=='prj_mLU2A8yiW61V4a4da54GryoIcSXX')throw new Error('Preview project guard failed');
  if(rotate&&alias.protectionBypass){
    for(const secret of Object.keys(alias.protectionBypass)){
      const revoked=await fetch('https://api.vercel.com/aliases/'+alias.uid+'/protection-bypass'+query,{method:'PATCH',headers,body:JSON.stringify({revoke:{secret,regenerate:false}})});
      if(!revoked.ok)throw new Error('Preview sharing revocation failed');
    }
  }
  if(!rotate&&alias.protectionBypass&&Object.keys(alias.protectionBypass).length)return {protectionBypass:alias.protectionBypass};
  const response=await fetch('https://api.vercel.com/aliases/'+alias.uid+'/protection-bypass'+query,{method:'PATCH',headers,body:JSON.stringify({ttl:604800})});
  if(!response.ok)throw new Error('Preview sharing request failed: '+response.status);
  return response.json();
}
if(process.argv.includes('--check')){const result=await previewAccess();console.log(JSON.stringify({entries:Object.values(result.protectionBypass).map(value=>({fieldNames:Object.keys(value),scope:value.scope}))}));}
