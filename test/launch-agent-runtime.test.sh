#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

unset \
  MESSAGE_AGENT_IDENTITY \
  MESSAGE_AGENT_FROM \
  SWARMY_WORKER_NAME \
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
  SWARMY_LOCAL_ATTACH \
  TMUX_PANE \
  TMUX_CALLS

# Now that startup injection is runtime-agnostic, a leaked ambient TMUX_PANE
# would trigger injection in the no-pane tests. Unset it in the base env; the
# pane-specific tests set TMUX_PANE explicitly inline.

# Neutralize the production startup-injection delays so this isolated test stays
# fast and deterministic. The two-phase submit timing itself is proven in the
# remote-app tmux-send-path integration test; here we only assert the calls.
export STARTUP_SUBMIT_ENTER_DELAY=0
export STARTUP_WARNING_ACK_GAP=0

mkdir -p "$TMP_DIR/bin" "$TMP_DIR/codex-cwd" "$TMP_DIR/legacy-runtime-cwd"
cat > "$TMP_DIR/codex-config.toml" <<'TOML'
model = "gpt-5.5"
TOML

cat > "$TMP_DIR/bin/codex" <<'SH'
#!/usr/bin/env bash
echo "COMMAND:codex"
for name in MESSAGE_AGENT_IDENTITY MESSAGE_AGENT_FROM SWARMY_WORKER_NAME SWARMY_PROFILE_PRESET SWARMY_WORKSPACE_MODE SWARMY_WORKTREE_STRATEGY SWARMY_LOCAL_MODE SWARMY_LOCAL_ATTACH; do
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
      "model": "gpt-5.5",
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
      "reasoning_effort": "xhigh",
      "sandbox": "danger-full-access",
      "approval_policy": "never",
      "startup_slash": "/lead-gogo",
      "startup_injection": {
        "include": ["dangerous_permission_enter", "startup_lines"],
        "exclude": []
      }
    },
    {
      "id": "warning-keys-codex",
      "display_name": "Warning Keys Codex",
      "cwd": "$TMP_DIR/codex-cwd",
      "runtime": "codex",
      "model": "gpt-5.5",
      "reasoning_effort": "xhigh",
      "startup_slash": "/lead-gogo",
      "startup_injection": {
        "include": ["dangerous_permission_enter", "startup_lines"],
        "warning_ack_keys": ["1", "Enter"]
      }
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
      "reasoning_effort": "xhigh",
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
      "startup_slash": "/lead-gogo",
      "startup_injection": {
        "include": ["dangerous_permission_enter", "startup_lines"],
        "exclude": []
      },
      "startup_lines": [
        "/color {{color}}",
        "-literal-starts-with-dash",
        "/rename {{rename_to}}",
        "{{startup_slash}}"
      ]
    },
    {
      "id": "xavier",
      "display_name": "Professor Xavier",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "claude",
      "allow_claude_runtime": true,
      "color": "cyan",
      "startup_slash": "/lead-gogo"
    },
    {
      "id": "empty-slash-claude",
      "display_name": "Empty Slash",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "claude",
      "allow_claude_runtime": true,
      "color": "cyan",
      "startup_slash": "",
      "startup_injection": {
        "include": ["dangerous_permission_enter", "startup_lines"]
      }
    },
    {
      "id": "exclude-enter-runtime",
      "display_name": "Exclude Enter Runtime",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "claude",
      "allow_claude_runtime": true,
      "rename_to": "EXCLUDE-ENTER",
      "startup_slash": "/lead-gogo",
      "startup_injection": {
        "include": ["dangerous_permission_enter", "startup_lines"],
        "exclude": ["dangerous_permission_enter"]
      },
      "startup_lines": [
        "/rename {{rename_to}}"
      ]
    },
    {
      "id": "invalid-startup-policy",
      "display_name": "Invalid Startup Policy",
      "cwd": "$TMP_DIR/legacy-runtime-cwd",
      "runtime": "claude",
      "allow_claude_runtime": true,
      "startup_injection": {
        "include": "dangerous_permission_enter"
      }
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
    CODEX_CONFIG="$TMP_DIR/codex-config.toml" \
    AGENTREMOTE_CODEX_MODELS="gpt-5.5,gpt-5.5-fast" \
    bash "$REPO_ROOT/launch-agent.sh" "$1"
}

run_agent_with_catalog() {
  PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    CODEX_CONFIG="$TMP_DIR/codex-config.toml" \
    CODEX_MODELS_CACHE="$TMP_DIR/missing-model-cache.json" \
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
grep -qx 'ARG:model_reasoning_effort="xhigh"' <<< "$codex_output"
grep -qx 'ARG:--no-alt-screen' <<< "$codex_output"
grep -qx 'ARG:/lead-gogo' <<< "$codex_output"

preset_output="$(run_agent preset-codex)"
grep -qx 'COMMAND:codex' <<< "$preset_output"
grep -qx 'ARG:--model' <<< "$preset_output"
grep -qx 'ARG:gpt-5.5' <<< "$preset_output"
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
grep -qx 'ARG:model_reasoning_effort="xhigh"' <<< "$override_output"

catalog_model_output="$(SWARMY_MODEL_OVERRIDE='gpt-5.4' run_agent_with_catalog codex)"
grep -qx 'COMMAND:codex' <<< "$catalog_model_output"
grep -qx 'ARG:gpt-5.4' <<< "$catalog_model_output"

xhigh_reasoning_output="$(SWARMY_REASONING_EFFORT_OVERRIDE='xhigh' run_agent codex)"
grep -qx 'COMMAND:codex' <<< "$xhigh_reasoning_output"
grep -qx 'ARG:model_reasoning_effort="xhigh"' <<< "$xhigh_reasoning_output"
grep -qx 'ARG:danger-full-access' <<< "$override_output"
grep -qx 'ARG:never' <<< "$override_output"

legacy_output="$(run_agent legacy)"
grep -qx 'COMMAND:codex' <<< "$legacy_output"
grep -qx 'ARG:gpt-5.5' <<< "$legacy_output"
grep -qx 'ARG:model_reasoning_effort="xhigh"' <<< "$legacy_output"

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
    CLAUDE_STARTUP_DELAY=0 \
    bash "$REPO_ROOT/launch-agent.sh" intentional-runtime
)"
grep -qx 'COMMAND:claude' <<< "$tmux_claude_output"
sleep 1
grep -Fxq 'send-keys -t %testpane Enter' "$TMUX_CALLS"
grep -Fxq 'send-keys -t %testpane -l -- /color purple' "$TMUX_CALLS"
grep -Fxq 'send-keys -t %testpane -l -- -literal-starts-with-dash' "$TMUX_CALLS"
grep -Fxq 'send-keys -t %testpane -l -- /rename INTENTIONAL' "$TMUX_CALLS"

TMUX_CALLS="$TMP_DIR/codex-policy-tmux-calls.log"
rm -f "$TMUX_CALLS"
codex_policy_output="$(
    PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    TMUX_PANE="%codexpolicy" \
    TMUX_CALLS="$TMUX_CALLS" \
    CLAUDE_WARNING_ACK_DELAY=0 \
    CLAUDE_STARTUP_DELAY=0 \
    bash "$REPO_ROOT/launch-agent.sh" codex
)"
grep -qx 'COMMAND:codex' <<< "$codex_policy_output"
# startup_injection is now runtime-agnostic (driven by the per-agent policy, the
# toggle). A Codex agent that opts in gets the warning-ack Enter and the startup
# command injected as keystrokes — and the startup command is delivered by
# injection, NOT also as a launch argv (no duplicate /lead-gogo).
! grep -qx 'ARG:/lead-gogo' <<< "$codex_policy_output"
sleep 1
grep -Fxq 'send-keys -t %codexpolicy Enter' "$TMUX_CALLS"
grep -Fxq 'send-keys -t %codexpolicy -l -- /lead-gogo' "$TMUX_CALLS"
# But Claude-only slash commands must never be typed into a Codex pane.
if grep -qE 'send-keys -t %codexpolicy -l -- /(color|rename)' "$TMUX_CALLS"; then
  echo "Codex must not receive Claude-only /color or /rename injection" >&2
  cat "$TMUX_CALLS" >&2
  exit 1
fi

# Configurable warning ack: an agent can specify startup_injection.warning_ack_keys
# so a runtime whose dev-warning needs "1" (then Enter) is dismissed correctly.
TMUX_CALLS="$TMP_DIR/warning-keys-tmux-calls.log"
rm -f "$TMUX_CALLS"
warning_keys_output="$(
    PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    TMUX_PANE="%warnkeys" \
    TMUX_CALLS="$TMUX_CALLS" \
    CLAUDE_WARNING_ACK_DELAY=0 \
    CLAUDE_STARTUP_DELAY=0 \
    bash "$REPO_ROOT/launch-agent.sh" warning-keys-codex
)"
grep -qx 'COMMAND:codex' <<< "$warning_keys_output"
sleep 1
grep -Fxq 'send-keys -t %warnkeys 1' "$TMUX_CALLS"
grep -Fxq 'send-keys -t %warnkeys Enter' "$TMUX_CALLS"

TMUX_CALLS="$TMP_DIR/xavier-no-policy-tmux-calls.log"
rm -f "$TMUX_CALLS" /tmp/xavier-bg-_nopolicy.pids
xavier_no_policy_output="$(
    PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    TMUX_PANE="%nopolicy" \
    TMUX_CALLS="$TMUX_CALLS" \
    CLAUDE_WARNING_ACK_DELAY=0 \
    CLAUDE_RENAME_DELAY=0 \
    CLAUDE_STARTUP_DELAY=0 \
    bash "$REPO_ROOT/launch-agent.sh" xavier
)"
grep -qx 'COMMAND:claude' <<< "$xavier_no_policy_output"
sleep 1
# Contract (2026-05-23): startup injection is SYMMETRICALLY default-on for the
# Claude runtime. A no-policy Claude agent auto-acks the dev-channels warning (one
# Enter) AND injects its startup lines, built from the legacy color/rename_to/
# startup_slash fields (/color + /rename + startup_slash). This removes the prior
# asymmetry where only the warning-ack defaulted on, which left Claude agents
# migrated without an explicit startup_injection policy (e.g. dasha, hansel)
# booting with no /color or /lead-gogo. Opt out per token via startup_injection.exclude.
if ! grep -qx 'send-keys -t %nopolicy Enter' "$TMUX_CALLS"; then
  echo "no-policy Claude agent must auto-ack the dev-channels warning (one Enter)" >&2
  cat "$TMUX_CALLS" >&2
  exit 1
fi
for expected in \
  'send-keys -t %nopolicy -l -- /color cyan' \
  'send-keys -t %nopolicy -l -- /rename PROFESSOR XAVIER' \
  'send-keys -t %nopolicy -l -- /lead-gogo'; do
  if ! grep -Fxq "$expected" "$TMUX_CALLS"; then
    echo "no-policy Claude agent must inject startup line: $expected" >&2
    cat "$TMUX_CALLS" >&2
    exit 1
  fi
done

# Contract (2026-05-23): a Claude agent whose registry startup_slash is empty (or
# missing) still boots into /lead-gogo by default — the launcher supplies the
# Claude default startup command, so no per-agent startup_slash entry is required.
# This is the hansel case (policy present, startup_slash ""), which previously
# booted with /color + /rename but no /lead-gogo. Mirrors the HUD default.
TMUX_CALLS="$TMP_DIR/empty-slash-tmux-calls.log"
rm -f "$TMUX_CALLS" /tmp/empty-slash-claude-bg-_emptyslash.pids
empty_slash_output="$(
    PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    TMUX_PANE="%emptyslash" \
    TMUX_CALLS="$TMUX_CALLS" \
    CLAUDE_WARNING_ACK_DELAY=0 \
    CLAUDE_RENAME_DELAY=0 \
    CLAUDE_STARTUP_DELAY=0 \
    bash "$REPO_ROOT/launch-agent.sh" empty-slash-claude
)"
grep -qx 'COMMAND:claude' <<< "$empty_slash_output"
sleep 1
for expected in \
  'send-keys -t %emptyslash -l -- /color cyan' \
  'send-keys -t %emptyslash -l -- /rename EMPTY SLASH' \
  'send-keys -t %emptyslash -l -- /lead-gogo'; do
  if ! grep -Fxq "$expected" "$TMUX_CALLS"; then
    echo "Claude agent with empty startup_slash must default to /lead-gogo: $expected" >&2
    cat "$TMUX_CALLS" >&2
    exit 1
  fi
done

# Negative guard (contract preservation): an explicit STARTUP_SLASH= env override
# (empty) must STILL disable the startup command — the Claude default must not
# override an operator's deliberate clear.
TMUX_CALLS="$TMP_DIR/empty-slash-envdisable-tmux-calls.log"
rm -f "$TMUX_CALLS" /tmp/empty-slash-claude-bg-_envdisable.pids
STARTUP_SLASH="" \
    PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    TMUX_PANE="%envdisable" \
    TMUX_CALLS="$TMUX_CALLS" \
    CLAUDE_WARNING_ACK_DELAY=0 \
    CLAUDE_RENAME_DELAY=0 \
    CLAUDE_STARTUP_DELAY=0 \
    bash "$REPO_ROOT/launch-agent.sh" empty-slash-claude >/dev/null
sleep 1
if grep -Fxq 'send-keys -t %envdisable -l -- /lead-gogo' "$TMUX_CALLS"; then
  echo "STARTUP_SLASH= env override must disable the startup command, not default it" >&2
  cat "$TMUX_CALLS" >&2
  exit 1
fi

TMUX_CALLS="$TMP_DIR/exclude-enter-tmux-calls.log"
rm -f "$TMUX_CALLS" /tmp/exclude-enter-runtime-bg-_exclude.pids
exclude_enter_output="$(
    PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    TMUX_PANE="%exclude" \
    TMUX_CALLS="$TMUX_CALLS" \
    CLAUDE_WARNING_ACK_DELAY=0 \
    CLAUDE_STARTUP_DELAY=0 \
    bash "$REPO_ROOT/launch-agent.sh" exclude-enter-runtime
)"
grep -qx 'COMMAND:claude' <<< "$exclude_enter_output"
sleep 1
first_exclude_send_key="$(awk '/^send-keys/ { print; exit }' "$TMUX_CALLS")"
[[ "$first_exclude_send_key" == 'send-keys -t %exclude -l -- /rename EXCLUDE-ENTER' ]]

launch_override_claude_output="$(SWARMY_RUNTIME_OVERRIDE=claude run_agent codex 2>&1)"
grep -qx 'COMMAND:claude' <<< "$launch_override_claude_output"
# The Codex agent's gpt model is stripped for the Claude runtime -> "default" ->
# launcher omits --model so Claude Code resolves its own recommended default.
# The bare word "default" is not a valid --model alias, so neither the flag nor
# the literal "default" may appear in argv.
! grep -qx 'ARG:--model' <<< "$launch_override_claude_output"
! grep -qx 'ARG:default' <<< "$launch_override_claude_output"
grep -qx 'ARG:max' <<< "$launch_override_claude_output"
! grep -qx 'ARG:gpt-5.5' <<< "$launch_override_claude_output"
! grep -qx 'ARG:danger-full-access' <<< "$launch_override_claude_output"

# An explicit Claude model is still passed through verbatim as --model <value>.
launch_explicit_claude_output="$(SWARMY_RUNTIME_OVERRIDE=claude SWARMY_MODEL_OVERRIDE='claude-opus-4-8[1m]' run_agent codex 2>&1)"
grep -qx 'COMMAND:claude' <<< "$launch_explicit_claude_output"
grep -qx 'ARG:--model' <<< "$launch_explicit_claude_output"
grep -qx 'ARG:claude-opus-4-8\[1m\]' <<< "$launch_explicit_claude_output"

launch_override_codex_output="$(SWARMY_RUNTIME_OVERRIDE=codex run_agent codex 2>&1)"
grep -qx 'COMMAND:codex' <<< "$launch_override_codex_output"
grep -qx 'ARG:gpt-5.5' <<< "$launch_override_codex_output"

# test_codex_runtime_override_sets_message_agent_identity
TMUX_CALLS="$TMP_DIR/codex-tmux-calls.log"
rm -f "$TMUX_CALLS"
codex_identity_output="$(
    PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    SWARMY_RUNTIME_OVERRIDE=codex \
    TMUX_PANE="%codexpane" \
    TMUX_CALLS="$TMUX_CALLS" \
    bash "$REPO_ROOT/launch-agent.sh" intentional-runtime
)"
grep -qx 'COMMAND:codex' <<< "$codex_identity_output"
grep -qx 'ENV:MESSAGE_AGENT_IDENTITY=intentional-runtime-codex' <<< "$codex_identity_output"
grep -qx 'ENV:MESSAGE_AGENT_FROM=intentional-runtime-codex' <<< "$codex_identity_output"
grep -qx 'ENV:SWARMY_WORKER_NAME=intentional-runtime-codex' <<< "$codex_identity_output"
grep -Fxq 'set-option -p -t %codexpane @agent-identity intentional-runtime-codex' "$TMUX_CALLS"
grep -Fxq 'set-option -p -t %codexpane @agent-runtime codex' "$TMUX_CALLS"
! grep -Fxq 'set-option -p -t %codexpane @agent-identity intentional-runtime-claude' "$TMUX_CALLS"

xavier_codex_identity_output="$(SWARMY_RUNTIME_OVERRIDE=codex run_agent xavier 2>&1)"
grep -qx 'COMMAND:codex' <<< "$xavier_codex_identity_output"
grep -qx 'ENV:MESSAGE_AGENT_IDENTITY=xavier-codex' <<< "$xavier_codex_identity_output"
! grep -qx 'ENV:MESSAGE_AGENT_IDENTITY=xavier-claude' <<< "$xavier_codex_identity_output"

contaminated_codex_override_output="$(SWARMY_RUNTIME_OVERRIDE=codex SWARMY_MODEL_OVERRIDE='claude-opus-4-7[1m]' SWARMY_REASONING_EFFORT_OVERRIDE=max run_agent codex 2>&1)"
grep -qx 'COMMAND:codex' <<< "$contaminated_codex_override_output"
grep -qx 'ARG:gpt-5.5' <<< "$contaminated_codex_override_output"
grep -qx 'ARG:model_reasoning_effort="xhigh"' <<< "$contaminated_codex_override_output"
grep -q "ignoring Claude model 'claude-opus-4-7\\[1m\\]' for Codex runtime agent 'codex'" <<< "$contaminated_codex_override_output"

if unsupported_codex_model_output="$(SWARMY_MODEL_OVERRIDE='gpt-5.1' run_agent codex 2>&1)"; then
  echo "expected unsupported Codex model to fail before exec" >&2
  exit 1
fi
grep -q "unsupported Codex model 'gpt-5.1'" <<< "$unsupported_codex_model_output"

contaminated_claude_output="$(run_agent contaminated-claude-runtime 2>&1)"
grep -qx 'COMMAND:claude' <<< "$contaminated_claude_output"
# Contaminating gpt model is stripped -> "default" -> launcher omits --model.
! grep -qx 'ARG:--model' <<< "$contaminated_claude_output"
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

if invalid_policy_output="$(run_agent invalid-startup-policy 2>&1)"; then
  echo "expected malformed startup_injection policy to fail" >&2
  exit 1
fi
grep -q "startup_injection.include" <<< "$invalid_policy_output"

grep -q 'startup_injection_active "dangerous_permission_enter"' "$REPO_ROOT/launch-agent.sh"
grep -q 'startup_injection_active "startup_lines"' "$REPO_ROOT/launch-agent.sh"
grep -q 'read_startup_lines()' "$REPO_ROOT/launch-agent.sh"
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
