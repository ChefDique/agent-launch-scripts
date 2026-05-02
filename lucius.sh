#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json (entry id "lucius").
# Kept so the `lucius` shell alias and any external caller keep working
# without edits. The pre-launch patch-drift WARN block from the old script
# has been dropped here; if you want it back, add it as a hook in
# agents.json's pre_launch field.
exec bash "$(dirname "$0")/launch-agent.sh" lucius
