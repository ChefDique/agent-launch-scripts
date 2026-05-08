#!/usr/bin/env bash
set -euo pipefail

# Terminal-based Small Tool Kit
# For when you want to stay inside the terminal flow.

swarmy_runtime="${AGENTREMOTE_SWARMY_RUNTIME:-${HOME}/ai_projects/swarmy/scripts/agentremote_runtime.py}"

echo "--- AGENT REMOTE ---"
echo "1) Xavier"
echo "2) Lucius"
echo "3) Gekko"
echo "4) Swarmy"
echo "5) SPAWN ALL"
echo "q) Quit"
echo "--------------------"
printf "Select Agent (e.g. 1 3): "
read -r INPUT

if [[ "$INPUT" == "q" ]]; then exit 0; fi

TARGETS=""
[[ "$INPUT" == *"1"* ]] && TARGETS="$TARGETS xavier"
[[ "$INPUT" == *"2"* ]] && TARGETS="$TARGETS lucius"
[[ "$INPUT" == *"3"* ]] && TARGETS="$TARGETS gekko"
[[ "$INPUT" == *"4"* ]] && TARGETS="$TARGETS overlord-swarmy"
[[ "$INPUT" == *"5"* ]] && TARGETS="all"

if [ -z "$TARGETS" ]; then exit 0; fi

python3 "$swarmy_runtime" add $TARGETS
