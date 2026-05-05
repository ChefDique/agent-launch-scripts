# Handoff — TMUX-MASTA

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote docs/repo-structure cleanup and Codex pet integration path.

**State at last pause (2026-05-05T05:36:11-0700):**
- R&D QMD retrieval found the Lucius/Codex structure direction: short `AGENTS.md`, `docs/` as system of record, and active/completed execution plans.
- `agent-launch-scripts` docs were reorganized and committed in `72c4703 Organize agent docs for AgentRemote`; branch is `main...origin/main [ahead 3]`.
- Richard installed the `hatch-pet` Codex skill at `~/.codex/skills/hatch-pet/SKILL.md`; it creates/validates Codex-compatible pet asset packs, not the AgentRemote runtime widget.
- Current Codex session is running under `Codex.app ... app-server`, not a tmux restart loop; `/done` cleanup should not kill `$PPID`.

**Next verifiable step:** Implement AgentRemote pet runtime by reading `~/.codex/pets/*/pet.json`, loading the `1536x1872` `spritesheet.webp`, and mapping voice/send/status events to the hatch-pet animation rows.

**If that step fails:** Inspect `~/.codex/skills/hatch-pet/references/codex-pet-contract.md` and `animation-rows.md`, then verify Electron can load local pet asset paths through `main.js` IPC without copying assets into `remote-app/`.

**Pending uncommitted diff:** none after `/done` handoff commit.

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

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-agent-launch-scripts/memory/MEMORY.md -->
