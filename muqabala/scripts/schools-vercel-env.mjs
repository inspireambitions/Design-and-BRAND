import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export async function existingVercelEnvironment(){
  const directory=join(process.env.APPDATA,'com.vercel.cli-inspire14');
  const auth=JSON.parse(readFileSync(join(directory,'auth.json'),'utf8'));
  const team='team_IlZz8UvetUXPtSvI4hPqy6fn';
  const headers={Authorization:'Bearer '+auth.token};
  async function get(path){const response=await fetch('https://api.vercel.com'+path,{headers});if(!response.ok)throw new Error('Vercel environment read failed: '+response.status);return response.json();}
  const project=await get('/v9/projects/muqabala?teamId='+encodeURIComponent(team));
  const result=await get('/v10/projects/'+project.id+'/env?decrypt=false&teamId='+encodeURIComponent(team));
  return {projectId:project.id,teamId:team,availableNames:result.envs.map(e=>({name:e.key,targets:e.target}))};
}
if(process.argv.includes('--check')){const c=await existingVercelEnvironment();console.log(JSON.stringify({projectId:c.projectId,availableNames:c.availableNames.filter(n=>/OPENAI|SCHOOLS|RESEND|MAIL|CRON/.test(n.name)),valuesPrinted:false}));}
