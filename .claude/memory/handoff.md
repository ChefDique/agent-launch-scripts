# Handoff — TMUX-MASTA

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote v1 HUD polish shipped, then scoped the next thread: make per-agent Codex pets undockable/floating with chat bubbles while preserving the HUD's current free-moving/lock behavior.

**State at last pause (2026-05-06T00:52:27-0700):**
- Commit `fbf20e1` was pushed to `origin/main`: 4-harness picker, Hermes/OpenClaw SVG assets, GIF/image avatar support, harness mascot fallback, Armory import, full add/edit form reuse for right-click settings, styled scrollbars, popup close buttons, intentional hidden-agent control, per-agent pet toggles, and bundled Goku pet removal.
- Auto-restart was confirmed wired: renderer persists `auto_restart`, `main.js` loads omitted as true, and `chq-tmux.sh` pane loop re-reads `agents.json` each iteration and exits instead of respawning when `auto_restart` is false.
- Gaara was messaged via the local message-agent bus for better Hermes/OpenClaw animated logo SVGs; delivery/correlation id was `codex-to-gaara-1778046735`.
- Richard asked whether AgentRemote pets can be undockable/floating like Codex app pets and whether they can have chat. Answer: yes, with Electron limits. Use separate transparent frameless BrowserWindow pet surfaces (one per visible pet, or a shared overlay window) rather than the current inline DOM pets. Persist per-pet coordinates. Do not change AgentRemote's HUD toggle, locking, or free-moving placement semantics.
- Chat path for floating pets should reuse existing local substrates: `chat-tail-init`, `chat-tail-read`, `chat-post`, and `~/.message-agent/channels/team/messages.jsonl` for team chat; `broadcast-message` remains the pane-send path for agent-targeted messages. Pet bubbles should appear above each floating pet, stream voice/transcript/team-chat text, and include a compact reply input/button like Richard's screenshot so the user can answer directly from the bubble.
- Live click testing briefly caused the HUD to jump across displays because a temporary summon/rescue patch changed visible-but-unfocused behavior. That was backed out before commit. Next session must avoid touching the locking/free-moving behavior unless Richard explicitly asks.
- Current branch is `main`, aligned with `origin/main` after push before this `/done` handoff update.

**Next verifiable step:** Prototype floating pet windows without changing HUD movement: create a minimal transparent frameless pet BrowserWindow for one visible agent, load the same Codex pet spritesheet, allow dragging/persisted position, close/spawn from the pet button, render a chat bubble with streaming text plus reply input, and prove the main AgentRemote window stays where Richard placed it.

**If that step fails:** Check Electron transparent/frameless child-window behavior, `remote-app/out.log`, file URL loading for `~/.codex/pets/*/spritesheet.webp`, and macOS Spaces/always-on-top interactions. Fall back to a single transparent overlay BrowserWindow before touching the main HUD toggle/lock path.

**Pending uncommitted diff:** none after this `/done` handoff commit.

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

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-agent-launch-scripts/memory/MEMORY.md -->
