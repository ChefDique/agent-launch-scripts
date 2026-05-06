# Handoff — TMUX-MASTA

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Non-pet TMUX-MASTA fixes: restored `/gogo`, simplified Deploy to one movable window per agent, fixed tmux send ordering, and made launch scripts worktree-local.

**State at last pause (2026-05-06T02:56:32-0700):**
- Commit `2624436` exists on branch `codex/tmux-gogo-launch-fixes`: AgentRemote Deploy exposes only `EACH` (`CHQ_LAYOUT=ittab`), `broadcast-message` sends text and submit in one ordered tmux command sequence, agent IDs can be edited only while not running, and `chq-tmux.sh` / `launch-remote.sh` resolve paths from their own worktree.
- Global `/gogo` was restored outside this repo at `/Users/richardadair/.agents/skills/gogo/SKILL.md` and pinned in `/Users/richardadair/.codex/config.toml`; it now delegates to repo-local CHQ/R&D/trading-style `gogo` skills before falling back to the generic startup checklist.
- Verification passed: `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh`, `jq . agents.json`, `cd remote-app && npm test`, `git diff --check`, and a live tmux smoke proving `ittab` creates separate tmux windows with one pane each.
- AgentRemote was relaunched from `/Users/richardadair/.codex/worktrees/8e7d/agent-launch-scripts/remote-app` and duplicate main-checkout Electron processes were reaped. Current live process at closeout was PID `6161`.
- The main checkout `/Users/richardadair/agent-launch-scripts` still has pre-existing dirty asset/registry changes (`agents.json`, `gaara.svg` delete, `gaara.gif`, `gara.gif`, `goku.gif`). Do not overwrite or clean those without Richard.

**Next verifiable step:** Decide how to land `codex/tmux-gogo-launch-fixes` from the detached worktree, then manually exercise AgentRemote Deploy: select two agents, Deploy, confirm iTerm shows one movable control-mode window per agent, and Send submits immediately instead of leaving text in the chat inbox.

**If that step fails:** Check `remote-app/out.log`, `/tmp/agent-remote-panes.json`, `tmux show-option -t chq -v -q '@chq_layout'`, `tmux list-windows -t chq`, and whether an existing non-control-mode tmux client is attached. Use `bash launch-remote.sh` from this branch to avoid accidentally launching the dirty main checkout.

**Pending uncommitted diff:** none in this worktree after the `/done` handoff commit; global Codex config/skill edits are outside this repo.

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
- 2026-05-05-SESSION_4: Codex-first runtime support and durable docs handoff: `launch-agent.sh` now dispatches Codex/Claude/Hermes/OpenClaw by registry runtime, all local fleet entries default to Codex, ACRM `ALS-011` is `review_pending`, and `context.md` records the Codex-first/ACRM operating contract — commits: `c18f5a4`, `bfd8d95`, `6de1a43` — gated on Richard: none
- 2026-05-05-SESSION_5: Global Codex config cleanup disabled Claude-origin plugins and configured the supported Codex TUI status line equivalent; repo change is handoff-only — commits: `/done` handoff commit — gated on Richard: none
- 2026-05-05-SESSION_6: `/done` and `/chores` local skills pinned explicitly in Codex config after slash-command exposure confusion; repo change is handoff-only — commits: `/done` handoff commit — gated on Richard: none
- 2026-05-06-SESSION: AgentRemote harness/avatar/settings/Armory/pet HUD polish shipped and pushed; next thread scoped to floating undockable pet windows with streaming/reply-capable chat bubbles while preserving HUD free-move behavior — commits: `fbf20e1` pushed plus `/done` handoff commit — gated on Richard: none
- 2026-05-06-SESSION_2: TMUX-MASTA non-pet fixes shipped in a worktree: generic `/gogo` restored/pinned, AgentRemote Deploy simplified to one movable tmux/iTerm window per agent, send ordering fixed, ID edits allowed for stopped agents, and launch scripts made worktree-local — commits: `2624436` plus `/done` handoff commit — gated on Richard: decide landing path for `codex/tmux-gogo-launch-fixes`

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-agent-launch-scripts/memory/MEMORY.md -->
