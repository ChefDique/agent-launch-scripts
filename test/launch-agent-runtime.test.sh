#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

unset \
  SWARMY_RUNTIME_OVERRIDE \
  SWARMY_MODEL_OVERRIDE \
  SWARMY_REASONING_EFFORT_OVERRIDE \
  SWARMY_PROVIDER_OVERRIDE \
  SWARMY_SANDBOX_OVERRIDE \
  SWARMY_APPROVAL_POLICY_OVERRIDE \
  SWARMY_PROFILE_PRESET \
  SWARMY_WORKSPACE_MODE \
  SWARMY_WORKTREE_STRATEGY \
  SWARMY_LOCAL_MODE \
  SWARMY_LOCAL_ATTACH

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

cat > "$TMP_DIR/bin/tmux" <<'SH'
#!/usr/bin/env bash
[[ -n "${TMUX_CALLS:-}" ]] || exit 0
printf '%s\n' "$*" >> "$TMUX_CALLS"
SH
chmod +x "$TMP_DIR/bin/tmux"

cat > "$TMP_DIR/bin/hermes" <<'SH'
#!/usr/bin/env bash
echo "COMMAND:hermes"
for arg in "$@"; do
  echo "ARG:${arg}"
done
SH
chmod +x "$TMP_DIR/bin/hermes"

cat > "$TMP_DIR/bin/openclaw" <<'SH'
#!/usr/bin/env bash
echo "COMMAND:openclaw"
for arg in "$@"; do
  echo "ARG:${arg}"
done
SH
chmod +x "$TMP_DIR/bin/openclaw"

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
      "allow_claude_runtime": true,
      "color": "purple",
      "rename_to": "INTENTIONAL",
      "startup_slash": "/lead-gogo"
    },
    {
      "id": "blocked-claude-runtime",
      "display_name": "Blocked Claude Runtime",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "claude"
    },
    {
      "id": "contaminated-claude-runtime",
      "display_name": "Contaminated Claude Runtime",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "claude",
      "allow_claude_runtime": true,
      "profile_preset": "runtime-presets",
      "model": "gpt-5.5",
      "reasoning_effort": "high",
      "sandbox": "danger-full-access",
      "approval_policy": "never"
    },
    {
      "id": "hermes-runtime",
      "display_name": "Hermes Runtime",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "hermes",
      "model": "hermes-model",
      "provider": "local"
    },
    {
      "id": "openclaw-runtime",
      "display_name": "OpenClaw Runtime",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "openclaw",
      "reasoning_effort": "max",
      "startup_slash": "/lead-gogo"
    },
    {
      "id": "unknown-runtime",
      "display_name": "Unknown Runtime",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "llama"
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

TMUX_CALLS="$TMP_DIR/tmux-calls.log"
rm -f "$TMUX_CALLS" /tmp/intentional-runtime-bg-_testpane.pids
tmux_claude_output="$(
    PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    TMUX_PANE="%testpane" \
    TMUX_CALLS="$TMUX_CALLS" \
    CLAUDE_WARNING_ACK_DELAY=0 \
    CLAUDE_RENAME_DELAY=0 \
    CLAUDE_STARTUP_DELAY=0 \
    bash "$REPO_ROOT/launch-agent.sh" intentional-runtime
)"
grep -qx 'COMMAND:claude' <<< "$tmux_claude_output"
sleep 1
grep -Fxq 'send-keys -t %testpane Enter' "$TMUX_CALLS"
grep -Fxq 'send-keys -t %testpane /color purple Enter' "$TMUX_CALLS"
grep -Fxq 'send-keys -t %testpane /rename INTENTIONAL Enter' "$TMUX_CALLS"
grep -Fxq 'send-keys -t %testpane /lead-gogo Enter' "$TMUX_CALLS"

launch_override_claude_output="$(SWARMY_RUNTIME_OVERRIDE=claude run_agent codex 2>&1)"
grep -qx 'COMMAND:claude' <<< "$launch_override_claude_output"
grep -qx 'ARG:claude-opus-4-7\[1m\]' <<< "$launch_override_claude_output"
grep -qx 'ARG:max' <<< "$launch_override_claude_output"
! grep -qx 'ARG:gpt-5.5' <<< "$launch_override_claude_output"
! grep -qx 'ARG:danger-full-access' <<< "$launch_override_claude_output"

launch_override_codex_output="$(SWARMY_RUNTIME_OVERRIDE=codex run_agent codex 2>&1)"
grep -qx 'COMMAND:codex' <<< "$launch_override_codex_output"
grep -qx 'ARG:gpt-5.5' <<< "$launch_override_codex_output"

contaminated_codex_override_output="$(SWARMY_RUNTIME_OVERRIDE=codex SWARMY_MODEL_OVERRIDE='claude-opus-4-7[1m]' SWARMY_REASONING_EFFORT_OVERRIDE=max run_agent codex 2>&1)"
grep -qx 'COMMAND:codex' <<< "$contaminated_codex_override_output"
grep -qx 'ARG:gpt-5.5' <<< "$contaminated_codex_override_output"
grep -qx 'ARG:model_reasoning_effort="high"' <<< "$contaminated_codex_override_output"
grep -q "ignoring Claude model 'claude-opus-4-7\\[1m\\]' for Codex runtime agent 'codex'" <<< "$contaminated_codex_override_output"

contaminated_claude_output="$(run_agent contaminated-claude-runtime 2>&1)"
grep -qx 'COMMAND:claude' <<< "$contaminated_claude_output"
grep -qx 'ARG:claude-opus-4-7\[1m\]' <<< "$contaminated_claude_output"
grep -qx 'ARG:max' <<< "$contaminated_claude_output"
! grep -qx 'ARG:gpt-5.5' <<< "$contaminated_claude_output"
! grep -qx 'ARG:high' <<< "$contaminated_claude_output"
grep -q "ignoring Codex model 'gpt-5.5' for Claude runtime agent 'contaminated-claude-runtime'" <<< "$contaminated_claude_output"

hermes_output="$(run_agent hermes-runtime)"
grep -qx 'COMMAND:hermes' <<< "$hermes_output"
grep -qx 'ARG:chat' <<< "$hermes_output"
grep -qx 'ARG:--tui' <<< "$hermes_output"
grep -qx 'ARG:--model' <<< "$hermes_output"
grep -qx 'ARG:hermes-model' <<< "$hermes_output"
grep -qx 'ARG:--provider' <<< "$hermes_output"
grep -qx 'ARG:local' <<< "$hermes_output"

openclaw_output="$(run_agent openclaw-runtime)"
grep -qx 'COMMAND:openclaw' <<< "$openclaw_output"
grep -qx 'ARG:chat' <<< "$openclaw_output"
grep -qx 'ARG:--local' <<< "$openclaw_output"
grep -qx 'ARG:--thinking' <<< "$openclaw_output"
grep -qx 'ARG:max' <<< "$openclaw_output"
grep -qx 'ARG:--message' <<< "$openclaw_output"
grep -qx 'ARG:/lead-gogo' <<< "$openclaw_output"

if unknown_runtime_output="$(run_agent unknown-runtime 2>&1)"; then
  echo "expected unsupported runtime to fail" >&2
  exit 1
fi
grep -q "unsupported runtime 'llama'" <<< "$unknown_runtime_output"

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

grep -q 'tmux send-keys -t "$TMUX_PANE" Enter' "$REPO_ROOT/launch-agent.sh"
grep -q 'tmux send-keys -t "$TMUX_PANE" "$STARTUP" Enter' "$REPO_ROOT/launch-agent.sh"
! grep -q 'submit_tmux_text' "$REPO_ROOT/launch-agent.sh"

if jq -e '[.agents[] | select((.runtime // "codex") == "claude" and (.allow_claude_runtime != true))] | length == 0' "$REPO_ROOT/agents.json" >/dev/null; then
  :
else
  echo "agents.json contains a Claude runtime entry without allow_claude_runtime=true" >&2
  jq -r '.agents[] | select((.runtime // "codex") == "claude" and (.allow_claude_runtime != true)) | "  - " + .id' "$REPO_ROOT/agents.json" >&2
  exit 1
fi

if jq -e '[.agents[] | select((.runtime // "codex") == "claude" and (((.model // "") | test("^(gpt-|.*codex.*)"; "i")) or has("sandbox") or has("approval_policy") or has("profile_preset")))] | length == 0' "$REPO_ROOT/agents.json" >/dev/null; then
  :
else
  echo "agents.json contains Claude runtime entries contaminated with Codex model/profile/sandbox fields" >&2
  jq -r '.agents[] | select((.runtime // "codex") == "claude" and (((.model // "") | test("^(gpt-|.*codex.*)"; "i")) or has("sandbox") or has("approval_policy") or has("profile_preset"))) | "  - " + .id' "$REPO_ROOT/agents.json" >&2
  exit 1
fi

echo "launch-agent runtime tests passed"
