#!/usr/bin/env bash
# ============================================================================
# spawn-swarmy.sh — idempotent Swarmy session spawner
# ============================================================================
# Wakes OverlordSwarmy in the CHQ tmux session.
# ============================================================================

set -euo pipefail

SESSION="chq"
default_launch_root="${HOME}/ai_projects/agent-launch-scripts"
legacy_launch_root="${HOME}/agent-launch-scripts"
if [[ -n "${AGENT_LAUNCH_SCRIPTS_ROOT:-}" ]]; then
  LAUNCH_SCRIPTS="${AGENT_LAUNCH_SCRIPTS_ROOT}"
elif [[ -d "$default_launch_root" ]]; then
  LAUNCH_SCRIPTS="$default_launch_root"
else
  LAUNCH_SCRIPTS="$legacy_launch_root"
fi
LAUNCHER="${LAUNCH_SCRIPTS}/chq-tmux.sh"

# Process-based detection
match="$(ps -eo command= | grep -E 'claude .*-n overlordswarmy' || true)"
if [[ -n "$match" ]]; then
  echo "spawn-swarmy: Swarmy already running — no spawn needed"
  exit 0
fi

echo "spawn-swarmy: no Swarmy, spawning in '${SESSION}' tmux session..."
bash "$LAUNCHER" start swarmy
echo "spawn-swarmy: Swarmy launching. Attach with: tmux attach -t ${SESSION}"
