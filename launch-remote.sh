#!/usr/bin/env bash
# Agent Remote Management Script

APP_DIR="/Users/richardadair/agent-launch-scripts/remote-app"

case "$1" in
  stop)
    echo "Stopping Agent Remote..."
    pkill -f "electron /Users/richardadair/agent-launch-scripts/remote-app" || pkill -f "remote-app"
    ;;
  *)
    # Start (default)
    echo "Launching Electron Agent Remote..."
    pkill -f "electron /Users/richardadair/agent-launch-scripts/remote-app" 2>/dev/null
    cd "$APP_DIR"
    ./node_modules/.bin/electron . > /dev/null 2>&1 &
    ;;
esac
