#!/usr/bin/env bash
# ============================================================================
# Swarmy — Multi-agent Swarm Orchestrator
# ============================================================================
# Supervisor loop for the OverlordSwarmy persona. The while-true loop is
# load-bearing for /done — `kill $PPID` from inside claude exits the claude
# process; this loop catches the exit and relaunches claude with the
# auto-start sequence rescheduled.
# ============================================================================

cd ~/ai_projects/swarmy

# Pre-launch: kill orphaned telegram pollers (one-time, before the loop)
if [ -f ~/ai_projects/CorporateHQ/hooks/telegram-cleanup.sh ]; then
  bash ~/ai_projects/CorporateHQ/hooks/telegram-cleanup.sh --pre-launch Swarmy
fi

PIDFILE=""
if [ -n "$TMUX_PANE" ]; then
  PIDFILE="/tmp/swarmy-bg-${TMUX_PANE//%/_}.pids"
fi

while true; do
  # Reschedule the auto-start sequence per claude restart so /gogo (and
  # /color/rename) fire on every fresh session, not just the first one.
  if [ -n "$TMUX_PANE" ]; then
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

  claude --channels plugin:telegram@claude-plugins-official \
         --dangerously-skip-permissions \
         --dangerously-load-development-channels server:claude-peers \
         --exclude-dynamic-system-prompt-sections \
         --model 'claude-opus-4-7[1m]' \
         --effort max \
         -n overlordswarmy

  # Brief pause so a tight crash loop isn't catastrophic and so the operator
  # has a moment to ctrl-C out of the supervisor if needed.
  echo "[swarmy.sh] claude exited — relaunching in 3s (ctrl-C to stop the supervisor)..."
  sleep 3
done
