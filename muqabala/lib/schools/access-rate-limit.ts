import {createHash} from 'node:crypto';
import {Ratelimit} from '@upstash/ratelimit';
import {Redis} from '@upstash/redis';

type Decision={limited:boolean;retryAfterSeconds:number};
type Bucket='ip'|'secret'|'actor';
const limits={ip:300,secret:8,actor:60} as const;
const windowMs=600_000;
const redis=process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN
  ?new Redis({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN}):null;
const shared=Object.fromEntries(Object.entries(limits).map(([bucket,count])=>[bucket,redis?new Ratelimit({redis,
  limiter:Ratelimit.slidingWindow(count,'10 m'),prefix:`muqabala:schools:access:${bucket}`,analytics:false,timeout:1000}):null])) as Record<Bucket,Ratelimit|null>;
const local=new Map<string,{count:number;reset:number}>();
function localDecision(key:string,limit:number):Decision {
  const now=Date.now();
  let entry=local.get(key);
  if(!entry||entry.reset<=now){
    // Bound memory even when an attacker keeps changing codes or addresses.
    if(local.size>=10_000){for(const [key,value] of local)if(value.reset<=now)local.delete(key);}
    if(local.size>=10_000)return {limited:true,retryAfterSeconds:60};
    entry={count:0,reset:now+windowMs};local.set(key,entry);
  }
  entry.count++;
  return {limited:entry.count>limit,retryAfterSeconds:entry.count>limit?Math.max(1,Math.ceil((entry.reset-now)/1000)):0};
}
async function limit(bucket:Bucket,value:string):Promise<Decision>{
  // Neither bearer secrets, account IDs nor raw addresses enter Redis or logs.
  const key=createHash('sha256').update(`${bucket}:${value}`).digest('hex');
  const limiter=shared[bucket];
  if(limiter){
    try {
      const result=await limiter.limit(key);
      if(result.reason!=='timeout')return {limited:!result.success,retryAfterSeconds:result.success?0:Math.max(1,Math.ceil((result.reset-Date.now())/1000))};
    }catch{ /* Use the bounded per-instance fallback without logging request data. */ }
  }
  return localDecision(`${bucket}:${key}`,limits[bucket]);
}
export function limitSchoolsAccessIp(request:Request){
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||'unknown';
  return limit('ip',ip);
}
export function limitSchoolsRedemption(secret:string){return limit('secret',secret);}
export function limitSchoolsIssuance(verifiedActorId:string){return limit('actor',verifiedActorId);}
export function schoolsAccessLimitResponse(decision:Decision){
  return decision.limited?Response.json({error:'Please wait before trying again.'},{status:429,
    headers:{'Retry-After':String(decision.retryAfterSeconds),'Cache-Control':'no-store'}}):null;
}
