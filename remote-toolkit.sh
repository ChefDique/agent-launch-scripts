#!/usr/bin/env bash
set -euo pipefail

# Agent Remote Toolkit (macOS Native)
# Launches a small popup for agent selection.

default_launch_root="${HOME}/ai_projects/agent-launch-scripts"
legacy_launch_root="${HOME}/agent-launch-scripts"
if [[ -n "${AGENT_LAUNCH_SCRIPTS_ROOT:-}" ]]; then
  launch_root="${AGENT_LAUNCH_SCRIPTS_ROOT}"
elif [[ -d "$default_launch_root" ]]; then
  launch_root="$default_launch_root"
else
  launch_root="$legacy_launch_root"
fi

CHOICES=$(osascript -e 'tell application "System Events"' -e 'activate' -e 'set agents to {"Xavier", "Lucius", "Gekko", "Swarmy", "CHQ (All)"}' -e 'choose from list agents with title "Agent Remote" with prompt "Select Agents to Spawn:" with multiple selections allowed' -e 'end tell')

if [ "$CHOICES" = "false" ]; then
    exit 0
fi

# Map choices to lowercase IDs for chq-tmux.sh
# "Xavier, Lucius" -> "xavier lucius"
TARGETS=""
[[ "$CHOICES" == *"Xavier"* ]] && TARGETS="$TARGETS xavier"
[[ "$CHOICES" == *"Lucius"* ]] && TARGETS="$TARGETS lucius"
[[ "$CHOICES" == *"Gekko"* ]] && TARGETS="$TARGETS trading"
[[ "$CHOICES" == *"Swarmy"* ]] && TARGETS="$TARGETS swarmy"
[[ "$CHOICES" == *"CHQ (All)"* ]] && TARGETS="all"

if [ -z "$TARGETS" ]; then
    exit 0
fi

bash "$launch_root/chq-tmux.sh" start $TARGETS
