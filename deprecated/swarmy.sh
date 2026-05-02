#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json (entry id "swarmy").
# Kept here in deprecated/ for backwards compat with the `swarmy` shell alias
# during the soak period. The restart loop still lives only in chq-tmux.sh —
# never nest one here.
exec bash "$(dirname "$0")/../launch-agent.sh" swarmy
