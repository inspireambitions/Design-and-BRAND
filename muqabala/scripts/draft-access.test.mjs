import test from 'node:test';
import assert from 'node:assert/strict';
import { draftAccess } from '../lib/draft-access.ts';

test('lost draft access remains separate from temporary server or network failures', async () => {
  for (const [status,expected] of [[200,'ready'],[404,'missing'],[429,'retry'],[503,'retry']]) {
    assert.equal(await draftAccess('saved/id',async (url,options)=>{
      assert.equal(url,'/api/interviews/saved%2Fid/report');
      assert.equal(options.cache,'no-store');
      return new Response(null,{status});
    }),expected);
  }
  assert.equal(await draftAccess('saved',async()=>{throw new Error('offline');}),'retry');
});
