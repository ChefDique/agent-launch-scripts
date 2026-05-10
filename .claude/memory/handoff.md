# Handoff — Neo (`tmux-masta`)

## Last working on

AgentRemote four-commit shipping run: v1.3.6 slug-collision fix in pet chat (cross-slug entry collection across `_→-` and preserved-`_` Claude project slug variants); expanded Codex model lineup from 2 → 7 in agent settings picker (gpt-5.5 / 5 / 5-codex / 5.1 / 5.1-codex / 5-mini / 5-nano); v1.4.0 Hermes/OpenClaw profile-name field replaces the model picker (id auto-suffixed `<profile>-hermes-tmux` / `<profile>-openclaw-tmux` to distinguish tmux pane twins from headless Telegram routes); v1.4.1 edit/create-agent modal grows the window when the form's `max-height` clamps under a 3-row roster. Test suite 94 → 108. Live HUD will pick up all four on the upcoming relaunch.

## Open priorities

- [PENDING-RICHARD] Skills (Armory → agent) wiring is broken at five steps: form has no input, IPC save (`main.js` UPDATABLE_FIELDS) doesn't whitelist `skills`, `launch-agent.sh` doesn't extract it, Swarmy's `agentremote_runtime.py` doesn't export it to the spawned process. Touches `~/ai_projects/swarmy` (overlord-swarmy's repo) — needs explicit Richard direction or a coordinated job dispatched through overlord-swarmy.
- [PENDING-RICHARD] `agents.json` dirty diff renames stable id `tmux-masta` → `neo` and removes the `gekko` entry. Load-bearing per Neo Operator Station Lane doctrine — sidecars / tmux targeting / historical refs depend on stable ids. Decision: keep stable id, accept rename + update doctrine, or revert.
- [BLOCKED] Comms bus: no `neo-claude` (or `tmux-masta-claude`) listener registered in message-agent registry; Neo's pane has no `@agent-identity` tag. Self-heal blocked because no registry-recorded port exists to derive from. Needs a registry add to enable peer-to-Neo routing.
- [DEFER] Avatar relocation from git-tracked `remote-app/assets/` to `~/Library/Application Support/AgentRemote/avatars/`. Requires custom protocol or absolute-path convention.
- [PENDING-RICHARD] Carried from prior session: bypass-perms walkback to Swarmy, Telegram bot 401 reissue for Neo channel via @BotFather, ALS-008 dispatch_pending bumped high by Xavier 2026-05-04.

## Cross-session comms

- 2026-05-09 Richard: requested skills pass-through verification + Codex model expansion + Hermes/OpenClaw profile field + modal-clip fix. Three of four shipped this session; skills wiring blocked on Swarmy coord.
- 2026-05-09 Richard: persistent wrong-session pet chat across reloads — slug-variant root cause shipped in v1.3.6.
- 2026-05-09 Swarmy (`overlord-swarmy-hermes`): two prior coord drops still unacknowledged (`cid neo-claude-to-overlordswarmy-1778356367` auto-send-task, `cid neo-claude-to-overlordswarmy-1778357741` permission-mode default — second one needs walkback).

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-ai-projects-agent-launch-scripts/memory/MEMORY.md -->
