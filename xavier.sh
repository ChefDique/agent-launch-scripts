#!/bin/bash
# ============================================================================
# Xavier — Platform Orchestrator Session Launcher (Opus)
# ============================================================================
# Used by both:
#   - xavier shell alias (~/.zshrc) — interactive, menu dismissed by hand
#   - agent-factory chq-tmux.sh pane_loop (wrapped in restart loop) — tmux
#     send-keys auto-dismisses the --dangerously-load-development-channels
#     warning so the unattended /restartsession relaunch works without a human
# ============================================================================

# Pivot knobs — override via alias to repoint Xavier at a different project.
PROJECT_ROOT="${PROJECT_ROOT:-$HOME/ai_projects/CorporateHQ}"
STARTUP_SLASH="${STARTUP_SLASH:-/gogo}"

cd "$PROJECT_ROOT"

bash ~/ai_projects/CorporateHQ/hooks/telegram-cleanup.sh --pre-launch Xavier

# If we're inside a tmux pane, schedule auto-start sequence:
# 1. Dismiss the dev-channels menu (4s)
# 2. Set pane color + display name (10s, 2s before startup)
# 3. Auto-send $STARTUP_SLASH (12s — lets session init, load hooks, render prompt)
if [ -n "$TMUX_PANE" ]; then
  # Kill stale auto-inject subshells from prior runs in this pane. Without this,
  # killpid + tmux restart-loop orphans the previous run's sleep subshells,
  # which fire delayed send-keys into the new claude session mid-boot (the "3x"
  # bug). Order matters: SIGKILL the subshell BEFORE its sleep child, otherwise
  # killing sleep first unblocks bash which runs tmux send-keys before we can
  # kill it. SIGKILL (not SIGTERM) because it's uncatchable and instant.
  PIDFILE="/tmp/xavier-bg-${TMUX_PANE//%/_}.pids"
  if [ -f "$PIDFILE" ]; then
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      kill -9 "$pid" 2>/dev/null || true
      pkill -9 -P "$pid" 2>/dev/null || true
    done < "$PIDFILE"
    rm -f "$PIDFILE"
  fi
  ( sleep 4;  tmux send-keys -t "$TMUX_PANE" Enter ) & echo $! >> "$PIDFILE"
  ( sleep 10; tmux send-keys -t "$TMUX_PANE" "/color yellow" Enter; sleep 0.5; tmux send-keys -t "$TMUX_PANE" "/rename XAVIER" Enter ) & echo $! >> "$PIDFILE"
  ( sleep 12; tmux send-keys -t "$TMUX_PANE" "$STARTUP_SLASH" Enter ) & echo $! >> "$PIDFILE"
fi

exec claude --channels plugin:telegram@claude-plugins-official \
            --dangerously-skip-permissions \
            --dangerously-load-development-channels server:claude-peers \
            --exclude-dynamic-system-prompt-sections \
            --model 'claude-opus-4-7[1m]' \
            --effort max \
            -n Xavier
