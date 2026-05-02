#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json (entry id "gekko").
# Kept so the `gekko` shell alias and trading-tmux.sh keep working without
# edits. PROJECT_ROOT and STARTUP_SLASH env overrides still work.
exec bash "$(dirname "$0")/launch-agent.sh" gekko
