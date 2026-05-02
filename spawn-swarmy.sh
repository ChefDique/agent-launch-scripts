#!/usr/bin/env bash
# ============================================================================
# spawn-swarmy.sh — idempotent Swarmy session spawner
# ============================================================================
# Wakes OverlordSwarmy in the CHQ tmux session.
# ============================================================================

set -euo pipefail

SESSION="chq"
LAUNCHER="${HOME}/agent-launch-scripts/chq-tmux.sh"

# Process-based detection
match="$(ps -eo command= | grep -E 'claude .*-n overlordswarmy' || true)"
if [[ -n "$match" ]]; then
  echo "spawn-swarmy: Swarmy already running — no spawn needed"
  exit 0
fi

echo "spawn-swarmy: no Swarmy, spawning in '${SESSION}' tmux session..."
bash "$LAUNCHER" start swarmy
echo "spawn-swarmy: Swarmy launching. Attach with: tmux attach -t ${SESSION}"
