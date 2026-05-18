#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOOK_SCRIPT="${REPO_ROOT}/scripts/codex-lifecycle-hook.sh"
CODEX_CONFIG="${CODEX_CONFIG:-$HOME/.codex/config.toml}"
CODEX_HOOKS_JSON="${CODEX_HOOKS_JSON:-$HOME/.codex/hooks.json}"
STRICT="${STRICT_CODEX_LIFECYCLE_HOOKS:-0}"

failures=0
warnings=0

fail() {
  echo "FAIL $*" >&2
  failures=$((failures + 1))
}

warn() {
  echo "WARN $*" >&2
  warnings=$((warnings + 1))
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "missing file: $path"
}

require_file "$HOOK_SCRIPT"
require_file "$CODEX_CONFIG"
require_file "$CODEX_HOOKS_JSON"

if [[ -f "$HOOK_SCRIPT" ]]; then
  bash -n "$HOOK_SCRIPT" || fail "bash syntax failed: $HOOK_SCRIPT"
  [[ -x "$HOOK_SCRIPT" ]] || warn "hook script is not executable: $HOOK_SCRIPT"
fi

if [[ -f "$CODEX_HOOKS_JSON" ]]; then
  jq empty "$CODEX_HOOKS_JSON" >/dev/null || fail "invalid JSON: $CODEX_HOOKS_JSON"
fi

if [[ -f "$CODEX_CONFIG" ]]; then
  if ! awk '
    $0 ~ /^\[features\]/ { in_features=1; next }
    $0 ~ /^\[/ { in_features=0 }
    in_features && $0 ~ /^hooks[[:space:]]*=[[:space:]]*true/ { found=1 }
    END { exit found ? 0 : 1 }
  ' "$CODEX_CONFIG"; then
    fail "Codex hooks feature is not enabled in $CODEX_CONFIG"
  fi
fi

if command -v codex >/dev/null 2>&1; then
  if ! codex features list 2>/dev/null | awk '$1 == "hooks" && $3 == "true" { found=1 } END { exit found ? 0 : 1 }'; then
    fail "live codex features list does not report hooks=true"
  fi
else
  fail "codex binary not on PATH"
fi

if [[ -f "$CODEX_HOOKS_JSON" ]]; then
  if ! grep -Fq "$HOOK_SCRIPT" "$CODEX_HOOKS_JSON"; then
    warn "$CODEX_HOOKS_JSON does not reference $HOOK_SCRIPT"
    if [[ "$STRICT" == "1" ]]; then
      failures=$((failures + 1))
    fi
  fi
fi

completion_output="$(
  printf '{"tool_name":"update_plan","plan":[{"step":"ship","status":"completed"}]}' \
    | "$HOOK_SCRIPT" --event PostToolUse --dry-run
)"
if ! grep -Fq "all current plan items are completed" <<< "$completion_output"; then
  fail "completion dry-run did not emit lifecycle checkpoint"
fi

failure_output="$(
  state_dir="$(mktemp -d)"
  printf '{"tool_name":"functions.exec_command","exit_code":1,"cwd":"%s"}' "$REPO_ROOT" \
    | CODEX_LIFECYCLE_STATE_DIR="$state_dir" CODEX_LIFECYCLE_FAILURE_THRESHOLD=1 \
      "$HOOK_SCRIPT" --event PostToolUse --dry-run
  rm -rf "$state_dir"
)"
if ! grep -Fq "consecutive shell/tool failures" <<< "$failure_output"; then
  fail "failure dry-run did not emit lifecycle checkpoint"
fi

if [[ "$failures" -ne 0 ]]; then
  echo "codex lifecycle hook audit failed: failures=$failures warnings=$warnings" >&2
  exit 1
fi

echo "codex lifecycle hook audit passed: warnings=$warnings"
