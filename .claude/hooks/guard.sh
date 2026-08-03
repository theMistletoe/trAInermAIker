#!/usr/bin/env bash
# Claude Code PreToolUse guard.
#
# Deterministic backstop for irreversible / production commands. `permissions.deny`
# in settings.json only matches a single command string and misses chained or
# env-prefixed forms (`cd x && wrangler deploy`, `FOO=1 wrangler deploy`,
# `npm run db:migrate:remote || true`). This hook inspects the whole Bash command
# and DENIES the production/destructive set. It never allows — on the common path
# it exits 0 silently so the normal permissions (allow/ask) flow still applies.
#
# Contract (PreToolUse): read JSON on stdin; to block, print a deny decision and
# exit 0; to pass through, emit nothing and exit 0.

set -uo pipefail

# Degrade gracefully if jq is unavailable: never wedge every Bash call.
command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty')"
[[ "$tool" != "Bash" ]] && exit 0

cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
# Collapse newlines so multi-line / chained commands match as one string.
norm="$(printf '%s' "$cmd" | tr '\n' ' ')"

deny() {
  jq -nc --arg r "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# --- Irreversible / production ---
case "$norm" in
  *db:migrate:remote*) deny "Blocked: db:migrate:remote alters PRODUCTION D1. Use 'npm run db:migrate:local'." ;;
  *db:create:remote*)  deny "Blocked: db:create:remote creates PRODUCTION D1 (one-time manual task)." ;;
esac

if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])(npx[[:space:]]+)?wrangler[[:space:]]+deploy(\b|$)'; then
  deny "Blocked: 'wrangler deploy' targets PRODUCTION. Deploys happen via CI on push to main."
fi
if printf '%s' "$norm" | grep -Eq 'wrangler[[:space:]]+d1[[:space:]].*--remote'; then
  deny "Blocked: 'wrangler d1 ... --remote' touches PRODUCTION D1."
fi
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])npm[[:space:]]+run[[:space:]]+deploy(:prod)?(\b|$)'; then
  deny "Blocked: 'npm run deploy/deploy:prod' deploys to PRODUCTION."
fi

# --- History destruction ---
if printf '%s' "$norm" | grep -Eq 'git[[:space:]]+push[[:space:]].*(--force(-with-lease)?|[[:space:]]-f(\b|$))'; then
  deny "Blocked: force-push rewrites shared history. If you truly need it, run it yourself outside the agent."
fi

exit 0
