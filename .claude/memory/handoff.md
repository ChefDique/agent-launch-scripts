# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)
**Last working on:** AgentRemote attach fix — detached windows still need resolution
**State at last pause (2026-05-15T22:50Z):**
- Fixed mugatu-claude tmux_target mismatch (d720f38, pushed)
- Broke panes layout → teams: each agent now in own tmux window
- PROBLEM: iTerm control-mode session predates break-pane ops — stale connection causes "detach everyone" when user clicks Attach in app. Fix: kill stale control-mode client, redeploy via AgentRemote Deploy button to get fresh tmux -CC attach session
- Next model: Richard wants Neo on Opus
**Next verifiable step:** Richard restarts Neo on Opus; in new session run `tmux detach-client -t /dev/ttys008` then click Deploy in AgentRemote to get fresh control-mode session
**If that step fails:** check `tmux list-clients` — if client gone already, just click Deploy
**Pending uncommitted diff:** .claude/memory/handoff.md, agents.json (pre-existing uncommitted changes from UI)
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

- [PENDING-RICHARD] Skills (Armory → agent) wiring is broken at five steps: form has no input, IPC save (`main.js` UPDATABLE_FIELDS) doesn't whitelist `skills`, `launch-agent.sh` doesn't extract it, Swarmy's `agentremote_runtime.py` doesn't export it to the spawned process. Touches `~/ai_projects/swarmy` (overlord-swarmy's repo) — needs explicit Richard direction or a coordinated job dispatched through overlord-swarmy.
- [PENDING-RICHARD] Confirm what the actual form rendering issue was (v1.4.6 scroll fix shipped but root cause unconfirmed — "horrible assumption" warning from Richard).
- [PENDING-RICHARD] bypass-perms walkback to Swarmy — prior coord drop `cid neo-claude-to-overlordswarmy-1778357741` (permission-mode default) needs acknowledgement.
- [PENDING-RICHARD] Telegram 401 reissue for Neo channel — needs @BotFather reissue. ALS-008 dispatch_pending bumped high by Xavier 2026-05-04.
- [DEFER] Avatar relocation from git-tracked `remote-app/assets/` to `~/Library/Application Support/AgentRemote/avatars/`. Requires custom protocol or absolute-path convention.

## Cross-session comms

- 2026-05-14 Richard: form showing bottom rows on open, then "now it's the top" — shipped v1.4.6 scroll reset; Richard flagged "horrible assumption" — root cause unconfirmed.
- 2026-05-14 Richard: Codex dropdown missing gpt-5.5; edit form top cut off on open. Both fixed in v1.4.5.
- 2026-05-13 Richard: settings surfaces clipping and stale GPT models; v1.4.4 fixes landed.
- 2026-05-09 Swarmy (`overlord-swarmy-hermes`): two prior coord drops still unacknowledged (`cid neo-claude-to-overlordswarmy-1778356367` auto-send-task, `cid neo-claude-to-overlordswarmy-1778357741` permission-mode default — second one needs walkback).

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-ai-projects-agent-launch-scripts/memory/MEMORY.md -->
