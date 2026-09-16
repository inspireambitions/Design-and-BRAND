import {spawnSync} from 'node:child_process';
export function stagingEnvironment(){
  const windows=process.platform==='win32';
  const command=windows?'cmd.exe':'./node_modules/.bin/supabase';
  const args=windows?['/d','/s','/c','node_modules\\.bin\\supabase.cmd branches get staging-release-gate --project-ref hmaxzpgsefzpflrwzopa -o json --log-level error']:['branches','get','staging-release-gate','--project-ref','hmaxzpgsefzpflrwzopa','-o','json','--log-level','error'];
  const result=spawnSync(command,args,{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
  if(result.status!==0)throw new Error('Staging connection lookup failed. No connection values were logged.');
  let config;try{config=JSON.parse(result.stdout);}catch{throw new Error('Staging connection response was not JSON.');}
  return config;
}
if(process.argv.includes('--check')){
  const config=stagingEnvironment();console.log(JSON.stringify({availableFields:Object.keys(config),valuesPrinted:false}));
}
