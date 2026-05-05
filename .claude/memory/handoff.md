# Handoff — TMUX-MASTA

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote pet companion MVP, with main functionality deferred to the next session.

**State at last pause (2026-05-05T07:40:00-0700):**
- `AGENTS.md`, `CLAUDE.md`, and `remote-app/AGENTS.md` were aligned and pushed in `768fc9d`.
- Openclaw was generated/validated as a Codex pet experiment, but Richard clarified Openclaw should eventually be a crab and that art should be handled later.
- AgentRemote was switched back to an MVP premade companion roster from `~/.codex/pets`: `goku`, `nimbus`, `gaara`, `codeberg`, and `neo`; pushed in `5d4226b`.
- Pets are companion chrome only. They do not replace agent buttons or agent identity. Current default is Goku, with `window.agentRemotePet.set('<id>')` available for later wiring.
- Current Codex session is running under `Codex.app ... app-server`, not a tmux restart loop; `/done` cleanup should not kill `$PPID`.

**Next verifiable step:** Start the next session on the main functionality: live-validate AgentRemote hold-to-talk/local STT -> `transcribe-voice` -> single-agent `broadcast-message`, then verify deploy/send behavior against a fresh `chq` session before claiming tmux/xterm reliability.

**If that step fails:** Check `remote-app/out.log`, `remote-app/main.js` IPC handlers (`transcribe-voice`, `broadcast-message`, `pane-status`, xterm pipe handlers), `/tmp/agent-remote-panes.json`, and `chq-tmux.sh` sidecar writes before changing UI.

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

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-agent-launch-scripts/memory/MEMORY.md -->
