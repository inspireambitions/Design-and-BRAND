import { createHash, randomBytes } from 'node:crypto';
export function newSchoolsSecret():string {return randomBytes(32).toString('base64url');}
export function schoolsSecretHash(secret:string):string {return createHash('sha256').update('schools-access-v1:'+secret).digest('hex');}
export function schoolsEmailHash(email:string):string {return createHash('sha256').update('schools-email-v1:'+email.trim().toLowerCase()).digest('hex');}
export function schoolsInternalEmail(grantId:string):string {return 'schools-'+grantId+'@accounts.trymuqabala.invalid';}
