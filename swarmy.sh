#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json (entry id "swarmy").
# Kept so the `swarmy` shell alias and chq-tmux.sh pane_loop keep working
# without edits. The restart loop still lives only in chq-tmux.sh — never
# nest one here.
exec bash "$(dirname "$0")/launch-agent.sh" swarmy
