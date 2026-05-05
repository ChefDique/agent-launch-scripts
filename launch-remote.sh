#!/usr/bin/env bash
# Agent Remote Management Script

APP_DIR="/Users/richardadair/agent-launch-scripts/remote-app"
ELECTRON_APP="$APP_DIR/node_modules/electron/dist/Electron.app"
ELECTRON_BIN="$ELECTRON_APP/Contents/MacOS/Electron"

case "$1" in
  stop)
    echo "Stopping Agent Remote..."
    pkill -f "$ELECTRON_BIN"
    pkill -f "node ./node_modules/.bin/electron ."
    ;;
  toggle)
    # Toggle show/hide via SIGUSR1. Works regardless of whether the OS
    # Accessibility / Input Monitoring permission has been granted to the
    # Electron binary (which is required for the globalShortcut to fire).
    # If SIGUSR1 is unavailable (e.g. rare platform issue), falls back to
    # touching the .toggle sentinel file that main.js watches.
    PID=$(pgrep -f "$ELECTRON_BIN")
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
    pkill -f "$ELECTRON_BIN" 2>/dev/null
    pkill -f "node ./node_modules/.bin/electron ." 2>/dev/null
    sleep 0.3
    open -na "$ELECTRON_APP" --args "$APP_DIR"
    ;;
esac
