# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)
**Last working on:** AgentRemote v1.4.7 embedded xterm image-paste fix for Codex-only tmux windows.
**State at last pause (2026-05-18T18:02-0700):**
- Pushed canonical `main` clean first, then committed the registry/avatar baseline that moved the fleet snapshot to Codex-only (`c3d54f1`).
- Fixed embedded terminal paste handling in `remote-app/index.html`: host paste, Cmd/Ctrl+V, Ctrl+Shift+V, and raw xterm SYN `0x16` now route through the existing image/text paste helper instead of forwarding control garbage or silently dropping images.
- Bumped AgentRemote to `v1.4.7` in `remote-app/package.json` and `remote-app/package-lock.json`.
- Updated `remote-app/test/renderer-static.test.js` and `docs/operations/agentremote-recovery-list.md` to make the regression visible.
- Verified: `npm run test:policy`, `npm test`, `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh`, and `bash test/launch-agent-runtime.test.sh` passed in the Codex worktree.
**Next verifiable step:** After merge, relaunch canonical AgentRemote with `bash launch-remote.sh`, confirm the running Electron app path is `/Users/richardadair/ai_projects/agent-launch-scripts/remote-app`, then Richard should paste an image into an embedded terminal panel and confirm the target pane receives `[image: /tmp/... ]`.
**If that step fails:** inspect `remote-app/out.log`, verify the renderer is actually v1.4.7, and capture whether the failure path is host `paste`, custom keydown, or xterm `onData` SYN.
**Pending uncommitted diff:** AgentRemote v1.4.7 paste fix branch only; ready to commit and merge to `main`.
---

Richard reported "can't attach anyone, everyone headless." Root causes:
1. Session was deployed in `panes` layout (all agents crammed in one tmux window) instead of `teams` (one window per agent). The `panes` layout forces break-pane on every attach, causing iTerm "detached" tab instability.
2. `mugatu-claude` had no `tmux_target` — the resolver needle was "mugatu-claude" but the pane title is "MUGATU", so AgentRemote couldn't see MUGATU at all.

Fixes applied:
- Added `tmux_target: "mugatu"` to mugatu-claude registry entry (committed d720f38, pushed).
- Manually broke all shared panes out to their own windows (non-destructive, processes kept running): dasha → chq:0, Xavier → chq:1, MUGATU → chq:2, LUCIUS → chq:3, NEO → chq:4.
- Set `@chq_layout teams` on the chq session so next deploy uses teams layout.

Next: Richard should open AgentRemote and test Attach on each agent. If it still shows "detached," the iTerm control-mode client may have dropped and needs re-attach via Deploy.

## Open priorities

- [ACTIVE] AgentRemote Deploy permanent fix still pending: clear tmux `@hidden` and `@buried_indexes` before iTerm control-mode attach/deploy.
- [PENDING-RICHARD] Skills (Armory → agent) wiring is broken at five steps: form has no input, IPC save (`main.js` UPDATABLE_FIELDS) doesn't whitelist `skills`, `launch-agent.sh` doesn't extract it, Swarmy's `agentremote_runtime.py` doesn't export it to the spawned process. Touches `~/ai_projects/swarmy` (overlord-swarmy's repo) — needs explicit Richard direction or a coordinated job dispatched through overlord-swarmy.
- [PENDING-RICHARD] Confirm what the actual form rendering issue was (v1.4.6 scroll fix shipped but root cause unconfirmed — "horrible assumption" warning from Richard).
- [PENDING-RICHARD] bypass-perms walkback to Swarmy — prior coord drop `cid neo-claude-to-overlordswarmy-1778357741` (permission-mode default) needs acknowledgement.
- [PENDING-RICHARD] Telegram 401 reissue for Neo channel — needs @BotFather reissue. ALS-008 dispatch_pending bumped high by Xavier 2026-05-04.
- [DEFER] Avatar relocation from git-tracked `remote-app/assets/` to `~/Library/Application Support/AgentRemote/avatars/`. Requires custom protocol or absolute-path convention.

## Cross-session comms

- 2026-05-18 worker+planner: Codex lifecycle hook parity implemented as repo-owned hook/audit/docs. Planner merged the hook into global `~/.codex/hooks.json`; strict audit now passes with no warnings.
- 2026-05-15 Richard: AgentRemote Deploy stopped spawning iTerm native windows — diagnosed as tmux `@hidden` user option residue; runtime cleared (verified 5 native windows spawn). Code fix in `remote-app/main.js` Deploy flow still pending. Session ended badly — Richard furious from 90min of my thrashing before reading docs.
- 2026-05-14 Richard: form showing bottom rows on open, then "now it's the top" — shipped v1.4.6 scroll reset; Richard flagged "horrible assumption" — root cause unconfirmed.
- 2026-05-14 Richard: Codex dropdown missing gpt-5.5; edit form top cut off on open. Both fixed in v1.4.5.
- 2026-05-13 Richard: settings surfaces clipping and stale GPT models; v1.4.4 fixes landed.
- 2026-05-09 Swarmy (`overlord-swarmy-hermes`): two prior coord drops still unacknowledged (`cid neo-claude-to-overlordswarmy-1778356367` auto-send-task, `cid neo-claude-to-overlordswarmy-1778357741` permission-mode default — second one needs walkback).

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-ai-projects-agent-launch-scripts/memory/MEMORY.md -->
