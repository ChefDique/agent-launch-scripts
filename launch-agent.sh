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
#   4. Schedule boot-time tmux auto-injects: warning ack, then startup lines.
#      Default-ON for the Claude runtime (opt out via startup_injection.exclude);
#      other runtimes opt in via startup_injection.include. PID cleanup runs first.
#   5. exec the configured runtime command (claude, codex, hermes, openclaw).
#
# Pivot knobs — env overrides for shell aliases that want to repoint an agent:
#   PROJECT_ROOT   — overrides the registry cwd
#   STARTUP_SLASH  — overrides the registry startup_slash (empty disables)
#   SWARMY_RUNTIME_OVERRIDE / SWARMY_MODEL_OVERRIDE /
#   SWARMY_REASONING_EFFORT_OVERRIDE — launch-time overrides from AgentRemote.
# Registry field:
#   startup_injection — optional policy object for tmux boot injection:
#                    { "include": ["dangerous_permission_enter", "startup_lines"],
#                      "exclude": [] }
#                    exclude wins. Ignored unless runtime is Claude.
#   startup_lines  — JSON array of up to three startup text lines sent to Claude
#                    via tmux after boot. Supports {{color}}, {{rename_to}},
#                    {{startup_slash}}, {{display_name}}, {{agent_id}}, {{cwd}}.
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

csv_items() {
  local raw="$1"
  local item
  IFS=',' read -ra items <<< "$raw"
  for item in "${items[@]}"; do
    item="$(sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' <<< "$item")"
    [[ -n "$item" ]] && printf '%s\n' "$item"
  done
}

codex_config_model() {
  local config="${CODEX_CONFIG:-$HOME/.codex/config.toml}"
  [[ -f "$config" ]] || return 0
  awk -F= '
    /^\[/ { in_table=1 }
    !in_table && /^[[:space:]]*model[[:space:]]*=/ {
      value=$2
      sub(/^[[:space:]]*/, "", value)
      sub(/[[:space:]]*$/, "", value)
      gsub(/^["'\''"]|["'\''"]$/, "", value)
      print value
      exit
    }
  ' "$config" 2>/dev/null || true
}

codex_default_model() {
  local value="${AGENTREMOTE_CODEX_DEFAULT_MODEL:-${SWARMY_CODEX_DEFAULT_MODEL:-}}"
  if [[ -z "$value" ]]; then
    value="$(codex_config_model)"
  fi
  [[ -n "$value" ]] || value="gpt-5.5"
  printf '%s\n' "$value"
}

codex_catalog_models() {
  local cache="${CODEX_MODELS_CACHE:-$HOME/.codex/models_cache.json}"
  if [[ -f "$cache" ]] && command -v jq >/dev/null 2>&1; then
    jq -r '.models[]? | .slug // empty | select(test("^gpt-[0-9].*"))' "$cache" 2>/dev/null || true
  fi
}

codex_supported_models() {
  local raw="${AGENTREMOTE_CODEX_MODELS:-${SWARMY_CODEX_MODELS:-}}"
  local default_model
  default_model="$(codex_default_model)"
  if [[ -n "$raw" ]]; then
    printf '%s\n' "$default_model"
    csv_items "$raw"
  else
    printf '%s\n' "$default_model"
    codex_catalog_models
    printf '%s\n' \
      "gpt-5.5" \
      "gpt-5.4" \
      "gpt-5.4-mini" \
      "gpt-5.3-codex" \
      "gpt-5.3-codex-spark" \
      "gpt-5.2"
  fi | awk 'NF && !seen[$0]++'
}

codex_model_is_supported() {
  local model="$1"
  [[ -n "$model" ]] || return 1
  codex_supported_models | grep -Fxq "$model"
}

validate_codex_model() {
  local model="$1"
  if codex_model_is_supported "$model"; then
    return 0
  fi
  echo "launch-agent: unsupported Codex model '$model' for agent '$AGENT_ID'; supported models: $(codex_supported_models | paste -sd, -)" >&2
  exit 2
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
THEME_COLOR="$(field theme_color)"
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
  [[ -n "$MODEL" ]] || MODEL="$(codex_default_model)"
  validate_codex_model "$MODEL"
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
# Claude default-on: every Claude lead boots into /lead-gogo. When the registry has
# no usable startup_slash (null or "") and no env override is in play, default it
# so a Claude agent gets the startup command WITHOUT a per-agent entry — the
# dynamic contract (mirrors the HUD's DEFAULT_LEAD_STARTUP_SLASH). An env override
# (STARTUP_SLASH=, even empty) always wins and can still disable it.
if [[ "$RUNTIME" == "claude" && -z "$STARTUP" && -z "${STARTUP_SLASH+x}" ]]; then
  STARTUP="/lead-gogo"
fi

expand_startup_line() {
  local line="$1"
  line="${line//'{{agent_id}}'/$AGENT_ID}"
  line="${line//'{{display_name}}'/$DISPLAY_NAME}"
  line="${line//'{{color}}'/$COLOR}"
  line="${line//'{{rename_to}}'/$RENAME_TO}"
  line="${line//'{{startup_slash}}'/$STARTUP}"
  line="${line//'{{cwd}}'/$CWD}"
  printf '%s\n' "$line"
}

startup_lines_contains() {
  local needle="$1" item
  (( ${#STARTUP_LINES[@]} )) || return 1
  for item in "${STARTUP_LINES[@]}"; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

read_startup_lines() {
  STARTUP_LINES=()
  if jq -e '.startup_lines != null' <<< "$ENTRY" >/dev/null; then
    HAS_STARTUP_LINES=true
    if ! jq -e '.startup_lines | type == "array"' <<< "$ENTRY" >/dev/null; then
      echo "launch-agent: startup_lines for agent '$AGENT_ID' must be a JSON array" >&2
      exit 2
    fi
    if ! jq -e 'all(.startup_lines[]; type == "string")' <<< "$ENTRY" >/dev/null; then
      echo "launch-agent: startup_lines for agent '$AGENT_ID' must contain only strings" >&2
      exit 2
    fi
    while IFS= read -r startup_line; do
      startup_line="$(expand_startup_line "$startup_line")"
      [[ -n "$startup_line" ]] && STARTUP_LINES+=("$startup_line")
    done < <(jq -r '.startup_lines[:3][]' <<< "$ENTRY")
    # An explicit startup_lines array used to BE the complete boot sequence — it
    # silently dropped the declarative /rename + startup_slash fields. So hansel
    # (startup_lines ["/color pink"], startup_slash "/lead-gogo") never ran
    # /lead-gogo, while xavier only worked because it duplicated /lead-gogo into
    # its array. That per-agent divergence is the "works for some, not others, as
    # if hardcoded" bug. Augment instead of replace: re-add /rename (Claude) and
    # startup_slash unless the array already lists them (dedup avoids doubles).
    # /color stays the array author's to override (hansel: cyan field -> pink).
    if [[ "$RUNTIME" == "claude" ]] && [[ -n "$RENAME_TO" ]] \
        && ! startup_lines_contains "/rename $RENAME_TO"; then
      STARTUP_LINES+=("/rename $RENAME_TO")
    fi
    if [[ -n "$STARTUP" ]] && ! startup_lines_contains "$STARTUP"; then
      STARTUP_LINES+=("$STARTUP")
    fi
    return 0
  fi
  HAS_STARTUP_LINES=false

  # Backward-compatible fallback uses legacy fields:
  #   * COLOR => /color COLOR
  #   * rename_to => /rename RENAME_TO
  #   * startup_slash => startup command
  # /color and /rename are Claude-only slash commands. Never inject them into a
  # non-Claude pane (they would land as literal text). Non-Claude runtimes fall
  # back to just the startup command.
  if [[ "$RUNTIME" == "claude" ]]; then
    if [[ -n "$COLOR" ]]; then
      STARTUP_LINES+=("/color $COLOR")
    fi
    STARTUP_LINES+=("/rename $RENAME_TO")
  fi
  [[ -n "$STARTUP" ]] && STARTUP_LINES+=("$STARTUP")
  # Explicit success. The bare [[ -n "$STARTUP" ]] above returns 1 when STARTUP is
  # empty; as the function's last command that makes read_startup_lines return
  # non-zero and trip `set -e` at the bare call site — i.e. a Claude agent with an
  # empty startup_slash would fail to launch entirely. Always return success.
  return 0
}

send_tmux_literal_line() {
  local line="$1"
  [[ -n "$line" ]] || return 0
  tmux send-keys -t "$TMUX_PANE" -l -- "$line"
  # Two-phase submit: the literal text and Enter MUST land in separate reads, or
  # a raw-mode TUI (Claude/Codex) treats text+CR as a paste and the line sits in
  # the composer unsubmitted. Mirrors remote-app/tmux-send-path.js. The delay is
  # load-bearing; tests set STARTUP_SUBMIT_ENTER_DELAY=0 to stay fast.
  sleep "${STARTUP_SUBMIT_ENTER_DELAY:-0.15}"
  tmux send-keys -t "$TMUX_PANE" Enter
}

validate_startup_injection_policy() {
  if ! jq -e '.startup_injection != null' <<< "$ENTRY" >/dev/null; then
    return
  fi
  if ! jq -e '.startup_injection | type == "object"' <<< "$ENTRY" >/dev/null; then
    echo "launch-agent: startup_injection for agent '$AGENT_ID' must be a JSON object" >&2
    exit 2
  fi
  for policy_key in include exclude; do
    if ! jq -e --arg k "$policy_key" '
      if .startup_injection[$k] == null then
        true
      else
        (.startup_injection[$k] | type == "array") and all(.startup_injection[$k][]; type == "string")
      end
    ' <<< "$ENTRY" >/dev/null; then
      echo "launch-agent: startup_injection.$policy_key for agent '$AGENT_ID' must be an array of strings" >&2
      exit 2
    fi
  done
}

startup_injection_includes() {
  local token="$1"
  jq -e --arg token "$token" '((.startup_injection.include // []) | index($token)) != null' <<< "$ENTRY" >/dev/null
}

startup_injection_excludes() {
  local token="$1"
  jq -e --arg token "$token" '((.startup_injection.exclude // []) | index($token)) != null' <<< "$ENTRY" >/dev/null
}

startup_injection_allows() {
  local token="$1"
  # Explicit opt-in only: the per-agent startup_injection.include array. An agent
  # with no startup_injection object is NOT allowed here (returns 1); the Claude
  # default-on path is handled by startup_injection_active() below.
  jq -e '.startup_injection != null' <<< "$ENTRY" >/dev/null || return 1
  startup_injection_includes "$token" || return 1
  if startup_injection_excludes "$token"; then
    return 1
  fi
  return 0
}

startup_injection_active() {
  # Unified default-on policy (the fix for per-agent hardcoding). A token fires
  # when the per-agent policy explicitly allows it, OR the runtime is Claude and
  # the token is not explicitly excluded. Claude always launches with
  # --dangerously-load-development-channels (a blocking warning) and is the lane
  # that wants the /color + /rename + startup_slash boot lines, so BOTH
  # dangerous_permission_enter AND startup_lines default ON for Claude with no
  # registry entry required. Opt out per token via startup_injection.exclude;
  # non-Claude runtimes still require explicit opt-in (never a stray keystroke).
  local token="$1"
  startup_injection_allows "$token" && return 0
  [[ "$RUNTIME" == "claude" ]] && ! startup_injection_excludes "$token" && return 0
  return 1
}

schedule_warning_ack() {
  local delay="$1"
  # Keys that dismiss the runtime's startup warning intro. Configurable per agent
  # via startup_injection.warning_ack_keys (tmux key names, e.g. ["1","Enter"]);
  # default is a single Enter. Each key is sent as its own keypress with a gap so
  # a select-then-confirm warning ("1" then Enter) registers correctly.
  local -a keys=()
  while IFS= read -r k; do
    [[ -n "$k" ]] && keys+=("$k")
  done < <(jq -r '(.startup_injection.warning_ack_keys // ["Enter"])[]' <<< "$ENTRY" 2>/dev/null)
  (( ${#keys[@]} > 0 )) || keys=("Enter")
  (
    sleep "$delay"
    for k in "${keys[@]}"; do
      tmux send-keys -t "$TMUX_PANE" "$k"
      sleep "${STARTUP_WARNING_ACK_GAP:-0.2}"
    done
  ) & echo $! >> "$PIDFILE"
}

schedule_tmux_literal_lines() {
  local delay="$1"
  shift
  ( sleep "$delay"; for line in "$@"; do send_tmux_literal_line "$line"; sleep 0.5; done ) & echo $! >> "$PIDFILE"
}

validate_startup_injection_policy

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

# Per-agent statusline color. The global statusline script reads
# AGENT_STATUSLINE_COLOR (a #RRGGBB hex) and paints its banner with it so each
# agent's terminal matches its AgentRemote HUD tile (both driven by theme_color).
# /color can't recolor a custom statusline, so this is the lever that does.
# Unset for non-launcher/interactive sessions => statusline keeps its default.
[[ -n "$THEME_COLOR" ]] && export AGENT_STATUSLINE_COLOR="$THEME_COLOR"

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
      local claude_model="${MODEL:-default}"
      local claude_effort="${REASONING_EFFORT:-max}"
      RUNTIME_CMD=(
        claude
        --channels "plugin:telegram@claude-plugins-official"
        --dangerously-skip-permissions
        --dangerously-load-development-channels "server:claude-peers"
        --exclude-dynamic-system-prompt-sections
        --effort "$claude_effort"
        -n "$DISPLAY_NAME"
      )
      # "default" (or empty) => omit --model so Claude Code resolves its own
      # recommended default (Opus 4.8 1M ctx today; auto-tracks future bumps,
      # matching Richard's `/model default`). The bare word "default" is NOT a
      # valid `claude --model` alias, so we drop the flag rather than pass it.
      # Mirrors the Hermes "default" sentinel handling below.
      if [[ -n "$claude_model" && "$claude_model" != "default" ]]; then
        RUNTIME_CMD+=(--model "$claude_model")
      fi
      ;;
    codex)
      local codex_model="${MODEL:-$(codex_default_model)}"
      local codex_effort="${REASONING_EFFORT:-xhigh}"
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
      if [[ -n "$STARTUP" && "${STARTUP_VIA_INJECTION:-false}" != true ]]; then
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
      if [[ -n "$STARTUP" && "${STARTUP_VIA_INJECTION:-false}" != true ]]; then
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

if [[ -n "${TMUX_PANE:-}" ]]; then
  # Runtime-agnostic startup injection. Whether anything fires is decided per
  # agent by startup_injection_allows() (the toggle), not by runtime. An agent
  # with no startup_injection policy schedules nothing below.
  #
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

  # Stage 1 (warning ack) + Stage 2 (boot lines) are BOTH default-ON for the
  # Claude runtime via startup_injection_active(): Claude always launches with
  # --dangerously-load-development-channels (a blocking warning) and is the lane
  # that wants /color + /rename + startup_slash, so neither needs a per-agent
  # registry entry — this covers any Claude agent migrated without a
  # startup_injection policy (e.g. dasha, hansel). Opt out per token via
  # startup_injection.exclude; non-Claude runtimes still require explicit opt-in,
  # so they never receive a stray keystroke. Default warning key is Enter; an
  # agent whose warning needs a different key (e.g. "1") sets
  # startup_injection.warning_ack_keys (see schedule_warning_ack).
  if startup_injection_active "dangerous_permission_enter"; then
    schedule_warning_ack "$CLAUDE_WARNING_ACK_DELAY"
  fi

  if startup_injection_active "startup_lines"; then
    read_startup_lines
    if (( ${#STARTUP_LINES[@]} > 0 )); then
      if [[ "$HAS_STARTUP_LINES" == true ]]; then
        # Registry-supplied lines: send all together at startup delay. Works for
        # any runtime — the agent author owns the line content.
        schedule_tmux_literal_lines "$CLAUDE_STARTUP_DELAY" "${STARTUP_LINES[@]}"
      elif [[ "$RUNTIME" == "claude" && -n "$COLOR" ]]; then
        # Claude legacy path keeps historical spacing: color + rename, then startup.
        schedule_tmux_literal_lines "$CLAUDE_RENAME_DELAY" "/color $COLOR" "/rename $RENAME_TO"
        if [[ -n "$STARTUP" ]]; then
          schedule_tmux_literal_lines "$CLAUDE_STARTUP_DELAY" "$STARTUP"
        fi
      elif [[ "$RUNTIME" == "claude" ]]; then
        # Claude legacy path for entries that only specified rename/startup_slash.
        schedule_tmux_literal_lines "$CLAUDE_RENAME_DELAY" "/rename $RENAME_TO"
        if [[ -n "$STARTUP" ]]; then
          schedule_tmux_literal_lines "$CLAUDE_STARTUP_DELAY" "$STARTUP"
        fi
      elif [[ -n "$STARTUP" ]]; then
        # Non-Claude fallback: inject only the startup command (no Claude-only
        # /color or /rename slash commands, which would land as literal text).
        schedule_tmux_literal_lines "$CLAUDE_STARTUP_DELAY" "$STARTUP"
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Exec configured runtime.
# ---------------------------------------------------------------------------
# When startup_lines injection is active for this pane, the startup command is
# delivered by keystroke injection (so it lands after the warning-ack), not as a
# launch argument — otherwise codex/openclaw would receive the command twice.
STARTUP_VIA_INJECTION=false
if [[ -n "${TMUX_PANE:-}" ]] && startup_injection_active "startup_lines"; then
  STARTUP_VIA_INJECTION=true
fi

RUNTIME_CMD=()
build_runtime_command "$RUNTIME"
exec "${RUNTIME_CMD[@]}"
