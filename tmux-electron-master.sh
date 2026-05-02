#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json (entry id "gemini").
# Kept so chq-tmux.sh's old DEPARTMENTS path and any external caller keep
# working without edits.
exec bash "$(dirname "$0")/launch-agent.sh" gemini
