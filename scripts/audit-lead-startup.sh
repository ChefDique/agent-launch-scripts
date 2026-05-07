#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REGISTRY="${AGENT_REGISTRY:-${REPO_ROOT}/agents.json}"
GLOBAL_SKILL="/Users/richardadair/.agents/skills/lead-gogo/SKILL.md"
CODEX_CONFIG="/Users/richardadair/.codex/config.toml"

failures=0

if [[ ! -f "$REGISTRY" ]]; then
  echo "FAIL registry missing: $REGISTRY" >&2
  exit 1
fi

if [[ ! -f "$GLOBAL_SKILL" ]]; then
  echo "FAIL global lead-gogo skill missing: $GLOBAL_SKILL" >&2
  failures=$((failures + 1))
fi

if [[ -f "$CODEX_CONFIG" ]] && ! grep -Fq 'path = "/Users/richardadair/.agents/skills/lead-gogo/SKILL.md"' "$CODEX_CONFIG"; then
  echo "FAIL Codex config does not enable lead-gogo skill: $CODEX_CONFIG" >&2
  failures=$((failures + 1))
fi

bad_startups="$(
  jq -r '
    .agents[]
    | select((.startup_slash // "") != "" and (.startup_slash // "") != "/lead-gogo")
    | "\(.id)\t\(.display_name // .id)\t\(.startup_slash)"
  ' "$REGISTRY"
)"

if [[ -n "$bad_startups" ]]; then
  echo "FAIL agents with non-empty startup_slash must use /lead-gogo:" >&2
  printf '%s\n' "$bad_startups" >&2
  failures=$((failures + 1))
fi

marker='Extends global lead startup'
while IFS= read -r cwd; do
  [[ -n "$cwd" ]] || continue
  cwd="${cwd/#\~/$HOME}"
  [[ -d "$cwd" ]] || continue
  for local_gogo in \
    "$cwd/.agents/skills/gogo/SKILL.md" \
    "$cwd/.claude/skills/gogo/SKILL.md" \
    "$cwd/.Codex/skills/gogo/SKILL.md" \
    "$cwd/.codex/skills/gogo/SKILL.md"; do
    if [[ -f "$local_gogo" ]] && ! grep -Fq "$marker" "$local_gogo"; then
      echo "WARN local /gogo missing extension marker: $local_gogo" >&2
      if [[ "${STRICT_LOCAL_GOGO:-0}" == "1" ]]; then
        failures=$((failures + 1))
      fi
    fi
  done
done < <(jq -r '.agents[] | .cwd // empty' "$REGISTRY" | sort -u)

if [[ "$failures" -ne 0 ]]; then
  exit 1
fi

echo "lead startup audit passed"
