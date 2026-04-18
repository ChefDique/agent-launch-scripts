#!/usr/bin/env bash
# ============================================================================
# spawn-lucius.sh — idempotent Lucius session spawner
# ============================================================================
# Wakes Lucius (R&D Lead) in a detached tmux session so Richard can reach him
# via the research-and-development Telegram bot.
#
# Callable from:
#   - Xavier's Bash tool in CorporateHQ (so Xavier can wake Lucius if asked)
#   - Claude Desktop shell dispatch
#   - Richard's terminal (any shell)
#
# Behavior:
#   - If ANY Lucius claude process is already running → no-op, exit 0.
#     Detection uses pgrep on the `-n Lucius` flag, so it works whether Lucius
#     was launched via the `lucius` alias (foreground), rnd-tmux.sh (detached),
#     or spawn-lucius.sh itself. Prevents the `telegram-cleanup.sh --pre-launch`
#     in lucius.sh from killing the live Lucius's telegram poller.
#   - Else → runs scripts/rnd-tmux.sh start, which creates a detached tmux 'rnd'
#     session running lucius.sh inside a restart loop.
#
# Exit codes:
#   0  Lucius is up (just spawned or already running)
#   1  launcher returned non-zero or session failed to come up
#   2  launcher script missing or not executable
# ============================================================================

set -euo pipefail

SESSION="rnd"
RND_ROOT="${HOME}/ai_projects/research-and-development"
LAUNCHER="${RND_ROOT}/scripts/rnd-tmux.sh"

[[ -x "$LAUNCHER" ]] || {
  echo "spawn-lucius: launcher missing or not executable: $LAUNCHER" >&2
  exit 2
}

# Process-based detection — tmux-agnostic. Matches the `-n Lucius` flag on
# the claude invocation line (set by lucius.sh's exec claude ... -n Lucius).
# Uses ps+grep because macOS pgrep -f truncates args past ~200 bytes.
# Captures via $(...) to avoid SIGPIPE under `set -o pipefail` (grep -q
# closes the pipe on first match, ps gets SIGPIPE, pipe exits 141).
match="$(ps -eo command= | grep -E 'claude .*-n Lucius' || true)"
if [[ -n "$match" ]]; then
  echo "spawn-lucius: Lucius already running — no spawn needed"
  ps -eo pid,etime,command= | grep -E 'claude .*-n Lucius' | grep -v grep | \
    awk '{printf "  PID %s (up %s)\n", $1, $2}' || true
  echo "spawn-lucius: DM the R&D telegram bot to reach him"
  exit 0
fi

# No Lucius running — spawn via the tmux restart-loop launcher.
# If the tmux session already exists but has no claude process, the launcher
# will report "already exists" and exit 0; in that edge case we surface it but
# trust the restart loop to respawn claude shortly.
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "spawn-lucius: tmux '${SESSION}' session exists without a live claude — restart loop will respawn"
  tmux list-windows -t "$SESSION" -F "  #I: #W (#{pane_current_command})"
  exit 0
fi

echo "spawn-lucius: no Lucius, no '${SESSION}' tmux session — spawning fresh..."
bash "$LAUNCHER" start
echo "spawn-lucius: Lucius launching. Telegram bot (R&D project) ready in ~15s."
echo "spawn-lucius: attach locally with: tmux attach -t ${SESSION}"
