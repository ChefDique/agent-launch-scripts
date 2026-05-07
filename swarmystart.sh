#!/usr/bin/env bash
# Start Swarmy in CHQ tmux and attach
set -euo pipefail

default_launch_root="${HOME}/ai_projects/agent-launch-scripts"
legacy_launch_root="${HOME}/agent-launch-scripts"
if [[ -n "${AGENT_LAUNCH_SCRIPTS_ROOT:-}" ]]; then
  launch_root="${AGENT_LAUNCH_SCRIPTS_ROOT}"
elif [[ -d "$default_launch_root" ]]; then
  launch_root="$default_launch_root"
else
  launch_root="$legacy_launch_root"
fi

bash "$launch_root/chq-tmux.sh" start swarmy
bash "$launch_root/chq-tmux.sh" attach
