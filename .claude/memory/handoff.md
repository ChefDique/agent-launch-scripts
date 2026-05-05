# Handoff — TMUX-MASTA

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Codex config cleanup: disabled Claude-origin plugins and set a Codex-native status line equivalent.

**State at last pause (2026-05-05T14:42:03-0700):**
- Updated `/Users/richardadair/.codex/config.toml` outside this repo so `claude-mem@thedotmack`, `quantitative-trading@claude-code-workflows`, and all configured `claude-plugins-official` plugins are disabled.
- Kept OpenAI/Codex-native plugin entries enabled, including `superpowers@openai-curated`, `github@openai-curated`, `browser-use@openai-bundled`, and `computer-use@openai-bundled`.
- Confirmed Codex does not support Claude's `statusLine.command` hook; configured the supported `[tui].status_line` list plus `terminal_title` instead.
- Verification passed: parsed `/Users/richardadair/.codex/config.toml` with `tomllib`, checked Claude-origin plugin entries are `False`, and fetched the official Codex config schema to confirm `[tui].status_line` is array-based.
- Repo code was not changed during the config cleanup; branch is `main` and remains ahead of `origin/main`.
- Current Codex session appears to be running under the desktop/app-server harness, not a proven tmux restart loop; do not blindly `kill $PPID` from this harness.

**Next verifiable step:** Start a fresh Codex session and confirm the exposed skill/plugin list no longer includes the disabled Claude-origin plugin duplicates, then visually confirm the Codex TUI status line shows model, cwd, git branch, context, tokens, limits, session, and task progress.

**If that step fails:** Inspect `/Users/richardadair/.codex/config.toml`, especially `[plugins]` and `[tui]`; if Claude-origin skills still appear, restart the Codex app/server process so plugin exposure reloads from config.

**Pending uncommitted diff:** none after the `/done` handoff commit.

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

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-agent-launch-scripts/memory/MEMORY.md -->
