#!/usr/bin/env bash
# Thin shim — superseded by launch-agent.sh + agents.json.
# Kept here in deprecated/ for backwards compat during the soak period.
# Entry id was "gemini"; renamed to "claude" 2026-05-02.
exec bash "$(dirname "$0")/../launch-agent.sh" claude
