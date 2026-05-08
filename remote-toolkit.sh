#!/usr/bin/env bash
set -euo pipefail

# Agent Remote Toolkit (macOS Native)
# Launches a small popup for agent selection.

swarmy_runtime="${AGENTREMOTE_SWARMY_RUNTIME:-${HOME}/ai_projects/swarmy/scripts/agentremote_runtime.py}"

CHOICES=$(osascript -e 'tell application "System Events"' -e 'activate' -e 'set agents to {"Xavier", "Lucius", "Gekko", "Swarmy", "CHQ (All)"}' -e 'choose from list agents with title "Agent Remote" with prompt "Select Agents to Spawn:" with multiple selections allowed' -e 'end tell')

if [ "$CHOICES" = "false" ]; then
    exit 0
fi

# Map choices to registry IDs for Swarmy's AgentRemote runtime.
# "Xavier, Lucius" -> "xavier lucius"
TARGETS=""
[[ "$CHOICES" == *"Xavier"* ]] && TARGETS="$TARGETS xavier"
[[ "$CHOICES" == *"Lucius"* ]] && TARGETS="$TARGETS lucius"
[[ "$CHOICES" == *"Gekko"* ]] && TARGETS="$TARGETS gekko"
[[ "$CHOICES" == *"Swarmy"* ]] && TARGETS="$TARGETS overlord-swarmy"
[[ "$CHOICES" == *"CHQ (All)"* ]] && TARGETS="all"

if [ -z "$TARGETS" ]; then
    exit 0
fi

python3 "$swarmy_runtime" add $TARGETS
