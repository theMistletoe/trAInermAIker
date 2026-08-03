#!/usr/bin/env bash
# Claude Code Stop hook.
#
# Runs the trimmed verification pipeline (biome check / typecheck / vitest) after
# Claude finishes a turn. `build` is intentionally omitted — it's the slowest step
# and adds little over typecheck here; CI still runs the full set including build.
# If any step fails, blocks the stop with a reason so Claude continues and fixes it.

set -uo pipefail

# Stop hook may run in a non-interactive shell where nvm is not sourced, so
# node/npm aren't on PATH for nvm users. Source nvm to resolve them. Check for
# `node` rather than `npm` because shell init may define an `npm` *function*
# that masks `command -v npm` even when no real binary exists.
if ! command -v node >/dev/null 2>&1; then
  if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
  fi
fi

# Degrade gracefully if prerequisites are missing: don't wedge every turn.
command -v jq >/dev/null 2>&1 || exit 0
command -v node >/dev/null 2>&1 || exit 0

input="$(cat)"

# Break the loop: if we're already inside a stop-hook continuation, don't re-block.
if [[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" == "true" ]]; then
  exit 0
fi

log_dir=".claude/hooks/.logs"
mkdir -p "$log_dir"
: > "$log_dir/run.log"

failures=()
run_step() {
  local name="$1"
  shift
  local log_file="$log_dir/${name}.log"
  if "$@" >"$log_file" 2>&1; then
    printf '[verify] ok: %s\n' "$name" >> "$log_dir/run.log"
  else
    printf '[verify] FAILED: %s (exit=%s)\n' "$name" "$?" >> "$log_dir/run.log"
    failures+=("$name")
  fi
}

run_step "check"     npm run --silent check
run_step "typecheck" npm run --silent typecheck
run_step "test"      npm run --silent test

[[ ${#failures[@]} -eq 0 ]] && exit 0

joined="$(IFS=, ; echo "${failures[*]}")"
reason_file="$log_dir/stop-reason.txt"
{
  printf 'Post-turn verification failed: %s\n' "$joined"
  printf '(scripts: npm run check / typecheck / test — fix and re-run before ending the turn.)\n\n'
  for name in "${failures[@]}"; do
    printf -- '----- %s (last 100 lines) -----\n' "$name"
    tail -n 100 "$log_dir/${name}.log" 2>/dev/null || printf '(no log captured)\n'
    printf '\n'
  done
} > "$reason_file"

jq -Rs '{decision:"block", reason: .}' < "$reason_file"
exit 0
