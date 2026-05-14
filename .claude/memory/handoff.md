# Handoff — Neo (`tmux-masta`)

## Last working on

AgentRemote v1.4.5 fixes:
1. Codex model list: added `gpt-5.5` back alongside `gpt-5.3-codex` (default) and `gpt-5.3-codex-spark`. Previous session had removed it; user intent was "default to lighter model" not "remove frontier option."
2. Edit form top cut-off: `closeRadialMenu`'s 320ms timer was sending `resize-window` with the pre-radial height (smaller), clipping the harness-tab row at the form top. Fixed by skipping the pre-open height IPC when `body.adding` is set; `syncWindowSize` owns the resize in that case.

Also: self-healed `neo-claude` message-agent listener on port 8651; synced registry.

## Open priorities

- [PENDING-RICHARD] Skills (Armory → agent) wiring is broken at five steps: form has no input, IPC save (`main.js` UPDATABLE_FIELDS) doesn't whitelist `skills`, `launch-agent.sh` doesn't extract it, Swarmy's `agentremote_runtime.py` doesn't export it to the spawned process. Touches `~/ai_projects/swarmy` (overlord-swarmy's repo) — needs explicit Richard direction or a coordinated job dispatched through overlord-swarmy.
- [PENDING-RICHARD] bypass-perms walkback to Swarmy — prior coord drop `cid neo-claude-to-overlordswarmy-1778357741` (permission-mode default) needs acknowledgement.
- [PENDING-RICHARD] Telegram 401 reissue for Neo channel — needs @BotFather reissue. ALS-008 dispatch_pending bumped high by Xavier 2026-05-04.
- [DEFER] Avatar relocation from git-tracked `remote-app/assets/` to `~/Library/Application Support/AgentRemote/avatars/`. Requires custom protocol or absolute-path convention.

## Cross-session comms

- 2026-05-14 Richard: Codex dropdown missing gpt-5.5; edit form top always cut off on open. Both fixed in v1.4.5.
- 2026-05-13 Richard: settings surfaces clipping and stale GPT models, clarified to use coding models instead of `gpt-5.5`, then asked for the dock to render 9 across. v1.4.4 fixes the settings growth path, avatar cropper fallback, model config, saved Codex model pins, and 9-column dock grid; docs updated in `docs/operations/agentremote-recovery-list.md`, `docs/exec-plans/active/agentremote-v1-pivot-plan.md`, and `remote-app/AGENTS.md`.
- 2026-05-09 Richard: persistent wrong-session pet chat across reloads — slug-variant root cause shipped in v1.3.6.
- 2026-05-09 Swarmy (`overlord-swarmy-hermes`): two prior coord drops still unacknowledged (`cid neo-claude-to-overlordswarmy-1778356367` auto-send-task, `cid neo-claude-to-overlordswarmy-1778357741` permission-mode default — second one needs walkback).

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-ai-projects-agent-launch-scripts/memory/MEMORY.md -->
