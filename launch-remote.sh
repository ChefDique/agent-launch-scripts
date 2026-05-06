#!/usr/bin/env bash
# Agent Remote Management Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/remote-app"
ELECTRON_APP="$APP_DIR/node_modules/electron/dist/Electron.app"
ELECTRON_BIN="$ELECTRON_APP/Contents/MacOS/Electron"
AGENTREMOTE_APP_PATTERN="/agent-launch-scripts/remote-app"

stop_agentremote_processes() {
  # Stop AgentRemote instances from the canonical checkout AND Codex worktrees.
  # Prior versions only killed the exact canonical Electron binary path, which
  # left stale worktree-launched HUDs visible and made renderer reloads appear
  # to ignore fresh code.
  pkill -f "$ELECTRON_BIN" 2>/dev/null
  pkill -f "node ./node_modules/.bin/electron ." 2>/dev/null
  pkill -f "$AGENTREMOTE_APP_PATTERN/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .*${AGENTREMOTE_APP_PATTERN}$" 2>/dev/null
  pkill -f "Electron Helper.*--app-path=.*$AGENTREMOTE_APP_PATTERN" 2>/dev/null
  return 0
}

agentremote_pid() {
  pgrep -f "$AGENTREMOTE_APP_PATTERN/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .*${AGENTREMOTE_APP_PATTERN}$" || true
}

case "$1" in
  stop)
    echo "Stopping Agent Remote..."
    stop_agentremote_processes
    ;;
  toggle)
    # Toggle show/hide via SIGUSR1. Works regardless of whether the OS
    # Accessibility / Input Monitoring permission has been granted to the
    # Electron binary (which is required for the globalShortcut to fire).
    # If SIGUSR1 is unavailable (e.g. rare platform issue), falls back to
    # touching the .toggle sentinel file that main.js watches.
    PID=$(agentremote_pid)
    if [ -z "$PID" ]; then
      echo "Agent Remote is not running. Start it first with: bash launch-remote.sh"
      exit 1
    fi
    kill -SIGUSR1 "$PID"
    echo "Sent SIGUSR1 to PID $PID — window toggled"
    ;;
  *)
    # Start (default)
    # Kill any prior main-process instance first. Then launch via macOS `open`
    # instead of shell-backgrounding the electron wrapper; the wrapper can exit
    # when its noninteractive parent shell goes away, while `open` hands the GUI
    # app off to LaunchServices and leaves one durable AgentRemote process.
    echo "Launching Electron Agent Remote..."
    stop_agentremote_processes
    sleep 0.3
    open -na "$ELECTRON_APP" --args "$APP_DIR"
    ;;
esac
