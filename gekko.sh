#!/bin/bash
# ============================================================================
# Gordon Gekko — Trading Lead Session Launcher (Opus)
# ============================================================================
# Single-session launcher for the Gordon Gekko persona (Trading Lead).
# Mirrors xavier.sh pattern — pre-launch telegram cleanup, tmux auto-inject
# of startup command, claude session with telegram + peers.
#
# Used by:
#   - gekko shell alias (~/.zshrc) — interactive launcher
#   - trading-tmux.sh pane_loop (wrapped in restart loop)
# ============================================================================

# Pivot knobs — override via alias to repoint Gekko at a different project.
PROJECT_ROOT="${PROJECT_ROOT:-$HOME/ai_projects/trading}"
STARTUP_SLASH="${STARTUP_SLASH:-/gekko-start}"

cd "$PROJECT_ROOT"

# Pre-launch: kill orphaned telegram pollers / suspended Gekko sessions to prevent 409 Conflict.
# Use agent-armory telegram-cleanup.sh — project-agnostic, takes --pre-launch <label>.
if [ -f "$HOME/ai_projects/agent-armory/hooks/telegram-cleanup.sh" ]; then
  bash "$HOME/ai_projects/agent-armory/hooks/telegram-cleanup.sh" --pre-launch Gekko
fi

# If we're inside a tmux pane, schedule auto-start sequence:
# 1. Dismiss the dev-channels menu (4s)
# 2. Set pane color green + display name (10s)
# 3. Auto-send $STARTUP_SLASH (12s) — only if non-empty
if [ -n "$TMUX_PANE" ]; then
  # Kill stale auto-inject subshells from prior runs in this pane.
  # SIGKILL the subshell BEFORE its sleep child — order matters to avoid the
  # "2 failed attempts before the real Enter" race.
  PIDFILE="/tmp/gekko-bg-${TMUX_PANE//%/_}.pids"
  if [ -f "$PIDFILE" ]; then
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      kill -9 "$pid" 2>/dev/null || true
      pkill -9 -P "$pid" 2>/dev/null || true
    done < "$PIDFILE"
    rm -f "$PIDFILE"
  fi
  ( sleep 4;  tmux send-keys -t "$TMUX_PANE" Enter ) & echo $! >> "$PIDFILE"
  ( sleep 10; tmux send-keys -t "$TMUX_PANE" "/color green" Enter; sleep 0.5; tmux send-keys -t "$TMUX_PANE" "/rename GEKKO" Enter ) & echo $! >> "$PIDFILE"
  if [ -n "$STARTUP_SLASH" ]; then
    ( sleep 12; tmux send-keys -t "$TMUX_PANE" "$STARTUP_SLASH" Enter ) & echo $! >> "$PIDFILE"
  fi
fi

exec claude --channels plugin:telegram@claude-plugins-official \
            --dangerously-skip-permissions \
            --dangerously-load-development-channels server:claude-peers \
            --exclude-dynamic-system-prompt-sections \
            --model 'claude-opus-4-7[1m]' \
            --effort max \
            -n Gekko
