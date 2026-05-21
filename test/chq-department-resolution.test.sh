#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/ecommerce"
cat > "$TMP_DIR/agents.json" <<JSON
{
  "agents": [
    {
      "id": "mugatu-claude",
      "display_name": "MUGATU",
      "runtime": "codex",
      "tmux_target": "mugatu",
      "cwd": "$TMP_DIR/ecommerce"
    }
  ]
}
JSON

AGENT_REGISTRY="$TMP_DIR/agents.json" CHQ_TMUX_LIB_ONLY=1 source "${ROOT}/chq-tmux.sh"

if [[ "${#DEPARTMENTS[@]}" != "1" ]]; then
  printf 'expected only registry department, got %s:\n' "${#DEPARTMENTS[@]}" >&2
  printf '%s\n' "${DEPARTMENTS[@]}" >&2
  exit 1
fi

IFS='|' read -r dept cwd wname script <<< "${DEPARTMENTS[0]}"
if ! department_matches "mugatu" "$dept" "$wname"; then
  echo "expected lowercase mugatu to match registry MUGATU entry" >&2
  exit 1
fi

if [[ "$dept" != "mugatu-claude" || "$script" != *"launch-agent.sh mugatu-claude" ]]; then
  echo "expected mugatu alias to resolve to launch-agent registry path, got:" >&2
  echo "${DEPARTMENTS[0]}" >&2
  exit 1
fi

echo "chq department resolution passed"
