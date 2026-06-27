#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REGISTRY="${AGENT_REGISTRY:-${REPO_ROOT}/agents.json}"
GLOBAL_SKILL="${GLOBAL_LEAD_STARTUP_SKILL:-${HOME}/.codex/skills/lead-gogo/SKILL.md}"
CODEX_CONFIG="${CODEX_CONFIG:-${HOME}/.codex/config.toml}"

failures=0

if [[ ! -f "$REGISTRY" ]]; then
  echo "FAIL registry missing: $REGISTRY" >&2
  exit 1
fi

if [[ ! -f "$GLOBAL_SKILL" ]]; then
  echo "FAIL global lead-gogo skill missing: $GLOBAL_SKILL" >&2
  failures=$((failures + 1))
fi

if [[ -f "$CODEX_CONFIG" && -f "$GLOBAL_SKILL" ]]; then
  resolved_global_skill="$(cd "$(dirname "$GLOBAL_SKILL")" && pwd -P)/$(basename "$GLOBAL_SKILL")"
  if ! grep -Fq "path = \"$GLOBAL_SKILL\"" "$CODEX_CONFIG" \
      && ! grep -Fq "path = \"$resolved_global_skill\"" "$CODEX_CONFIG"; then
    echo "FAIL Codex config does not enable lead-gogo skill: $CODEX_CONFIG" >&2
    failures=$((failures + 1))
  fi
fi

# Empty is an intentional opt-out. The audit only rejects non-empty commands
# other than the supported lead startup; it must never normalize empty to the
# default used by AgentRemote's new-agent form.
unsupported_startups="$(
  jq -r '
    .agents[]
    | select((.startup_slash // "") != "" and (.startup_slash // "") != "/lead-gogo")
    | "\(.id)\t\(.display_name // .id)\t\(.startup_slash)"
  ' "$REGISTRY"
)"

if [[ -n "$unsupported_startups" ]]; then
  echo "FAIL startup_slash must be empty (disabled) or /lead-gogo:" >&2
  printf '%s\n' "$unsupported_startups" >&2
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
