import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {register} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
import {PGlite} from '@electric-sql/pglite';

register('./test-hooks/ts-paths.mjs',import.meta.url);
const {processSchoolsPilotMail}=await import('../lib/schools/pilot-mail.ts');
const {ResendEmailProvider,EmailProviderError}=await import('../lib/practice-plan/email-provider.ts');
const input={institution:'Synthetic college',name:'Synthetic contact',email:'pilot@example.test',message:'Private synthetic enquiry'};
const migration='20260916090000_schools_pilot_enquiry_outbox.sql';

test('pilot transactions, idempotency, founder authorization and mail leases',async t=>{
  const db=new PGlite();
  const founder=randomUUID(),outsider=randomUUID();
  const query=async(sql,args=[])=> (await db.query(sql,args)).rows;
  const submit=async(id=randomUUID(),overrides={},available=true)=>{
    const p={...input,...overrides};
    return (await query('select schools_submit_pilot_contact($1,$2,$3,$4,$5,$6) as result',
      [p.institution,p.name,p.email,p.message,id,available]))[0].result;
  };
  const inbox=async(size=25,offset=0,actor=founder)=>(await query('select schools_pilot_inbox_page($1,$2,$3) as result',[actor,size,offset]))[0].result;
  const claim=async()=>{const id=randomUUID();return {id,jobs:(await query('select schools_claim_pilot_mail($1) as jobs',[id]))[0].jobs};};
  const finish=async(id,lease,receipt=null,permanent=false)=>(await query('select schools_finish_pilot_mail($1,$2,$3,$4) as ok',[id,lease,receipt,permanent]))[0].ok;
  const clear=()=>db.exec('delete from schools_private.pilot_contacts');
  const dbAdmin={rpc:async(name,args)=>{
    const calls={
      schools_claim_pilot_mail:['select schools_claim_pilot_mail($1) as result',[args.claim]],
      schools_finish_pilot_mail:['select schools_finish_pilot_mail($1,$2,$3,$4) as result',[args.message,args.claim,args.provider_id,args.permanent_failure]],
    };
    assert.ok(calls[name],name);
    const [sql,values]=calls[name];
    return {data:(await query(sql,values))[0].result,error:null};
  }};
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create function auth.jwt() returns jsonb language sql as 'select jsonb_build_object(''session_id'',nullif(current_setting(''request.jwt.claim.sub'',true),''''))';
      grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role;`);
    const directory=new URL('../supabase/migrations/',import.meta.url);
    for(const name of readdirSync(directory).filter(n=>n.includes('_schools_')&&n<migration).sort())await db.exec(readFileSync(new URL(name,directory),'utf8'));
    await db.query('insert into auth.users(id) values($1),($2)',[founder,outsider]);
    await db.query('insert into schools_staff(user_id) values($1)',[founder]);
    const legacy=(await query('select schools_pilot_contact($1,$2,$3,$4) as id',Object.values(input)))[0].id;
    await db.exec(readFileSync(new URL(migration,directory),'utf8'));
    await db.exec('set role service_role');

    await t.test('legacy contacts remain visible without retroactive mail; old inbox stays compatible',async()=>{
      const page=await inbox();assert.equal(page.total,1);assert.equal(page.items[0].id,legacy);
      assert.equal(page.items[0].status,'new');assert.deepEqual(page.items[0].mail,[]);
      assert.equal(page.items[0].owner_email,'hello@trymuqabala.com');
      assert.equal((await query('select schools_pilot_inbox() as items'))[0].items[0].id,legacy);
      await clear();
    });
    await t.test('new submissions atomically persist the contact and exactly two correctly addressed jobs',async()=>{
      const result=await submit();assert.equal(result.acknowledgement,'queued');
      const jobs=await query('select * from schools_private.pilot_mail_outbox order by kind');assert.equal(jobs.length,2);
      assert.deepEqual(jobs.map(j=>j.recipient),['pilot@example.test','hello@trymuqabala.com']);
      for(const job of jobs){assert.equal(job.contact_id,result.reference);assert.equal(job.reply_to,'hello@trymuqabala.com');
        assert.equal(job.sender,'Muqabala Schools <hello@auth.trymuqabala.com>');assert.ok(job.body_text.includes(result.reference));
        assert.ok(!job.body_text.includes(input.message));assert.ok(!job.body_text.includes(input.institution));}
      await clear();
    });
    await t.test('an outbox failure rolls back the enquiry too',async()=>{
      await db.exec(`reset role;
        create function schools_private.test_fail_pilot_mail() returns trigger language plpgsql as $$begin raise exception 'synthetic outbox failure'; end;$$;
        create trigger test_fail_pilot_mail before insert on schools_private.pilot_mail_outbox for each row execute function schools_private.test_fail_pilot_mail();
        set role service_role;`);
      await assert.rejects(()=>submit(),/synthetic outbox failure/);
      assert.equal((await inbox()).total,0);
      await db.exec('reset role; drop trigger test_fail_pilot_mail on schools_private.pilot_mail_outbox; drop function schools_private.test_fail_pilot_mail(); set role service_role;');
    });
    await t.test('twenty simultaneous requests replay one reference; altered payload conflicts without overwriting',async()=>{
      const id=randomUUID();const results=await Promise.all(Array.from({length:20},()=>submit(id)));
      assert.equal(new Set(results.map(r=>r.reference)).size,1);assert.equal((await inbox()).total,1);
      assert.equal((await query('select count(*)::int as n from schools_private.pilot_mail_outbox'))[0].n,2);
      for(const [field,value] of Object.entries({institution:'Different',name:'Another',email:'other@example.test',message:'Changed'})){
        await assert.rejects(()=>submit(id,{[field]:value}),error=>error.code==='23505');
      }
      assert.equal((await inbox()).items[0].message,input.message);await clear();
    });
    await t.test('competing different payloads have one winner; distinct UUIDs remain separate',async()=>{
      const id=randomUUID();const results=await Promise.allSettled([submit(id),submit(id,{message:'Another payload'})]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'23505');
      await submit();assert.equal((await inbox()).total,2);await clear();
    });
    await t.test('mail unavailability does not lose the enquiry or jobs; same-ID retry recovers availability',async()=>{
      const id=randomUUID();const first=await submit(id,{},false);assert.equal(first.acknowledgement,'unavailable');
      const replay=await submit(id);assert.equal(replay.reference,first.reference);assert.equal(replay.acknowledgement,'queued');
      assert.equal((await claim()).jobs.length,2);await clear();
    });
    await t.test('legacy no-ID API and four-argument RPC remain supported',async()=>{
      const first=await submit(null);const second=await submit(null);assert.notEqual(first.reference,second.reference);
      const old=(await query('select schools_pilot_contact($1,$2,$3,$4) as id',Object.values(input)))[0].id;
      assert.ok(old);assert.equal((await inbox()).total,3);
      assert.equal((await query('select count(*)::int as n from schools_private.pilot_mail_outbox'))[0].n,6);await clear();
    });
    await t.test('founder pagination puts unanswered first, includes mail, and records status actor',async()=>{
      const refs=[];for(let i=0;i<5;i++)refs.push((await submit()).reference);
      assert.equal((await query("select schools_update_pilot_contact($1,$2,'replied') as ok",[founder,refs[4]]))[0].ok,true);
      assert.equal((await query("select schools_update_pilot_contact($1,$2,'closed') as ok",[founder,refs[3]]))[0].ok,true);
      const first=await inbox(2),second=await inbox(2,first.nextOffset),third=await inbox(2,second.nextOffset);
      const all=[...first.items,...second.items,...third.items];assert.equal(new Set(all.map(x=>x.id)).size,5);
      assert.ok(all.slice(0,3).every(x=>x.status==='new'));assert.ok(all.slice(3).every(x=>x.updated_by===founder));
      assert.equal(first.total,5);assert.equal(third.nextOffset,null);assert.equal(first.items[0].mail.length,2);
      assert.ok(first.items[0].mail.every(job=>job.canRetry===false&&job.providerMessageId===null));
      await assert.rejects(()=>inbox(101),/Invalid pagination/);await assert.rejects(()=>inbox(25,-1),/Invalid pagination/);
      await assert.rejects(()=>query("select schools_update_pilot_contact($1,$2,'sent')",[founder,refs[0]]),/Invalid enquiry status/);
      assert.equal((await query("select schools_update_pilot_contact($1,$2,'new') as ok",[founder,randomUUID()]))[0].ok,false);await clear();
    });
    await t.test('service role requires a schools_staff actor; browser roles cannot invoke privileged RPCs or read content',async()=>{
      const reference=(await submit()).reference;const message=(await inbox()).items[0].mail[0].id;
      await assert.rejects(()=>inbox(25,0,outsider),/Founder access required/);
      await assert.rejects(()=>query("select schools_update_pilot_contact($1,$2,'replied')",[outsider,reference]),/Founder access required/);
      await assert.rejects(()=>query('select schools_retry_pilot_mail($1,$2)',[outsider,message]),/Founder access required/);
      const calls=[['select schools_pilot_inbox()',[]],['select schools_pilot_inbox_page($1)',[founder]],
        ["select schools_update_pilot_contact($1,$2,'closed')",[founder,reference]],['select schools_retry_pilot_mail($1,$2)',[founder,message]],
        ['select schools_claim_pilot_mail($1)',[randomUUID()]],['select schools_finish_pilot_mail($1,$2,null)',[message,randomUUID()]],
        ['select schools_submit_pilot_contact($1,$2,$3,$4)',Object.values(input)],['select schools_pilot_contact($1,$2,$3,$4)',Object.values(input)],
        ['select * from schools_private.pilot_contacts',[]],['select * from schools_private.pilot_mail_outbox',[]]];
      for(const role of ['anon','authenticated']){
        await db.exec('reset role; set role '+role);
        for(const [sql,args] of calls)await assert.rejects(()=>query(sql,args),error=>error.code==='42501');
      }
      await db.exec('reset role; set role service_role');await clear();
    });
    await t.test('concurrent workers claim each message once, bounded to two jobs per lease',async()=>{
      for(let i=0;i<6;i++)await submit();
      const claims=await Promise.all(Array.from({length:10},claim));const jobs=claims.flatMap(c=>c.jobs);
      assert.equal(jobs.length,12);assert.equal(new Set(jobs.map(j=>j.id)).size,12);assert.ok(claims.every(c=>c.jobs.length<=2));await clear();
    });
    await t.test('backoff, expired leases and stale completion cannot overwrite a newer claim',async()=>{
      await submit();const first=await claim();const id=first.jobs[0].id;
      assert.equal(await finish(id,randomUUID(),'wrong'),false);
      assert.equal(await finish(id,first.id),true);assert.equal((await claim()).jobs.length,0);
      await query("update schools_private.pilot_mail_outbox set next_at=now()-interval '1 second' where id=$1",[id]);
      const second=await claim();assert.equal(second.jobs.length,1);
      assert.equal(await finish(id,first.id,'stale'),false);
      await query("update schools_private.pilot_mail_outbox set claim_expires_at=now()-interval '1 second' where id=$1",[id]);
      assert.equal(await finish(id,second.id,'expired'),false);
      const third=await claim();assert.equal(third.jobs.length,1);
      assert.equal(await finish(id,third.id,'accepted-receipt'),true);
      const state=(await query('select * from schools_private.pilot_mail_outbox where id=$1',[id]))[0];
      assert.equal(state.status,'accepted');assert.equal(state.attempts,3);assert.equal((await claim()).jobs.length,0);await clear();
    });
    await t.test('expired fifth leases are visibly failed before cron runs and can be retried only inside the window',async()=>{
      const saved=await submit();await claim();
      await db.exec("update schools_private.pilot_mail_outbox set attempts=5,claim_expires_at=now()-interval '1 second'");
      const before=(await inbox()).items[0].mail;assert.ok(before.every(j=>j.status==='failed'&&j.canRetry));
      assert.equal((await claim()).jobs.length,0);
      const id=before[0].id;await query('select schools_retry_pilot_mail($1,$2)',[founder,id]);
      assert.equal((await claim()).jobs.length,1);
      await db.exec("update schools_private.pilot_mail_outbox set first_attempted_at=now()-interval '24 hours',claim_expires_at=now()-interval '1 second'");
      assert.ok((await inbox()).items[0].mail.every(j=>!j.canRetry));
      await assert.rejects(()=>query('select schools_retry_pilot_mail($1,$2)',[founder,id]),/Inspect provider/);
      assert.equal((await claim()).jobs.length,0);
      assert.equal((await submit((await query('select submission_id from schools_private.pilot_contacts where id=$1',[saved.reference]))[0].submission_id)).acknowledgement,'unavailable');
      await clear();
    });
    await t.test('unsent old mail gets its first lease and permanent failures remain visible',async()=>{
      await submit();await db.exec("update schools_private.pilot_mail_outbox set created_at=now()-interval '3 days'");
      const batch=await claim();assert.equal(batch.jobs.length,2);
      for(const job of batch.jobs)assert.equal(await finish(job.id,batch.id,null,true),true);
      assert.ok((await inbox()).items[0].mail.every(j=>j.status==='failed'&&j.failureCode==='provider_permanent'));
      assert.equal((await claim()).jobs.length,0);await clear();
    });
    await t.test('lost database receipts replay identical provider requests without duplicate acceptance',async()=>{
      await submit();const accepted=new Map(),requests=[];
      const provider={name:'local-idempotent',send:async message=>{
        requests.push(message);const previous=accepted.get(message.idempotencyKey);
        if(previous)assert.deepEqual(message,previous);else accepted.set(message.idempotencyKey,structuredClone(message));
        return {providerMessageId:'synthetic-'+message.idempotencyKey};
      }};
      const lostReceipt={rpc:async(name,args)=>name==='schools_finish_pilot_mail'?{data:null,error:{code:'synthetic'}}:dbAdmin.rpc(name,args)};
      assert.deepEqual(await processSchoolsPilotMail(lostReceipt,provider),{accepted:0,failed:2});
      await db.exec("update schools_private.pilot_mail_outbox set claim_expires_at=now()-interval '1 second'");
      assert.deepEqual(await processSchoolsPilotMail(dbAdmin,provider),{accepted:2,failed:0});
      assert.equal(requests.length,4);assert.equal(accepted.size,2);
      assert.ok((await inbox()).items[0].mail.every(j=>j.status==='accepted'));
      assert.ok((await inbox()).items[0].mail.every(j=>j.providerMessageId==='synthetic-schools-pilot:'+j.id));
      assert.deepEqual(await processSchoolsPilotMail(dbAdmin,provider),{accepted:0,failed:0});await clear();
    });
    await t.test('worker failures store safe codes; transient and concurrent provider errors stay retryable',async()=>{
      for(const [kind,code,expected] of [['retryable','resend_503','queued'],['permanent','resend_409','queued'],['permanent','resend_422','failed']]){
        await submit();const result=await processSchoolsPilotMail(dbAdmin,{name:'synthetic',send:async()=>{throw new EmailProviderError(kind,code);}});
        assert.equal(result.failed,2);assert.ok((await inbox()).items[0].mail.every(j=>j.status===expected));await clear();
      }
    });
    await t.test('90-day enquiry retention cascades to email payloads and receipts',async()=>{
      await submit();await db.exec("update schools_private.pilot_contacts set created_at=now()-interval '91 days'");
      await query('select schools_queue_retention()');assert.equal((await inbox()).total,0);
      assert.equal((await query('select count(*)::int as n from schools_private.pilot_mail_outbox'))[0].n,0);
    });
  }finally{await db.close();}
});

function route({enabled=true,trusted=true,limited=false,key='synthetic-key',rpc=async()=>({data:{reference:randomUUID(),acknowledgement:'queued'},error:null})}={}){
  const calls=[];
  const deps={zod:{z},'@/lib/schools/access':{schoolsUnavailable:()=>enabled?null:Response.json({error:'Not found'},{status:404})},
    '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return rpc(name,args);}})},
    '@/lib/server/security':{hasTrustedOrigin:()=>trusted},'@/lib/rate-limit':{limitAuth:async()=>({limited})}};
  const code=ts.transpileModule(readFileSync(new URL('../app/api/schools/pilot-contact/route.ts',import.meta.url),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(code,{exports,Response,process:{env:{SCHOOLS_RESEND_API_KEY:key}},require:name=>{assert.ok(deps[name],name);return deps[name];}});
  return {calls,post:body=>exports.POST(new Request('https://trymuqabala.com/api/schools/pilot-contact',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}))};
}

test('pilot route returns only reference and acknowledgement after the transaction, with legacy callers supported',async()=>{
  const id=randomUUID(),reference=randomUUID();let release;
  const run=route({rpc:()=>new Promise(resolve=>{release=()=>resolve({data:{reference,acknowledgement:'queued'},error:null});})});
  let completed=false;const pending=run.post({...input,submissionId:id}).then(r=>{completed=true;return r;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false);release();
  const response=await pending;assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{reference,acknowledgement:'queued'});
  assert.equal(run.calls[0].name,'schools_submit_pilot_contact');assert.equal(run.calls[0].args.submission_id,id);
  const legacy=route();assert.equal((await legacy.post(input)).status,200);assert.equal(legacy.calls[0].args.submission_id,null);
});
test('pilot route rejects conflicts, malformed UUIDs and untrusted requests without leaking database errors',async()=>{
  const conflicting=route({rpc:async()=>({data:null,error:{code:'23505',message:input.message}})});
  const conflict=await conflicting.post({...input,submissionId:randomUUID()});assert.equal(conflict.status,409);assert.ok(!(await conflict.text()).includes(input.message));
  const invalid=route();assert.equal((await invalid.post({...input,submissionId:'invalid'})).status,400);assert.equal(invalid.calls.length,0);
  for(const [config,status] of [[{enabled:false},404],[{trusted:false},403],[{limited:true},429]]){
    const run=route(config);assert.equal((await run.post(input)).status,status);assert.equal(run.calls.length,0);
  }
  assert.equal((await route().post('{')).status,400);assert.equal((await route().post('x'.repeat(6001))).status,413);
  const outage=route({rpc:async()=>{throw new Error(input.message);}});const response=await outage.post(input);assert.equal(response.status,503);assert.ok(!(await response.text()).includes(input.message));
});
test('missing email configuration still persists, reports unavailable, and does not send inside POST',async()=>{
  const run=route({key:'',rpc:async()=>({data:{reference:randomUUID(),acknowledgement:'unavailable'},error:null})});
  assert.equal((await (await run.post(input)).json()).acknowledgement,'unavailable');assert.equal(run.calls[0].args.mail_available,false);
  assert.equal(run.calls.length,1);
});
test('Resend reply_to is optional and provider idempotency header is preserved',async()=>{
  const calls=[];const provider=new ResendEmailProvider('synthetic',async(url,options)=>{calls.push({url,options});return Response.json({id:'synthetic-acceptance'});});
  const message={to:'pilot@example.test',from:'Muqabala Schools <hello@auth.trymuqabala.com>',subject:'Synthetic',text:'Synthetic',html:'<p>Synthetic</p>',idempotencyKey:'synthetic-key'};
  await provider.send(message);await provider.send({...message,replyTo:'hello@trymuqabala.com',messageType:'schools_pilot_acknowledgement'});
  assert.ok(!Object.hasOwn(JSON.parse(calls[0].options.body),'reply_to'));
  assert.equal(JSON.parse(calls[1].options.body).reply_to,'hello@trymuqabala.com');
  assert.equal(calls[1].options.headers['Idempotency-Key'],'synthetic-key');
});

test('cron runs bounded institution and pilot batches concurrently and waits for both',async()=>{
  let releaseInstitution,releasePilot,institutionStarted=false,pilotStarted=false,complete=false;
  const institutionGate=new Promise(resolve=>{releaseInstitution=resolve;});
  const pilotGate=new Promise(resolve=>{releasePilot=resolve;});
  const admin={rpc:async name=>({data:name==='schools_claim_mail'?[{id:randomUUID(),kind:'privacy',recipient_user_id:randomUUID(),payload_id:randomUUID()}]:true,error:null}),
    auth:{admin:{getUserById:async()=>({data:{user:{email:'fixture@example.test'}}})}}};
  const deps={'server-only':{},'node:crypto':{randomUUID},zod:{z},'../supabase/admin':{createAdminClient:()=>admin},
    '../server/security':{configuredOrigin:()=> 'https://trymuqabala.com'},
    '../practice-plan/email-provider':{ResendEmailProvider:class {async send(){institutionStarted=true;await institutionGate;return {providerMessageId:'synthetic'};}}},
    './mail-crypto':{openSchoolsMail:()=>null},'./access':{requireSchoolsEnabled:()=>{}},
    './pilot-mail':{processSchoolsPilotMail:async()=>{pilotStarted=true;await pilotGate;return {accepted:2,failed:0};}}};
  const code=ts.transpileModule(readFileSync(new URL('../lib/schools/mail.ts',import.meta.url),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(code,{exports,URL,process:{env:{SCHOOLS_RESEND_API_KEY:'synthetic'}},require:name=>{assert.ok(deps[name],name);return deps[name];}});
  const pending=exports.processSchoolsMail().then(result=>{complete=true;return result;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(institutionStarted,true);assert.equal(pilotStarted,true);
  releasePilot();await new Promise(resolve=>setImmediate(resolve));assert.equal(complete,false);
  releaseInstitution();assert.deepEqual(JSON.parse(JSON.stringify(await pending)),{sent:1,pilotAccepted:2,failed:0});
  const routeSource=readFileSync(new URL('../app/api/schools/mail/route.ts',import.meta.url),'utf8');
  assert.match(routeSource,/maxDuration\s*=\s*120/);
});

function inboxRoute({trusted=true,signedIn=true,actor=randomUUID(),result={data:true,error:null}}={}){
  const calls=[];
  const client={};
  const deps={
    zod:{z},
    '@/lib/schools/access':{schoolsUnavailable:()=>null},
    '@/lib/server/security':{hasTrustedOrigin:()=>trusted},
    '@/lib/supabase/server':{createClient:async()=>{calls.push({name:'createClient'});return client;}},
    '@/lib/supabase/admin':{createAdminClient:()=>{
      calls.push({name:'createAdminClient'});
      return {rpc:async(name,args)=>{calls.push({name,args:{...args}});return result;}};
    }},
    '@/lib/schools/session':{touchSchoolsSession:async received=>{
      assert.equal(received,client);calls.push({name:'touchSchoolsSession'});
      return signedIn?{user:{id:actor}}:null;
    }},
  };
  const source=readFileSync(new URL('../app/api/schools/pilot-inbox/route.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  vm.runInNewContext(code,{exports,Response,require:name=>{assert.ok(deps[name],name);return deps[name];}});
  return {actor,calls,rpcCalls:()=>calls.filter(call=>call.args),post:body=>exports.POST(new Request(
    'https://trymuqabala.com/api/schools/pilot-inbox',
    {method:'POST',body:typeof body==='string'?body:JSON.stringify(body)},
  ))};
}

test('pilot inbox denies untrusted origin before accessing session or storage',async()=>{
  const run=inboxRoute({trusted:false});
  const response=await run.post({operation:'status',contactId:randomUUID(),status:'replied'});
  assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'Request not allowed.'});
  assert.deepEqual(run.calls,[]);
});

test('pilot inbox requires an active session before calling a privileged RPC',async()=>{
  const run=inboxRoute({signedIn:false});
  const response=await run.post({operation:'retry_mail',messageId:randomUUID()});
  assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'Sign in again.'});
  assert.ok(run.calls.some(call=>call.name==='touchSchoolsSession'));assert.deepEqual(run.rpcCalls(),[]);
});

test('pilot inbox maps non-founder database denial to 403 without exposing database details',async()=>{
  for(const action of [{operation:'status',contactId:randomUUID(),status:'closed'},{operation:'retry_mail',messageId:randomUUID()}]){
    const run=inboxRoute({result:{data:null,error:{code:'42501',message:'Private synthetic database detail'}}});
    const response=await run.post(action);
    assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'Founder access is required.'});
    assert.equal(run.rpcCalls().length,1);assert.equal(run.rpcCalls()[0].args.actor,run.actor);
  }
});

test('pilot inbox rejects malformed actions and injected actor IDs before any mutation',async()=>{
  const actions=['{',null,{},
    {operation:'unknown',contactId:randomUUID()},
    {operation:'status',contactId:'invalid',status:'new'},
    {operation:'status',contactId:randomUUID(),status:'sent'},
    {operation:'status',contactId:randomUUID()},
    {operation:'status',contactId:randomUUID(),status:'closed',actor:randomUUID()},
    {operation:'retry_mail'},
    {operation:'retry_mail',messageId:'invalid'},
    {operation:'retry_mail',messageId:randomUUID(),actor:randomUUID()},
  ];
  for(const action of actions){
    const run=inboxRoute();const response=await run.post(action);
    assert.equal(response.status,400,JSON.stringify(action));
    assert.deepEqual(await response.json(),{error:'Check your request.'});assert.deepEqual(run.rpcCalls(),[]);
  }
});

test('pilot inbox updates each valid status using the verified session actor and agreed RPC arguments',async()=>{
  for(const status of ['new','replied','closed']){
    const run=inboxRoute(),contactId=randomUUID();
    const response=await run.post({operation:'status',contactId,status});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(await response.json(),{updated:true});
    assert.deepEqual(run.rpcCalls(),[{name:'schools_update_pilot_contact',args:{actor:run.actor,contact:contactId,new_status:status}}]);
  }
});

test('pilot inbox retries mail using the verified session actor and agreed RPC arguments',async()=>{
  const run=inboxRoute(),messageId=randomUUID();
  const response=await run.post({operation:'retry_mail',messageId});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{updated:true});
  assert.deepEqual(run.rpcCalls(),[{name:'schools_retry_pilot_mail',args:{actor:run.actor,message:messageId}}]);
});

test('pilot inbox returns 404 when the status RPC reports a missing contact',async()=>{
  const run=inboxRoute({result:{data:false,error:null}}),contactId=randomUUID();
  const response=await run.post({operation:'status',contactId,status:'replied'});
  assert.equal(response.status,404);assert.deepEqual(await response.json(),{error:'Request not found.'});
  assert.deepEqual(run.rpcCalls(),[{name:'schools_update_pilot_contact',args:{actor:run.actor,contact:contactId,new_status:'replied'}}]);
});
