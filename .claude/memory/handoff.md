# Handoff — TMUX-MASTA

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote paste/deploy/pet parity fixes plus hard-coded pet/HUD cleanup inventory.

**State at last pause (2026-05-07T03:26:06-0700):**
- AgentRemote is relaunched from `/Users/richardadair/agent-launch-scripts/remote-app` at `v1.0.19`; current branch is `main` and is ahead of origin.
- Shipped local commits: `b2e473e` deploy viewer validation, `4026802` ittab deploy normalization, `aac4686` image paste into the AgentRemote input, and `6af9918` floating Codex pet parity.
- Image paste now saves clipboard images under `/tmp/agentremote-pasted-images/` and inserts `[image: /tmp/...]` tokens for tmux-compatible delivery.
- Floating pets now use centralized `PET_ATLAS` / `PET_WINDOW_GEOMETRY`, movement/release moods, compact chat bubbles, and edge-aware bubble placement above/below the character.
- Verification passed after the pet parity commit: `npm test` (`41` tests), `node --check remote-app/main.js`, and `git diff --check`.
- Read-only hard-coded-assumption inventory completed. Highest-priority cleanup targets: pet atlas metadata, mood mapping, pet geometry, duplicated chat bubble rendering, stale inline HUD pet CSS, hard-coded `richard`/`team` chat identity, and brittle static tests.
- Richard asked how painful it would be to migrate this repo under `~/ai_projects`. Verdict: doable as a planned migration, not a blind `mv`; `DESIGN.md` already names `~/ai_projects/agent-remote/` as the future home, but current live scripts/tests/docs still contain absolute `~/agent-launch-scripts` / `/Users/richardadair/agent-launch-scripts` assumptions.
- Richard asked to run `/chores` after every major task and to `/done` and restart when context is near 50%; no active goal budget is exposed by the harness, so use visible context indicators and `/done` proactively.

**Next verifiable step:** If continuing AgentRemote work, first verify live pet behavior by dragging a pet near the top and bottom screen edges. If taking the migration request next, draft and execute a small migration plan: choose final path (`~/ai_projects/agent-remote` or `~/ai_projects/agent-launch-scripts`), update path-sensitive launch scripts/tests/docs, verify AgentRemote process path and shortcut behavior, then only move/rename after `launch-remote.sh`, `session-end-cleanup.sh`, tmux launchers, and package tests pass.

**If that step fails:** For pet behavior, inspect `remote-app/out.log`, `remote-app/pet-window.html`, `remote-app/main.js` pet-window bounds events, and `remote-app/test/renderer-static.test.js`. For migration, search absolute path assumptions first (`rg '/Users/richardadair/agent-launch-scripts|~/agent-launch-scripts|agent-launch-scripts/remote-app'`) and avoid moving the live HUD until the replacement launch path is verified.

**Pending uncommitted diff:** `agents.json` only: `hidden: true` toggles for `gekko`, `openclaw-generic`, `hermes-generic`, and `codex`. Treat as AgentRemote/user visibility state; do not commit or revert without Richard's direction.

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
- 2026-05-06-SESSION_3: AgentRemote reliability/versioning closeout shipped: floating pets, registry/avatar state, stale-worktree launcher fix, session-end cleanup hook, dirty-state rules, SemVer badge `v1.0.1`, `/gogo` version/process checks, and pushed `main` through `ac52cfe` — gated on Richard: none
- 2026-05-06-SESSION_4: AgentRemote pet send/mood/chrome iteration committed locally: tmux send now submits with delayed `C-m`, pet windows resize, Codex sprite atlas rows react to move/send/review/error states, and package is `v1.0.5`; Richard's screenshot review shows the bubble UI still needs Codex-style compact/expand/reply behavior next — commits: `50d8de5` local only plus `/done` handoff commit — gated on Richard: none
- 2026-05-06-SESSION_5: Codex lifecycle skill visibility incident closed: global shared `gogo` YAML and `done` stale path fixed, prompt-input verified `gogo`/`chores`/`done`, Lucius report written and R&D coord note delivered because `claude-peers` had zero peers — commits: `1c1b12b`, R&D `521bfc2` — gated on Richard: none
- 2026-05-06-SESSION_6: AgentRemote pet/chat/tmux regression wave documented and partially repaired: pet bubble/readability, per-agent pet chat filtering, relaunch-after-cleanup rule, pet-picker scrollbar styling, dock online state corrected to pane-alive semantics, and new guardrails added against live iTerm/tmux validation mutations — commits: `f6aa1dd`, `43bad2c`, `84b9acc`, `9c0f333`, `e04e35a`, `e1dbd0b`, `3170c3c` plus `/done` closeout commits — gated on Richard: none
- 2026-05-06-SESSION_7: Deploy/headless viewer regression fixed, live `chq` iTerm control-mode viewer restored, AgentRemote `v1.0.14` relaunched, registry-driven pet/chat identity cleanup preserved, and Codex `SessionStart` `claude-mem` hook removed from active hook manifests — commits: closeout commit — gated on Richard: none
- 2026-05-07-SESSION: AgentRemote deploy validation, ittab normalization, image paste, and floating Codex pet parity shipped; hard-coded pet/HUD cleanup inventory completed; `/chores`/`done` cadence preference captured; migration-to-`~/ai_projects` request assessed as doable but path-sensitive — commits: `b2e473e`, `4026802`, `aac4686`, `6af9918` — gated on Richard: decide whether to commit or revert `agents.json` hidden-agent toggles

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-agent-launch-scripts/memory/MEMORY.md -->
