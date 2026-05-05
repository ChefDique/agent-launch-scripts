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
#   4. For Claude runtimes only, schedule the three-stage auto-inject sequence
#      (Enter at 4s, /color + /rename at 10s, startup_slash at 12s). Stale
#      subshell PID cleanup runs first — SIGKILL the subshell BEFORE its sleep
#      child (order matters; see CLAUDE.md "auto-inject sequence").
#   5. exec the configured runtime command (claude, codex, hermes, openclaw).
#
# Pivot knobs — env overrides for shell aliases that want to repoint an agent:
#   PROJECT_ROOT   — overrides the registry cwd
#   STARTUP_SLASH  — overrides the registry startup_slash (empty disables)
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

DISPLAY_NAME="$(field display_name)"
[[ -n "$DISPLAY_NAME" ]] || { echo "launch-agent: agent '$AGENT_ID' missing display_name" >&2; exit 1; }

# Tilde-expand cwd. Honor PROJECT_ROOT override (alias-driven repointing).
RAW_CWD="$(field cwd)"
CWD="${PROJECT_ROOT:-${RAW_CWD/#\~/$HOME}}"
[[ -d "$CWD" ]] || { echo "launch-agent: cwd does not exist: $CWD" >&2; exit 1; }

COLOR="$(field color)"
RUNTIME="$(field runtime)"
[[ -z "$RUNTIME" ]] && RUNTIME="claude"
MODEL="$(field model)"
REASONING_EFFORT="$(field reasoning_effort)"
[[ -z "$REASONING_EFFORT" ]] && REASONING_EFFORT="$(field effort)"
PROVIDER="$(field provider)"
SANDBOX="$(field sandbox)"
APPROVAL_POLICY="$(field approval_policy)"
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

# ---------------------------------------------------------------------------
# Auto-inject sequence (only when running inside a tmux pane)
# ---------------------------------------------------------------------------
if [[ "$RUNTIME" == "claude" && -n "${TMUX_PANE:-}" ]]; then
  # PIDFILE per (agent, pane). Tmux pane ids are like %23 — the slash-safe
  # substitution matches the old per-agent scripts so existing /tmp files keep
  # working without orphaning.
  PIDFILE="/tmp/${AGENT_ID}-bg-${TMUX_PANE//%/_}.pids"

  # Stale-pid cleanup. Order is load-bearing: SIGKILL the subshell BEFORE its
  # sleep child. If we kill sleep first, bash unblocks and runs `tmux send-keys`
  # into the new Claude session mid-boot. SIGKILL (not SIGTERM) because bash
  # can trap SIGTERM. See CLAUDE.md "stale-pid cleanup".
  if [[ -f "$PIDFILE" ]]; then
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      kill -9 "$pid" 2>/dev/null || true
      pkill -9 -P "$pid" 2>/dev/null || true
    done < "$PIDFILE"
    rm -f "$PIDFILE"
  fi

  # Stage 1 — dismiss the --dangerously-load-development-channels warning.
  ( sleep 4;  tmux send-keys -t "$TMUX_PANE" Enter ) & echo $! >> "$PIDFILE"

  # Stage 2 — pane color + rename. Matches the legacy 10s+0.5s spacing.
  if [[ -n "$COLOR" ]]; then
    ( sleep 10; tmux send-keys -t "$TMUX_PANE" "/color $COLOR" Enter; sleep 0.5; tmux send-keys -t "$TMUX_PANE" "/rename $RENAME_TO" Enter ) & echo $! >> "$PIDFILE"
  else
    ( sleep 10; tmux send-keys -t "$TMUX_PANE" "/rename $RENAME_TO" Enter ) & echo $! >> "$PIDFILE"
  fi

  # Stage 3 — startup slash. Skip if empty (matches old gekko.sh guard).
  if [[ -n "$STARTUP" ]]; then
    ( sleep 12; tmux send-keys -t "$TMUX_PANE" "$STARTUP" Enter ) & echo $! >> "$PIDFILE"
  fi
fi

# ---------------------------------------------------------------------------
# Exec configured runtime.
# ---------------------------------------------------------------------------
RUNTIME_CMD=()
build_runtime_command "$RUNTIME"
exec "${RUNTIME_CMD[@]}"
