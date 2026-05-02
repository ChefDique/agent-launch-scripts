#!/usr/bin/env bash

# Agent Remote Toolkit (macOS Native)
# Launches a small popup for agent selection.

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

bash ~/agent-launch-scripts/chq-tmux.sh start $TARGETS
