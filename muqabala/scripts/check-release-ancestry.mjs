import { execFileSync } from 'node:child_process';
// Both releases must remain in the ancestry. Do not remove a baseline to make
// a stale checkout pass. Add each approved release when changing the workflow.
for (const commit of ['b5d6241', '47a076f']) {
  try { execFileSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { stdio: 'pipe', windowsHide: true }); }
  catch { throw new Error(`Release is missing required ancestor ${commit}. Merge the released fixes before deploying.`); }
}
console.log('Release ancestry includes the employer reliability and design releases.');
