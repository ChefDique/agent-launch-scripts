#!/usr/bin/env bash
set -euo pipefail

SESSION="als-ittab-layout-$$"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="/tmp/${SESSION}"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/bin" "$TMP_DIR/cwd-a" "$TMP_DIR/cwd-b" "$TMP_DIR/cwd-c"
trap 'CHQ_SESSION="$SESSION" TMUX_AUTO_ATTACH=0 bash "$REPO_ROOT/chq-tmux.sh" stop >/dev/null 2>&1 || true; rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/bin/codex" <<'SH'
#!/usr/bin/env bash
sleep 30
SH
chmod +x "$TMP_DIR/bin/codex"

cat > "$TMP_DIR/agents.json" <<JSON
{
  "agents": [
    {
      "id": "a",
      "display_name": "A",
      "runtime": "codex",
      "cwd": "$TMP_DIR/cwd-a",
      "startup_slash": "",
      "env": { "PATH": "$TMP_DIR/bin:/usr/bin:/bin:/usr/sbin:/sbin" }
    },
    {
      "id": "b",
      "display_name": "B",
      "runtime": "codex",
      "cwd": "$TMP_DIR/cwd-b",
      "startup_slash": "",
      "env": { "PATH": "$TMP_DIR/bin:/usr/bin:/bin:/usr/sbin:/sbin" }
    },
    {
      "id": "c",
      "display_name": "C",
      "runtime": "codex",
      "cwd": "$TMP_DIR/cwd-c",
      "startup_slash": "",
      "env": { "PATH": "$TMP_DIR/bin:/usr/bin:/bin:/usr/sbin:/sbin" }
    }
  ]
}
JSON

AGENT_REGISTRY="$TMP_DIR/agents.json" \
AGENT_REMOTE_PANES_SIDECAR="$TMP_DIR/sidecar.json" \
CHQ_SESSION="$SESSION" \
CHQ_LAYOUT=ittab \
TMUX_AUTO_ATTACH=0 \
  bash "$REPO_ROOT/chq-tmux.sh" start a b c >/tmp/chq-ittab-layout.out

for _ in {1..20}; do
  window_count=$(tmux list-windows -t "$SESSION" -F '#{window_index}' 2>/dev/null | wc -l | tr -d ' ')
  [[ "$window_count" == "3" ]] && break
  sleep 0.1
done

windows="$(tmux list-windows -t "$SESSION" -F '#{window_index}:#{window_name}:#{window_panes}' 2>/dev/null)"
window_count="$(wc -l <<< "$windows" | tr -d ' ')"
if [[ "$window_count" != "3" ]]; then
  echo "expected 3 tmux windows for ittab deploy; got:" >&2
  echo "$windows" >&2
  exit 1
fi

if awk -F: '$3 != 1 { bad=1 } END { exit bad ? 0 : 1 }' <<< "$windows"; then
  echo "expected each ittab tmux window to contain exactly one pane; got:" >&2
  echo "$windows" >&2
  exit 1
fi

echo "chq ittab window layout passed"
