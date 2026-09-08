export function isSchoolsDestination(next: string | undefined): boolean {
  const path=(next??'').split(/[?#]/,1)[0];
  return path==='/schools'||path.startsWith('/schools/');
}
/** Product sign-in must not claim an unrelated practice attempt on this browser. */
export function shouldClaimPracticeAttempt(next: string): boolean {
  const path = next.split(/[?#]/, 1)[0];
  return !(path === '/employer' || path.startsWith('/employer/')
    || path === '/for-employers' || path.startsWith('/for-employers/')
    || path === '/schools' || path.startsWith('/schools/'));
}
