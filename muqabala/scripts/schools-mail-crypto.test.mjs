import test from 'node:test';
import assert from 'node:assert/strict';
import {sealSchoolsMail,openSchoolsMail} from '../lib/schools/mail-crypto.ts';
test('schools invitations encrypt recipients and links and reject tampering',()=>{
  const previous=process.env.SCHOOLS_DATA_KEY;process.env.SCHOOLS_DATA_KEY=Buffer.alloc(32,17).toString('base64');
  try{
    const payload={to:'fixture@example.test',url:'https://example.test/schools/staff#private'};
    const first=sealSchoolsMail(payload);const second=sealSchoolsMail(payload);
    assert.notEqual(first,second);assert.ok(!first.includes(payload.to));assert.deepEqual(openSchoolsMail(first),payload);
    const parts=first.split('.');const cipher=Buffer.from(parts[3],'base64url');cipher[0]^=1;parts[3]=cipher.toString('base64url');
    assert.throws(()=>openSchoolsMail(parts.join('.')));
    process.env.SCHOOLS_DATA_KEY=Buffer.alloc(32,18).toString('base64');assert.throws(()=>openSchoolsMail(first));
  }finally{if(previous===undefined)delete process.env.SCHOOLS_DATA_KEY;else process.env.SCHOOLS_DATA_KEY=previous;}
});
