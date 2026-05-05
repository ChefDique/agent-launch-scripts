#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/bin" "$TMP_DIR/codex-cwd" "$TMP_DIR/claude-cwd"

cat > "$TMP_DIR/bin/codex" <<'SH'
#!/usr/bin/env bash
echo "COMMAND:codex"
for arg in "$@"; do
  echo "ARG:${arg}"
done
SH
chmod +x "$TMP_DIR/bin/codex"

cat > "$TMP_DIR/bin/claude" <<'SH'
#!/usr/bin/env bash
echo "COMMAND:claude"
for arg in "$@"; do
  echo "ARG:${arg}"
done
SH
chmod +x "$TMP_DIR/bin/claude"

cat > "$TMP_DIR/agents.json" <<JSON
{
  "agents": [
    {
      "id": "codex",
      "display_name": "Codex",
      "cwd": "$TMP_DIR/codex-cwd",
      "runtime": "codex",
      "model": "gpt-5.5",
      "reasoning_effort": "high",
      "sandbox": "danger-full-access",
      "approval_policy": "never",
      "startup_slash": "/gogo"
    },
    {
      "id": "legacy",
      "display_name": "Legacy",
      "cwd": "$TMP_DIR/claude-cwd"
    },
    {
      "id": "explicit-claude",
      "display_name": "Explicit Claude",
      "cwd": "$TMP_DIR/claude-cwd",
      "runtime": "claude"
    }
  ]
}
JSON

run_agent() {
  PATH="$TMP_DIR/bin:$PATH" \
    AGENT_REGISTRY="$TMP_DIR/agents.json" \
    bash "$REPO_ROOT/launch-agent.sh" "$1"
}

codex_output="$(run_agent codex)"
grep -qx 'COMMAND:codex' <<< "$codex_output"
grep -qx 'ARG:--model' <<< "$codex_output"
grep -qx 'ARG:gpt-5.5' <<< "$codex_output"
grep -qx 'ARG:--ask-for-approval' <<< "$codex_output"
! grep -qx 'ARG:--dangerously-bypass-approvals-and-sandbox' <<< "$codex_output"
grep -qx 'ARG:never' <<< "$codex_output"
grep -qx 'ARG:--sandbox' <<< "$codex_output"
grep -qx 'ARG:danger-full-access' <<< "$codex_output"
grep -qx 'ARG:-c' <<< "$codex_output"
grep -qx 'ARG:model_reasoning_effort="high"' <<< "$codex_output"
grep -qx 'ARG:--no-alt-screen' <<< "$codex_output"
grep -qx 'ARG:/gogo' <<< "$codex_output"

legacy_output="$(run_agent legacy)"
grep -qx 'COMMAND:codex' <<< "$legacy_output"
grep -qx 'ARG:gpt-5.5' <<< "$legacy_output"
grep -qx 'ARG:model_reasoning_effort="high"' <<< "$legacy_output"

explicit_claude_output="$(run_agent explicit-claude)"
grep -qx 'COMMAND:claude' <<< "$explicit_claude_output"
grep -qx 'ARG:-n' <<< "$explicit_claude_output"
grep -qx 'ARG:Explicit Claude' <<< "$explicit_claude_output"

if jq -e '[.agents[] | select((.runtime // "codex") == "claude" and (.allow_claude_runtime != true))] | length == 0' "$REPO_ROOT/agents.json" >/dev/null; then
  :
else
  echo "agents.json contains a Claude runtime entry without allow_claude_runtime=true" >&2
  jq -r '.agents[] | select((.runtime // "codex") == "claude" and (.allow_claude_runtime != true)) | "  - " + .id' "$REPO_ROOT/agents.json" >&2
  exit 1
fi

echo "launch-agent runtime tests passed"
