#!/bin/bash
# Muqabala Post-Neb preview acceptance runner.
#
# This runner builds the app, starts a server it owns, runs the acceptance
# suite exactly once, captures the real exit code, shuts its own server down
# and writes a timestamped log to the Desktop.
#
# It never prints environment values. It refuses to run against a server it
# did not start.

set -u

REPO="/Users/kim/Library/CloudStorage/OneDrive-Personal/Code/muqabala-integration/muqabala"
PORT=3102
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$HOME/Desktop/post-neb-acceptance-$STAMP.log"
SERVERLOG="$HOME/Desktop/post-neb-server-$STAMP.log"
GUARDLOG="$HOME/Desktop/post-neb-network-guard-$STAMP.jsonl"
GUARD="$REPO/scripts/test-network-guard.mjs"
SERVER_PID=""
SUITE_EXIT=99

exec > >(tee -a "$LOG") 2>&1

finish() {
  if [ -n "$SERVER_PID" ]; then
    echo "Shutting down acceptance server pid $SERVER_PID"
    kill "$SERVER_PID" 2>/dev/null
    for i in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$SERVER_PID" 2>/dev/null
  fi
  echo ""
  echo "ACCEPTANCE_EXIT_CODE: $SUITE_EXIT"
  if [ "$SUITE_EXIT" -eq 0 ]; then
    echo "RESULT: PASS"
  else
    echo "RESULT: FAIL"
  fi
  echo "LOG: $LOG"
  echo "SERVER_LOG: $SERVERLOG"
  echo "NETWORK_GUARD_LOG: $GUARDLOG"
  if [ -f "$GUARDLOG" ]; then
    echo "NETWORK_GUARD_PRODUCTION_ENTRIES: $(grep -c '"kind":"production"' "$GUARDLOG" | tr -d ' ')"
    echo "NETWORK_GUARD_ISOLATED_ENTRIES: $(grep -c '"kind":"isolated"' "$GUARDLOG" | tr -d ' ')"
  fi
  echo ""
  echo "Acceptance run finished. You can close this window."
  sleep 1
}
trap finish EXIT

abort() {
  echo "RUNNER_ABORT: $1"
  SUITE_EXIT=4
  exit 4
}

echo "Muqabala Post-Neb acceptance run $STAMP"
echo "Repository: $REPO"
echo ""

cd "$REPO" || abort "repository folder not found"

# ---------------------------------------------------------------- environment
[ -f ".env.preview.local" ] || abort ".env.preview.local is missing"

# Next.js also loads .env.local and .env.production.local at start, so every
# local env file must be clean, not only the one this runner sources.
for envfile in .env.preview.local .env.local .env.production.local .env; do
  if [ -f "$envfile" ] && grep -q "hmaxzpgsefzpflrwzopa" "$envfile"; then
    abort "$envfile references the production project. Refusing to run."
  fi
done
if ! grep -q "flznnwurtwernztltnva" ".env.preview.local"; then
  abort "environment file does not reference the isolated preview project. Refusing to run."
fi
echo "ENVIRONMENT: isolated preview project only"

# ------------------------------------------------------- harness verification
HARDCODED_PASS_COUNT="$(grep -nE "[^=!<>]=[[:space:]]*['\"]PASS['\"]" scripts/post-neb-preview-acceptance.mjs | grep -v "?" | wc -l | tr -d ' ')"
echo "HARDCODED_PASS_COUNT: $HARDCODED_PASS_COUNT"
if [ "$HARDCODED_PASS_COUNT" != "0" ]; then
  abort "the acceptance harness still contains unconditional PASS assignments"
fi
[ -f "$GUARD" ] || abort "test network guard is missing at scripts/test-network-guard.mjs"
node --check "$GUARD" || abort "test network guard does not parse"
echo "NETWORK_GUARD: $GUARD"
echo "NETWORK_GUARD_LOG: $GUARDLOG"
: > "$GUARDLOG"

# ------------------------------------------------------------------ port 3102
EXISTING="$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null)"
if [ -n "$EXISTING" ]; then
  for pid in $EXISTING; do
    PCMD="$(ps -o command= -p "$pid" 2>/dev/null)"
    PCWD="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
    echo "Port $PORT is held by pid $pid (cwd: ${PCWD:-unknown})"
    case "$PCMD" in
      *next*|*node*)
        if [ "$PCWD" = "$REPO" ]; then
          echo "Stopping stale Muqabala server pid $pid from this repository"
          kill "$pid" 2>/dev/null
          sleep 3
          kill -9 "$pid" 2>/dev/null
        else
          abort "port $PORT is used by a process outside this repository. Close it and run again."
        fi
        ;;
      *)
        abort "port $PORT is used by an unrelated process. Close it and run again."
        ;;
    esac
  done
  sleep 2
  STILL="$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null)"
  [ -n "$STILL" ] && abort "port $PORT is still in use"
fi
echo "PORT_$PORT: free"

# ------------------------------------------------------------------- env load
set -a
# shellcheck disable=SC1091
. ./.env.preview.local
set +a

# ----------------------------------------------------------------------- build
echo ""
echo "Building..."
npm run build
BUILD_EXIT=$?
if [ "$BUILD_EXIT" -ne 0 ]; then
  echo "BUILD: FAILED"
  SUITE_EXIT=5
  exit 5
fi
echo "BUILD: CLEAN"

# ---------------------------------------------------------------------- server
echo ""
echo "Starting acceptance server on port $PORT (with test network guard)"
export ACCEPTANCE_GUARD_LOG="$GUARDLOG"
export NODE_OPTIONS="--import $GUARD"
node node_modules/next/dist/bin/next start -p "$PORT" > "$SERVERLOG" 2>&1 &
SERVER_PID=$!
export ACCEPTANCE_SERVER_PID="$SERVER_PID"
echo "ACCEPTANCE_SERVER_PID: $SERVER_PID"

READY=0
for i in $(seq 1 90); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; then READY=1; break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "SERVER: did not become ready. See $SERVERLOG"
  tail -n 20 "$SERVERLOG"
  SUITE_EXIT=6
  exit 6
fi
echo "SERVER: ready"

OWNER="$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"
echo "PORT_OWNER_PIDS: $OWNER"

# -------------------------------------------------------------------- run once
echo ""
echo "Running the acceptance suite once..."
node scripts/post-neb-preview-acceptance.mjs
SUITE_EXIT=$?

exit "$SUITE_EXIT"
