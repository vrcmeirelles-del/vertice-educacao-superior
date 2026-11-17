import test from 'node:test';import assert from 'node:assert/strict';
import {totpCode} from '../../supabase/functions/enamed-homologation-fixtures/totp.mjs';
const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // Public RFC vector, not an account secret.
test('RFC 6238 SHA-1 reference vectors',async()=>{
 for(const [time,expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])assert.equal(await totpCode(secret,time,8),expected);
});
test('six digits and input validation',async()=>{
 assert.equal(await totpCode(secret,59),'287082');
 await assert.rejects(()=>totpCode('not a secret',59));await assert.rejects(()=>totpCode(secret,-1));
});
