#!/bin/bash
# cron-poke.sh — send a tmux send-keys broadcast to a single agent pane.
#
# Designed to be invoked from `crontab -e`. Cron has minimal PATH and no
# attached tmux client, so this script:
#   - hardcodes absolute paths for tmux and jq
#   - resolves the target pane via /tmp/agent-remote-panes.json (the
#     pane_id sidecar written by chq-tmux.sh at agent deploy time)
#   - never starts tmux or wakes a cold session — if the chq session or
#     the agent's pane isn't live, this exits non-zero so the cron line
#     surfaces in the log instead of silently launching against nothing
#
# Usage:
#   scripts/cron-poke.sh <agent-id> <message...>
#
# Crontab example (daily 09:00 nudge to Xavier):
#   0 9 * * * /Users/richardadair/ai_projects/agent-launch-scripts/scripts/cron-poke.sh xavier "morning standup: post yesterday's wins" >> /tmp/cron-poke.log 2>&1

set -euo pipefail

readonly TMUX=/opt/homebrew/bin/tmux
readonly JQ=/usr/bin/jq
readonly SIDECAR=/tmp/agent-remote-panes.json
readonly LOG=/tmp/cron-poke.log

log() {
  printf '[%s] cron-poke: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG"
}

die() {
  log "ERROR: $*"
  printf 'cron-poke: %s\n' "$*" >&2
  exit "${2:-1}"
}

[[ $# -ge 2 ]] || die "usage: cron-poke.sh <agent-id> <message...>" 2

agent_id=$1
shift
message=$*

[[ -n "$agent_id" ]] || die "agent-id is empty" 2
[[ -n "$message"  ]] || die "message is empty"  2

[[ -x "$TMUX" ]] || die "tmux not found at $TMUX" 3
[[ -x "$JQ"   ]] || die "jq not found at $JQ"     3
[[ -r "$SIDECAR" ]] || die "sidecar missing at $SIDECAR — is chq-tmux.sh running?" 3

pane_id=$("$JQ" -r --arg a "$agent_id" '.[$a].pane_id // empty' "$SIDECAR")
[[ -n "$pane_id" ]] || die "agent '$agent_id' not in sidecar — deploy it first via chq-tmux.sh" 4

# tmux send-keys with -t <pane_id> works without a TMUX env var because
# pane_ids (%N) are server-wide. If the pane has been killed since the
# sidecar was written, send-keys exits non-zero and we surface that.
if ! "$TMUX" send-keys -t "$pane_id" -- "$message" Enter 2>>"$LOG"; then
  die "tmux send-keys failed for pane $pane_id (agent=$agent_id) — pane may be dead" 5
fi

log "OK agent=$agent_id pane=$pane_id msg=\"$message\""
