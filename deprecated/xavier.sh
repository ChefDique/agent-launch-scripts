#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json (entry id "xavier").
# Kept here in deprecated/ so the `xavier` shell alias and any external caller
# (cron, scripts in other repos) keep working without edits during the soak
# period. To migrate a caller, replace `bash xavier.sh` with
# `bash launch-agent.sh xavier`. PROJECT_ROOT and STARTUP_SLASH env overrides
# still work — launch-agent.sh honors both.
exec bash "$(dirname "$0")/../launch-agent.sh" xavier
