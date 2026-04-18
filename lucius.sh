#!/usr/bin/env bash
# ============================================================================
# Lucius — R&D Lead session for research-and-development
# ============================================================================
# Single-session launcher for the Lucius Fox persona (Applied Sciences head).
# Mirrors agent-armory/scripts/xavier.sh — pre-launch telegram cleanup,
# tmux auto-inject of /lucius-start, claude session with telegram + peers.
#
# Used by:
#   - lucius shell alias (~/.zshrc) — interactive launcher
# ============================================================================

cd ~/ai_projects/research-and-development

# Pre-launch: kill orphaned telegram pollers / suspended Lucius sessions to prevent 409 Conflict
bash ~/ai_projects/agent-armory/hooks/telegram-cleanup.sh --pre-launch Lucius

# Pre-launch: reap orphaned claude-peers server.ts processes (parent claude dead → PPID=1).
# Broker's 30s stale-peer sweep cleans the DB rows; this clears the OS processes.
# DISABLED 2026-04-17 session 15 — diagnostic: testing whether this reaper is responsible
# for mid-session server.ts death that affects Lucius but not Xavier. Re-enable if mid-session
# MCP drops persist (rules it out), remove entirely if drops stop (confirmed culprit).
# pgrep -f "bun.*claude-peers/server\.ts" 2>/dev/null | while read -r pid; do
#   [ "$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')" = "1" ] && kill "$pid" 2>/dev/null || true
# done

# If we're inside a tmux pane, schedule the auto-start sequence:
# 1. Dismiss the --dangerously-load-development-channels warning (4s)
# 2. Auto-send /lucius-start to orient and start working (12s — lets the
#    session fully initialize, load hooks, render the prompt)
if [ -n "$TMUX_PANE" ]; then
  # Kill stale auto-inject subshells from prior runs in this pane. Order
  # matters: SIGKILL the subshell BEFORE its sleep child. Prior version did
  # `pkill -P $pid` first (killed sleep), which unblocked bash and let it run
  # `tmux send-keys` into the new session before `kill $pid` landed — the "2
  # failed attempts before the real Enter" race. SIGKILL (not SIGTERM) so bash
  # can't trap and finish its current command.
  PIDFILE="/tmp/lucius-bg-${TMUX_PANE//%/_}.pids"
  if [ -f "$PIDFILE" ]; then
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      kill -9 "$pid" 2>/dev/null || true
      pkill -9 -P "$pid" 2>/dev/null || true
    done < "$PIDFILE"
    rm -f "$PIDFILE"
  fi
  ( sleep 4;  tmux send-keys -t "$TMUX_PANE" Enter ) & echo $! >> "$PIDFILE"
  ( sleep 10; tmux send-keys -t "$TMUX_PANE" "/color purple" Enter; sleep 0.5; tmux send-keys -t "$TMUX_PANE" "/rename LUCIUS" Enter ) & echo $! >> "$PIDFILE"
  ( sleep 12; tmux send-keys -t "$TMUX_PANE" "/lucius-start" Enter ) & echo $! >> "$PIDFILE"
fi

exec claude --channels plugin:telegram@claude-plugins-official \
            --dangerously-skip-permissions \
            --dangerously-load-development-channels server:claude-peers \
            --exclude-dynamic-system-prompt-sections \
            --model 'claude-opus-4-7[1m]' \
            --effort max \
            -n Lucius
