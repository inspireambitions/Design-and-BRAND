// Browser errors can include private request headers. Never print raw failures.
let stage = 'initialisation';
export function qaStage(value) { stage = value; }
export function qaFailure() {
  console.error(JSON.stringify({failed: true, stage, detail: 'Private error details suppressed'}));
  process.exitCode = 1;
}
process.on('uncaughtException', () => { qaFailure(); process.exit(1); });
process.on('unhandledRejection', () => { qaFailure(); process.exit(1); });
