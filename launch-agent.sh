#!/usr/bin/env bash
# ============================================================================
# launch-agent.sh — generic per-agent runtime launcher
# ============================================================================
# Reads an entry from agents.json (this repo's registry) and does what each
# of the old per-agent scripts (xavier.sh / lucius.sh / gekko.sh / swarmy.sh /
# tmux-electron-master.sh) used to do — generically.
#
# Usage:
#   bash launch-agent.sh <id>
#
# What it does, in order:
#   1. Look up <id> in agents.json. cwd into the agent's project root.
#   2. Run the optional pre_launch hook (typically telegram-cleanup --pre-launch).
#   3. Export any per-agent env vars from the registry's "env" map.
#   4. For Claude runtimes only, schedule the boot-time tmux auto-injects:
#      warning ack at 4s, /color + /rename at 10s, startup_slash at 12s.
#      Stale subshell PID cleanup runs first.
#   5. exec the configured runtime command (claude, codex, hermes, openclaw).
#
# Pivot knobs — env overrides for shell aliases that want to repoint an agent:
#   PROJECT_ROOT   — overrides the registry cwd
#   STARTUP_SLASH  — overrides the registry startup_slash (empty disables)
#   SWARMY_RUNTIME_OVERRIDE / SWARMY_MODEL_OVERRIDE /
#   SWARMY_REASONING_EFFORT_OVERRIDE — launch-time overrides from AgentRemote.
#
# These mirror what xavier.sh / gekko.sh exposed before. They're agent-agnostic.
# ============================================================================

set -euo pipefail

AGENT_ID="${1:-}"
[[ -z "$AGENT_ID" ]] && { echo "usage: $0 <agent-id>" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY="${AGENT_REGISTRY:-${SCRIPT_DIR}/agents.json}"
[[ -f "$REGISTRY" ]] || { echo "launch-agent: registry not found: $REGISTRY" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "launch-agent: jq is required" >&2; exit 2; }

# Pull entry as raw JSON so we can extract individual fields below without
# re-parsing the whole file each time. Errors out if id not found.
ENTRY="$(jq --arg id "$AGENT_ID" '.agents[] | select(.id == $id)' "$REGISTRY")"
[[ -n "$ENTRY" ]] || { echo "launch-agent: unknown agent id: $AGENT_ID" >&2; exit 1; }

# Helper: read a string field, treating null/missing as empty.
field() { jq -r --arg k "$1" '.[$k] // empty' <<< "$ENTRY"; }
PROFILE_PRESET="$(field profile_preset)"

if [[ -n "$PROFILE_PRESET" ]]; then
  PRESET="$(jq --arg preset "$PROFILE_PRESET" '(.["_profile_presets"] // [])[] | select(.profile_id == $preset)' "$REGISTRY")"
  if [[ -z "$PRESET" ]]; then
    echo "launch-agent: unknown profile_preset '$PROFILE_PRESET' for agent '$AGENT_ID'" >&2
    exit 2
  fi
else
  PRESET='{}'
fi

preset_field() {
  jq -r --arg p "$1" '.[$p] // empty' <<< "$PRESET"
}

preset_nested_field() {
  jq -r "($1 // empty)" <<< "$PRESET"
}

canonical_agent_slug() {
  local slug="$1"
  case "$slug" in
    *-claude) slug="${slug%-claude}" ;;
    *-codex) slug="${slug%-codex}" ;;
    *-hermes) slug="${slug%-hermes}" ;;
    *-openclaw) slug="${slug%-openclaw}" ;;
  esac
  tr '[:upper:]' '[:lower:]' <<< "$slug" | sed -E 's/[^a-z0-9_-]+/-/g; s/^-+//; s/-+$//'
}

DISPLAY_NAME="$(field display_name)"
[[ -n "$DISPLAY_NAME" ]] || { echo "launch-agent: agent '$AGENT_ID' missing display_name" >&2; exit 1; }

# Tilde-expand cwd. Honor PROJECT_ROOT override (alias-driven repointing).
RAW_CWD="$(field cwd)"
CWD="${PROJECT_ROOT:-${RAW_CWD/#\~/$HOME}}"
[[ -d "$CWD" ]] || { echo "launch-agent: cwd does not exist: $CWD" >&2; exit 1; }

COLOR="$(field color)"
ENTRY_RUNTIME="$(field runtime)"
PRESET_RUNTIME="$(preset_field runtime)"
REGISTRY_RUNTIME="$ENTRY_RUNTIME"
if [[ -z "$REGISTRY_RUNTIME" ]]; then
  REGISTRY_RUNTIME="$PRESET_RUNTIME"
fi
[[ -z "$REGISTRY_RUNTIME" ]] && REGISTRY_RUNTIME="codex"

RUNTIME_OVERRIDE="${SWARMY_RUNTIME_OVERRIDE:-}"
RUNTIME="$RUNTIME_OVERRIDE"
if [[ -z "$RUNTIME" ]]; then
  RUNTIME="$REGISTRY_RUNTIME"
fi
[[ -z "$RUNTIME" ]] && RUNTIME="codex"
ALLOW_CLAUDE_RUNTIME="$(jq -r '.allow_claude_runtime // false' <<< "$ENTRY")"
if [[ "$RUNTIME" == "claude" && "$ALLOW_CLAUDE_RUNTIME" != "true" && -z "$RUNTIME_OVERRIDE" ]]; then
  echo "launch-agent: agent '$AGENT_ID' sets runtime=claude without allow_claude_runtime=true" >&2
  exit 2
fi
MODEL="${SWARMY_MODEL_OVERRIDE:-}"
REASONING_EFFORT="${SWARMY_REASONING_EFFORT_OVERRIDE:-}"
PROVIDER="${SWARMY_PROVIDER_OVERRIDE:-}"
SANDBOX="${SWARMY_SANDBOX_OVERRIDE:-}"
APPROVAL_POLICY="${SWARMY_APPROVAL_POLICY_OVERRIDE:-}"
if [[ -z "$RUNTIME_OVERRIDE" || "$RUNTIME_OVERRIDE" == "$REGISTRY_RUNTIME" ]]; then
  [[ -z "$MODEL" ]] && MODEL="$(field model)"
  if [[ -z "$REASONING_EFFORT" ]]; then
    REASONING_EFFORT="$(field reasoning_effort)"
    [[ -z "$REASONING_EFFORT" ]] && REASONING_EFFORT="$(field effort)"
  fi
  [[ -z "$PROVIDER" ]] && PROVIDER="$(field provider)"
  [[ -z "$SANDBOX" ]] && SANDBOX="$(field sandbox)"
  [[ -z "$APPROVAL_POLICY" ]] && APPROVAL_POLICY="$(field approval_policy)"
  if [[ -z "$MODEL" && ( -z "$ENTRY_RUNTIME" || "$ENTRY_RUNTIME" == "$PRESET_RUNTIME" ) ]]; then
    MODEL="$(preset_field model)"
  fi
  if [[ -z "$REASONING_EFFORT" && ( -z "$ENTRY_RUNTIME" || "$ENTRY_RUNTIME" == "$PRESET_RUNTIME" ) ]]; then
    REASONING_EFFORT="$(preset_nested_field '.reasoning_effort')"
  fi
  if [[ -z "$SANDBOX" && ( -z "$ENTRY_RUNTIME" || "$ENTRY_RUNTIME" == "$PRESET_RUNTIME" ) ]]; then
    SANDBOX="$(preset_nested_field '.sandbox.mode')"
  fi
  if [[ -z "$APPROVAL_POLICY" && ( -z "$ENTRY_RUNTIME" || "$ENTRY_RUNTIME" == "$PRESET_RUNTIME" ) ]]; then
    APPROVAL_POLICY="$(preset_nested_field '.sandbox.approval_policy')"
  fi
fi
if [[ "$RUNTIME" == "claude" ]]; then
  if [[ "$MODEL" == gpt-* || "$MODEL" == *codex* ]]; then
    echo "launch-agent: ignoring Codex model '$MODEL' for Claude runtime agent '$AGENT_ID'" >&2
    MODEL=""
  fi
  if [[ "$REASONING_EFFORT" == "low" || "$REASONING_EFFORT" == "medium" || "$REASONING_EFFORT" == "high" ]]; then
    echo "launch-agent: ignoring Codex reasoning_effort '$REASONING_EFFORT' for Claude runtime agent '$AGENT_ID'" >&2
    REASONING_EFFORT=""
  fi
  SANDBOX=""
  APPROVAL_POLICY=""
elif [[ "$RUNTIME" == "codex" ]]; then
  if [[ "$MODEL" == claude-* ]]; then
    echo "launch-agent: ignoring Claude model '$MODEL' for Codex runtime agent '$AGENT_ID'" >&2
    MODEL=""
  fi
  if [[ "$REASONING_EFFORT" == "max" ]]; then
    echo "launch-agent: ignoring Claude effort '$REASONING_EFFORT' for Codex runtime agent '$AGENT_ID'" >&2
    REASONING_EFFORT=""
  fi
fi

WORKSPACE_MODE="$(field workspace_mode)"
WORKTREE_STRATEGY="$(field worktree_strategy)"
LOCAL_MODE="$(field local_mode)"
LOCAL_ATTACH="$(field local_attach)"
if [[ -z "$WORKSPACE_MODE" ]]; then
  WORKSPACE_MODE="$(preset_nested_field '.workspace.cwd_mode')"
fi
if [[ -z "$WORKTREE_STRATEGY" ]]; then
  WORKTREE_STRATEGY="$(preset_nested_field '.workspace.worktree_strategy')"
fi
if [[ -z "$LOCAL_MODE" ]]; then
  LOCAL_MODE="$(preset_nested_field '.local.mode')"
fi
if [[ -z "$LOCAL_ATTACH" ]]; then
  LOCAL_ATTACH="$(preset_nested_field '.local.attach')"
fi
# rename_to defaults to display_name uppercased to match the legacy per-agent
# scripts (xavier.sh wrote /rename XAVIER, lucius.sh /rename LUCIUS, etc).
RENAME_TO="$(field rename_to)"
[[ -z "$RENAME_TO" ]] && RENAME_TO="$(tr '[:lower:]' '[:upper:]' <<< "$DISPLAY_NAME")"

# STARTUP_SLASH precedence: env override > registry value. Empty string disables
# the auto-inject (matches the old gekko.sh `[ -n "$STARTUP_SLASH" ]` guard).
if [[ -n "${STARTUP_SLASH+x}" ]]; then
  STARTUP="$STARTUP_SLASH"
else
  STARTUP="$(field startup_slash)"
fi

cd "$CWD"

# ---------------------------------------------------------------------------
# Pre-launch hook (optional)
# ---------------------------------------------------------------------------
# Field is a free-form command string: "/path/to/hook --pre-launch Xavier".
# Tilde-expand and run via `eval` so the existing entries don't have to change
# their argv shape. Failure is non-fatal (matches the `[ -f ... ] && bash ...`
# guards in the old scripts).
PRE_LAUNCH_RAW="$(field pre_launch)"
if [[ -n "$PRE_LAUNCH_RAW" ]]; then
  PRE_LAUNCH="${PRE_LAUNCH_RAW/#\~/$HOME}"
  # The first whitespace-separated token is the path; check it exists before
  # invoking. Mirrors the `[ -f ... ]` guard in lucius.sh / gekko.sh.
  PRE_LAUNCH_BIN="${PRE_LAUNCH%% *}"
  if [[ -f "$PRE_LAUNCH_BIN" ]]; then
    eval "$PRE_LAUNCH" || echo "[launch-agent] pre_launch hook returned non-zero (continuing)" >&2
  fi
fi

# ---------------------------------------------------------------------------
# Per-agent env exports (e.g. KOKORO_VOICE for telegram-voice-followup)
# ---------------------------------------------------------------------------
# Iterate the env map and `export KEY=VALUE` for each entry. Skipped if the map
# is missing or empty.
while IFS=$'\t' read -r k v; do
  [[ -z "$k" ]] && continue
  export "$k=$v"
done < <(jq -r '(.env // {}) | to_entries[] | "\(.key)\t\(.value)"' <<< "$ENTRY")

MESSAGE_AGENT_SLUG="$(field message_agent_slug)"
[[ -z "$MESSAGE_AGENT_SLUG" ]] && MESSAGE_AGENT_SLUG="$(canonical_agent_slug "$AGENT_ID")"
MESSAGE_AGENT_SLUG="$(canonical_agent_slug "$MESSAGE_AGENT_SLUG")"
if [[ -n "$MESSAGE_AGENT_SLUG" && -z "${MESSAGE_AGENT_IDENTITY:-}" ]]; then
  export MESSAGE_AGENT_IDENTITY="${MESSAGE_AGENT_SLUG}-${RUNTIME}"
fi
[[ -n "${MESSAGE_AGENT_IDENTITY:-}" && -z "${MESSAGE_AGENT_FROM:-}" ]] && export MESSAGE_AGENT_FROM="$MESSAGE_AGENT_IDENTITY"
[[ -n "${MESSAGE_AGENT_IDENTITY:-}" && -z "${SWARMY_WORKER_NAME:-}" ]] && export SWARMY_WORKER_NAME="$MESSAGE_AGENT_IDENTITY"

if [[ -n "${TMUX_PANE:-}" && -n "${MESSAGE_AGENT_IDENTITY:-}" ]]; then
  tmux set-option -p -t "$TMUX_PANE" @agent-identity "$MESSAGE_AGENT_IDENTITY" >/dev/null 2>&1 \
    || echo "[launch-agent] failed to tag tmux pane identity=${MESSAGE_AGENT_IDENTITY}" >&2
  tmux set-option -p -t "$TMUX_PANE" @agent-runtime "$RUNTIME" >/dev/null 2>&1 \
    || echo "[launch-agent] failed to tag tmux pane runtime=${RUNTIME}" >&2
fi

[[ -n "$PROFILE_PRESET" ]] && export SWARMY_PROFILE_PRESET="$PROFILE_PRESET"
[[ -n "$WORKSPACE_MODE" ]] && export SWARMY_WORKSPACE_MODE="$WORKSPACE_MODE"
[[ -n "$WORKTREE_STRATEGY" ]] && export SWARMY_WORKTREE_STRATEGY="$WORKTREE_STRATEGY"
[[ -n "$LOCAL_MODE" ]] && export SWARMY_LOCAL_MODE="$LOCAL_MODE"
[[ -n "$LOCAL_ATTACH" ]] && export SWARMY_LOCAL_ATTACH="$LOCAL_ATTACH"

if [[ "$RUNTIME" == "codex" && -x "${SCRIPT_DIR}/scripts/codex-mcp-cleanup.sh" ]]; then
  "${SCRIPT_DIR}/scripts/codex-mcp-cleanup.sh" || echo "[launch-agent] codex MCP cleanup returned non-zero (continuing)" >&2
fi

build_runtime_command() {
  local runtime="$1"
  case "$runtime" in
    claude)
      local claude_model="${MODEL:-claude-opus-4-7[1m]}"
      local claude_effort="${REASONING_EFFORT:-max}"
      RUNTIME_CMD=(
        claude
        --channels "plugin:telegram@claude-plugins-official"
        --dangerously-skip-permissions
        --dangerously-load-development-channels "server:claude-peers"
        --exclude-dynamic-system-prompt-sections
        --model "$claude_model"
        --effort "$claude_effort"
        -n "$DISPLAY_NAME"
      )
      ;;
    codex)
      local codex_model="${MODEL:-gpt-5.5}"
      local codex_effort="${REASONING_EFFORT:-high}"
      local codex_sandbox="${SANDBOX:-danger-full-access}"
      local codex_approval="${APPROVAL_POLICY:-never}"
      RUNTIME_CMD=(
        codex
        --model "$codex_model"
        --ask-for-approval "$codex_approval"
        --sandbox "$codex_sandbox"
        -c "model_reasoning_effort=\"${codex_effort}\""
        --no-alt-screen
      )
      if [[ -n "$STARTUP" ]]; then
        RUNTIME_CMD+=("$STARTUP")
      fi
      ;;
    hermes)
      RUNTIME_CMD=(hermes chat --tui --yolo --accept-hooks)
      if [[ -n "$MODEL" ]]; then
        RUNTIME_CMD+=(--model "$MODEL")
      fi
      if [[ -n "$PROVIDER" ]]; then
        RUNTIME_CMD+=(--provider "$PROVIDER")
      fi
      ;;
    openclaw)
      RUNTIME_CMD=(openclaw chat --local)
      if [[ -n "$REASONING_EFFORT" ]]; then
        RUNTIME_CMD+=(--thinking "$REASONING_EFFORT")
      fi
      if [[ -n "$STARTUP" ]]; then
        RUNTIME_CMD+=(--message "$STARTUP")
      fi
      ;;
    *)
      echo "launch-agent: unsupported runtime '$runtime' for agent '$AGENT_ID' (expected claude|codex|hermes|openclaw)" >&2
      exit 2
      ;;
  esac

  while IFS= read -r arg; do
    [[ -n "$arg" ]] || continue
    RUNTIME_CMD+=("$arg")
  done < <(jq -r '(.runtime_args // [])[]' <<< "$ENTRY")
}

if [[ "$RUNTIME" == "claude" && -n "${TMUX_PANE:-}" ]]; then
  # PIDFILE per (agent, pane). Tmux pane ids are like %23 — the slash-safe
  # substitution matches the old per-agent scripts so existing /tmp files keep
  # working without orphaning.
  PIDFILE="/tmp/${AGENT_ID}-bg-${TMUX_PANE//%/_}.pids"

  # Stale-pid cleanup. Order is load-bearing: SIGKILL the subshell BEFORE its
  # sleep child. If we kill sleep first, bash unblocks and runs a delayed
  # command into the new Claude session mid-boot. SIGKILL (not SIGTERM) because
  # bash can trap SIGTERM.
  if [[ -f "$PIDFILE" ]]; then
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      kill -9 "$pid" 2>/dev/null || true
      pkill -9 -P "$pid" 2>/dev/null || true
    done < "$PIDFILE"
    rm -f "$PIDFILE"
  fi

  CLAUDE_WARNING_ACK_DELAY="${CLAUDE_WARNING_ACK_DELAY:-4}"
  CLAUDE_RENAME_DELAY="${CLAUDE_RENAME_DELAY:-10}"
  CLAUDE_STARTUP_DELAY="${CLAUDE_STARTUP_DELAY:-12}"

  # Stage 1: dismiss the --dangerously-load-development-channels warning.
  ( sleep "$CLAUDE_WARNING_ACK_DELAY"; tmux send-keys -t "$TMUX_PANE" Enter ) & echo $! >> "$PIDFILE"

  # Stage 2: pane color + rename. Matches the legacy 10s+0.5s spacing.
  if [[ -n "$COLOR" ]]; then
    ( sleep "$CLAUDE_RENAME_DELAY"; tmux send-keys -t "$TMUX_PANE" "/color $COLOR" Enter; sleep 0.5; tmux send-keys -t "$TMUX_PANE" "/rename $RENAME_TO" Enter ) & echo $! >> "$PIDFILE"
  else
    ( sleep "$CLAUDE_RENAME_DELAY"; tmux send-keys -t "$TMUX_PANE" "/rename $RENAME_TO" Enter ) & echo $! >> "$PIDFILE"
  fi

  # Stage 3: startup slash. Skip if empty.
  if [[ -n "$STARTUP" ]]; then
    ( sleep "$CLAUDE_STARTUP_DELAY"; tmux send-keys -t "$TMUX_PANE" "$STARTUP" Enter ) & echo $! >> "$PIDFILE"
  fi
fi

# ---------------------------------------------------------------------------
# Exec configured runtime.
# ---------------------------------------------------------------------------
RUNTIME_CMD=()
build_runtime_command "$RUNTIME"
exec "${RUNTIME_CMD[@]}"
