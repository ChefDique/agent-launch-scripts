#!/usr/bin/env bash
set -euo pipefail

# R&D Tmux Launcher — spin up Lucius in a tmux pane with restart loop
# (Mirror of agent-armory/scripts/armory-tmux.sh — only Lucius for now;
#  add more agents to DEPARTMENTS if R&D grows local persistent panes.)
#
# Usage:
#   rnd-tmux.sh start    — create session with Lucius
#   rnd-tmux.sh stop     — kill the entire rnd session
#   rnd-tmux.sh status   — show which panes are running
#   rnd-tmux.sh attach   — attach to the rnd session
#   rnd-tmux.sh restart <name> — restart a pane

SESSION="rnd"
RND_ROOT="${HOME}/ai_projects/research-and-development"
RESTART_DELAY=3
AUTO_ATTACH_DEFAULT="${TMUX_AUTO_ATTACH:-1}"

LAUNCH_SCRIPTS="${HOME}/agent-launch-scripts"

# Department definitions: name|cwd|window-name|script
# script is a full command (registry-driven via launch-agent.sh + agents.json),
# not a path. pane_loop runs it as-is rather than prefixing with `bash`.
DEPARTMENTS=(
  "lucius|${RND_ROOT}|lucius|bash ${LAUNCH_SCRIPTS}/launch-agent.sh lucius"
)

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

# Build the restart loop command for a department pane.
# Claude runs, and when it exits the loop waits RESTART_DELAY seconds then relaunches.
pane_loop() {
  local cwd="$1"
  local script="$2"
  # script is a full command string (e.g. "bash launch-agent.sh lucius"); run
  # it as-is rather than wrapping in another `bash ${script}`.
  cat <<LOOP
cd "${cwd}" && while true; do ${script}; echo "--- session exited, restarting in ${RESTART_DELAY}s ---"; sleep ${RESTART_DELAY}; done
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

  local selected_names=()
  if [[ $# -gt 0 && "$1" == "all" ]]; then
    for entry in "${DEPARTMENTS[@]}"; do
      IFS='|' read -r dept cwd wname script <<< "$entry"
      selected_names+=("$wname")
    done
  elif [[ $# -gt 0 ]]; then
    selected_names=("$@")
  else
    for entry in "${DEPARTMENTS[@]}"; do
      IFS='|' read -r dept cwd wname script <<< "$entry"
      selected_names+=("$wname")
    done
  fi

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
      echo "ERROR: Unknown pane '${name}'. Valid options: lucius" >&2
      exit 1
    fi
    selected_entries+=("$found")
  done

  if [[ ${#selected_entries[@]} -eq 0 ]]; then
    die "No panes selected."
  fi

  echo "Starting rnd tmux session..."

  local first="${selected_entries[0]}"
  IFS='|' read -r dept cwd wname script <<< "$first"

  tmux new-session -d -s "$SESSION" -n "rnd" -c "$cwd" -x 220 -y 50
  tmux select-pane -t "${SESSION}:rnd.0" -T "$wname"
  tmux send-keys -t "${SESSION}:rnd.0" "$(pane_loop "$cwd" "$script")" Enter

  if [[ ${#selected_entries[@]} -gt 1 ]]; then
    local pane_idx=0
    for entry in "${selected_entries[@]:1}"; do
      IFS='|' read -r dept cwd wname script <<< "$entry"
      tmux split-window -h -t "${SESSION}:rnd" -c "$cwd"
      pane_idx=$((pane_idx + 1))
      tmux select-pane -t "${SESSION}:rnd.${pane_idx}" -T "$wname"
      tmux send-keys -t "${SESSION}:rnd.${pane_idx}" "$(pane_loop "$cwd" "$script")" Enter
    done
  fi

  tmux set -t "$SESSION" pane-border-status top
  tmux set -t "$SESSION" pane-border-format " #T "
  tmux select-layout -t "${SESSION}:rnd" even-horizontal
  tmux select-pane -t "${SESSION}:rnd.0"

  tmux set -g mouse on
  tmux set -g history-limit 50000
  tmux bind-key -n M-1 select-pane -t 0
  tmux bind-key -n M-2 select-pane -t 1
  tmux bind-key -n M-3 select-pane -t 2
  tmux bind-key -n M-4 select-pane -t 3
  tmux bind-key -n M-5 select-pane -t 4
  tmux bind-key -n M-Left  select-pane -L
  tmux bind-key -n M-Right select-pane -R
  tmux bind-key -n M-Up    select-pane -U
  tmux bind-key -n M-Down  select-pane -D

  echo "R&D session started with ${#selected_entries[@]} pane(s):"
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
    echo "No rnd session running."
    exit 0
  fi

  tmux kill-session -t "$SESSION"
  echo "R&D session stopped."
}

cmd_status() {
  if ! session_exists; then
    echo "No rnd session running."
    exit 0
  fi

  echo "R&D tmux session:"
  tmux list-windows -t "$SESSION" -F "  #I: #W — #{pane_current_path} (#{pane_current_command})"
}

cmd_attach() {
  if ! session_exists; then
    die "No rnd session running. Start with: $0 start"
  fi

  tmux attach -t "$SESSION"
}

cmd_restart() {
  local target="${1:-lucius}"

  if ! session_exists; then
    die "No rnd session running."
  fi

  local found=""
  for entry in "${DEPARTMENTS[@]}"; do
    IFS='|' read -r dept cwd wname script <<< "$entry"
    if [[ "$wname" == "$target" || "$dept" == "$target" ]]; then
      found="$entry"
      break
    fi
  done

  [[ -z "$found" ]] && die "Unknown pane: ${target}. Options: lucius"

  IFS='|' read -r dept cwd wname script <<< "$found"

  tmux send-keys -t "${SESSION}:${wname}" C-c
  echo "Restarting ${wname} (${dept})... loop will relaunch in ${RESTART_DELAY}s."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case "${1:-}" in
  start)   shift; cmd_start "$@" ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  attach)  cmd_attach ;;
  restart) cmd_restart "${2:-}" ;;
  *)
    echo "R&D Tmux Launcher"
    echo ""
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Commands:"
    echo "  start [name...]    Create tmux session. Default = all (currently just lucius)."
    echo "  stop               Kill the entire rnd session"
    echo "  status             Show running panes"
    echo "  attach             Attach to the rnd session"
    echo "  restart <name>     Restart a pane (currently: lucius)"
    ;;
esac
