#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json (entry id "gemini").
# Kept here in deprecated/ for backwards compat during the soak period.
exec bash "$(dirname "$0")/../launch-agent.sh" gemini
