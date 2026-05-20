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

  for event_name in PostToolUse PreCompact PostCompact Stop; do
    event_count="$(
      jq --arg event_name "$event_name" --arg hook_script "$HOOK_SCRIPT" \
        '[.hooks[$event_name][]?.hooks[]?.command? | select(contains($hook_script))] | length' \
        "$CODEX_HOOKS_JSON" 2>/dev/null || echo 0
    )"
    if [[ ! "$event_count" =~ ^[0-9]+$ || "$event_count" -eq 0 ]]; then
      fail "$CODEX_HOOKS_JSON does not wire $event_name to $HOOK_SCRIPT"
    fi
  done

  session_start_count="$(
    jq --arg hook_script "$HOOK_SCRIPT" \
      '[.hooks.SessionStart[]?.hooks[]?.command? | select(contains($hook_script))] | length' \
      "$CODEX_HOOKS_JSON" 2>/dev/null || echo 0
  )"
  if [[ ! "$session_start_count" =~ ^[0-9]+$ || "$session_start_count" -eq 0 ]]; then
    warn "$CODEX_HOOKS_JSON does not wire SessionStart to the startup/lane checkpoint"
    if [[ "$STRICT" == "1" ]]; then
      failures=$((failures + 1))
    fi
  fi

  pre_tool_count="$(
    jq --arg hook_script "$HOOK_SCRIPT" \
      '[.hooks.PreToolUse[]?.hooks[]?.command? | select(contains($hook_script))] | length' \
      "$CODEX_HOOKS_JSON" 2>/dev/null || echo 0
  )"
  if [[ ! "$pre_tool_count" =~ ^[0-9]+$ || "$pre_tool_count" -eq 0 ]]; then
    warn "$CODEX_HOOKS_JSON does not wire PreToolUse to the Neo/Codex scope guard"
    if [[ "$STRICT" == "1" ]]; then
      failures=$((failures + 1))
    fi
  fi

  user_prompt_count="$(
    jq '[.hooks.UserPromptSubmit[]?] | length' "$CODEX_HOOKS_JSON" 2>/dev/null || echo 0
  )"
  if [[ ! "$user_prompt_count" =~ ^[0-9]+$ || "$user_prompt_count" -ne 0 ]]; then
    fail "$CODEX_HOOKS_JSON must keep UserPromptSubmit unwired"
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

precompact_output="$(
  printf '{"cwd":"%s"}' "$REPO_ROOT" \
    | "$HOOK_SCRIPT" --event PreCompact --dry-run
)"
if ! grep -Fq "PRE-COMPACT LIFECYCLE CHECKPOINT" <<< "$precompact_output"; then
  fail "PreCompact dry-run did not emit lifecycle checkpoint"
fi

cross_repo_precompact_output="$(
  printf '{"cwd":"/Users/richardadair/ai_projects/swarmy"}' \
    | MESSAGE_AGENT_IDENTITY=neo-codex CODEX_LIFECYCLE_GUARD_REPO_ROOT="$REPO_ROOT" "$HOOK_SCRIPT" --event PreCompact --dry-run
)"
if ! grep -Fq "GUARD BLOCK Neo/Codex lifecycle guard" <<< "$cross_repo_precompact_output"; then
  fail "PreCompact dry-run did not hard-block cross-repo lifecycle work"
fi

cross_repo_guard_output="$(
  printf '{"tool_name":"Write","cwd":"%s","tool_input":{"file_path":"/Users/richardadair/ai_projects/swarmy/notes.md"}}' "$REPO_ROOT" \
    | MESSAGE_AGENT_IDENTITY=neo-codex "$HOOK_SCRIPT" --event PreToolUse --dry-run
)"
if ! grep -Fq "GUARD BLOCK Neo/Codex scope guard" <<< "$cross_repo_guard_output"; then
  fail "PreToolUse dry-run did not block cross-repo file edit"
fi

live_surface_guard_output="$(
  printf '{"tool_name":"functions.exec_command","cwd":"%s","tool_input":{"cmd":"tmux send-keys -t chq hello Enter"}}' "$REPO_ROOT" \
    | MESSAGE_AGENT_IDENTITY=neo-codex "$HOOK_SCRIPT" --event PreToolUse --dry-run
)"
if ! grep -Fq "GUARD BLOCK Neo/Codex live-surface guard" <<< "$live_surface_guard_output"; then
  fail "PreToolUse dry-run did not block live tmux/iTerm/AgentRemote mutation"
fi

missing_handoff_dir="$(mktemp -d)"
missing_handoff_guard_output="$(
  printf '{"tool_name":"Write","cwd":"%s","tool_input":{"file_path":"%s/notes.md"}}' "$missing_handoff_dir" "$missing_handoff_dir" \
    | MESSAGE_AGENT_IDENTITY=neo-codex CODEX_LIFECYCLE_GUARD_REPO_ROOT="$missing_handoff_dir" "$HOOK_SCRIPT" --event PreToolUse --dry-run
)"
rm -rf "$missing_handoff_dir"
if ! grep -Fq "GUARD BLOCK Codex startup/lane precondition" <<< "$missing_handoff_guard_output"; then
  fail "PreToolUse dry-run did not block mutating work without startup/status proof"
fi

override_guard_output="$(
  printf '{"tool_name":"functions.exec_command","cwd":"%s","tool_input":{"cmd":"tmux send-keys -t chq hello Enter"}}' "$REPO_ROOT" \
    | MESSAGE_AGENT_IDENTITY=neo-codex CODEX_LIFECYCLE_OPERATOR_OVERRIDE=1 "$HOOK_SCRIPT" --event PreToolUse --dry-run
)"
if grep -Fq "GUARD BLOCK" <<< "$override_guard_output"; then
  fail "PreToolUse dry-run blocked despite explicit operator override"
fi

postcompact_output="$(
  printf '{"cwd":"%s"}' "$REPO_ROOT" \
    | "$HOOK_SCRIPT" --event PostCompact --dry-run
)"
if ! grep -Fq "POST-COMPACT RE-ANCHOR" <<< "$postcompact_output"; then
  fail "PostCompact dry-run did not emit lifecycle re-anchor"
fi

status_dir="$(mktemp -d)"
mkdir -p "$status_dir/memory"
cat > "$status_dir/memory/handoff.md" <<'MD'
# Handoff

## Active thread
Current work.
---
MD
handoff_sha="$(shasum -a 256 "$status_dir/memory/handoff.md" | awk '{print $1}')"
cat > "$status_dir/memory/session-status.json" <<JSON
{
  "repo_root": "$status_dir",
  "lane": "audit",
  "active_goal": "prove hook startup gate",
  "status": "in_progress",
  "next_action": "run audit",
  "updated_at": "2026-05-20T00:00:00Z",
  "handoff": {
    "path": "memory/handoff.md",
    "sha256": "$handoff_sha",
    "read_at": "2026-05-20T00:00:00Z"
  }
}
JSON

valid_startup_output="$(
  printf '{"tool_name":"Write","cwd":"%s","tool_input":{"file_path":"%s/notes.md"}}' "$status_dir" "$status_dir" \
    | MESSAGE_AGENT_IDENTITY=neo-codex CODEX_LIFECYCLE_GUARD_REPO_ROOT="$status_dir" "$HOOK_SCRIPT" --event PreToolUse --dry-run
)"
if grep -Fq "GUARD BLOCK" <<< "$valid_startup_output"; then
  fail "PreToolUse dry-run blocked despite valid startup/status artifact"
fi

session_start_output="$(
  printf '{"cwd":"%s","source":"startup"}' "$status_dir" \
    | CODEX_LIFECYCLE_GUARD_REPO_ROOT="$status_dir" "$HOOK_SCRIPT" --event SessionStart --dry-run
)"
if ! grep -Fq "STARTUP/LANE CHECKPOINT" <<< "$session_start_output"; then
  fail "SessionStart dry-run did not emit startup/lane checkpoint"
fi

stop_unfinished_output="$(
  printf '{"cwd":"%s","stop_hook_active":false}' "$status_dir" \
    | CODEX_LIFECYCLE_GUARD_REPO_ROOT="$status_dir" "$HOOK_SCRIPT" --event Stop --dry-run
)"
if ! grep -Fq "STOP LIFECYCLE CONTINUATION" <<< "$stop_unfinished_output"; then
  fail "Stop dry-run did not continue unfinished active work from status artifact"
fi

stop_active_output="$(
  printf '{"cwd":"%s","stop_hook_active":true}' "$status_dir" \
    | CODEX_LIFECYCLE_GUARD_REPO_ROOT="$status_dir" "$HOOK_SCRIPT" --event Stop --dry-run
)"
if grep -Fq "STOP LIFECYCLE CONTINUATION" <<< "$stop_active_output"; then
  fail "Stop dry-run repeated continuation while stop_hook_active=true"
fi

printf '\nchanged\n' >> "$status_dir/memory/handoff.md"
stale_precompact_output="$(
  printf '{"cwd":"%s"}' "$status_dir" \
    | CODEX_LIFECYCLE_GUARD_REPO_ROOT="$status_dir" "$HOOK_SCRIPT" --event PreCompact --dry-run
)"
if ! grep -Fq "PRE-COMPACT LIFECYCLE BLOCK" <<< "$stale_precompact_output"; then
  fail "PreCompact dry-run did not block stale handoff checksum"
fi

handoff_sha="$(shasum -a 256 "$status_dir/memory/handoff.md" | awk '{print $1}')"
jq --arg sha "$handoff_sha" '.handoff.sha256 = $sha' "$status_dir/memory/session-status.json" > "$status_dir/memory/session-status.tmp" \
  && mv "$status_dir/memory/session-status.tmp" "$status_dir/memory/session-status.json"

process_state_dir="$(mktemp -d)"
python3 -m http.server 0 --directory "$status_dir" >/dev/null 2>&1 &
process_pid="$!"
sleep 0.2
process_key="$(printf '%s' "$status_dir" | tr '/:[:space:]' '____' | tr -cd '[:alnum:]_.-')"
printf '2026-05-20T00:00:00Z\t%s\t0\tpython3 -m http.server\n' "$process_pid" > "$process_state_dir/$process_key.processes.tsv"
process_precompact_output="$(
  printf '{"cwd":"%s"}' "$status_dir" \
    | CODEX_LIFECYCLE_STATE_DIR="$process_state_dir" CODEX_LIFECYCLE_GUARD_REPO_ROOT="$status_dir" "$HOOK_SCRIPT" --event PreCompact --dry-run
)"
kill "$process_pid" >/dev/null 2>&1 || true
wait "$process_pid" >/dev/null 2>&1 || true
rm -rf "$process_state_dir"
if ! grep -Fq "PRE-COMPACT PROCESS CLEANUP BLOCK" <<< "$process_precompact_output"; then
  fail "PreCompact dry-run did not block unkept tracked process"
fi

rm -rf "$status_dir"

if command -v node >/dev/null 2>&1; then
  if ! (cd "$REPO_ROOT" && node <<'NODE'
const fs = require('fs');
const path = require('path');
const { getModelsForHarness, getDefaultModelForHarness } = require('./remote-app/harness-models');

const registry = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'agents.json'), 'utf8'));
const codexModels = new Set(getModelsForHarness('codex').map(model => model.id));
const codexDefault = getDefaultModelForHarness('codex');
const failures = [];

if (!codexDefault || !codexModels.has(codexDefault)) {
  failures.push(`Codex default ${codexDefault || '<empty>'} is not in the harness model allowlist`);
}

for (const preset of registry._profile_presets || []) {
  if (String(preset.runtime || '').toLowerCase() === 'codex' && preset.model && !codexModels.has(preset.model)) {
    failures.push(`profile_preset:${preset.profile_id}:${preset.model}`);
  }
}

for (const agent of registry.agents || []) {
  if (String(agent.runtime || 'codex').toLowerCase() !== 'codex') continue;
  if (agent.model && !codexModels.has(agent.model)) {
    failures.push(`agent:${agent.id}:${agent.model}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
NODE
  )
  then
    fail "Codex launcher registry contains models outside the current harness allowlist"
  fi
else
  fail "node binary not on PATH"
fi

bad_model_dir="$(mktemp -d)"
mkdir -p "$bad_model_dir/bin" "$bad_model_dir/cwd"
cat > "$bad_model_dir/bin/codex" <<'SH'
#!/usr/bin/env bash
echo "codex should not execute for unsupported model" >&2
exit 99
SH
chmod +x "$bad_model_dir/bin/codex"
cat > "$bad_model_dir/config.toml" <<'TOML'
model = "gpt-5.5"
TOML
cat > "$bad_model_dir/agents.json" <<JSON
{
  "agents": [
    {
      "id": "bad-codex",
      "display_name": "Bad Codex",
      "runtime": "codex",
      "cwd": "$bad_model_dir/cwd",
      "model": "gpt-5.1"
    }
  ]
}
JSON
if bad_model_output="$(
  PATH="$bad_model_dir/bin:$PATH" \
  AGENT_REGISTRY="$bad_model_dir/agents.json" \
  CODEX_CONFIG="$bad_model_dir/config.toml" \
  bash "$REPO_ROOT/launch-agent.sh" bad-codex 2>&1
)"; then
  fail "launch-agent accepted unsupported Codex model"
elif ! grep -Fq "unsupported Codex model 'gpt-5.1'" <<< "$bad_model_output"; then
  fail "launch-agent unsupported-model failure did not identify the rejected Codex model"
fi
rm -rf "$bad_model_dir"

if [[ "$failures" -ne 0 ]]; then
  echo "codex lifecycle hook audit failed: failures=$failures warnings=$warnings" >&2
  exit 1
fi

echo "codex lifecycle hook audit passed: warnings=$warnings"
