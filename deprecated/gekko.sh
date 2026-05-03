#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json (entry id "gekko").
# Kept here in deprecated/ for backwards compat with the `gekko` shell alias
# during the soak period. PROJECT_ROOT and STARTUP_SLASH env overrides still
# work.
exec bash "$(dirname "$0")/../launch-agent.sh" gekko
