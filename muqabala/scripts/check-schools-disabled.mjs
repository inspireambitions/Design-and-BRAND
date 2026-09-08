import assert from 'node:assert/strict';
import { readdir, writeFile } from 'node:fs/promises';
const origin=process.env.SCHOOLS_CHECK_ORIGIN??'http://127.0.0.1:3109';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Use a local build for this check');
const results=[];
for(const root of ['app/schools','app/api/schools']) {
  for(const file of await readdir(root,{recursive:true})) {
    if(!/(?:^|[/\\])(page|route)\.tsx?$/.test(file))continue;
    const route=('/'+root.replace(/^app\//,'')+'/'+file.replaceAll('\\','/')).replace(/\/(page|route)\.tsx?$/,'').replace(/\[[^\]]+\]/g,'00000000-0000-4000-8000-000000000001');
    const methods=root.includes('/api/')?['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']:['GET','HEAD'];
    for(const method of methods) {
      const response=await fetch(origin+route,{method,redirect:'manual',signal:AbortSignal.timeout(10000)});
      assert.equal(response.status,404,method+' '+route);
      results.push({method,route,status:response.status});
    }
  }
}
for(const route of ['/','/practice','/for-employers']) {
  const response=await fetch(origin+route,{signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,route);results.push({method:'GET',route,status:response.status});
}
await writeFile('../docs/schools-disabled-http-check.json',JSON.stringify({checkedAt:new Date().toISOString(),origin,results},null,2)+'\n');
console.log(results.length+' HTTP checks passed. Schools is unavailable; existing public entry pages respond.');
