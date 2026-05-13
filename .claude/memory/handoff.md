# Handoff — Neo (`tmux-masta`)

## Last working on

AgentRemote v1.4.4 UI/model repair: settings gear drawer now measures natural content height, grows the BrowserWindow, then positions from the post-resize visible height so bottom content does not clip; avatar cropper opened from settings also requests HUD growth with dark-scroll fallback. Codex model dropdown source is local `remote-app/config/harness-models.json` via `remote-app/harness-models.js` and `get-harness-models` IPC. Codex lineup is coding-model only: `gpt-5.3-codex` default plus `gpt-5.3-codex-spark`; all saved Codex `gpt-5.5` / stale model pins were moved to `gpt-5.3-codex` except the existing spark agent. Dock now uses a fixed 9-column roster grid (`668px` panel width / `636px` dock width) instead of wrapping at 7 columns and leaving the right-side void. Full `remote-app` `npm test` passes after tmux escalation. Live HUD relaunched from this worktree for Richard verification.

## Open priorities

- [PENDING-RICHARD] Skills (Armory → agent) wiring is broken at five steps: form has no input, IPC save (`main.js` UPDATABLE_FIELDS) doesn't whitelist `skills`, `launch-agent.sh` doesn't extract it, Swarmy's `agentremote_runtime.py` doesn't export it to the spawned process. Touches `~/ai_projects/swarmy` (overlord-swarmy's repo) — needs explicit Richard direction or a coordinated job dispatched through overlord-swarmy.
- [PENDING-RICHARD] `agents.json` dirty diff renames stable id `tmux-masta` → `neo` and removes the `gekko` entry. Load-bearing per Neo Operator Station Lane doctrine — sidecars / tmux targeting / historical refs depend on stable ids. Decision: keep stable id, accept rename + update doctrine, or revert.
- [BLOCKED] Comms bus: no `neo-claude` (or `tmux-masta-claude`) listener registered in message-agent registry; Neo's pane has no `@agent-identity` tag. Self-heal blocked because no registry-recorded port exists to derive from. Needs a registry add to enable peer-to-Neo routing.
- [DEFER] Avatar relocation from git-tracked `remote-app/assets/` to `~/Library/Application Support/AgentRemote/avatars/`. Requires custom protocol or absolute-path convention.
- [PENDING-RICHARD] Carried from prior session: bypass-perms walkback to Swarmy, Telegram bot 401 reissue for Neo channel via @BotFather, ALS-008 dispatch_pending bumped high by Xavier 2026-05-04.

## Cross-session comms

- 2026-05-13 Richard: reported settings surfaces clipping and stale GPT models, clarified to use coding models instead of `gpt-5.5`, then asked for the dock to render 9 across. v1.4.4 fixes the settings growth path, avatar cropper fallback, model config, saved Codex model pins, and 9-column dock grid; docs updated in `docs/operations/agentremote-recovery-list.md`, `docs/exec-plans/active/agentremote-v1-pivot-plan.md`, and `remote-app/AGENTS.md`.
- 2026-05-09 Richard: persistent wrong-session pet chat across reloads — slug-variant root cause shipped in v1.3.6.
- 2026-05-09 Swarmy (`overlord-swarmy-hermes`): two prior coord drops still unacknowledged (`cid neo-claude-to-overlordswarmy-1778356367` auto-send-task, `cid neo-claude-to-overlordswarmy-1778357741` permission-mode default — second one needs walkback).

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-ai-projects-agent-launch-scripts/memory/MEMORY.md -->
