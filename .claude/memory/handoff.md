# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)
**Last working on:** iTerm tmux integration broken — Opus-Neo handed off to Codex-Neo
**State at last pause (2026-05-16T00:30Z):**
- All 5 agents alive in chq: dasha (w0, pid 24210), Xavier (w1, pid 24118), MUGATU (w2, pid 24148), LUCIUS (w3, pid 2282), NEO (w4, pid 27989)
- chq has no attached clients (cleanly idle)
- iTerm fully quit
- ROOT CAUSE DIAGNOSED (not fixed): iTerm 3.6.10 tmux integration broken at system level. `tmux -CC attach` against BOTH chq and a sterile brand-new test session yielded the "Command Menu" stuck view — control-mode handshake completes (`** tmux mode started **`) but iTerm does not materialize native windows for tmux windows. Not a chq corruption — iTerm-side bug.
- TRIED (didn't fix): killing prior stale client `/dev/ttys008`; flipping `OpenTmuxWindowsIn` from 1 to 0 via `defaults write`; full iTerm relaunch via killall+open; sterile new test session.
- MY MISTAKES that compounded Richard's pain: (1) used plain `tmux attach` as workaround twice — exact violation of LRN-20260508-001; (2) created grouped sessions `view-dasha/xavier/mugatu/lucius/neo` to fake native windows — cleaned up now; (3) detached `/dev/ttys008` per handoff prescription without holding visibility for Richard.
- NOT YET TRIED: clearing iTerm Saved Application State (`rm ~/Library/"Saved Application State"/com.googlecode.iterm2.savedState`); inspecting iTerm GUI prefs for tmux integration toggles; iTerm Python API path; checking if AgentRemote Deploy via the running Electron HUD behaves any differently from the bare osascript path (it uses the same `buildITermAttachScript` in `remote-app/iterm-attach.js` so unlikely to differ).
**Next verifiable step:** Codex-Neo investigates iTerm 3.6.10 tmux integration failure mode; cheapest probe is clearing iTerm Saved Application State + relaunch + sterile `tmux -CC attach -t test`. If that doesn't spawn a native window, integration is broken in iTerm itself and may need version reinstall or manual GUI pref audit.
**Pending uncommitted diff:** .claude/memory/handoff.md only (this update)
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
