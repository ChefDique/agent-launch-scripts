#!/usr/bin/env bash
# Start Swarmy through Swarmy's AgentRemote runtime and attach.
set -euo pipefail

swarmy_runtime="${AGENTREMOTE_SWARMY_RUNTIME:-${HOME}/ai_projects/swarmy/scripts/agentremote_runtime.py}"

python3 "$swarmy_runtime" add overlord-swarmy
python3 "$swarmy_runtime" attach
