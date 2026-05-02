#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json (entry id "lucius").
# Kept here in deprecated/ for backwards compat with external callers during
# the soak period. The pre-launch patch-drift WARN block from the old script
# was dropped in the registry migration; if you want it back, add it as a
# hook in agents.json's pre_launch field.
exec bash "$(dirname "$0")/../launch-agent.sh" lucius
