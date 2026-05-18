# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)
**Last working on:** Codex lifecycle hook parity for `/chores` and `/done` checkpoint nudges.
**State at last pause (2026-05-18T13:45-0700):**
- Added repo-owned Codex lifecycle hook script: `scripts/codex-lifecycle-hook.sh`.
- Added audit/dry-run proof command: `scripts/audit-codex-lifecycle-hooks.sh`.
- Added docs: `docs/operations/codex-lifecycle-hooks.md`; updated `docs/operations/launch-scripts.md` and `docs/README.md`.
- Verified: hook scripts parse; completion, failure, and closeout-language dry runs emit lifecycle checkpoints; `bash scripts/audit-codex-lifecycle-hooks.sh` passes with no warnings after planner merged the global hook entries.
- Global `~/.codex/hooks.json` now references the repo-owned lifecycle hook while preserving existing self-improving and message-agent hooks.
- Existing AgentRemote `@hidden` iTerm/native-window code fix remains pending and was not touched.
**Next verifiable step:** Observe the next Codex lead completion/failure boundary and confirm the hook injects a lifecycle checkpoint in-session.
**If that step fails:** inspect the actual Codex hook event payload shape for `PostToolUse`, adjust matchers or parser fields in `scripts/codex-lifecycle-hook.sh`, then rerun the dry-run audit.
**Pending uncommitted diff:** `docs/README.md`, `docs/operations/launch-scripts.md`, `docs/operations/codex-lifecycle-hooks.md`, `scripts/codex-lifecycle-hook.sh`, `scripts/audit-codex-lifecycle-hooks.sh`, plus pre-existing unrelated `agents.json`, `graphify-out/`, and `remote-app/assets/homelander.png`.
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
