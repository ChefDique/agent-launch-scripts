#!/usr/bin/env bash
set -euo pipefail

# council-spawn.sh — spawn bounded-membership council session
# Usage: council-spawn.sh <council-id> <comma-list-members> <topic-brief-path>
#
# Example:
#   council-spawn.sh alpha "xavier,lucius" ~/briefs/strategy-2026.md
#
# Creates one tmux window per member: council-<id>-<member>
# Each window runs claude with a per-member settings file that touches a
# sentinel on Stop, plus the topic brief injected as a system-prompt addendum.

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

[[ $# -lt 3 ]] && die "Usage: $0 <council-id> <comma-list-members> <topic-brief-path>"

COUNCIL_ID="$1"
MEMBERS_CSV="$2"
TOPIC_BRIEF_PATH="$3"

# Validate topic brief
[[ -f "$TOPIC_BRIEF_PATH" ]] || die "Topic brief not found: $TOPIC_BRIEF_PATH"

# Validate tmux is active
tmux list-sessions >/dev/null 2>&1 || die "No active tmux session. Start a tmux session first."

# ---------------------------------------------------------------------------
# Paths (expanded — no tilde in JSON)
# ---------------------------------------------------------------------------

COUNCILS_DIR="${HOME}/.message-agent/councils/${COUNCIL_ID}"
SENTINELS_DIR="${COUNCILS_DIR}/sentinels"
TRANSCRIPT="${COUNCILS_DIR}/transcript.jsonl"

# ---------------------------------------------------------------------------
# Directory setup (idempotent)
# ---------------------------------------------------------------------------

mkdir -p "${SENTINELS_DIR}"
[[ -f "${TRANSCRIPT}" ]] || touch "${TRANSCRIPT}"

# ---------------------------------------------------------------------------
# Parse member list
# ---------------------------------------------------------------------------

IFS=',' read -ra MEMBERS <<< "${MEMBERS_CSV}"

if [[ ${#MEMBERS[@]} -eq 0 ]]; then
  die "No members parsed from: ${MEMBERS_CSV}"
fi

# ---------------------------------------------------------------------------
# Topic brief — write to temp file once, reuse for all members
# Topic content may contain single quotes, newlines, special chars.
# We write to a per-invocation temp file and reference it inside the tmux
# command via a subshell so the content is read at window-spawn time.
# ---------------------------------------------------------------------------

TOPIC_TMP="/tmp/council-topic-$$.txt"
cp "${TOPIC_BRIEF_PATH}" "${TOPIC_TMP}"
# Ensure cleanup on exit (best-effort; council sessions are ephemeral anyway)
trap 'rm -f "${TOPIC_TMP}"' EXIT

# ---------------------------------------------------------------------------
# Spawn one tmux window per member
# ---------------------------------------------------------------------------

SPAWNED=()

for raw_member in "${MEMBERS[@]}"; do
  # Trim whitespace
  member="${raw_member#"${raw_member%%[![:space:]]*}"}"
  member="${member%"${member##*[![:space:]]}"}"
  [[ -z "$member" ]] && continue

  WINDOW_NAME="council-${COUNCIL_ID}-${member}"
  SETTINGS_PATH="${COUNCILS_DIR}/settings-${member}.json"

  # Write per-member settings file with Stop hook that touches the sentinel
  cat > "${SETTINGS_PATH}" <<SETTINGS_EOF
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "touch ${SENTINELS_DIR}/${member}"
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF

  # Build the tmux new-window command.
  # We pass --append-system-prompt via a subshell cat so special chars in the
  # brief don't break the tmux command string. The temp file is written above
  # and shared across all members for this invocation.
  tmux new-window \
    -n "${WINDOW_NAME}" \
    "claude --settings '${SETTINGS_PATH}' --append-system-prompt \"\$(cat '${TOPIC_TMP}')\""

  SPAWNED+=("$member")
done

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

if [[ ${#SPAWNED[@]} -eq 0 ]]; then
  die "No members spawned (empty list after parsing '${MEMBERS_CSV}')"
fi

SPAWNED_LIST=$(IFS=', '; echo "${SPAWNED[*]}")
echo "Spawned council ${COUNCIL_ID}: ${SPAWNED_LIST}"
