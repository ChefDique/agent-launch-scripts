#!/usr/bin/env bash
set -euo pipefail

SESSION="als-codex-smoke-$$"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="/tmp/${SESSION}"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
trap 'CHQ_SESSION="$SESSION" TMUX_AUTO_ATTACH=0 bash "$REPO_ROOT/chq-tmux.sh" stop >/dev/null 2>&1 || true; rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/bin" "$TMP_DIR/cwd"

cat > "$TMP_DIR/bin/codex" <<SH
#!/usr/bin/env bash
{
  echo "COMMAND:codex"
  for arg in "\$@"; do
    echo "ARG:\${arg}"
  done
} >> "$TMP_DIR/command.log"
SH
chmod +x "$TMP_DIR/bin/codex"

cat > "$TMP_DIR/bin/claude" <<SH
#!/usr/bin/env bash
{
  echo "COMMAND:claude"
  for arg in "\$@"; do
    echo "ARG:\${arg}"
  done
} >> "$TMP_DIR/command.log"
SH
chmod +x "$TMP_DIR/bin/claude"

cat > "$TMP_DIR/agents.json" <<JSON
{
  "agents": [
    {
      "id": "smoke-codex",
      "display_name": "Smoke Codex",
      "runtime": "codex",
      "cwd": "$TMP_DIR/cwd",
      "model": "gpt-5.5",
      "reasoning_effort": "high",
      "sandbox": "danger-full-access",
      "approval_policy": "never",
      "startup_slash": "/gogo",
      "auto_restart": false,
      "env": {
        "PATH": "$TMP_DIR/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
      }
    }
  ]
}
JSON

AGENT_REGISTRY="$TMP_DIR/agents.json" \
AGENT_REMOTE_PANES_SIDECAR="$TMP_DIR/sidecar.json" \
CHQ_SESSION="$SESSION" \
TMUX_AUTO_ATTACH=0 \
  bash "$REPO_ROOT/chq-tmux.sh" start smoke-codex >/tmp/chq-codex-smoke.out

for _ in {1..30}; do
  [[ -s "$TMP_DIR/command.log" ]] && break
  sleep 0.2
done

if [[ ! -s "$TMP_DIR/command.log" ]]; then
  echo "smoke codex command log was not written" >&2
  tmux capture-pane -t "$SESSION:0.0" -p -S -80 >&2 2>/dev/null || true
  exit 1
fi

grep -qx 'COMMAND:codex' "$TMP_DIR/command.log"
grep -qx 'ARG:gpt-5.5' "$TMP_DIR/command.log"
grep -qx 'ARG:model_reasoning_effort="high"' "$TMP_DIR/command.log"
grep -qx 'ARG:/gogo' "$TMP_DIR/command.log"
if grep -q 'COMMAND:claude' "$TMP_DIR/command.log"; then
  echo "chq smoke launched claude" >&2
  cat "$TMP_DIR/command.log" >&2
  exit 1
fi

echo "chq codex runtime smoke passed"
