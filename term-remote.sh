#!/usr/bin/env bash
set -euo pipefail

# Terminal-based Small Tool Kit
# For when you want to stay inside the terminal flow.

default_launch_root="${HOME}/ai_projects/agent-launch-scripts"
legacy_launch_root="${HOME}/agent-launch-scripts"
if [[ -n "${AGENT_LAUNCH_SCRIPTS_ROOT:-}" ]]; then
  launch_root="${AGENT_LAUNCH_SCRIPTS_ROOT}"
elif [[ -d "$default_launch_root" ]]; then
  launch_root="$default_launch_root"
else
  launch_root="$legacy_launch_root"
fi

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
[[ "$INPUT" == *"3"* ]] && TARGETS="$TARGETS trading"
[[ "$INPUT" == *"4"* ]] && TARGETS="$TARGETS swarmy"
[[ "$INPUT" == *"5"* ]] && TARGETS="all"

if [ -z "$TARGETS" ]; then exit 0; fi

bash "$launch_root/chq-tmux.sh" start $TARGETS
