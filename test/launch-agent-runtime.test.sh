#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/bin" "$TMP_DIR/codex-cwd" "$TMP_DIR/legacy-runtime-cwd"

cat > "$TMP_DIR/bin/codex" <<'SH'
#!/usr/bin/env bash
echo "COMMAND:codex"
for name in SWARMY_PROFILE_PRESET SWARMY_WORKSPACE_MODE SWARMY_WORKTREE_STRATEGY SWARMY_LOCAL_MODE SWARMY_LOCAL_ATTACH; do
  [[ -n "${!name:-}" ]] && echo "ENV:${name}=${!name}"
done
for arg in "$@"; do
  echo "ARG:${arg}"
done
SH
chmod +x "$TMP_DIR/bin/codex"

cat > "$TMP_DIR/bin/claude" <<'SH'
#!/usr/bin/env bash
echo "COMMAND:claude"
for arg in "$@"; do
  echo "ARG:${arg}"
done
SH
chmod +x "$TMP_DIR/bin/claude"

cat > "$TMP_DIR/agents.json" <<JSON
{
  "_profile_presets": [
    {
      "profile_id": "runtime-presets",
      "runtime": "codex",
      "model": "gpt-4o-mini",
      "reasoning_effort": "low",
      "workspace": {
        "cwd_mode": "worktree",
        "worktree_strategy": "dedicated_per_agent"
      },
      "local": {
        "mode": "visible_tmux",
        "attach": "iterm_control_mode"
      },
      "sandbox": {
        "mode": "workspace-write",
        "approval_policy": "on-request",
        "config_isolation": "isolated_home",
        "trust_repo": false
      }
    }
  ],
  "agents": [
    {
      "id": "codex",
      "display_name": "Codex",
      "cwd": "$TMP_DIR/codex-cwd",
      "runtime": "codex",
      "model": "gpt-5.5",
      "reasoning_effort": "high",
      "sandbox": "danger-full-access",
      "approval_policy": "never",
      "startup_slash": "/lead-gogo"
    },
    {
      "id": "legacy",
      "display_name": "Legacy",
      "cwd": "$TMP_DIR/legacy-runtime-cwd"
    },
    {
      "id": "preset-codex",
      "display_name": "Preset Codex",
      "cwd": "$TMP_DIR/codex-cwd",
      "runtime": "codex",
      "profile_preset": "runtime-presets",
      "startup_slash": "/lead-gogo"
    },
    {
      "id": "preset-override",
      "display_name": "Preset Override",
      "cwd": "$TMP_DIR/codex-cwd",
      "runtime": "codex",
      "profile_preset": "runtime-presets",
      "model": "gpt-5.5",
      "reasoning_effort": "high",
      "sandbox": "danger-full-access",
      "approval_policy": "never",
      "startup_slash": "/lead-gogo"
    },
    {
      "id": "preset-unknown",
      "display_name": "Preset Unknown",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "codex",
      "profile_preset": "does-not-exist",
      "startup_slash": "/lead-gogo"
    },
    {
      "id": "intentional-runtime",
      "display_name": "Intentional Runtime",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "claude",
      "allow_claude_runtime": true
    },
    {
      "id": "blocked-claude-runtime",
      "display_name": "Blocked Claude Runtime",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "claude"
    }
  ]
}
JSON

run_agent() {
  PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    bash "$REPO_ROOT/launch-agent.sh" "$1"
}

codex_output="$(run_agent codex)"
grep -qx 'COMMAND:codex' <<< "$codex_output"
grep -qx 'ARG:--model' <<< "$codex_output"
grep -qx 'ARG:gpt-5.5' <<< "$codex_output"
grep -qx 'ARG:--ask-for-approval' <<< "$codex_output"
! grep -qx 'ARG:--dangerously-bypass-approvals-and-sandbox' <<< "$codex_output"
grep -qx 'ARG:never' <<< "$codex_output"
grep -qx 'ARG:--sandbox' <<< "$codex_output"
grep -qx 'ARG:danger-full-access' <<< "$codex_output"
grep -qx 'ARG:-c' <<< "$codex_output"
grep -qx 'ARG:model_reasoning_effort="high"' <<< "$codex_output"
grep -qx 'ARG:--no-alt-screen' <<< "$codex_output"
grep -qx 'ARG:/lead-gogo' <<< "$codex_output"

preset_output="$(run_agent preset-codex)"
grep -qx 'COMMAND:codex' <<< "$preset_output"
grep -qx 'ARG:--model' <<< "$preset_output"
grep -qx 'ARG:gpt-4o-mini' <<< "$preset_output"
grep -qx 'ARG:model_reasoning_effort="low"' <<< "$preset_output"
grep -qx 'ARG:--ask-for-approval' <<< "$preset_output"
grep -qx 'ARG:on-request' <<< "$preset_output"
grep -qx 'ARG:--sandbox' <<< "$preset_output"
grep -qx 'ARG:workspace-write' <<< "$preset_output"
grep -qx 'ENV:SWARMY_PROFILE_PRESET=runtime-presets' <<< "$preset_output"
grep -qx 'ENV:SWARMY_WORKSPACE_MODE=worktree' <<< "$preset_output"
grep -qx 'ENV:SWARMY_WORKTREE_STRATEGY=dedicated_per_agent' <<< "$preset_output"
grep -qx 'ENV:SWARMY_LOCAL_MODE=visible_tmux' <<< "$preset_output"
grep -qx 'ENV:SWARMY_LOCAL_ATTACH=iterm_control_mode' <<< "$preset_output"

override_output="$(run_agent preset-override)"
grep -qx 'ARG:gpt-5.5' <<< "$override_output"
grep -qx 'ARG:model_reasoning_effort="high"' <<< "$override_output"
grep -qx 'ARG:danger-full-access' <<< "$override_output"
grep -qx 'ARG:never' <<< "$override_output"

legacy_output="$(run_agent legacy)"
grep -qx 'COMMAND:codex' <<< "$legacy_output"
grep -qx 'ARG:gpt-5.5' <<< "$legacy_output"
grep -qx 'ARG:model_reasoning_effort="high"' <<< "$legacy_output"

intentional_runtime_output="$(run_agent intentional-runtime)"
grep -qx 'COMMAND:claude' <<< "$intentional_runtime_output"
grep -qx 'ARG:-n' <<< "$intentional_runtime_output"
grep -qx 'ARG:Intentional Runtime' <<< "$intentional_runtime_output"

if blocked_runtime_output="$(run_agent blocked-claude-runtime 2>&1)"; then
  echo "expected runtime=claude without allow_claude_runtime=true to fail" >&2
  exit 1
fi
grep -q "allow_claude_runtime=true" <<< "$blocked_runtime_output"

if preset_unknown_output="$(run_agent preset-unknown 2>&1)"; then
  echo "expected missing profile_preset to fail" >&2
  exit 1
fi
grep -q "unknown profile_preset" <<< "$preset_unknown_output"

! grep -q 'submit_tmux_text' "$REPO_ROOT/launch-agent.sh"
! grep -q 'tmux send-keys' "$REPO_ROOT/launch-agent.sh"
! grep -q '"/rename \$RENAME_TO" Enter' "$REPO_ROOT/launch-agent.sh"
! grep -q '"\$STARTUP" Enter' "$REPO_ROOT/launch-agent.sh"

if jq -e '[.agents[] | select((.runtime // "codex") == "claude" and (.allow_claude_runtime != true))] | length == 0' "$REPO_ROOT/agents.json" >/dev/null; then
  :
else
  echo "agents.json contains a Claude runtime entry without allow_claude_runtime=true" >&2
  jq -r '.agents[] | select((.runtime // "codex") == "claude" and (.allow_claude_runtime != true)) | "  - " + .id' "$REPO_ROOT/agents.json" >&2
  exit 1
fi

echo "launch-agent runtime tests passed"
