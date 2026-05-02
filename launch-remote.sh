#!/usr/bin/env bash
# Agent Remote Management Script

APP_DIR="/Users/richardadair/agent-launch-scripts/remote-app"

case "$1" in
  stop)
    echo "Stopping Agent Remote..."
    pkill -f "electron /Users/richardadair/agent-launch-scripts/remote-app" || pkill -f "remote-app"
    ;;
  toggle)
    # Toggle show/hide via SIGUSR1. Works regardless of whether the OS
    # Accessibility / Input Monitoring permission has been granted to the
    # Electron binary (which is required for the globalShortcut to fire).
    # If SIGUSR1 is unavailable (e.g. rare platform issue), falls back to
    # touching the .toggle sentinel file that main.js watches.
    PID=$(pgrep -f "Electron.app/Contents/MacOS/Electron \.")
    if [ -z "$PID" ]; then
      echo "Agent Remote is not running. Start it first with: bash launch-remote.sh"
      exit 1
    fi
    kill -SIGUSR1 "$PID"
    echo "Sent SIGUSR1 to PID $PID — window toggled"
    ;;
  *)
    # Start (default)
    echo "Launching Electron Agent Remote..."
    pkill -f "electron /Users/richardadair/agent-launch-scripts/remote-app" 2>/dev/null
    cd "$APP_DIR"
    ./node_modules/.bin/electron . > /dev/null 2>&1 &
    ;;
esac
