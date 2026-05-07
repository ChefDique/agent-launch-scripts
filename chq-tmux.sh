#!/usr/bin/env bash
set -euo pipefail

# CHQ Tmux Launcher — spin up department leads in tmux panes
# Usage:
#   chq-tmux.sh start    — create session with all department leads
#   chq-tmux.sh stop     — kill the entire CHQ session
#   chq-tmux.sh status   — show which panes are running
#   chq-tmux.sh attach   — attach to the CHQ session
#   chq-tmux.sh restart <dept> — restart a single department pane

SESSION="${CHQ_SESSION:-chq}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHQ_ROOT="/Users/richardadair/ai_projects/CorporateHQ"
RESTART_DELAY=3
AUTO_ATTACH_DEFAULT="${TMUX_AUTO_ATTACH:-1}"

# Department definitions: name|cwd|window-name|script
#
# Two sources, merged into one DEPARTMENTS array:
#   1. Registry-driven (agents.json) — xavier/lucius/gekko/swarmy/claude/codex.
#      Each registry entry contributes ONE department whose script field is
#      `bash launch-agent.sh <id>` so adding a new agent here is just an
#      `agents.json` append.
#   2. Static (this file) — agent-factory residents (mugatu, derek, hansel,
#      maury) whose scripts live in the agent-factory repo. They're not in the
#      registry because their launchers aren't owned by this repo.
#
# Xavier is the harness slot (not a department). The registry order puts it
# first, so it lands as the leftmost pane on `start all`.
REGISTRY="${AGENT_REGISTRY:-${SCRIPT_DIR}/agents.json}"
LAUNCH_AGENT="${SCRIPT_DIR}/launch-agent.sh"
AGENT_FACTORY="${HOME}/ai_projects/agent-factory"

shell_quote() {
  printf '%q' "$1"
}

DEPARTMENTS=()
if [[ -f "$REGISTRY" ]] && command -v jq >/dev/null 2>&1; then
  # Pull id|cwd from the registry. The DEPARTMENTS entry uses `id` for both
  # the dept slug AND the initial pane title (wname) — Claude's /rename
  # may overwrite that title afterward, while Codex/Hermes/OpenClaw keep it.
  # Broadcast targeting (Electron remote) reads tmux_target
  # from the registry directly, so the initial wname only matters for the
  # CLI (chq-tmux.sh start <name>) and the pane-border-format display.
  while IFS=$'\t' read -r id cwd; do
    [[ -z "$id" ]] && continue
    cwd="${cwd/#\~/$HOME}"
    q_registry=$(shell_quote "$REGISTRY")
    q_launch_agent=$(shell_quote "$LAUNCH_AGENT")
    q_id=$(shell_quote "$id")
    DEPARTMENTS+=("${id}|${cwd}|${id}|AGENT_REGISTRY=${q_registry} bash ${q_launch_agent} ${q_id}")
  done < <(jq -r '.agents[] | [.id, .cwd] | @tsv' "$REGISTRY")
else
  echo "WARN: agents.json registry not found or jq missing — registry agents unavailable" >&2
fi

# Static agent-factory entries (not in agents.json — their scripts live in the
# agent-factory repo). Insert these after the registry agents.
DEPARTMENTS+=(
  "ceo|${AGENT_FACTORY}/dogfood-agents/CEO_Office|mugatu|${AGENT_FACTORY}/Operations/scripts/mugatu.sh"
  "engineering|${AGENT_FACTORY}/Engineering|derek|${AGENT_FACTORY}/Operations/scripts/derek.sh"
  "marketing|${HOME}/ai_projects/adairlabs|hansel|${AGENT_FACTORY}/Operations/scripts/hansel.sh"
  "operations|${AGENT_FACTORY}/Operations|maury|${AGENT_FACTORY}/Operations/scripts/maury.sh"
)

# Sidecar file written by chq-tmux.sh at pane creation time. Maps agent id
# (from agents.json) → stable pane_id (%N notation) so remote-app/main.js can
# target broadcasts via pane_id rather than the brittle pane-title grep.
# pane_id is stable across agent auto-restart: pane_loop relaunches the
# configured runtime in the SAME pane, so no re-write is needed on relaunch.
SIDECAR_PATH="${AGENT_REMOTE_PANES_SIDECAR:-/tmp/agent-remote-panes.json}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

should_auto_attach() {
  [[ "${AUTO_ATTACH_DEFAULT}" == "1" ]] || return 1
  [[ -z "${TMUX:-}" ]] || return 1
  [[ -t 0 && -t 1 ]] || return 1
}

auto_attach_if_requested() {
  should_auto_attach || return 0
  echo "Auto-attaching to tmux session '${SESSION}'..."
  exec tmux attach -t "$SESSION"
}

session_exists() {
  tmux has-session -t "$SESSION" 2>/dev/null
}

# Given `tmux list-panes -s -F '#{window_id}\t#{pane_id}'` on stdin, print the
# pane ids that should be broken out to make each tmux window hold at most one
# pane. The first pane in each existing window stays put; every sibling gets a
# new tmux window.
pane_ids_to_break_for_window_normalization() {
  awk -F '\t' 'NF >= 2 { seen[$1]++; if (seen[$1] > 1 && $2 ~ /^%[0-9]+$/) print $2 }'
}

normalize_session_to_tmux_windows() {
  local layout="$1"
  case "$layout" in windows|ittab) ;; *) return 0 ;; esac

  local pane_ids
  pane_ids=$(
    tmux list-panes -s -t "$SESSION" -F $'#{window_id}\t#{pane_id}' 2>/dev/null \
      | pane_ids_to_break_for_window_normalization
  ) || true
  [[ -z "$pane_ids" ]] && return 0

  local pane_id pane_title
  while IFS= read -r pane_id; do
    [[ -z "$pane_id" ]] && continue
    [[ "$pane_id" =~ ^%[0-9]+$ ]] || continue
    pane_title=$(tmux display-message -t "$pane_id" -p '#{pane_title}' 2>/dev/null || echo "")
    tmux break-pane -d -s "$pane_id" -t "${SESSION}:"
    if [[ -n "$pane_title" ]]; then
      tmux rename-window -t "$pane_id" "$pane_title" 2>/dev/null || true
    fi
  done <<< "$pane_ids"
}

normalize_session_for_layout() {
  local layout="$1"
  case "$layout" in
    windows|ittab) normalize_session_to_tmux_windows "$layout" ;;
    *) return 0 ;;
  esac
}

# Write/update the pane sidecar at SIDECAR_PATH. Called once per pane at
# creation time — pane_id is stable across agent auto-restart, so this only
# runs when the pane is first created, NOT on every loop iteration.
#
# Args: <agent-id> <pane_target>
#   agent-id    — agents.json id field (e.g. "xavier")
#   pane_target — tmux target used to query the pane_id (e.g. "chq:chq.0"
#                 or the %N-style id returned by split-window -P -F '#{pane_id}')
#
# The sidecar is a flat JSON object: { "xavier": { "pane_id": "%5",
# "session": "chq", "window": 0, "pane": 2, "updated_at": "..." }, ... }
# python3 is used for atomic JSON read-modify-write without external deps.
write_pane_sidecar() {
  local agent_id="$1"
  local pane_target="$2"
  # Capture stable pane_id (e.g. "%23") from tmux.
  local pane_id
  pane_id=$(tmux display-message -t "$pane_target" -p '#{pane_id}' 2>/dev/null) || return 0
  [[ -z "$pane_id" ]] && return 0
  # Capture session/window/pane indexes for the coord triple.
  local session_name window_index pane_index
  session_name=$(tmux display-message -t "$pane_target" -p '#{session_name}' 2>/dev/null) || return 0
  window_index=$(tmux display-message -t "$pane_target"  -p '#{window_index}' 2>/dev/null) || return 0
  pane_index=$(tmux display-message -t "$pane_target"    -p '#{pane_index}'   2>/dev/null) || return 0
  # Atomic read-modify-write via python3 (available on macOS without extra deps).
  # `|| true` ensures a python3 failure (e.g. /tmp permission) never aborts
  # the caller under set -euo pipefail — sidecar is best-effort metadata.
  python3 - <<PYEOF || true
import json, os, sys, datetime
path = "${SIDECAR_PATH}"
try:
    data = json.loads(open(path).read()) if os.path.exists(path) else {}
except Exception:
    data = {}
data["${agent_id}"] = {
    "pane_id":     "${pane_id}",
    "session":     "${session_name}",
    "window":      int("${window_index}") if "${window_index}".isdigit() else "${window_index}",
    "pane":        int("${pane_index}")   if "${pane_index}".isdigit()   else "${pane_index}",
    "updated_at":  datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
}
tmp = path + ".tmp"
open(tmp, "w").write(json.dumps(data, indent=2) + "\n")
os.replace(tmp, path)
PYEOF
}

# Build the restart loop command for a department pane.
# The runtime runs, and when it exits the loop waits RESTART_DELAY seconds then relaunches.
# Each iteration writes a timestamped banner + exit code to /tmp/chq-pane-<slug>.log
# so post-mortem can tell whether the loop never started vs. started but was SIGKILL'd.
#
# `script` may be either a path to a .sh file (legacy static entries) OR a
# command string like `bash launch-agent.sh <id>` (registry entries). The third
# arg is the dept name, used as the log slug to keep one log file per agent.
pane_loop() {
  local cwd="$1"
  local script="$2"
  local slug="${3:-pane}"
  local log="/tmp/chq-pane-${slug}.log"
  # If `script` is a single path (no spaces), prefix with `bash` for the legacy
  # behavior. Otherwise it's already a full command — invoke as-is via sh -c.
  local invoke
  if [[ "$script" == *" "* ]]; then
    invoke="$script"
  else
    invoke="bash \"$script\""
  fi
  # auto_restart gate: re-read the registry each iteration so a renderer-side
  # toggle takes effect without restarting the loop. `// true` makes the field
  # opt-out — entries without it keep the historical always-restart behavior.
  # Static agent-factory entries have no registry row; jq returns empty and the
  # `[[ -z ... ]]` branch falls through to the always-restart path.
  cat <<LOOP
cd "${cwd}" && { echo "[\$(date '+%F %T')] pane_loop start cmd=${invoke} log=${log}" | tee -a "${log}"; while true; do echo "[\$(date '+%F %T')] -> ${invoke}" | tee -a "${log}"; ${invoke}; rc=\$?; ar=\$(jq -r --arg id "${slug}" '.agents[]? | select(.id==\$id) | .auto_restart // true' "${REGISTRY}" 2>/dev/null); if [[ -n "\$ar" && "\$ar" != "true" ]]; then echo "[\$(date '+%F %T')] <- exit=\$rc, auto_restart=false; loop exiting" | tee -a "${log}"; break; fi; echo "[\$(date '+%F %T')] <- exit=\$rc, restarting in ${RESTART_DELAY}s" | tee -a "${log}"; sleep ${RESTART_DELAY}; done; }
LOOP
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

cmd_start() {
  if session_exists; then
    echo "Session '${SESSION}' already exists. Use 'attach' or 'stop' first."
    tmux list-windows -t "$SESSION" -F "  #I: #W (#{pane_current_command})"
    auto_attach_if_requested
    exit 0
  fi

  # Collect exec names from args, or prompt interactively if none given
  local selected_names=()
  if [[ $# -gt 0 && "$1" == "all" ]]; then
    # Arg mode shorthand: chq-tmux.sh start all
    for entry in "${DEPARTMENTS[@]}"; do
      IFS='|' read -r dept cwd wname script <<< "$entry"
      selected_names+=("$wname")
    done
  elif [[ $# -gt 0 ]]; then
    # Arg mode: chq-tmux.sh start mugatu derek hansel ...
    selected_names=("$@")
  else
    # Interactive mode: prompt for comma/space separated list or 'all'
    printf "Which executives? (comma/space separated, or 'all'): "
    read -r input
    if [[ "$input" == "all" ]]; then
      for entry in "${DEPARTMENTS[@]}"; do
        IFS='|' read -r dept cwd wname script <<< "$entry"
        selected_names+=("$wname")
      done
    else
      # Split on commas and spaces
      IFS=', ' read -ra selected_names <<< "$input"
    fi
  fi

  # Validate all names and build the working list
  local selected_entries=()
  for name in "${selected_names[@]}"; do
    [[ -z "$name" ]] && continue
    local found=""
    for entry in "${DEPARTMENTS[@]}"; do
      IFS='|' read -r dept cwd wname script <<< "$entry"
      if [[ "$wname" == "$name" || "$dept" == "$name" ]]; then
        found="$entry"
        break
      fi
    done
    if [[ -z "$found" ]]; then
      local valid_names=()
      for e in "${DEPARTMENTS[@]}"; do
        IFS='|' read -r d _ wn _ <<< "$e"
        valid_names+=("$wn")
      done
      echo "ERROR: Unknown executive '${name}'. Valid options: ${valid_names[*]}" >&2
      exit 1
    fi
    selected_entries+=("$found")
  done

  if [[ ${#selected_entries[@]} -eq 0 ]]; then
    die "No executives selected."
  fi

  # Layout mode — env-driven so the renderer can spawn with a preferred shape.
  #   ittab  (default) — first agent in window "chq", each subsequent agent in
  #                      its own tmux window named after the agent. cmd_attach
  #                      uses `tmux -CC attach` so iTerm renders each tmux
  #                      window as a real iTerm window. Drag, dock, split,
  #                      merge into tabs freely — the layout is whatever
  #                      Richard wants in iTerm. New default 2026-05-03.
  #   windows          — same window-per-agent as ittab but uses plain
  #                      `tmux attach` so it shows as one iTerm tab with tmux
  #                      window-switching (Ctrl-b N). Useful on Linux / non-
  #                      iTerm terminals.
  #   panes            — every agent as a horizontal split-pane in window
  #                      "chq". Original behavior. Cramped at 5+ agents but
  #                      keeps everything in a single iTerm tab.
  #   tiled            — every agent as a pane in window "chq", but after all
  #                      panes are spawned `tmux select-layout tiled` runs to
  #                      auto-balance into a grid. Works well at 4+ agents.
  #                      Added 2026-05-03 for the deploy-preview overlay.
  local layout="${CHQ_LAYOUT:-ittab}"
  case "$layout" in panes|windows|ittab|tiled) ;; *) die "invalid CHQ_LAYOUT: $layout (panes|windows|ittab|tiled)";; esac

  echo "Starting CHQ tmux session (layout=${layout})..."

  local first="${selected_entries[0]}"
  IFS='|' read -r dept cwd wname script <<< "$first"

  tmux new-session -d -s "$SESSION" -n "chq" -c "$cwd" -x 220 -y 50 "$(pane_loop "$cwd" "$script" "$dept")"
  tmux select-pane -t "${SESSION}:chq.0" -T "$wname"
  # Capture stable pane_id for the sidecar (registry agents only — static
  # agent-factory entries don't have an agents.json id to key on, so skip them).
  # The dept field IS the agents.json id for registry entries (see DEPARTMENTS
  # construction above). Static entries use plain names (ceo/engineering/etc).
  write_pane_sidecar "$dept" "${SESSION}:chq.0" || true

  # Stash the layout choice on the session so cmd_attach can read it back.
  # tmux @user-options survive for the session's lifetime and are zero-cost.
  tmux set-option -t "$SESSION" -q '@chq_layout' "$layout"

  if [[ ${#selected_entries[@]} -gt 1 ]]; then
    for entry in "${selected_entries[@]:1}"; do
      IFS='|' read -r dept cwd wname script <<< "$entry"
      case "$layout" in
        panes|tiled)
          # Both layouts spawn as horizontal splits inside chq:0; tiled gets
          # an extra `select-layout tiled` after all panes exist (below).
          # -P -F '#{pane_id}' prints the new pane's stable id (%N notation)
          # so we target by id rather than positional index from here on.
          local new_pid
          new_pid=$(tmux split-window -h -t "${SESSION}:chq" -c "$cwd" -P -F '#{pane_id}' "$(pane_loop "$cwd" "$script" "$dept")")
          tmux select-pane -t "$new_pid" -T "$wname"
          write_pane_sidecar "$dept" "$new_pid" || true
          ;;
        windows|ittab)
          # Trailing colon = session-target form. Without it, `-t "$SESSION"`
          # is ambiguous when the existing first window happens to share the
          # session name (which it does — line 213 hardcodes -n "chq" inside
          # session "chq"); tmux resolves `-t chq` to the existing window
          # and new-window fails with "create window failed: index 0 in use".
          # Repro: tmux new-session -d -s chq -n chq; tmux new-window -t chq -n x
          # → "create window failed: index 0 in use". With -t "chq:" it works.
          local new_pid
          new_pid=$(tmux new-window -t "${SESSION}:" -n "$wname" -c "$cwd" -P -F '#{pane_id}' "$(pane_loop "$cwd" "$script" "$dept")")
          tmux select-pane -t "$new_pid" -T "$wname"
          write_pane_sidecar "$dept" "$new_pid" || true
          ;;
      esac
    done
  fi

  normalize_session_for_layout "$layout"

  tmux set -t "$SESSION" pane-border-status top
  tmux set -t "$SESSION" pane-border-format " #T "
  # Apply the chosen pane layout. `tiled` auto-balances into a grid; `panes`
  # keeps the historical even-horizontal split. `windows`/`ittab` only have
  # one pane in chq:0, so even-horizontal is a no-op for them but harmless.
  if [[ "$layout" == "tiled" ]]; then
    tmux select-layout -t "${SESSION}:chq" tiled
  else
    tmux select-layout -t "${SESSION}:chq" even-horizontal
  fi
  tmux select-pane -t "${SESSION}:chq.0"

  # Navigation: mouse + Alt-number + Alt-arrow, no prefix chord required.
  tmux set -g mouse on
  tmux set -g history-limit 50000
  # Let terminal chat UIs distinguish modified keys such as Shift+Enter
  # through tmux. iTerm must also emit modified-key sequences for this to work.
  tmux set -g extended-keys always
  tmux set -g extended-keys-format csi-u
  if ! tmux show -gqv terminal-features | tr ',' '\n' | grep -Eq '^xterm\*:(.*:)?extkeys(:|$)'; then
    tmux set -as terminal-features ',xterm*:extkeys'
  fi
  tmux bind-key -n M-1 select-pane -t 0
  tmux bind-key -n M-2 select-pane -t 1
  tmux bind-key -n M-3 select-pane -t 2
  tmux bind-key -n M-4 select-pane -t 3
  tmux bind-key -n M-5 select-pane -t 4
  tmux bind-key -n M-Left  select-pane -L
  tmux bind-key -n M-Right select-pane -R
  tmux bind-key -n M-Up    select-pane -U
  tmux bind-key -n M-Down  select-pane -D

  echo "CHQ session started with ${#selected_entries[@]} executive(s):"
  for entry in "${selected_entries[@]}"; do
    IFS='|' read -r dept cwd wname script <<< "$entry"
    echo "  ${wname} -> ${cwd}"
  done
  echo ""
  echo "Attach with:  tmux attach -t ${SESSION}"
  echo "Or run:       $0 attach"
  auto_attach_if_requested
}

cmd_stop() {
  if ! session_exists; then
    echo "No CHQ session running."
    exit 0
  fi

  tmux kill-session -t "$SESSION"
  echo "CHQ session stopped."
}

cmd_status() {
  if ! session_exists; then
    echo "No CHQ session running."
    exit 0
  fi

  echo "CHQ tmux session:"
  tmux list-windows -t "$SESSION" -F "  #I: #W — #{pane_current_path} (#{pane_current_command})"
}

cmd_attach() {
  if ! session_exists; then
    die "No CHQ session running. Start with: $0 start"
  fi

  # Honor the layout recorded at start time. ittab uses tmux -CC so iTerm
  # renders each tmux window as its own iTerm window — drag/dock freely.
  # Falls back to plain attach if @chq_layout was never set (legacy session).
  local layout
  layout=$(tmux show-option -t "$SESSION" -v -q '@chq_layout' 2>/dev/null || echo "")
  if [[ "$layout" == "ittab" ]]; then
    normalize_session_for_layout "$layout"
    exec tmux -CC attach -t "$SESSION"
  fi
  normalize_session_for_layout "$layout"
  exec tmux attach -t "$SESSION"
}

# Add agent panes to an EXISTING chq session. Idempotent: if a pane with the
# requested wname already exists, it's a no-op. Created to fix the Electron
# Deploy bug — clicking an agent button when chq is already up used to bail
# with "Session already exists", instead of growing the session.
cmd_add() {
  if ! session_exists; then
    # Sensible fallback: if there's no session, this is just a `start`.
    cmd_start "$@"
    return
  fi

  local selected_names=("$@")
  if [[ ${#selected_names[@]} -eq 0 ]]; then
    die "Usage: $0 add <name> [name...]"
  fi

  # Validate + lookup, mirroring cmd_start.
  local selected_entries=()
  local all_names=()
  for entry in "${DEPARTMENTS[@]}"; do
    IFS='|' read -r d _ wn _ <<< "$entry"
    all_names+=("$wn")
  done
  for name in "${selected_names[@]}"; do
    [[ -z "$name" ]] && continue
    local found=""
    for entry in "${DEPARTMENTS[@]}"; do
      IFS='|' read -r dept cwd wname script <<< "$entry"
      if [[ "$wname" == "$name" || "$dept" == "$name" ]]; then
        found="$entry"
        break
      fi
    done
    [[ -z "$found" ]] && die "Unknown executive '${name}'. Valid options: ${all_names[*]}"
    selected_entries+=("$found")
  done

  # Layout policy for an existing session. CHQ_LAYOUT explicitly overrides the
  # stored session layout so AgentRemote can upgrade a split-pane session into
  # per-window panes without requiring a kill/redeploy cycle.
  local stored_layout layout
  stored_layout=$(tmux show-option -t "$SESSION" -v -q '@chq_layout' 2>/dev/null || echo "")
  layout="${CHQ_LAYOUT:-$stored_layout}"
  [[ -z "$layout" ]] && layout="ittab"
  case "$layout" in panes|windows|ittab|tiled) ;; *) layout="ittab";; esac

  if [[ "$layout" == "windows" || "$layout" == "ittab" ]]; then
    normalize_session_for_layout "$layout"
  fi
  if [[ "$stored_layout" != "$layout" ]]; then
    tmux set-option -t "$SESSION" -q '@chq_layout' "$layout"
  fi

  # Existing-titles check — substring match across ALL panes in the session
  # (not just chq:0) so an agent already in a detached window isn't re-spawned.
  local existing_titles
  existing_titles=$(tmux list-panes -s -t "$SESSION" -F '#{pane_title}' 2>/dev/null || true)
  local added=0
  for entry in "${selected_entries[@]}"; do
    IFS='|' read -r dept cwd wname script <<< "$entry"
    # Skip if a pane with this title exists anywhere in the session.
    if grep -qi "${wname}" <<< "$existing_titles" 2>/dev/null; then
      echo "  ${wname} already running — skipping."
      continue
    fi
    local new_pane_id
    case "$layout" in
      panes|tiled)
        # split-window -P -F '#{pane_id}' prints the new pane's stable id (e.g.
        # "%47") to stdout. Stable id is safer than pane_index because indexes
        # renumber on every split. Both `panes` and `tiled` go via split-window;
        # `tiled` gets an additional `select-layout tiled` re-balance below.
        new_pane_id=$(tmux split-window -h -t "${SESSION}:0" -c "$cwd" -P -F '#{pane_id}' "$(pane_loop "$cwd" "$script" "$dept")")
        ;;
      windows|ittab)
        # new-window -P -F prints the new window's pane id directly. Trailing
        # colon = session-target form (avoids the same -t-ambiguity bug
        # documented in cmd_start above when the first window's name equals
        # the session name).
        new_pane_id=$(tmux new-window -t "${SESSION}:" -n "$wname" -c "$cwd" -P -F '#{pane_id}' "$(pane_loop "$cwd" "$script" "$dept")")
        ;;
    esac
    tmux select-pane -t "$new_pane_id" -T "$wname"
    # Write pane_id sidecar so AgentRemote can target by stable id, not title.
    write_pane_sidecar "$dept" "$new_pane_id" || true
    echo "  ${wname} added -> ${cwd} (layout=${layout})"
    added=$((added + 1))
  done

  if [[ $added -gt 0 ]]; then
    normalize_session_for_layout "$layout"
    # Re-balance based on the session's chosen layout. `tiled` auto-grids;
    # everything else falls back to even-horizontal. windows/ittab only added
    # whole windows (no panes inside chq:0), so the call is a harmless no-op
    # for them.
    if [[ "$layout" == "tiled" ]]; then
      tmux select-layout -t "${SESSION}:0" tiled
    else
      tmux select-layout -t "${SESSION}:0" even-horizontal
    fi
  fi
  echo "Added ${added} pane(s) to existing CHQ session."
}

cmd_restart() {
  local target="${1:-}"
  local all_names=()
  for entry in "${DEPARTMENTS[@]}"; do
    IFS='|' read -r d _ wn _ <<< "$entry"
    all_names+=("$wn")
  done
  [[ -z "$target" ]] && die "Usage: $0 restart <dept-name>  (${all_names[*]})"

  if ! session_exists; then
    die "No CHQ session running."
  fi

  # Find the matching department
  local found=""
  for entry in "${DEPARTMENTS[@]}"; do
    IFS='|' read -r dept cwd wname script <<< "$entry"
    if [[ "$wname" == "$target" || "$dept" == "$target" ]]; then
      found="$entry"
      break
    fi
  done

  [[ -z "$found" ]] && die "Unknown department: ${target}. Options: ${all_names[*]}"

  IFS='|' read -r dept cwd wname script <<< "$found"

  # Send Ctrl-C to kill current runtime, then the loop restarts it
  tmux send-keys -t "${SESSION}:${wname}" C-c
  echo "Restarting ${wname} (${dept})... loop will relaunch in ${RESTART_DELAY}s."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if [[ "${CHQ_TMUX_LIB_ONLY:-0}" == "1" ]]; then
  return 0 2>/dev/null || exit 0
fi

case "${1:-}" in
  start)   shift; cmd_start "$@" ;;
  add)     shift; cmd_add "$@" ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  attach)  cmd_attach ;;
  restart) cmd_restart "${2:-}" ;;
  *)
    all_names=()
    for entry in "${DEPARTMENTS[@]}"; do
      IFS='|' read -r d _ wn _ <<< "$entry"
      all_names+=("$wn")
    done
    valid_csv="${all_names[*]}"
    echo "CHQ Tmux Launcher"
    echo ""
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Commands:"
    echo "  start [exec...]    Create tmux session. With no args, prompts interactively."
    echo "                     With names, spawns only those execs (left-to-right)."
    echo "                     Execs: ${valid_csv}"
    echo "                     Examples:"
    echo "                       $0 start            (interactive prompt)"
    echo "                       $0 start xavier mugatu derek"
    echo "                       $0 start all        (registry agents + agent-factory execs)"
    echo "  add <exec>...      Add panes to an EXISTING session (no-op if pane already running)."
    echo "                     If no session exists, falls through to start."
    echo "  stop               Kill the entire CHQ session"
    echo "  status             Show running panes"
    echo "  attach             Attach to the CHQ session"
    echo "  restart <name>     Restart a pane (${valid_csv})"
    ;;
esac
