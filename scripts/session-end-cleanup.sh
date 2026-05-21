#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTREMOTE_SUPPORT_DIR="$HOME/Library/Application Support/AgentRemote"

KEEP_AGENTREMOTE=0
SKIP_CACHE=0
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: scripts/session-end-cleanup.sh [--keep-agentremote] [--skip-cache] [--dry-run]

Session-end cleanup for agent-launch-scripts.

Default behavior:
  - Stop AgentRemote Electron processes from the canonical checkout and Codex worktrees.
  - Close marked AgentRemote iTerm viewer windows left behind after tmux detach.
  - Clear AgentRemote Chromium caches while preserving Local Storage and pet-state.json.
  - Print git status, worktree list, remaining AgentRemote processes, and viewer residue.

Options:
  --keep-agentremote  Do not stop AgentRemote; still report running processes.
  --skip-cache        Do not remove Chromium cache directories.
  --dry-run           Print what would happen without stopping/removing anything.
USAGE
}

while (($#)); do
  case "$1" in
    --keep-agentremote) KEEP_AGENTREMOTE=1 ;;
    --skip-cache) SKIP_CACHE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

run() {
  if ((DRY_RUN)); then
    printf '[dry-run] %q' "$1"
    shift || true
    for arg in "$@"; do printf ' %q' "$arg"; done
    printf '\n'
  else
    "$@"
  fi
}

print_agentremote_processes() {
  ps -axo pid,ppid,lstart,command \
    | awk '/agent-launch-scripts\/remote-app\/node_modules\/electron\/dist\/Electron.app\/Contents\/MacOS\/Electron|--app-path=.*agent-launch-scripts\/remote-app/ && !/awk / { print }'
}

print_marked_iterm_viewers() {
  pgrep -x iTerm2 >/dev/null 2>&1 || {
    echo "(no iTerm process)"
    return 0
  }

  osascript <<'APPLESCRIPT' 2>/dev/null || true
tell application "iTerm2"
  set markerName to "AgentRemote CHQ Viewer"
  set foundViewer to false
  repeat with candidateWindow in windows
    set windowHasMarker to false
    repeat with candidateTab in tabs of candidateWindow
      repeat with candidateSession in sessions of candidateTab
        try
          if (name of candidateSession as text) contains markerName then
            set windowHasMarker to true
            set foundViewer to true
          end if
        end try
      end repeat
    end repeat
    if windowHasMarker then
      log "marked-viewer-window=" & (index of candidateWindow as text) & " name=" & (name of candidateWindow as text)
    end if
  end repeat
  if foundViewer is false then log "(no marked AgentRemote iTerm viewer windows)"
end tell
APPLESCRIPT
}

close_marked_iterm_viewers() {
  pgrep -x iTerm2 >/dev/null 2>&1 || return 0

  if ((DRY_RUN)); then
    echo "[dry-run] close iTerm windows containing AgentRemote CHQ Viewer marker"
    return 0
  fi

  osascript <<'APPLESCRIPT' >/dev/null 2>&1 || true
tell application "iTerm2"
  set markerName to "AgentRemote CHQ Viewer"
  set windowsToClose to {}
  repeat with candidateWindow in windows
    set windowHasMarker to false
    repeat with candidateTab in tabs of candidateWindow
      repeat with candidateSession in sessions of candidateTab
        try
          if (name of candidateSession as text) contains markerName then set windowHasMarker to true
        end try
      end repeat
    end repeat
    if windowHasMarker then set end of windowsToClose to candidateWindow
  end repeat
  repeat with candidateWindow in windowsToClose
    close candidateWindow
  end repeat
end tell
APPLESCRIPT
}

clear_cache_dir() {
  local rel="$1"
  local target="$AGENTREMOTE_SUPPORT_DIR/$rel"
  [[ -e "$target" ]] || return 0
  if ((DRY_RUN)); then
    echo "[dry-run] rm -rf $target"
  else
    rm -rf "$target"
  fi
}

echo "== AgentRemote processes before cleanup =="
print_agentremote_processes || true

echo "== Marked iTerm viewers before cleanup =="
print_marked_iterm_viewers || true

if ((KEEP_AGENTREMOTE)); then
  echo "== Keeping AgentRemote running =="
else
  echo "== Stopping AgentRemote =="
  if ((DRY_RUN)); then
    echo "[dry-run] bash $ROOT_DIR/launch-remote.sh stop"
  else
    bash "$ROOT_DIR/launch-remote.sh" stop || true
    sleep 0.5
  fi
fi

echo "== Closing marked AgentRemote iTerm viewers =="
close_marked_iterm_viewers || true

if ((SKIP_CACHE)); then
  echo "== Skipping AgentRemote cache cleanup =="
else
  echo "== Clearing AgentRemote Chromium caches =="
  # Preserve Local Storage, Preferences, and pet-state.json. These carry
  # operator settings, selected pets, window coordinates, and registry UI state.
  clear_cache_dir "Cache"
  clear_cache_dir "Code Cache"
  clear_cache_dir "GPUCache"
  clear_cache_dir "DawnGraphiteCache"
  clear_cache_dir "DawnWebGPUCache"
  clear_cache_dir "ShaderCache"
  clear_cache_dir "GrShaderCache"
  clear_cache_dir "blob_storage"
  clear_cache_dir "Session Storage"
  clear_cache_dir "WebStorage"
  clear_cache_dir "Shared Dictionary"
fi

echo "== Git status =="
git -C "$ROOT_DIR" status --short --branch

echo "== Worktrees =="
git -C "$ROOT_DIR" worktree list

echo "== AgentRemote processes after cleanup =="
print_agentremote_processes || true

echo "== Marked iTerm viewers after cleanup =="
print_marked_iterm_viewers || true
