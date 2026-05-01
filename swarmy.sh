#!/usr/bin/env bash
# ============================================================================
# Swarmy — Multi-agent Swarm Orchestrator
# ============================================================================
# Single-session launcher for the OverlordSwarmy persona.
# Mirrors xavier.sh / lucius.sh / gekko.sh — pre-launch telegram cleanup,
# tmux auto-inject of /color/rename/gogo, claude session with telegram + peers.
#
# Used by:
#   - swarmy shell alias (~/.zshrc) — interactive launcher
#   - chq-tmux.sh pane_loop (wrapped in restart loop) — the restart layer is
#     in chq-tmux.sh, NOT here. Do not add a while-true here; it would nest
#     inside pane_loop and compound the RESTART_DELAY.
# ============================================================================

cd ~/ai_projects/swarmy

# Pre-launch: kill orphaned telegram pollers
if [ -f ~/ai_projects/CorporateHQ/hooks/telegram-cleanup.sh ]; then
  bash ~/ai_projects/CorporateHQ/hooks/telegram-cleanup.sh --pre-launch Swarmy
fi

# If we're inside a tmux pane, schedule the auto-start sequence:
# 1. Dismiss the --dangerously-load-development-channels warning (4s)
# 2. Set pane color + display name (10s, 2s before startup)
# 3. Auto-send /gogo to orient and start working (12s)
if [ -n "$TMUX_PANE" ]; then
  # Kill stale auto-inject subshells from prior runs in this pane. SIGKILL the
  # subshell BEFORE its sleep child, otherwise killing sleep first unblocks
  # bash and runs tmux send-keys before we can kill it (the "2 failed attempts
  # before the real Enter" race).
  PIDFILE="/tmp/swarmy-bg-${TMUX_PANE//%/_}.pids"
  if [ -f "$PIDFILE" ]; then
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      kill -9 "$pid" 2>/dev/null || true
      pkill -9 -P "$pid" 2>/dev/null || true
    done < "$PIDFILE"
    rm -f "$PIDFILE"
  fi
  ( sleep 4;  tmux send-keys -t "$TMUX_PANE" Enter ) & echo $! >> "$PIDFILE"
  ( sleep 10; tmux send-keys -t "$TMUX_PANE" "/color cyan" Enter; sleep 0.5; tmux send-keys -t "$TMUX_PANE" "/rename overlordswarmy" Enter ) & echo $! >> "$PIDFILE"
  ( sleep 12; tmux send-keys -t "$TMUX_PANE" "/gogo" Enter ) & echo $! >> "$PIDFILE"
fi

exec claude --channels plugin:telegram@claude-plugins-official \
            --dangerously-skip-permissions \
            --dangerously-load-development-channels server:claude-peers \
            --exclude-dynamic-system-prompt-sections \
            --model 'claude-opus-4-7[1m]' \
            --effort max \
            -n overlordswarmy
