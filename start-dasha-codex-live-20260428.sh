#!/usr/bin/env bash
set -euo pipefail
export PATH="/Users/richardadair/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
WT="/Users/richardadair/ai_projects/trading__dasha_codex_live_20260428"
PROMPT="$WT/.dasha_codex_startup_prompt.md"
cd "$WT"
clear || true
printf '\033]0;DASHA CODEX LIVE — Teldar Dashboard\007'
echo "============================================================"
echo "DASHA CODEX LIVE — Teldar Dashboard Debug"
echo "============================================================"
echo "Worktree: $WT"
echo "Branch: $(git branch --show-current)"
echo "If Richard is reading this: type directly to Dasha below."
echo "Launching Codex..."
echo
exec codex --cd "$WT" --sandbox workspace-write --ask-for-approval on-request --no-alt-screen "$(cat "$PROMPT")"
