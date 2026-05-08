#!/usr/bin/env bash
# ============================================================================
# spawn-swarmy.sh — idempotent Swarmy session spawner
# ============================================================================
# Wakes OverlordSwarmy through Swarmy's AgentRemote runtime.
# ============================================================================

set -euo pipefail

SESSION="chq"
SWARMY_RUNTIME="${AGENTREMOTE_SWARMY_RUNTIME:-${HOME}/ai_projects/swarmy/scripts/agentremote_runtime.py}"

# Process-based detection
match="$(ps -eo command= | grep -E 'claude .*-n overlordswarmy' || true)"
if [[ -n "$match" ]]; then
  echo "spawn-swarmy: Swarmy already running — no spawn needed"
  exit 0
fi

echo "spawn-swarmy: no Swarmy, spawning in '${SESSION}' tmux session..."
python3 "$SWARMY_RUNTIME" --session "$SESSION" add overlord-swarmy
echo "spawn-swarmy: Swarmy launching. Attach with: python3 ${SWARMY_RUNTIME} --session ${SESSION} attach"
