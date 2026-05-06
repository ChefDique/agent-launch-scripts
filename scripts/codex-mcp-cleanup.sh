#!/usr/bin/env bash
set -euo pipefail

# Reap stale MCP helper processes left behind by prior Codex sessions.
# This is intentionally narrower than Claude Code's session hooks: it only
# targets known Codex-spawned helper commands whose parent Codex process is gone.

DRY_RUN=0
INCLUDE_BROKER=0

usage() {
  /bin/cat <<'USAGE'
Usage: scripts/codex-mcp-cleanup.sh [--dry-run] [--include-claude-peers-broker]

Kills stale local MCP helper processes whose parent process is no longer a live
Codex process. The claude-peers broker is preserved unless explicitly requested.
USAGE
}

while (($#)); do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --include-claude-peers-broker) INCLUDE_BROKER=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

is_helper_command() {
  local command="$1"
  case "$command" in
    *notebooklm-mcp*) return 0 ;;
    *zc-mcp-server.py*) return 0 ;;
    *SkyComputerUseClient*" mcp"*) return 0 ;;
    *"/claude-peers/server.ts"*) return 0 ;;
    *"/claude-peers/broker.ts"*)
      ((INCLUDE_BROKER)) && return 0
      return 1
      ;;
    *) return 1 ;;
  esac
}

parent_is_live_codex() {
  local ppid="$1"
  local parent_command
  [[ "$ppid" =~ ^[0-9]+$ ]] || return 1
  parent_command="$(/bin/ps -p "$ppid" -o command= 2>/dev/null || true)"
  [[ -n "$parent_command" ]] || return 1
  [[ "$parent_command" == *"/codex "* || "$parent_command" == *" codex "* || "$parent_command" == *"/codex/codex "* ]]
}

terminate_pid() {
  local pid="$1"
  local command="$2"
  if ((DRY_RUN)); then
    printf '[dry-run] would kill stale MCP helper pid=%s cmd=%s\n' "$pid" "$command" >&2
    return 0
  fi

  kill "$pid" 2>/dev/null || return 0
  /bin/sleep 0.1
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  printf '[codex-mcp-cleanup] killed stale MCP helper pid=%s cmd=%s\n' "$pid" "$command" >&2
}

while IFS= read -r line; do
  [[ -n "$line" ]] || continue
  pid="${line%% *}"
  rest="${line#* }"
  ppid="${rest%% *}"
  command="${rest#* }"

  [[ "$pid" =~ ^[0-9]+$ && "$ppid" =~ ^[0-9]+$ ]] || continue
  is_helper_command "$command" || continue
  parent_is_live_codex "$ppid" && continue

  terminate_pid "$pid" "$command"
done < <(/bin/ps -axo pid=,ppid=,command=)
