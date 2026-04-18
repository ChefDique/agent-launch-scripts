#!/usr/bin/env bash
set -euo pipefail

# CHQ Tmux Launcher — spin up department leads in tmux panes
# Usage:
#   chq-tmux.sh start    — create session with all department leads
#   chq-tmux.sh stop     — kill the entire CHQ session
#   chq-tmux.sh status   — show which panes are running
#   chq-tmux.sh attach   — attach to the CHQ session
#   chq-tmux.sh restart <dept> — restart a single department pane

SESSION="chq"
CHQ_ROOT="/Users/richardadair/ai_projects/CorporateHQ"
RESTART_DELAY=3

# Flags every CHQ claude session must launch with.
# - telegram channel for Mugatu/Derek messaging
# - skip-permissions so hooks/tools don't prompt inside tmux
# - claude-peers dev channel for peer messaging
# - exclude-dynamic-system-prompt-sections to keep context lean
CLAUDE_FLAGS=(
  --channels "plugin:telegram@claude-plugins-official"
  --dangerously-skip-permissions
  --dangerously-load-development-channels "server:claude-peers"
  --exclude-dynamic-system-prompt-sections
)

# Department definitions: name|cwd|window-name|script
# Xavier is the harness slot (not a department). Listed first so it is the
# leftmost pane on `start all`. cwd = building root, script uses -n Xavier.
# NOTE: Engineering, Marketing, R&D, Operations, and CEO_Office have moved to
# the agent-factory repo at ~/ai_projects/agent-factory/. Scripts now live there.
AGENT_FACTORY="${HOME}/ai_projects/agent-factory"
DEPARTMENTS=(
  "xavier|${CHQ_ROOT}|xavier|${HOME}/agent-launch-scripts/xavier.sh"
  "ceo|${AGENT_FACTORY}/dogfood-agents/CEO_Office|mugatu|${AGENT_FACTORY}/Operations/scripts/mugatu.sh"
  "engineering|${AGENT_FACTORY}/Engineering|derek|${AGENT_FACTORY}/Operations/scripts/derek.sh"
  "marketing|${HOME}/ai_projects/adairlabs|hansel|${AGENT_FACTORY}/Operations/scripts/hansel.sh"
  "rnd|${HOME}/ai_projects/research-and-development|lucius|${HOME}/agent-launch-scripts/lucius.sh"
  "operations|${AGENT_FACTORY}/Operations|maury|${AGENT_FACTORY}/Operations/scripts/maury.sh"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

session_exists() {
  tmux has-session -t "$SESSION" 2>/dev/null
}

# Build the restart loop command for a department pane.
# Claude runs, and when it exits the loop waits RESTART_DELAY seconds then relaunches.
pane_loop() {
  local cwd="$1"
  local script="$2"
  # The loop keeps the dept claude session alive. /restartsession exits claude; tmux loop relaunches via the dept .sh script (which carries the model + flag set).
  cat <<LOOP
cd "${cwd}" && while true; do bash ${script}; echo "--- session exited, restarting in ${RESTART_DELAY}s ---"; sleep ${RESTART_DELAY}; done
LOOP
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

cmd_start() {
  if session_exists; then
    echo "Session '${SESSION}' already exists. Use 'attach' or 'stop' first."
    tmux list-windows -t "$SESSION" -F "  #I: #W (#{pane_current_command})"
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
      echo "ERROR: Unknown executive '${name}'. Valid options: xavier, mugatu, derek, hansel, lucius, maury" >&2
      exit 1
    fi
    selected_entries+=("$found")
  done

  if [[ ${#selected_entries[@]} -eq 0 ]]; then
    die "No executives selected."
  fi

  echo "Starting CHQ tmux session..."

  local first="${selected_entries[0]}"
  IFS='|' read -r dept cwd wname script <<< "$first"

  tmux new-session -d -s "$SESSION" -n "chq" -c "$cwd" -x 220 -y 50
  tmux select-pane -t "${SESSION}:chq.0" -T "$wname"
  tmux send-keys -t "${SESSION}:chq.0" "$(pane_loop "$cwd" "$script")" Enter

  # Only split if there are additional execs (skip split for single-exec mode)
  if [[ ${#selected_entries[@]} -gt 1 ]]; then
    local pane_idx=0
    for entry in "${selected_entries[@]:1}"; do
      IFS='|' read -r dept cwd wname script <<< "$entry"
      tmux split-window -h -t "${SESSION}:chq" -c "$cwd"
      pane_idx=$((pane_idx + 1))
      tmux select-pane -t "${SESSION}:chq.${pane_idx}" -T "$wname"
      tmux send-keys -t "${SESSION}:chq.${pane_idx}" "$(pane_loop "$cwd" "$script")" Enter
    done
  fi

  tmux set -t "$SESSION" pane-border-status top
  tmux set -t "$SESSION" pane-border-format " #T "
  tmux select-layout -t "${SESSION}:chq" even-horizontal
  tmux select-pane -t "${SESSION}:chq.0"

  # Navigation: mouse + Alt-number + Alt-arrow, no prefix chord required.
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

  echo "CHQ session started with ${#selected_entries[@]} executive(s):"
  for entry in "${selected_entries[@]}"; do
    IFS='|' read -r dept cwd wname script <<< "$entry"
    echo "  ${wname} -> ${cwd}"
  done
  echo ""
  echo "Attach with:  tmux attach -t ${SESSION}"
  echo "Or run:       $0 attach"
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

  tmux attach -t "$SESSION"
}

cmd_restart() {
  local target="${1:-}"
  [[ -z "$target" ]] && die "Usage: $0 restart <dept-name>  (xavier|mugatu|derek|hansel|lucius|maury)"

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

  [[ -z "$found" ]] && die "Unknown department: ${target}. Options: xavier, mugatu, derek, hansel, lucius, maury"

  IFS='|' read -r dept cwd wname script <<< "$found"

  # Send Ctrl-C to kill current claude, then the loop restarts it
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
    echo "CHQ Tmux Launcher"
    echo ""
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Commands:"
    echo "  start [exec...]    Create tmux session. With no args, prompts interactively."
    echo "                     With names, spawns only those execs (left-to-right)."
    echo "                     Execs: xavier, mugatu, derek, hansel, lucius, maury"
    echo "                     Examples:"
    echo "                       $0 start            (interactive prompt)"
    echo "                       $0 start xavier mugatu derek"
    echo "                       $0 start all        (xavier + all 5 execs)"
    echo "  stop               Kill the entire CHQ session"
    echo "  status             Show running panes"
    echo "  attach             Attach to the CHQ session"
    echo "  restart <name>     Restart a pane (xavier|mugatu|derek|hansel|lucius|maury)"
    ;;
esac
