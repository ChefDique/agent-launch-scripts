# Handoff — TMUX-MASTA

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote tmux pane management reliability: draggable `MULTI` layout policy and kill-pane resolution.

**State at last pause (2026-05-05T09:40:13-0700):**
- Shipped `d46016d` so `MULTI` preserves `CHQ_LAYOUT=ittab`, Deploy defaults to draggable iTerm control-mode windows, and an existing split `chq` session can normalize into per-agent tmux windows.
- Shipped `29e4761` so status, broadcast, restart, attach, xterm, and kill share a sidecar-first pane resolver; this fixes the live case where TMUX-MASTA lights up from sidecar `%44` even though the pane title is empty.
- AgentRemote was restarted via `bash launch-remote.sh` and is running from `remote-app` as PID `83896`.
- Post-cleanup live check: no `chq` session is present, and `/tmp/agent-remote-panes.json` no longer maps `claude` to `%44`. This is consistent with the refreshed right-click kill path succeeding after AgentRemote loaded `29e4761`.
- `/tmp/agent-remote-panes.json` still has old `chq` sidecar entries for `xavier`, `gekko`, and `swarmy`, but their pane ids are not live; the shared resolver ignores them unless a matching live pane id exists.
- Richard raised the next product direction: a custom AgentRemote display streaming logs / pipe output may be cleaner than making xterm behave like the primary terminal manager. Keep tmux as the control substrate for identity, kill, restart, send, and deploy.
- Current Codex session is running under `Codex.app ... app-server`, not a tmux restart loop; `/done` cleanup should not kill `$PPID` unless a wrapper is actually proven.

**Next verifiable step:** Start a fresh small `MULTI` deploy from AgentRemote, confirm iTerm control-mode windows are draggable, then right-click kill one agent and verify the pane disappears and its sidecar entry clears without a stale light.

**If that step fails:** Check `remote-app/out.log`, `remote-app/main.js` `kill-pane` handler, `remote-app/pane-resolver.js`, `/tmp/agent-remote-panes.json`, and `tmux list-panes -s -t chq -F '#{session_name}:#{window_index}.#{pane_index}\t#{pane_id}\t#{pane_title}\t#{pane_current_command}'`.

**Pending uncommitted diff:** `.claude/memory/handoff.md` until the `/done` handoff commit lands, then none.

---

## Last working on

ALS-010 attach consolidation merged. The Attach orb is now layout-aware (silent break-pane if the agent shares a window with siblings) and the two settings-popover detach buttons are gone. AgentRemote's HUD architecture refactor (waves 1+2 + visual polish + attach consolidation) is functionally complete on main; Richard has not done end-to-end testing yet.

## Open priorities

- [DEFER] ALS-008 — per-project orchestrator (launchd plist filtered to project=agent-launch-scripts). Bumped to high by Xavier; durable fix for the dispatch friction this session (cherry-pick rescue + one worker bypassing PR path). Pick up next session.
- [PENDING-RICHARD] Telegram bot for TMUX-MASTA channel returns 401 from `getMe`. Token in `~/.claude/channels/telegram-tmux-masta/.env` is revoked or wrong. Needs reissue via @BotFather + replace token before Telegram pings work; until then status updates land in Claude Code.
- [DEFER] ALS-001/002/003 — pre-session tickets still in `dispatch_pending`; waiting on ALS-008 to unblock auto-claim. CHQ orchestrator is project-scoped to CorporateHQ.
- [DEFER] Atlas-of-Atlas-Island migration — AgentRemote product evolution moves to Atlas post-session per Xavier 2026-05-03; TMUX-MASTA retains the tmux script management lane (chq-tmux.sh, launch-agent.sh, agents.json).
- [DEFER] Cron-monitor popup, tmux command palette, layout-preset selector — Atlas-lane backlog per CLAUDE.md.

## Cross-session comms

- 2026-05-04 Xavier: filed OPS-104 (`--add-artifact` FK constraint on cross-project tasks) + OPS-105 (`--check-criterion --evidence` Phase G SyntaxError JSONB sync); bumped ALS-008 to high; per 2026-05-03 rule each lead owns their queue end-to-end.
- 2026-05-04 Richard: skip rollback; collapse 3 detach controls into one layout-aware Attach (shipped as ALS-010); reminded about the auto-restart wrapper preserving across break-pane (verified live — pane_pid stable).
- 2026-05-03 Xavier: AgentRemote product evolution moves to Atlas post-session; TMUX-MASTA keeps the tmux script lane.

## Session log

- 2026-05-05-SESSION: R&D QMD/graphify repo-structure retrieval, agent-first docs reorg, and Codex `hatch-pet` integration path identified for AgentRemote — commits: `72c4703` docs reorg plus `/done` handoff commit — gated on Richard: none
- 2026-05-05-SESSION_2: AgentRemote instructions aligned, Openclaw pet experiment completed, then MVP premade pet roster (`goku`, `nimbus`, `gaara`, `codeberg`, `neo`) bundled as companion chrome — commits: `768fc9d`, `855fa29`, `5d4226b` — gated on Richard: none
- 2026-05-05-SESSION_3: AgentRemote tmux pane management baseline fixed: `MULTI` now preserves draggable `ittab`, split sessions can normalize to per-window panes, and kill/restart/attach/broadcast/xterm now resolve panes through shared sidecar-first identity — commits: `d46016d`, `29e4761` — gated on Richard: verify right-click kill on live `%44`

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-agent-launch-scripts/memory/MEMORY.md -->
