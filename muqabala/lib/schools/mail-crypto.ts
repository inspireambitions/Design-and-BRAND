import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
function key(){
  const configured=process.env.SCHOOLS_DATA_KEY;
  if(configured){const decoded=Buffer.from(configured,'base64');if(decoded.length!==32)throw new Error('Schools encryption key is invalid');return decoded;}
  const master=process.env.INTERVIEW_SECRET;if(!master||master.length<32)throw new Error('Schools encryption is not configured');
  return createHash('sha256').update('schools-mail-v1:'+master).digest();
}
export function sealSchoolsMail(value:unknown){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from('schools-mail-v1'));
  const text=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return ['s1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),text.toString('base64url')].join('.');}
export function openSchoolsMail(value:string):unknown{const [version,iv,tag,text,...extra]=value.split('.');if(version!=='s1'||!iv||!tag||!text||extra.length)throw new Error('Invalid schools envelope');
  const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64url'));decipher.setAAD(Buffer.from('schools-mail-v1'));decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(text,'base64url')),decipher.final()]).toString('utf8'));}
